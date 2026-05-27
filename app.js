// ==================== 🛠️ 關鍵參數設定區 ====================
const BACKEND_URL = 'https://stock-backend-5wk1.onrender.com'; // ⚠️ 請替換成你的 Render 後端網址 (結尾不要加斜線)
const PUBLIC_VAPID_KEY = 'BOqI-NMOQANwPM44bvi_XXkbaTaI4htRS4tooJcDD8MY6u2fJwNnnhl_RvjJNsdlXEuiodPQMzJMlhg961gJrzw';     // ⚠️ 請替換成你生成的 VAPID Public Key
// =========================================================

let configList = JSON.parse(localStorage.getItem('stockAlertConfigs')) || [];
let currentSubscription = null;

document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    renderTrackingList();
    document.getElementById('btn-add-alert').addEventListener('click', addAlertConfig);
    document.getElementById('btn-subscribe').addEventListener('click', subscribeToPush);
});

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker 註冊成功');
            // 檢查是否已有訂閱
            currentSubscription = await reg.pushManager.getSubscription();
        } catch (error) {
            console.error('Service Worker 註冊失敗:', error);
        }
    }
}

// 加入或堆疊警示門檻
function addAlertConfig() {
    const symbol = document.getElementById('stock-input').value.trim().toUpperCase();
    const period = parseInt(document.getElementById('alert-period').value);
    const type = document.getElementById('alert-type').value;
    const percent = parseFloat(document.getElementById('alert-percent').value);

    if (!symbol) return alert('請輸入股票代碼！');
    if (isNaN(percent) || percent < 0) return alert('請輸入正確的百分比門檻！');

    // 尋找是否已有該股票的監控
    let stockItem = configList.find(s => s.symbol === symbol);
    if (!stockItem) {
        stockItem = { symbol: symbol, thresholds: [] };
        configList.push(stockItem);
    }

    // 檢查有沒有重複的條件，有就更新，沒有就塞入
    const existIndex = stockItem.thresholds.findIndex(t => t.period === period && t.type === type);
    if (existIndex > -1) {
        stockItem.thresholds[existIndex].percent = percent;
    } else {
        stockItem.thresholds.push({ period, type, percent });
    }

    localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
    renderTrackingList();
    
    // 每次更新清單，自動跟雲端後端同步
    syncConfigsToBackend();

    // 清空輸入框
    document.getElementById('alert-percent').value = '';
}

// 渲染清單（支援同股票顯示多個門檻）
function renderTrackingList() {
    const listUl = document.getElementById('tracking-list');
    listUl.innerHTML = '';

    if (configList.length === 0) {
        listUl.innerHTML = '<li style="border-left:5px solid #ccc;">目前沒有設定任何監控條件</li>';
        return;
    }

    configList.forEach((stock, sIdx) => {
        const li = document.createElement('li');
        
        let tagsHtml = '';
        stock.thresholds.forEach((t, tIdx) => {
            const typeText = t.type === 'high' ? '🎯高於最高' : '📉低於最低';
            const colorClass = t.type === 'high' ? 'price-up' : 'price-down';
            tagsHtml += `
                <div class="threshold-tag">
                    ${t.period}M內 ${typeText} <span class="${colorClass}">${t.percent}%</span>
                    <span style="cursor:pointer;margin-left:5px;color:#999;" onclick="deleteThreshold(${sIdx}, ${tIdx})">×</span>
                </div>
            `;
        });

        li.innerHTML = `
            <div class="flex-between">
                <strong>📈 ${stock.symbol} ${stock.name}</strong>
                <button onclick="deleteStock(${sIdx})" style="width:auto; padding:3px 8px; margin:0; background-color:#eb4d4b; font-size:12px;">全部刪除</button>
            </div>
            <div>${tagsHtml}</div>
        `;
        listUl.appendChild(li);
    });
}

window.deleteThreshold = function(sIdx, tIdx) {
    configList[sIdx].thresholds.splice(tIdx, 1);
    if (configList[sIdx].thresholds.length === 0) {
        configList.splice(sIdx, 1);
    }
    localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
    renderTrackingList();
    syncConfigsToBackend();
};

window.deleteStock = function(sIdx) {
    configList.splice(sIdx, 1);
    localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
    renderTrackingList();
    syncConfigsToBackend();
};

// 訂閱推播
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return alert('瀏覽器不支援推播功能 😭');
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        currentSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });
        
        await syncConfigsToBackend();
        alert('✅ 雲端背景推播同步成功！即使關閉網頁，Render 也會幫你盯盤。');
    } catch (error) {
        console.error(error);
        alert('開啟推播失敗，請確認通知權限。');
    }
}

// 核心：把手機的訂閱資訊與最新的「多重門檻清單」一起打包送到後端
async function syncConfigsToBackend() {
    if (!currentSubscription) return; // 使用者還沒點啟用推播按鈕，先不跟後端同步

    try {
        await fetch(`${BACKEND_URL}/api/subscribe`, {
            method: 'POST',
            body: JSON.stringify({
                subscription: currentSubscription,
                configs: configList // 把整張自訂門檻表傳過去
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('雲端監控條件同步成功');
    } catch (error) {
        console.error('同步後端失敗:', error);
    }
}

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
