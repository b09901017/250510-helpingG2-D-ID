// main.js
// 這是整個前端應用程式的起點和總指揮
// 主要工作：
// 1. 選取畫面上所有重要的 DOM 元素
// 2. 初始化全域狀態變數
// 3. 把各個按鈕的點擊事件 (Event Listener) 跟對應的處理函式綁定起來
// 4. 載入其他 JS 模組的函式 並在適當時候呼叫它們

// --- DOM 元素選取：先把畫面上會動到的東西都抓起來 ---
const connectButton = document.getElementById('connect-button')
const createChatButton = document.getElementById('create-chat-button')
const sendButton = document.getElementById('send-button')
const messageInput = document.getElementById('message-input')
const agentVideo = document.getElementById('agent-video')
const connectionStatus = document.getElementById('connection-status')
const errorMessageDisplay = document.getElementById('error-message') // 重新命名以區分變數和函式
const chatInterface = document.getElementById('chat-interface')
const unMuteButton = document.getElementById('unmute-button')
const endChatButton = document.getElementById('end-chat-button')
const chatHistoryDisplay = document.getElementById('chat-history') // 聊天紀錄顯示區塊

// 把常用的 DOM 元素包成一個物件 方便傳遞給其他模組的函式
const uiElements = {
    connectButton, createChatButton, sendButton, messageInput,
    agentVideo, connectionStatus, errorMessage: errorMessageDisplay, // 使用重新命名的 errorMessageDisplay
    chatInterface, unMuteButton, endChatButton, chatHistory: chatHistoryDisplay
}
// --- DOM 元素選取結束 ---


// --- 全域狀態變數：存放整個應用程式共享的狀態 ---
let peerConnectionInstance = null // RTCPeerConnection 的實例
let currentTalkStreamId = null    // D-ID /talks/streams API 回傳的 id
let currentTalkSessionId = null // D-ID /talks/streams API 回傳的 session_id
let currentIceServers = []      // D-ID 給的 ICE server 列表
let currentChatHistoryMessages = [] // 用陣列存當前對話的歷史訊息 {role, content, timestamp}

// 把全域狀態變數也包成一個物件 方便其他模組修改 (透過引用傳遞)
const globalAppRefs = {
    peerConnection: peerConnectionInstance,
    talkStreamId: currentTalkStreamId,
    talkSessionId: currentTalkSessionId,
    iceServers: currentIceServers,
    chatHistory: currentChatHistoryMessages // 注意 chatHistory 是 JS 陣列 chatHistoryDisplay 是 DOM 元素
}
// --- 全域狀態變數結束 ---

// --- 從其他模組引入函式 ---
// 假設其他 .js 檔案 (api_handlers.js, webrtc_handlers.js, ui_handlers.js, chat_handlers.js)
// 已經在 HTML 中被正確引入 並且它們的函式是在全域範疇 (或者透過模組系統引入)
// 為了簡單起見 這裡直接使用上一則回覆中定義的函式名稱

// 從 ui_handlers.js (假設函式都在全域或已正確引入)
// const displayError = displayErrorOnPage // 把 ui_handlers.js 的 displayErrorOnPage 賦值給 displayError
// const updateConnectionStatus = updateConnectionStatusUI
// const displayMessageInChatHistory = displayMessageInChatHistoryUI
// const resetUIForNewChat = resetChatUI // 在 chat_handlers 裡面會用到
// const showChatInterfaceUI = showChatInterface // 在 chat_handlers 裡面會用到
// const toggleUnmuteButtonUI = toggleUnmuteButton // 在 webrtc_handlers 裡面會用到

// 打包 ui 函式給 chat_handlers
const uiHandlerFunctions = {
    displayError: (msg) => displayErrorOnPage(uiElements.errorMessage, msg),
    updateConnectionStatus: (status) => updateConnectionStatusUI(uiElements.connectionStatus, status),
    displayMessageInChatHistory: (sender, text) => displayMessageInChatHistoryUI(uiElements.chatHistory, sender, text),
    resetChatUI: () => resetChatUI(uiElements.chatInterface, uiElements.endChatButton, uiElements.createChatButton, uiElements.connectButton, uiElements.connectionStatus, uiElements.chatHistory),
    showChatInterface: () => showChatInterface(uiElements.chatInterface, uiElements.endChatButton, uiElements.createChatButton),
    toggleUnmuteButton: (show) => toggleUnmuteButton(uiElements.unMuteButton, uiElements.agentVideo, show)
}


// 從 api_handlers.js
// const callCreateStream = callCreateStreamAPI
// const callStartSdp = callStartStreamSdpAPI
// const callSendIce = callSendIceCandidateAPI
// const callCreateNewChat = callCreateChatAPI
// const callSendMessageToApi = callSendMessageAPI
// const callSaveHistory = callSaveChatHistoryAPI
// const callDeleteDidStream = callDeleteStreamAPI

// 打包 api 函式給 chat_handlers
const apiHandlerFunctions = {
    callCreateStreamAPI, callStartStreamSdpAPI, callSendIceCandidateAPI,
    callCreateChatAPI, callSendMessageAPI, callSaveChatHistoryAPI, callDeleteStreamAPI
}

// 從 webrtc_handlers.js
// const createNewPeerConnection = createPeerConnection
// const setupAndStartRTC = setupAndStartWebRTC
// const handleRemoteTrackStream = handleRemoteTrack
// const closeCurrentPeerConnection = closePeerConnection

