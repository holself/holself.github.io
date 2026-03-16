// ⚠️ 關鍵新增：請將這裡的網址替換為您 Hugging Face Space 的 Direct URL
// 注意：網址最後面不要加上斜線 (/)
const API_BASE_URL = "https://holself2868-credit-risk-api.hf.space";

// ── Inline error display (replaces native dialogs) ──
function showInlineError(msg) {
  let el = document.getElementById('inline-error-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'inline-error-msg';
    el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:var(--danger-bg);color:var(--danger);border:1px solid var(--danger-bd);padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ==========================================
// ── 1. 頁面導航與基礎 UI 邏輯 ──
// ==========================================
let _activePage = 'home';

function showPage(id) {
    _activePage = id;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + id);
    if (target) target.classList.add('active');
    // 更新 nav 顏色
    document.querySelectorAll('.nav-link').forEach(b => {
        b.style.color = b.id === 'nav-' + id ? 'var(--blue)' : 'var(--text-sub)';
        b.style.fontWeight = b.id === 'nav-' + id ? '600' : '500';
    });
    // Auto-run MCS simulation on first visit
    if (id === 'mcs' && !window._mcsHasRun) {
        window._mcsHasRun = true;
        setTimeout(() => runSimulation(false), 50);
    }
    window.scrollTo(0, 0);
}

function drawGauge(pct) {
    const c = document.getElementById('gauge');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height - 8, r = 88;
    
    // 底環
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); 
    ctx.lineWidth = 14; ctx.strokeStyle = '#f0f2f6'; ctx.lineCap = 'round'; ctx.stroke();
    
    // 依據四分位數上色
    const v = Math.min(Math.max(pct, 0), 100) / 100, endA = Math.PI + v * Math.PI;
    const color = pct >= 75 ? '#b30000' : pct >= 50 ? '#c87000' : pct >= 25 ? '#e6b800' : '#006b35';
    
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, endA); 
    ctx.lineWidth = 14; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
    
    // 指針
    const nx = cx + (r - 4) * Math.cos(Math.PI + v * Math.PI), ny = cy + (r - 4) * Math.sin(Math.PI + v * Math.PI);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); 
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1e2d45'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 2 * Math.PI); ctx.fillStyle = '#0066CC'; ctx.fill();
}

// ==========================================
// ── 2. 十六宮格策略文案定義 (Risk_Amount) ──
// ==========================================
const qInfo = {
    // 高風險 (>= 75%)
    'h_h': { title: '高風險 × 高金額', desc: '違約機率 ≥ 75%，餘額 ≥ 30.5萬。極高危險，資產保全，法務強勢介入。', action: '法務強勢催收' },
    'h_mh': { title: '高風險 × 中高金額', desc: '違約機率 ≥ 75%，餘額 10.1萬~30.5萬。發送存證信函，專責催收。', action: '專責法務介入' },
    'h_ml': { title: '高風險 × 中低金額', desc: '違約機率 ≥ 75%，餘額 4.5K~10.1萬。強制停卡，密集人工電話催收。', action: '停卡/電話催收' },
    'h_l': { title: '高風險 × 低金額', desc: '違約機率 ≥ 75%，餘額 < 4.5K。強制停卡，委外或全自動化催收。', action: '自動化密集催收' },
    // 中高風險 (50% ~ 75%)
    'mh_h': { title: '中高風險 × 高金額', desc: '機率 50%-75%，餘額 ≥ 30.5萬。潛在鉅額呆帳，高階專員協商重組。', action: '專人協商重組' },
    'mh_mh': { title: '中高風險 × 中高金額', desc: '機率 50%-75%，餘額 10.1萬~30.5萬。專人溫和協商分期還款。', action: '溫和協商分期' },
    'mh_ml': { title: '中高風險 × 中低金額', desc: '機率 50%-75%，餘額 4.5K~10.1萬。早期人工介入，提醒繳款。', action: '早期人工介入' },
    'mh_l': { title: '中高風險 × 低金額', desc: '機率 50%-75%，餘額 < 4.5K。系統高頻自動推播提醒。', action: '高頻系統推播' },
    // 中低風險 (25% ~ 50%)
    'ml_h': { title: '中低風險 × 高金額', desc: '機率 25%-50%，餘額 ≥ 30.5萬。大額監控，專屬客服關懷還款意願。', action: '大額客群監控' },
    'ml_mh': { title: '中低風險 × 中高金額', desc: '機率 25%-50%，餘額 10.1萬~30.5萬。常規客服電話提醒。', action: '常規電話提醒' },
    'ml_ml': { title: '中低風險 × 中低金額', desc: '機率 25%-50%，餘額 4.5K~10.1萬。一般簡訊推播。', action: '一般簡訊推播' },
    'ml_l': { title: '中低風險 × 低金額', desc: '機率 25%-50%，餘額 < 4.5K。系統常規帳單提醒。', action: '常規帳單提醒' },
    // 低風險 (< 25%)
    'l_h': { title: '低風險 × 高金額', desc: '機率 < 25%，餘額 ≥ 30.5萬。VIP/優質大戶，密切監控防範突發風險。', action: '大戶專屬維護' },
    'l_mh': { title: '低風險 × 中高金額', desc: '機率 < 25%，餘額 10.1萬~30.5萬。優質客群，正常服務。', action: '正常維護' },
    'l_ml': { title: '低風險 × 中低金額', desc: '機率 < 25%，餘額 4.5K~10.1萬。無風險徵兆，無需特別動作。', action: '觀察即可' },
    'l_l': { title: '低風險 × 低金額', desc: '機率 < 25%，餘額 < 4.5K。低活躍或無風險，不耗費資源。', action: '無需動作' }
};

