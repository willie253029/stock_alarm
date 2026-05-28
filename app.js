// ==================== 🛠️ 關鍵參數設定區 ====================
const BACKEND_URL = 'https://stock-backend-5wk1.onrender.com'; // ⚠️ 請替換成你的 Render 後端網址 (結尾不要加斜線)
const PUBLIC_VAPID_KEY = 'BOqI-NMOQANwPM44bvi_XXkbaTaI4htRS4tooJcDD8MY6u2fJwNnnhl_RvjJNsdlXEuiodPQMzJMlhg961gJrzw'; // ⚠️ 請替換成你生成的 VAPID Public Key
// =========================================================

let configList = JSON.parse(localStorage.getItem('stockAlertConfigs')) || [];
let currentSubscription = null;

document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    renderTrackingList(); // 初始化時渲染追蹤清單
    document.getElementById('btn-add-alert').addEventListener('click', addAlertConfig);
    document.getElementById('btn-subscribe').addEventListener('click', subscribeToPush);
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

// 新增監控設定 (核心改版：自動抓取股票名稱、改為低於歷史高點 % 邏輯、保留時間功能)
async function addAlertConfig() {
    const stockId = document.getElementById('stock-id').value.trim();
    const fallPercentage = document.getElementById('fall-percentage').value.trim();
    const alertTime = document.getElementById('alert-time').value;

    // 基礎欄位驗證
    if (!stockId || !fallPercentage || !alertTime) {
        alert('請完整填寫所有欄位（股票代號、成數/百分比、提醒時間）！');
        return;
    }

    try {
        // ✨【關鍵步驟】向後端 API 查詢該股票的名稱與歷史高點資料
        // 備註：後端 server.js 需配合提供此 API 端點
        const response = await fetch(`${BACKEND_URL}/api/stock-info?stockId=${stockId}`);
        if (!response.ok) throw new Error('後端回傳錯誤或找不到該股票');
        
        const stockData = await response.json(); 
        // 預期後端會回傳物件，例如：{ stockId: "2330", stockName: "台積電", ath: 1000 }
        const stockName = stockData.stockName || '未命名股票';

        // 檢查清單中是否已經重複加入
        if (configList.some(item => item.stockId === stockId)) {
            alert('此股票已在監控清單中！');
            return;
        }

        // 建立符合新邏輯的設定物件 (內含 stockName)
        const newConfig = {
            id: Date.now().toString(),
            stockId: stockId,
            stockName: stockName,           // ✨ 成功存入股票名稱
            fallPercentage: parseFloat(fallPercentage), // 使用者自訂低於高點的百分比 (例如輸入 10 代表低於 10%)
            alertTime: alertTime           // 使用者自訂的提醒檢查時間 (例如 "13:30")
        };

        configList.push(newConfig);
        localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
        
        renderTrackingList();         // 更新 App 畫面顯示
        await syncConfigsToBackend(); // 將新清單同步到 Render 雲端後端
        
        // 清空 UI 輸入框
        document.getElementById('stock-code').value = '';
        document.getElementById('fall-percentage').value = '';
    } catch (error) {
        console.error('獲取股票資訊失敗:', error);
        alert('無法取得股票名稱。請確認輸入的代號正確，且 Render 後端已啟動！');
    }
}

// 渲染前端追蹤清單畫面 (完美顯示股票名稱)
function renderTrackingList() {
    const listContainer = document.getElementById('tracking-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';

    if (configList.length === 0) {
        listContainer.innerHTML = '<p style="color: #888; text-align: center; margin-top: 20px;">目前沒有監控中的股票。</p>';
        return;
    }

    configList.forEach(config => {
        const item = document.createElement('div');
        item.className = 'alert-item';
        // 簡單加上外觀樣式讓它像個 App 清單卡片
        item.style = 'border: 1px solid #e0e0e0; padding: 12px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';
        
        // ✨【畫面顯示】在這裡將股票代號與名稱（config.stockName）一同呈現在介面上
        item.innerHTML = `
            <div>
                <strong style="font-size: 1.1em; color: #333;">📊 ${config.stockId} ${config.stockName}</strong><br>
                <span style="font-size: 0.9em; color: #666; display: inline-block; margin-top: 4px;">
                    📉 條件：比歷史最高點低 <strong>${config.fallPercentage}%</strong> 時通知<br>
                    ⏰ 時間：每日 <strong>${config.alertTime}</strong> 執行檢查
                </span>
            </div>
            <button onclick="deleteConfig('${config.id}')" style="background-color: #ff4d4d; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">刪除</button>
        `;
        listContainer.appendChild(item);
    });
}

// 刪除監控設定
async function deleteConfig(id) {
    configList = configList.filter(item => item.id !== id);
    localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
    renderTrackingList();
    await syncConfigsToBackend();
}

// 啟用推播與權限向手機申請
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('此裝置或瀏覽器不支援雲端推播功能。');
        return;
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        currentSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });
        
        await syncConfigsToBackend();
        alert('✅ 雲端背景推播同步成功！Render 後端將在指定時間為您盯盤。');
    } catch (error) {
        console.error('訂閱推播失敗:', error);
        alert('開啟推播失敗，請檢查手機的通知權限設定。');
    }
}

// 把最新的監控清單（含股票名稱）打包同步給後端
async function syncConfigsToBackend() {
    if (!currentSubscription) return; // 若使用者未點擊啟用推播，先不上傳

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

// 全域刪除函數绑定給 window 物件，確保 HTML 的 onclick 可以順利觸發
window.deleteConfig = deleteConfig;

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