// ==================== 🛠️ 關鍵參數設定區 ====================
const BACKEND_URL = 'https://stock-backend-5wk1.onrender.com'; // ⚠️ 請替換成你的 Render 後端網址 (結尾不要加斜線 /)
const PUBLIC_VAPID_KEY = 'BOqI-NMOQANwPM44bvi_XXkbaTaI4htRS4tooJcDD8MY6u2fJwNnnhl_RvjJNsdlXEuiodPQMzJMlhg961gJrzw';     // ⚠️ 請替換成你生成的 VAPID Public Key
// =========================================================

let currentSearchSymbol = '';
let currentSearchPrice = null;
let trackingStocks = JSON.parse(localStorage.getItem('trackingStocks')) || [];

// 頁面載入完成後執行
document.addEventListener('DOMContentLoaded', () => {
    // 註冊 Service Worker
    registerServiceWorker();
    // 渲染已儲存的追蹤清單
    renderTrackingList();

    // 綁定按鈕事件
    document.getElementById('btn-search').addEventListener('click', searchStock);
    document.getElementById('btn-add-list').addEventListener('click', addToTrackingList);
    document.getElementById('btn-subscribe').addEventListener('click', subscribeToPush);
});

// 1. 註冊 Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker 註冊成功');
        } catch (error) {
            console.error('Service Worker 註冊失敗:', error);
        }
    }
}

// 2. 查詢股價 (透過你的 Render 後端轉接，確保 Fugle 金鑰安全)
async function searchStock() {
    const symbol = document.getElementById('stock-input').value.trim().toUpperCase();
    const resultDiv = document.getElementById('search-result');
    const addBtn = document.getElementById('btn-add-list');
    
    if (!symbol) return alert('請輸入股票代碼！');

    resultDiv.innerHTML = '🔍 查詢中...';
    addBtn.style.display = 'none';

    try {
        // 向你的後端請求股價 (後端需要實作 /api/price/:symbol 路由，詳見文末補充)
        const response = await fetch(`${BACKEND_URL}/api/price/${symbol}`);
        const data = await response.json();

        if (data && data.price) {
            currentSearchSymbol = symbol;
            currentSearchPrice = data.price;
            resultDiv.innerHTML = `代號 <strong>${symbol}</strong> 目前股價: <span class="price-up">${data.price}</span> 元`;
            addBtn.style.display = 'block';
        } else {
            resultDiv.innerHTML = '❌ 找不到該股票資料或非盤中時間';
        }
    } catch (error) {
        console.error('查詢失敗:', error);
        resultDiv.innerHTML = '❌ 連線後端伺服器失敗';
    }
}

// 3. 加入追蹤清單
function addToTrackingList() {
    if (!currentSearchSymbol || !currentSearchPrice) return;

    if (trackingStocks.some(s => s.symbol === currentSearchSymbol)) {
        return alert('該股票已在追蹤清單中！');
    }

    trackingStocks.push({ symbol: currentSearchSymbol, price: currentSearchPrice });
    localStorage.setItem('trackingStocks', JSON.stringify(trackingStocks));
    renderTrackingList();
    alert(`成功將 ${currentSearchSymbol} 加入追蹤清單！`);
}

// 4. 渲染追蹤清單
function renderTrackingList() {
    const listUl = document.getElementById('tracking-list');
    listUl.innerHTML = '';

    if (trackingStocks.length === 0) {
        listUl.innerHTML = '<li style="border-left:5px solid #ccc;">目前沒有追蹤的股票</li>';
        return;
    }

    trackingStocks.forEach((stock, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><strong>${stock.symbol}</strong></span>
            <span>基準價: <unknown class="price-up">${stock.price}</unknown> 元</span>
            <button onclick="deleteStock(${index})" style="width:auto; padding:5px 10px; margin:0; background-color:#eb4d4b;">刪除</button>
        `;
        listUl.appendChild(li);
    });
}

// 5. 刪除追蹤股票 (綁定在 window 方便 html 內聯呼叫)
window.deleteStock = function(index) {
    trackingStocks.splice(index, 1);
    localStorage.setItem('trackingStocks', JSON.stringify(trackingStocks));
    renderTrackingList();
};

// 6. 訂閱背景推播功能
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return alert('您的瀏覽器或裝置不支援此推播功能 😭');
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        
        // 申請推播憑證
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });

        // 將手機的手牌（Subscription）傳給 Render 後端
        const res = await fetch(`${BACKEND_URL}/api/subscribe`, {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            alert('✅ 成功開啟背景推播提醒！不論關閉網頁或關機，條件觸發時手機都會收到通知。');
        } else {
            alert('❌ 後端儲存訂閱失敗');
        }
    } catch (error) {
        console.error('推播訂閱失敗:', error);
        alert('❌ 開啟推播失敗，請確認是否允許了通知權限。');
    }
}

// 輔助工具：Base64 轉 Uint8Array (推播專用)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}