function selectQuad(q) {
    document.querySelectorAll('.qc').forEach(c => c.classList.remove('active'));
    const target = document.getElementById('q-' + q);
    if (target) target.classList.add('active');
    
    const strategy = qInfo[q];
    if (strategy) {
        const titleEl = document.getElementById('qd-title');
        const descEl = document.getElementById('qd-desc');
        const actionEl = document.getElementById('qd-action');
        if(titleEl) titleEl.textContent = strategy.title;
        if(descEl) descEl.textContent = strategy.desc;
        if(actionEl) actionEl.textContent = strategy.action;
    }
}

// ==========================================
// ── 3. 雷達圖核心邏輯 (共用) ──
// ==========================================
let currentSingleRadarChart = null;
let currentModalRadarChart = null;

const radarChartOptions = {
    scales: { r: { suggestedMin: 0, suggestedMax: 100, ticks: { display: false } } },
    plugins: { legend: { display: false } },
    maintainAspectRatio: false
};

// 正規化資料 (0-100)
function normalizeRadarData(limitBal, balance, age, sex, pay0, pay2, billAmt1) {
    limitBal = Number(limitBal) || 0;
    age = Number(age) || 0;
    pay0 = Number(pay0) || 0;
    pay2 = Number(pay2) || 0;
    billAmt1 = Number(billAmt1) || 0;

    let limitRiskScore = 0;
    if (limitBal < 50000) limitRiskScore = 100;
    else if (limitBal < 140000) limitRiskScore = 66;
    else if (limitBal < 240000) limitRiskScore = 33;
    else limitRiskScore = 0;

    const ageScore = age < 30 ? 70 : (age < 50 ? 30 : 15);
    const pay0Score = Math.max(0, Math.min(((pay0 + 2) / 10) * 100, 100)); 
    const pay2Score = Math.max(0, Math.min(((pay2 + 2) / 10) * 100, 100));
    const utilRate = limitBal > 0 ? (billAmt1 / limitBal) * 100 : 0;
    const normUtil = Math.min(Math.max(isFinite(utilRate) ? utilRate : 0, 0), 150);
    const safeScore = v => (isFinite(v) && !isNaN(v)) ? v : 0;

    return [safeScore(limitRiskScore), safeScore(ageScore), safeScore(pay0Score), safeScore(pay2Score), safeScore(normUtil)];
}

// 單筆預測雷達圖
function updateSingleRadarChart(data, balance) {
    const canvas = document.getElementById('singleRadarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (currentSingleRadarChart) currentSingleRadarChart.destroy();

    const normData = normalizeRadarData(data.LIMIT_BAL, balance, data.AGE, data.SEX, data.PAY_0, data.PAY_2, data.BILL_AMT1);
    currentSingleRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['信用額度風險', '年輕客群風險', '上月繳款狀況', '二月前繳款狀況', '額度使用率'],
            datasets: [{
                label: '風險特徵',
                data: normData,
                backgroundColor: 'rgba(179, 0, 0, 0.2)',
                borderColor: '#b30000',
                pointBackgroundColor: '#b30000',
            }]
        },
        options: radarChartOptions
    });
}

