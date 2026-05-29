// ==================== 🛠️ 關鍵參數設定區 ====================
const BACKEND_URL = 'https://stock-backend-5wk1.onrender.com'; // ⚠️ 請確保替換成您的 Render 後端網址 (結尾不要加斜線)
const PUBLIC_VAPID_KEY = 'BOqI-NMOQANwPM44bvi_XXkbaTaI4htRS4tooJcDD8MY6u2fJwNnnhl_RvjJNsdlXEuiodPQMzJMlhg961gJrzw'; // ⚠️ 請替換成您生成的 VAPID Public Key
// =========================================================

let configList = JSON.parse(localStorage.getItem('stockAlertConfigs')) || [];
let currentSubscription = null;

// 當網頁載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    renderTrackingList();
    
    const btnAddAlert = document.getElementById('btn-add-alert');
    if (btnAddAlert) btnAddAlert.addEventListener('click', addAlertConfig);
    
    const btnSubscribe = document.getElementById('btn-subscribe');
    if (btnSubscribe) btnSubscribe.addEventListener('click', subscribeToPush);
    
    const btnSearch = document.getElementById('btn-search-stock');
    if (btnSearch) btnSearch.addEventListener('click', searchStockPrice);
});

// 1. 註冊 PWA Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker 註冊成功');
            // 檢查是否已有現存的雲端推播訂閱
            currentSubscription = await reg.pushManager.getSubscription();
            updateSubscribeButtonUI();
        } catch (error) {
            console.error('Service Worker 註冊失敗:', error);
        }
    }
}

