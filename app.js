// ==================== 🛠️ 關鍵參數設定區 ====================
const BACKEND_URL = 'https://stock-backend-5wk1.onrender.com'; // ⚠️ Render 後端網址
const PUBLIC_VAPID_KEY = 'BOqI-NMOQANwPM44bvi_XXkbaTaI4htRS4tooJcDD8MY6u2fJwNnnhl_RvjJNsdlXEuiodPQMzJMlhg961gJrzw'; // ⚠️ VAPID Public Key
// =========================================================

let configList = JSON.parse(localStorage.getItem('stockAlertConfigs')) || [];
let currentSubscription = null;

// 當網頁載入完成後執行
document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    renderTrackingList();
    
    // 安全綁定按鈕事件 (對齊 HTML 中的 ID)
    const btnAddAlert = document.getElementById('btn-add-alert');
    if (btnAddAlert) btnAddAlert.addEventListener('click', addAlertConfig);
    
    const btnSubscribe = document.getElementById('btn-subscribe');
    if (btnSubscribe) btnSubscribe.addEventListener('click', subscribeToPush);
    
    const btnSearch = document.getElementById('btn-search-stock');
    if (btnSearch) btnSearch.addEventListener('click', searchStockPrice);
});

// 註冊 Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker 註冊成功');
            currentSubscription = await reg.pushManager.getSubscription();
        } catch (error) {
            console.error('Service Worker 註冊失敗:', error);
        }
    }
}

// ==================== 🔍 即時股價查詢功能 ====================
async function searchStockPrice() {
    const stockInputEl = document.getElementById('stock-input');
    const resultDiv = document.getElementById('search-result'); 
    
    if (!stockInputEl || !stockInputEl.value.trim()) {
        alert('請輸入股票代號！');
        return;
    }

    const stockId = stockInputEl.value.trim();

    if (resultDiv) {
        resultDiv.innerHTML = '<div style="color: #666; margin: 10px 0;">🔍 正在連線雲端爬取即時股價...</div>';
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/stock?id=${stockId}`);
        
        if (!response.ok) {
            throw new Error('找不到該股票資料或後端伺服器錯誤');
        }

        const data = await response.json();
        
        if (resultDiv && data) {
            resultDiv.innerHTML = `
                <div style="background: #f0f7ff; padding: 12px; border-radius: 8px; margin: 10px 0; border-left: 5px solid #007bff; text-align: left; font-size: 14px; line-height: 1.6;">
                    <strong style="font-size: 15px; color: #333;">📈 查詢結果：</strong><br>
                    <span style="color: #555;">股票名稱：</span> <strong>${data.name || '未命名'}</strong> (${stockId})<br>
                    <span style="color: #555;">目前股價：</span> <strong style="color: #eb4d4b; font-size: 16px;">${data.price || '讀取失敗'}</strong> 元<br>
                    <span style="color: #555;">歷史高點：</span> <span style="color: #2ecc71; font-weight: bold;">${data.high || '無資料'}</span> 元
                </div>
            `;
        }
    } catch (error) {
        console.error('查詢失敗:', error);
        if (resultDiv) {
            resultDiv.innerHTML = `<div style="color: #eb4d4b; margin: 10px 0; font-size: 14px;">❌ 查詢失敗：${error.message}</div>`;
        }
    }
}

// ==================== ➕ 新增監控設定 ====================
async function addAlertConfig() {
    // 精準對齊 HTML 的 ID
    const stockId = document.getElementById('stock-input').value.trim();
    const period = document.getElementById('period').value;
    const percent = document.getElementById('percent').value.trim();

    if (!stockId || !percent) {
        alert('請填寫股票代號與回檔跌幅比例！');
        return;
    }

    alert('正在向雲端確認股票資訊並同步至監控清單...');

    try {
        const response = await fetch(`${BACKEND_URL}/api/stock?id=${stockId}`);
        let stockName = '未命名股票';
        if (response.ok) {
            const data = await response.json();
            stockName = data.name || stockName;
        }

        const newConfig = {
            id: Date.now().toString(),
            stockId: stockId,
            stockName: stockName,
            period: period,
            percent: parseFloat(percent)
        };

        configList.push(newConfig);
        localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
        
        renderTrackingList();
        await syncConfigsToBackend(); 

        // 成功後清空輸入框
        document.getElementById('stock-input').value = '';
        document.getElementById('percent').value = '';
        if (document.getElementById('search-result')) {
            document.getElementById('search-result').innerHTML = '';
        }
        
        alert(`✅ 成功將 [${stockName}] 加入雲端監控清單！`);
    } catch (error) {
        console.error(error);
        alert('加入失敗，請確認網路連線或後端狀態。');
    }
}

// ==================== 📋 渲染追蹤清單畫面 ====================
function renderTrackingList() {
    const listContainer = document.getElementById('tracking-list');
    if (!listContainer) return;

    if (configList.length === 0) {
        listContainer.innerHTML = '<p style="color: #999; text-align: center; margin-top: 10px;">目前沒有監控中的股票</p>';
        return;
    }

    const periodMapping = { "1": "1個月", "3": "3個月", "6": "6個月", "12": "12個月" };

    listContainer.innerHTML = configList.map(config => {
        const periodText = periodMapping[config.period] || (config.period + "個月");
        return `
            <li>
                <div class="flex-between">
                    <div>
                        <strong style="font-size: 16px; color: #2c3e50;">${config.stockName} (${config.stockId})</strong>
                        <div style="margin-top: 5px;">
                            <span class="threshold-tag">📈 觀測範圍：${periodText}內最高點</span>
                            <span class="threshold-tag" style="color: #eb4d4b; background: #ffeaa7;">📉 目標跌幅：-${config.percent}%</span>
                        </div>
                    </div>
                    <button onclick="deleteConfig('${config.id}')" style="width: auto; background: #eb4d4b; color: white; border: none; padding: 6px 12px; border-radius: 4px; margin: 0; font-size: 14px;">刪除</button>
                </div>
            </li>
        `;
    }).join('');
}

// ==================== 🗑️ 刪除監控項目 ====================
async function deleteConfig(id) {
    configList = configList.filter(config => config.id !== id);
    localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
    renderTrackingList();
    await syncConfigsToBackend(); 
}

// ==================== 🔔 啟用推播 ====================
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('此瀏覽器或裝置不支援背景推播通知。');
        return;
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        currentSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });
        
        await syncConfigsToBackend();
        alert('✅ 雲端背景推播同步成功！');
    } catch (error) {
        console.error(error);
        alert('開啟推播失敗，請確認通知權限。');
    }
}

// ==================== ☁️ 同步設定到後端 ====================
async function syncConfigsToBackend() {
    if (!currentSubscription) return; 

    try {
        await fetch(`${BACKEND_URL}/api/subscribe`, {
            method: 'POST',
            body: JSON.stringify({
                subscription: currentSubscription,
                configs: configList 
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('雲端監控條件同步成功');
    } catch (error) {
        console.error('同步後端失敗:', error);
    }
}

// 輔助函數：轉換 VAPID Key 格式
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