// 批次 Modal 雷達圖
function updateModalRadarChart(data) {
    const canvas = document.getElementById('modalRadarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (currentModalRadarChart) currentModalRadarChart.destroy();

    const normData = normalizeRadarData(data.LIMIT_BAL, data.BALANCE, data.AGE, data.SEX, data.PAY_0, data.PAY_2, data.BILL_AMT1);
    currentModalRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['信用額度風險', '年輕客群風險', '上月繳款狀況', '二月前繳款狀況', '額度使用率'],
            datasets: [{
                label: '風險特徵',
                data: normData,
                backgroundColor: 'rgba(0, 102, 204, 0.2)', // 藍色以區分單筆
                borderColor: '#0066CC',
                pointBackgroundColor: '#0066CC',
            }]
        },
        options: radarChartOptions
    });
}

// ==========================================
// ── 4. 單筆即時預測 API 串接 ──
// ==========================================
// ── Check live model status and update badge ──
async function checkModelStatus() {
  try {
    // ⚠️ 修正：加上 API_BASE_URL
    const res = await fetch(`${API_BASE_URL}/api/status`);
    const data = await res.json();
    const isLive = data.model_loaded === true;
    const statusBadge = document.getElementById('model-status-badge');
    if (statusBadge) {
      statusBadge.className = isLive ? 'dtag live' : 'dtag';
      statusBadge.textContent = isLive ? '● LIVE MODEL' : '⚠ FALLBACK MODE';
      statusBadge.style.color = isLive ? '' : 'var(--warn)';
      statusBadge.style.borderColor = isLive ? '' : 'var(--warn-bd)';
      statusBadge.style.background = isLive ? '' : 'var(--warn-bg)';
    }
    document.querySelectorAll('.mb-live, .mb-fallback').forEach(el => {
      el.className = isLive ? 'model-badge mb-live' : 'model-badge mb-fallback';
      el.innerHTML = isLive
        ? '<span class="spin"></span> LIVE MODEL'
        : '<span>⚠</span> FALLBACK MODE';
    });
    const simBadge = document.querySelector('.mcs-header-bar span');
    if (simBadge && simBadge.textContent.includes('LIVE')) {
      simBadge.style.background = isLive ? 'var(--safe-bg)' : 'var(--warn-bg)';
      simBadge.style.color = isLive ? 'var(--safe)' : 'var(--warn)';
      simBadge.textContent = isLive ? '● LIVE SIMULATION' : '⚠ FALLBACK MODE';
    }
  } catch(e) { /* silent fail */ }
}

function checkTemporalConflict(payload) {
  const pay0 = payload.PAY_0;
  const pay2 = payload.PAY_2;
  const pay3 = payload.PAY_3;
  const pay4 = payload.PAY_4;

  const blockEl  = document.getElementById('temporal-conflict-block');
  const gaugeEl  = document.getElementById('gauge');
  const pctEl    = document.getElementById('gauge-pct');
  const badgeEl  = document.getElementById('risk-badge');
  const abarEl   = document.getElementById('abar');

  let conflictMsg = null;

  if (pay0 >= 3 && pay2 <= 0) {
    conflictMsg = `PAY_0=${pay0}（上月逾期${pay0}個月）但 PAY_2=${pay2}（2個月前正常）`;
  } else if (pay0 >= 4 && pay3 <= 0) {
    conflictMsg = `PAY_0=${pay0}（上月逾期${pay0}個月）但 PAY_3=${pay3}（3個月前正常）`;
  } else if (pay0 >= 5 && pay4 <= 0) {
    conflictMsg = `PAY_0=${pay0}（上月逾期${pay0}個月）但 PAY_4=${pay4}（4個月前正常）`;
  }

  if (conflictMsg) {
    if (blockEl) {
      blockEl.style.display = 'flex';
      blockEl.querySelector('.tcb-detail').textContent = conflictMsg;
    }
    if (gaugeEl) {
      const ctx = gaugeEl.getContext('2d');
      ctx.clearRect(0, 0, gaugeEl.width, gaugeEl.height);
    }
    if (pctEl)   { pctEl.textContent = '—'; pctEl.style.color = '#bbb'; }
    if (badgeEl) { badgeEl.className = 'rbadge'; badgeEl.textContent = '無法預測'; badgeEl.style.background='var(--gray-100)'; badgeEl.style.color='var(--text-muted)'; badgeEl.style.borderColor='var(--border)'; }
    if (abarEl)  { abarEl.className = 'abar'; abarEl.style.background='var(--gray-50)'; abarEl.style.borderColor='var(--border)'; }
    const abText = document.getElementById('ab-text');
    const abIcon = document.getElementById('ab-icon');
    if (abText) abText.textContent = '參數時序矛盾，無法計算';
    if (abIcon) { abIcon.className='fas fa-ban'; abIcon.style.color='var(--text-muted)'; }
    return true; 
  }

  if (blockEl) blockEl.style.display = 'none';
  if (pctEl)   pctEl.style.color = '';
  return false; 
}