// 打包 webrtc 函式 (一個物件比較好管理)
const webrtcManagerFunctions = {
    createPeerConnection, setupAndStartWebRTC, handleRemoteTrack, closePeerConnection
}
// --- 函式引入結束 ---


// --- 事件監聽器設定：幫按鈕們綁定對應的動作 ---

// 「連接 Agent」按鈕
connectButton.addEventListener('click', async () => {
    console.log('main.js: 「連接 Agent」按鈕被按下了')
    // 把 UI 元素物件 API 函式物件 WebRTC 管理物件 和全域參照物件都傳過去
    await handleConnectAndSetupWebRTC(uiElements, apiHandlerFunctions, webrtcManagerFunctions, globalAppRefs, uiHandlerFunctions)
})

// 「創建聊天」按鈕
createChatButton.addEventListener('click', async () => {
    console.log('main.js: 「創建聊天」按鈕被按下了')
    // 更新 globalAppRefs.peerConnection 的值 (如果 handleConnectAndSetupWebRTC 有更新它的話)
    // 這裡假設 globalAppRefs.peerConnection 在 handleConnectAndSetupWebRTC 執行後會是最新狀態
    await handleCreateChatSession(uiElements, apiHandlerFunctions, globalAppRefs, uiHandlerFunctions)
})

// 「傳送訊息」按鈕
sendButton.addEventListener('click', async () => {
    console.log('main.js: 「傳送訊息」按鈕被按下了')
    await handleSendMessage(uiElements, apiHandlerFunctions, globalAppRefs, uiHandlerFunctions)
})

// 「取消靜音 / 靜音」按鈕
unMuteButton.addEventListener('click', () => {
    console.log('main.js: 「取消靜音/靜音」按鈕被按下了')
    if (uiElements.agentVideo.srcObject) {
        uiElements.agentVideo.muted = !uiElements.agentVideo.muted
        uiElements.unMuteButton.textContent = uiElements.agentVideo.muted ? '取消靜音 / Unmute' : '靜音 / Mute'
        console.log(uiElements.agentVideo.muted ? "main.js: 視訊已靜音" : "main.js: 視訊已取消靜音")
    } else {
        console.log("main.js: 無法切換靜音狀態 因為視訊來源還沒設定好")
    }
})

// 「結束聊天」按鈕
endChatButton.addEventListener('click', async () => {
    console.log('main.js: 「結束聊天」按鈕被按下了')
    // 在呼叫 handleEndChatAndSaveHistory 之前 更新 globalAppRefs 裡面的 peerConnection 和 chatHistory
    // 確保傳遞的是最新的狀態
    // 實際上 因為 globalAppRefs 傳的是物件引用 所以裡面的值應該已經是最新的了
    await handleEndChatAndSaveHistory(uiElements, apiHandlerFunctions, webrtcManagerFunctions, globalAppRefs, uiHandlerFunctions)
})

// 處理頁面卸載事件 (例如關閉瀏覽器分頁)
window.addEventListener('beforeunload', async (event) => {
    console.log('main.js: 偵測到頁面即將卸載 (beforeunload)')
    // 盡可能地嘗試清理 D-ID stream 資源
    // 注意: beforeunload 事件中能做的事情有限 不能執行太久或異步操作
    if (globalAppRefs.peerConnection && globalAppRefs.talkStreamId && globalAppRefs.talkSessionId) {
        console.log('main.js: 頁面卸載前 嘗試非同步呼叫刪除 Stream API (可能不會成功執行完畢)')
        // 這裡使用 fetch 的 keepalive 選項 增加請求在頁面卸載時被發送出去的機會
        // 但這不是保證 D-ID 的同步刪除行為在所有瀏覽器都完美運作
        // D-ID 本身應該有超時機制來清理閒置的 stream
        try {
            // 不 await 直接發送 讓它自己跑
            fetch('/api/delete_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stream_id: globalAppRefs.talkStreamId, session_id: globalAppRefs.talkSessionId }),
                keepalive: true // 這是關鍵
            })
            console.log('main.js: 已觸發刪除 Stream API (使用 keepalive) 頁面即將關閉')
        } catch(e) {
            // 在 beforeunload 中 catch 錯誤可能沒什麼用 因為 console 可能已經關了
            console.error("main.js: beforeunload 中呼叫刪除 Stream API 時發生錯誤:", e)
        }
    } else {
        console.log('main.js: 頁面卸載前 無需呼叫刪除 Stream API (可能未連接或已清理)')
    }
    // beforeunload 中不能 `event.preventDefault()` (除非有特定條件)
    // 也不能可靠地執行異步操作後才關閉頁面
})

// --- 事件監聽器設定結束 ---

// --- 頁面載入後的一些初始化動作 (如果有的話) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('main.js: DOM都載入完成啦 應用程式準備好了')
    // 可以在這裡做一些初始的UI設定 例如禁用某些按鈕
    if (uiElements.createChatButton) uiElements.createChatButton.disabled = true // 一開始不能創建聊天
    if (uiElements.chatInterface) uiElements.chatInterface.style.display = 'none' // 隱藏聊天介面
    if (uiElements.endChatButton) uiElements.endChatButton.style.display = 'none' // 隱藏結束按鈕
    if (uiElements.unMuteButton) uiElements.unMuteButton.style.display = 'none' // 隱藏取消靜音按鈕
})
// --- 初始化動作結束 ---