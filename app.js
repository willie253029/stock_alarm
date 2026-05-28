辛苦了！我看過你最新上傳的 HTML 截圖了，這完全不是你的問題，是因為我們前面的討論中，輸入框的 ID 有時用 stock-input，有時用 stock-id，導致 JavaScript 抓不到你畫面上的元件，所以才會產生錯誤。

我已經完全根據你截圖裡的 HTML 代碼（確認了 stock-id、btn-search-stock、search-result、fall-percentage、alert-time 等精確名稱），幫你重新寫好這份一體成型、保證不會抓錯 ID 的 app.js。

此外，我幫所有的按鈕綁定都加了「安全檢查」，就算你的 HTML 不小心漏了某個按鈕，整個網頁也不會當機。

🛠️ 最終整合版：完全對齊你 HTML 的 app.js
請把 app.js 裡面的內容全部刪除，直接貼上以下這段程式碼並存檔即可：

JavaScript
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
    
    // 安全綁定按鈕事件 (如果有這個按鈕才綁定，避免報錯)
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
    // 對齊截圖：獲取 id="stock-id" 的值
    const stockIdInput = document.getElementById('stock-id');
    const resultDiv = document.getElementById('search-result'); 
    
    if (!stockIdInput || !stockIdInput.value.trim()) {
        alert('請輸入股票代號！');
        return;
    }

    const stockId = stockIdInput.value.trim();

    if (resultDiv) {
        resultDiv.innerHTML = '<span style="color: #666;">🔍 正在連線雲端爬取即時股價...</span>';
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/stock?id=${stockId}`);
        
        if (!response.ok) {
            throw new Error('找不到該股票資料或後端伺服器錯誤');
        }

        const data = await response.json();
        
        if (resultDiv && data) {
            resultDiv.innerHTML = `
                <div style="background: #f0f7ff; padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 5px solid #007bff;">
                    <strong style="font-size: 1.1em; color: #333;">📈 查詢結果：</strong><br>
                    <span style="color: #555;">股票名稱：</span> <strong>${data.name || '未命名'}</strong> (${stockId})<br>
                    <span style="color: #555;">目前股價：</span> <strong style="color: #d9534f; font-size: 1.2em;">${data.price || '讀取失敗'}</strong> 元<br>
                    <span style="color: #555;">歷史高點：</span> <span style="color: #28a745;">${data.high || '無資料'}</span> 元
                </div>
            `;
        }
    } catch (error) {
        console.error('查詢失敗:', error);
        if (resultDiv) {
            resultDiv.innerHTML = `<span style="color: #d9534f;">❌ 查詢失敗：${error.message}，請確認代號是否正確。</span>`;
        }
    }
}

// ==================== ➕ 新增監控設定 ====================
async function addAlertConfig() {
    // 對齊截圖：精準抓取對應 ID 的值
    const stockId = document.getElementById('stock-id').value.trim();
    const fallPercentage = document.getElementById('fall-percentage').value.trim();
    const alertTime = document.getElementById('alert-time').value;

    if (!stockId || !fallPercentage || !alertTime) {
        alert('請填寫完整監控資訊！');
        return;
    }

    alert('正在跟後端確認股票名稱並加入清單...');

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
            fallPercentage: parseFloat(fallPercentage),
            alertTime: alertTime
        };

        configList.push(newConfig);
        localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
        
        renderTrackingList();
        await syncConfigsToBackend(); 

        // 加入成功後清空輸入框
        document.getElementById('stock-id').value = '';
        document.getElementById('fall-percentage').value = '';
        
        alert(`✅ 成功將 [${stockName}] 加入監控清單！`);
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
        listContainer.innerHTML = '<p style="color: #999; text-align: center;">目前沒有監控中的股票</p>';
        return;
    }

    listContainer.innerHTML = configList.map(config => `
        <div class="card" style="border: 1px solid #ddd; padding: 12px; margin-bottom: 10px; border-radius: 8px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 1.1em;">${config.stockName} (${config.stockId})</strong>
                    <div style="font-size: 0.9em; color: #666; margin-top: 4px;">
                        📉 當低於歷史高點達到：<span style="color: #d9534f; font-weight: bold;">${config.fallPercentage}%</span><br>
                        ⏰ 檢查時間：<span style="color: #007bff;">${config.alertTime}</span>
                    </div>
                </div>
                <button onclick="deleteConfig('${config.id}')" style="background: #d9534f; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">刪除</button>
            </div>
        </div>
    `).join('');
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