async function updateAll() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? Number(el.value) : 0; };
    const payload = {
        LIMIT_BAL: getVal('sl-limit'), AGE: getVal('sl-age'), SEX: getVal('sl-sex'), EDUCATION: getVal('sl-edu'), MARRIAGE: getVal('sl-marriage'),
        PAY_0: getVal('sl-pay0'), PAY_2: getVal('sl-pay2'), PAY_3: getVal('sl-pay3'), PAY_4: getVal('sl-pay4'), PAY_5: getVal('sl-pay5'), PAY_6: getVal('sl-pay6'),
        BILL_AMT1: getVal('sl-bill1'), BILL_AMT2: getVal('sl-bill2'), BILL_AMT3: getVal('sl-bill3'), BILL_AMT4: getVal('sl-bill4'), BILL_AMT5: getVal('sl-bill5'), BILL_AMT6: getVal('sl-bill6'),
        PAY_AMT1: getVal('sl-payamt1'), PAY_AMT2: getVal('sl-payamt2'), PAY_AMT3: getVal('sl-payamt3'), PAY_AMT4: getVal('sl-payamt4'), PAY_AMT5: getVal('sl-payamt5'), PAY_AMT6: getVal('sl-payamt6')
    };

    const balance = Math.max(0, payload.BILL_AMT1 - payload.PAY_AMT1);

    if (checkTemporalConflict(payload)) return;

    const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    updateText('val-limit', payload.LIMIT_BAL.toLocaleString());
    updateText('val-age', payload.AGE);
    
    const valBalance = document.getElementById('val-balance');
    if(valBalance) valBalance.textContent = balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    try {
        // ⚠️ 修正：加上 API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/api/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            const prob = result.probability;
            drawGauge(prob);
            
            const pctEl = document.getElementById('gauge-pct');
            if(pctEl) pctEl.textContent = prob + '%';
            
            let riskLevel = prob >= 75 ? 'h' : (prob >= 50 ? 'mh' : (prob >= 25 ? 'ml' : 'l'));
            let amtLevel = balance >= 62242 ? 'h' : (balance >= 18550 ? 'mh' : (balance >= 745 ? 'ml' : 'l'));
            selectQuad(`${riskLevel}_${amtLevel}`);

            const badge = document.getElementById('risk-badge');
            const bar = document.getElementById('abar');
            const icon = document.getElementById('ab-icon');
            const text = document.getElementById('ab-text');
            
            if (badge && bar) {
                badge.className = 'rbadge'; bar.className = 'abar';
                if (prob < 25) {
                    badge.classList.add('rb-safe'); badge.textContent = '低違約風險';
                    bar.classList.add('ab-s'); icon.className = 'fas fa-circle-check'; icon.style.color = 'var(--safe)'; text.textContent = '評估：優質穩定';
                } else if (prob < 75) {
                    badge.classList.add('rb-warn'); badge.textContent = '中度風險區域';
                    bar.classList.add('ab-w'); icon.className = 'fas fa-triangle-exclamation'; icon.style.color = 'var(--warn)'; text.textContent = '評估：潛在邊際風險';
                } else {
                    badge.classList.add('rb-danger'); badge.textContent = '高違約風險';
                    bar.classList.add('ab-d'); icon.className = 'fas fa-circle-exclamation'; icon.style.color = 'var(--danger)'; text.textContent = '評估：高風險預警';
                }
            }
            updateSingleRadarChart(payload, balance);
            checkParamSanity(payload);
        }
    } catch (err) {
        console.error("API 連線失敗：", err);
    }
}