// 2. 即時查詢目前股價 (與後端結合)
async function searchStockPrice() {
    const stockInput = document.getElementById('stock-code');
    const periodSelect = document.getElementById('period');
    const resultDiv = document.getElementById('search-result');
    if (!stockInput || !resultDiv || !periodSelect) return;
    
    const code = stockInput.value.trim().toUpperCase();
    const period = periodSelect.value;
    if (!code) {
        alert('請輸入股票代碼！');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">正在連線伺服器抓取即時數據...</div>';
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/stock/${code}?period=${period}`);
        if (!response.ok) throw new Error('伺服器回傳錯誤或找不到該股票代號');
        const data = await response.json();
        
        resultDiv.innerHTML = `
            <div class="info-box">
                <strong>📊 查詢結果 [${data.symbol}]</strong><br>
                最新成交價：<span style="color: #2980b9; font-size: 18px; font-weight: bold;">$${data.currentPrice.toFixed(2)}</span><br>
                
            </div>
        `;
    } catch (error) {
        console.error(error);
        resultDiv.innerHTML = `<div class="error-box">❌ 查詢失敗：${error.message}</div>`;
    }
}

// 3. 新增回檔策略監控條件
async function addAlertConfig() {
    const stockCodeInput = document.getElementById('stock-code');
    const periodSelect = document.getElementById('period');
    const percentInput = document.getElementById('percent');
    
    if (!stockCodeInput || !periodSelect || !percentInput) return;
    
    const stockCode = stockCodeInput.value.trim().toUpperCase();
    const period = periodSelect.value;
    const percent = parseFloat(percentInput.value);
    
    if (!stockCode) {
        alert('請輸入股票代碼！');
        return;
    }
    if (isNaN(percent) || percent <= 0) {
        alert('請輸入正確的回檔百分比門檻（必須大於 0）！');
        return;
    }

    //新增
    let name = '未知股票';
    try {
        console.log("準備請求的完整網址:", `${BACKEND_URL}/api/stock/${stockCode}`); //新增
        const response = await fetch(`${BACKEND_URL}/api/stock/${stockCode}`);
        if (response.ok) {
            const data = await response.json();
            name = data.name || '未知股票'; // 成功拿到後端 server 讀取的 name
        }
    } catch (error) {
        console.error('前端獲取股票名稱失敗:', error);
    }
    
    // 檢查是否有完全重複的條件
    const isDuplicate = configList.some(item => item.stockCode === stockCode && item.period === period && item.percent === percent);
    if (isDuplicate) {
        alert('相同的抄底監控條件已經存在清單中囉！');
        return;
    }
    
    // 封裝標準結構
    const newConfig = {
        id: Date.now().toString(),
        stockCode,
        name,
        period,
        percent
    };
    
    configList.push(newConfig);
    localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
    
    renderTrackingList();
    await syncConfigsToBackend();
    
    // 清空輸入框
    stockCodeInput.value = '';
    alert(`✅ 成功加入監控：${stockCode} 當低於近 ${period} 個月高點 ${percent}% 時通知。`);
}

// 4. 刪除監控條件 (綁定至全域 window 物件以防作用域問題)
window.removeAlertConfig = async function(id) {
    configList = configList.filter(item => item.id !== id);
    localStorage.setItem('stockAlertConfigs', JSON.stringify(configList));
    renderTrackingList();
    await syncConfigsToBackend();
};

// 5. 渲染監控清單表格 UI
function renderTrackingList() {
    const container = document.getElementById('tracking-list');
    if (!container) return;
    
    if (configList.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; margin: 15px 0;">目前沒有設定任何回檔條件，趕快新增一個吧！</p>';
        return;
    }

    console.log("目前的監控清單資料:", configList); //新增檢查點
    
    let html = `
        <table class="tracking-table">
            <thead>
                <tr>
                    <th>股票代碼</th>
                    <th>股票名稱</th>
                    <th>觀測時段</th>
                    <th>觸發降幅</th>
                    <th>管理</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    configList.forEach(config => {
        html += `
            <tr>
                <td><strong>${config.stockCode}</strong></td>
                <td>${config.name}</td>
                <td>近 ${config.period} 個月內</td>
                <td>低於高點 <span style="color: #e74c3c; font-weight: bold;">${config.percent}%</span></td>
                <td>
                    <button class="btn-delete" onclick="removeAlertConfig('${config.id}')">刪除</button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// 6. 啟用雲端背景推播與權限要求
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('抱歉，您的手機或瀏覽器不支援 Web Push 雲端推播功能。');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('通知權限被拒絕。請至手機或瀏覽器設定中手動開啟通知權限，否則伺服器無法發送提醒簡訊。');
            return;
        }
        
        const registration = await navigator.serviceWorker.ready;
        currentSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });
        
        await syncConfigsToBackend();
        updateSubscribeButtonUI();
        alert('✅ 雲端背景推播同步成功！即使您關閉網頁、將手機滑掉，伺服器也會在背景幫您盯盤。');
    } catch (error) {
        console.error('開啟雲端推播失敗:', error);
        alert('開啟推播失敗，請確認伺服器連線與通知權限。');
    }
}

// 7. 更新啟用推播按鈕的 UI 狀態
function updateSubscribeButtonUI() {
    const btn = document.getElementById('btn-subscribe');
    if (!btn) return;
    if (currentSubscription) {
        btn.innerText = '🟢 雲端背景盯盤推播已啟用';
        btn.style.backgroundColor = '#2ecc71';
    } else {
        btn.innerText = '啟用雲端背景推播功能';
        btn.style.backgroundColor = '#4A90E2';
    }
}

// 8. 將手機訂閱代碼與最新的「多重回檔條件清單」一起同步送到 Render 後端
async function syncConfigsToBackend() {
    if (!currentSubscription) return; // 使用者還沒點啟用推播按鈕，先不跟後端同步

    try {
        await fetch(`${BACKEND_URL}/api/subscribe`, {
            method: 'POST',
            body: JSON.stringify({
                subscription: currentSubscription,
                configs: configList // 把整張自訂回檔跌幅表傳過去
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('雲端監控條件成功同步至後端');
    } catch (error) {
        console.error('同步後端失敗:', error);
    }
}

// 輔助函數：將 Base64 的 VAPID Key 轉換為 Uint8Array
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
