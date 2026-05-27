// 初始化時讀取 Local Storage 的追蹤清單
let watchlist = JSON.parse(localStorage.getItem('stock_watchlist')) || [];

// 要求推播通知權限
function requestNotificationPermission() {
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

// 模擬搜尋與取得股價 (未來這裡要換成真實 API)
function searchStock() {
    requestNotificationPermission(); // 順便要求通知權限
    
    const stockId = document.getElementById('stockInput').value.trim();
    if (!stockId) return alert("請輸入股票代號");

    // 模擬 API 回傳結果
    const mockPrice = (Math.random() * 50 + 10).toFixed(2); 
    
    const stockData = {
        id: stockId,
        price: mockPrice,
        alertDrop: 8 // 預設跌幅提醒 8%
    };

    // 加入清單並儲存
    const existingIndex = watchlist.findIndex(s => s.id === stockId);
    if(existingIndex === -1) {
        watchlist.push(stockData);
    } else {
        watchlist[existingIndex] = stockData;
    }
    
    saveAndRender();
    
    document.getElementById('searchResult').innerText = `${stockId} 目前模擬報價：$${mockPrice}`;
    
    // 模擬檢查是否觸發提醒 (假裝剛好觸發了)
    checkAlerts(stockId, mockPrice);
}

// 渲染追蹤清單畫面
function saveAndRender() {
    localStorage.setItem('stock_watchlist', JSON.stringify(watchlist));
    const listDiv = document.getElementById('watchlist');
    listDiv.innerHTML = "";

    watchlist.forEach((stock, index) => {
        listDiv.innerHTML += `
            <div class="stock-item">
                <div>
                    <strong>${stock.id}</strong> <br>
                    <span class="alert-text">當下跌超過 ${stock.alertDrop}% 時提醒</span>
                </div>
                <div>
                    $${stock.price}
                    <button onclick="removeStock(${index})" style="background: #f44336; padding: 5px; width: auto; margin-left: 10px;">刪除</button>
                </div>
            </div>
        `;
    });
}

function removeStock(index) {
    watchlist.splice(index, 1);
    saveAndRender();
}

// 發送手機通知的邏輯
function checkAlerts(stockId, currentPrice) {
    // 這裡僅作為概念展示：假設我們判定它下跌了
    if (Notification.permission === "granted") {
        new Notification("📉 股價提醒", {
            body: `${stockId} 已經達到您設定的提醒條件 (模擬測試)，請評估是否加倉！`,
            icon: "./icon-192.png"
        });
    }
}

// 網頁載入時先渲染一次
window.onload = saveAndRender;

// 將這段函式加入你的 app.js 中

const publicVapidKey = '你的_PUBLIC_VAPID_KEY'; // 填入與後端相同的 Public Key

// 將 Base64 字串轉換為 UInt8Array
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

// 訂閱推播並發送給後端
async function subscribeToPush() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // 向瀏覽器申請推播訂閱
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });

            // 將訂閱資訊發送給你的 Node.js 伺服器 (假設你的伺服器網址為 https://your-backend.com)
            await fetch('https://你的後端伺服器網址.com/api/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: { 'Content-Type': 'application/json' }
            });

            alert('✅ 成功開啟背景推播提醒！');
        } catch (error) {
            console.error('推播訂閱失敗:', error);
        }
    }
}