const _origShowPage = showPage;

document.addEventListener("DOMContentLoaded", () => {
    checkModelStatus();
    document.querySelectorAll('button.nav-link').forEach(btn => {
        btn.addEventListener('mouseenter', () => { btn.style.color = 'var(--blue)'; });
        btn.addEventListener('mouseleave', () => {
            btn.style.color = btn.id === 'nav-' + _activePage ? 'var(--blue)' : 'var(--text-sub)';
            btn.style.fontWeight = btn.id === 'nav-' + _activePage ? '600' : '500';
        });
    });

    const params = new URLSearchParams(window.location.search);
    const pg = params.get('page');
    if (pg && document.getElementById('page-' + pg)) {
        showPage(pg);
    }
    updateAll();
});

// ==========================================
// ── 5. 批次上傳、分頁與 Modal 邏輯 ──
// ==========================================
let batchDataCache = [];
let currentPage = 1;
const rowsPerPage = 20;

async function uploadCSV() {
    const fileInput = document.getElementById('csv-upload');
    const btn = document.getElementById('btn-upload');
    if (!fileInput.files.length) { showInlineError('請先選擇一個 CSV 檔案'); return; }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    btn.textContent = '批次預測中...'; 
    btn.disabled = true;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); 
        let response;
        try {
            // ⚠️ 修正：加上 API_BASE_URL
            response = await fetch(`${API_BASE_URL}/api/predict_batch`, { method: 'POST', body: formData, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
        const result = await response.json();

        if (result.success) {
            batchDataCache = result.results;
            currentPage = 1; 
            document.getElementById('modal-total-count').textContent = `(共 ${batchDataCache.length} 筆)`;
            
            renderBatchTable();
            
            document.getElementById('customer-insight').style.display = 'none';
            document.getElementById('batch-modal').style.display = 'flex';
        } else {
            showInlineError('批次預測失敗：' + result.error);
        }
    } catch (err) {
        const errMsg = err.name === 'AbortError' ? '請求超時（>60秒），請縮小檔案後重試' : '網路連線錯誤，請檢查伺服器狀態';
        showInlineError(errMsg);
    } finally {
        btn.textContent = '執行批次預測'; 
        btn.disabled = false; 
        fileInput.value = '';
    }
}

function renderBatchTable() {
    const tbody = document.getElementById('batch-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    const emptyRow = document.getElementById('batch-empty-row');
    if (!batchDataCache.length) {
        if (emptyRow) emptyRow.style.display = '';
        return;
    }
    if (emptyRow) emptyRow.style.display = 'none';

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const currentData = batchDataCache.slice(startIndex, endIndex);

    currentData.forEach((data, i) => {
        const actualIndex = startIndex + i; 
        const prob = data.PROBABILITY;
        const balance = data.BALANCE;
        let color = prob >= 75 ? 'var(--danger)' : prob >= 50 ? '#c87000' : prob >= 25 ? 'var(--warn)' : 'var(--safe)';

        let displayId = data.ID;
        if (!isNaN(displayId) && displayId !== null && displayId !== '') {
            displayId = parseInt(Number(displayId), 10);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px 16px; border-bottom: 1px solid var(--gray-100);">${displayId}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid var(--gray-100); text-align: right;">${Number(data.LIMIT_BAL).toLocaleString()}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid var(--gray-100); text-align: center;">${data.AGE}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid var(--gray-100); text-align: right; font-weight: 600; color: ${color};">${prob}%</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid var(--gray-100); text-align: right;">${balance.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid var(--gray-100); text-align: center;">
                <button onclick="showModalInsight(${actualIndex})" style="background:var(--blue-lt); border:1px solid rgba(0,102,204,0.3); color:var(--blue); padding:6px 14px; border-radius:4px; font-size:12px; font-weight: 600; cursor:pointer; transition: 0.2s;">查看特徵</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPaginationControls();
}

function renderPaginationControls() {
    const controls = document.getElementById('pagination-controls');
    if(!controls) return;
    controls.innerHTML = '';

    const totalPages = Math.ceil(batchDataCache.length / rowsPerPage);
    if (totalPages <= 1) return; 

    const createBtn = (text, isDisabled, onClickFn, isActive = false) => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.disabled = isDisabled;
        btn.onclick = onClickFn;
        let bg = isActive ? 'var(--blue)' : (isDisabled ? 'var(--gray-50)' : 'var(--white)');
        let color = isActive ? 'var(--white)' : (isDisabled ? 'var(--text-muted)' : 'var(--navy)');
        let border = isActive ? 'var(--blue)' : 'var(--border)';
        btn.style.cssText = `padding: 6px 12px; font-size: 13px; font-weight: 600; border-radius: 4px; border: 1px solid ${border}; cursor: ${isDisabled ? 'not-allowed' : 'pointer'}; background: ${bg}; color: ${color}; transition: 0.2s;`;
        return btn;
    };

    controls.appendChild(createBtn('上一頁', currentPage === 1, () => {
        currentPage--; renderBatchTable(); scrollToModalTop();
    }));

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    if (startPage > 1) {
        controls.appendChild(createBtn('1', false, () => { currentPage = 1; renderBatchTable(); scrollToModalTop(); }));
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.cssText = 'padding: 0 4px; color: var(--text-sub); font-weight: 600;';
            controls.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        controls.appendChild(createBtn(i.toString(), false, () => {
            currentPage = i; renderBatchTable(); scrollToModalTop();
        }, i === currentPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.cssText = 'padding: 0 4px; color: var(--text-sub); font-weight: 600;';
            controls.appendChild(dots);
        }
        controls.appendChild(createBtn(totalPages.toString(), false, () => { currentPage = totalPages; renderBatchTable(); scrollToModalTop(); }));
    }

    controls.appendChild(createBtn('下一頁', currentPage === totalPages, () => {
        currentPage++; renderBatchTable(); scrollToModalTop();
    }));
}

function showModalInsight(index) {
    const data = batchDataCache[index];
    if (!data) return;

    const insightArea = document.getElementById('customer-insight');
    if (insightArea) {
        insightArea.style.display = 'grid'; 
    }
    
    document.getElementById('insight-id').textContent = data.ID;
    
    let riskLevel = data.PROBABILITY >= 75 ? 'h' : (data.PROBABILITY >= 50 ? 'mh' : (data.PROBABILITY >= 25 ? 'ml' : 'l'));
    let amtLevel = data.BALANCE >= 62242 ? 'h' : (data.BALANCE >= 18550 ? 'mh' : (data.BALANCE >= 745 ? 'ml' : 'l'));
    const strategy = qInfo[`${riskLevel}_${amtLevel}`] || { title: '未定義', action: '無對應策略' };
    
    const riskColor = data.PROBABILITY >= 75 ? 'var(--danger)' : (data.PROBABILITY >= 50 ? 'var(--warn)' : (data.PROBABILITY >= 25 ? '#c87000' : 'var(--safe)'));
    const strategyEl = document.getElementById('insight-strategy');
    if (strategyEl) {
        strategyEl.innerHTML = `風險層級: <span style="color:${riskColor};font-weight:700;">${strategy.title}</span><br>建議策略: <span style="color:var(--navy)">${strategy.action}</span>`;
    }

    updateModalRadarChart(data);
    
    setTimeout(() => { 
        if (insightArea) {
            insightArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

function scrollToModalTop() {
    const scrollArea = document.getElementById('modal-scroll-area');
    if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeModal() {
    const modal = document.getElementById('batch-modal');
    if (modal) modal.style.display = 'none';
    const insight = document.getElementById('customer-insight');
    if (insight) insight.style.display = 'none';
}

function toggleNavMenu() {
  const m   = document.getElementById('nav-menu');
  const nav = document.querySelector('.topnav');
  if (!m) return;
  const isOpen = m.classList.contains('open');
  if (isOpen) {
    m.classList.remove('open');
    nav && nav.classList.remove('menu-open');
  } else {
    m.classList.add('open');
    nav && nav.classList.add('menu-open');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  function updatePagePadding() {
    const nav = document.querySelector('.topnav');
    if (!nav) return;
    const h = nav.getBoundingClientRect().height;
    document.querySelectorAll('.page.active').forEach(function (pg) {
      pg.style.paddingTop = h + 'px';
    });
  }

  document.querySelectorAll('#nav-menu .nav-link').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const m   = document.getElementById('nav-menu');
      const nav = document.querySelector('.topnav');
      if (m)   m.classList.remove('open');
      if (nav) nav.classList.remove('menu-open');
      setTimeout(updatePagePadding, 50);
    });
  });

  var hamburger = document.querySelector('.nav-hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', function () {
      setTimeout(updatePagePadding, 50);
    });
  }

  if (window.innerWidth <= 768) updatePagePadding();
  window.addEventListener('resize', updatePagePadding);
});

let mcsHistObj = null;

function runSimulation(animate) {
  const n   = parseInt(document.getElementById('sim-n').value);
  const lgd = parseFloat(document.getElementById('sim-lgd').value);
  const btn = document.getElementById('sim-btn');
  const pw  = document.getElementById('sim-prog');
  const pf  = document.getElementById('sim-prog-fill');
  const st  = document.getElementById('sim-status');
  if (animate) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> 模擬中...'; pw.style.display='block'; }
  const meanPD = 0.2214 + (lgd - 0.45) * 0.08;
  const meanEAD = 167484;
  const perClientEL = meanPD * meanEAD * lgd;
  const simStdDev = meanEAD * lgd * Math.sqrt(meanPD * (1 - meanPD));
  const results = [], batchSize = Math.max(1, Math.floor(n / 20));
  function doChunk(iter){
    for(let j=0;j<batchSize&&iter*batchSize+j<n;j++){
      const u1=Math.random(),u2=Math.random();
      results.push(perClientEL+Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)*simStdDev);
    }
    if(animate){ pf.style.width=Math.min(100,Math.round((iter+1)/20*100))+'%'; }
    if(iter<19) setTimeout(()=>doChunk(iter+1),4);
    else finalizeMCS(results,perClientEL,n,animate,btn,pw,st);
  }
  doChunk(0);
}

function finalizeMCS(results,meanLoss,n,animate,btn,pw,st){
  results.sort((a,b)=>a-b);
  const mean=results.reduce((s,v)=>s+v,0)/results.length;
  const variance=results.reduce((s,v)=>s+(v-mean)**2,0)/results.length;
  const stdDev=Math.sqrt(variance);
  const p90=results[Math.floor(n*.90)],var95=results[Math.floor(n*.95)];
  const cvar95=results.slice(Math.floor(n*.95)).reduce((s,v)=>s+v,0)/results.slice(Math.floor(n*.95)).length;
  const var99=results[Math.floor(n*.99)];
  const cvar99=results.slice(Math.floor(n*.99)).reduce((s,v)=>s+v,0)/results.slice(Math.floor(n*.99)).length;
  const buf=cvar99-mean;
  const f=v=>v.toFixed(2);
  const upd=(id,html)=>{const el=document.getElementById(id);if(el)el.innerHTML=html;};
  upd('mcs-mean',`${f(mean)}<span class="mkpi-unit"> NT$</span>`);
  upd('mcs-var95',`${f(var95)}<span class="mkpi-unit"> NT$</span>`);
  upd('mcs-cvar99',`${f(cvar99)}<span class="mkpi-unit"> NT$</span>`);
  upd('mcs-std',`${stdDev.toFixed(1)}<span class="mkpi-unit"> NT$</span>`);
  upd('mcs-buffer',`≥ ${f(buf)}<span class="mkpi-unit"> NT$</span>`);
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  s('vt-mean',`${f(mean)} NT$`);s('vt-std',`${stdDev.toFixed(2)} NT$`);s('vt-p90',`${f(p90)} NT$`);
  s('vt-var95',`${f(var95)} NT$`);s('vt-cvar95',`${f(cvar95)} NT$`);s('vt-var99',`${f(var99)} NT$`);
  s('vt-cvar99',`${f(cvar99)} NT$`);s('vt-buffer',`≥ ${f(buf)} NT$`);
  const bins=22,min=results[0],max=results[results.length-1],binW=(max-min)/bins;
  const counts=new Array(bins).fill(0),labels=[];
  for(let i=0;i<bins;i++)labels.push((min+i*binW+binW/2).toFixed(0));
  results.forEach(v=>{const bi=Math.min(Math.floor((v-min)/binW),bins-1);counts[bi]++;});
  const colors=labels.map(l=>{const lv=parseFloat(l);return lv>=var99?'rgba(179,0,0,0.85)':lv>=var95?'rgba(200,112,0,0.75)':'rgba(0,102,204,0.65)';});
  const canvas=document.getElementById('mcsHistChart');
  if(!canvas)return;
  if(mcsHistObj)mcsHistObj.destroy();
  mcsHistObj=new Chart(canvas.getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[{label:'頻率',data:counts,backgroundColor:colors,borderWidth:0,borderRadius:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`頻率: ${c.raw}次`,title:c=>`損失: ~${c[0].label} NT$`}}},scales:{x:{ticks:{font:{size:10,family:'IBM Plex Mono'},maxRotation:45},grid:{display:false}},y:{ticks:{font:{size:10}},grid:{color:'rgba(0,0,0,.05)'}}}}
  });
  if(animate){btn.disabled=false;btn.innerHTML='<i class="fas fa-play"></i> 執行模擬';pw.style.display='none';if(st){st.textContent=`✓ ${n.toLocaleString()} 次完成`;setTimeout(()=>st.textContent='',3000);}}
}

function exportBatchCSV() {
  if (!batchDataCache.length) { showInlineError('尚無預測結果可匯出'); return; }
  const headers = ['客戶ID','信用額度','年齡','違約機率(%)','欠款餘額','風險層級'];
  const rows = batchDataCache.map(d => {
    const prob = d.PROBABILITY;
    const level = prob >= 75 ? '高風險' : prob >= 50 ? '中高風險' : prob >= 25 ? '中低風險' : '低風險';
    return [d.ID, d.LIMIT_BAL, d.AGE, prob, d.BALANCE.toFixed(0), level].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = 'CRIP_batch_results_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
}

let batchSortDir = -1; 
function sortBatchByProb() {
  batchDataCache.sort((a, b) => batchSortDir * (b.PROBABILITY - a.PROBABILITY));
  batchSortDir *= -1;
  currentPage = 1;
  renderBatchTable();
}

function checkParamSanity(payload) {
  const pay0 = payload.PAY_0;
  const pay2 = payload.PAY_2;
  const pay3 = payload.PAY_3;
  const pay4 = payload.PAY_4;
  const pay5 = payload.PAY_5;
  const pay6 = payload.PAY_6;
  const allPays = [pay0, pay2, pay3, pay4, pay5, pay6];
  const maxPay  = Math.max(...allPays);
  const warningEl = document.getElementById('param-sanity-warning');
  if (!warningEl) return;

  const showErr = (msg, isRed) => {
    warningEl.style.display = 'block';
    warningEl.style.borderColor  = isRed ? 'var(--danger-bd)' : 'var(--warn-bd)';
    warningEl.style.background   = isRed ? 'var(--danger-bg)' : 'var(--warn-bg)';
    warningEl.style.color        = isRed ? 'var(--danger)'    : 'var(--warn)';
    warningEl.innerHTML = msg;
  };

  if (maxPay >= 4) {
    showErr(`⚠ <strong>不合實務警示：</strong>逾期 ${maxPay} 個月在真實銀行授信中不應存在——帳戶逾期 2~3 個月即應強制停卡或核銷。此為資料集邊界值（訓練樣本 &lt;0.5%），預測結果不具實務參考意義。`, true);
    return;
  }

  if (pay0 >= 2 && pay2 <= -1) {
    showErr(`⚠ <strong>時序異常：</strong>PAY_0=${pay0}（上月逾期${pay0}個月）但 PAY_2=${pay2}（2個月前溢繳）。<br>在30,000筆資料中此組合僅 ${pay0===2 ? '少數' : '0'} 筆，預測結果僅供參考。`, false);
    return;
  }

  const severeCount = allPays.filter(p => p >= 3).length;
  if (severeCount >= 2) {
    showErr(`⚠ <strong>參數提示：</strong>${severeCount} 個月份逾期≥3個月，此客戶在實務上應已進入強制停卡或法務催收程序。`, false);
    return;
  }

  warningEl.style.display = 'none';
}
