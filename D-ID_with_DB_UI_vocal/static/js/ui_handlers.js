// ui_handlers.js
// 這個檔案專門放所有跟畫面顯示、使用者介面更新有關的函式
// 像是顯示錯誤訊息、在聊天框框加訊息、重設畫面之類的

// --- 全域 DOM 元素 快取起來用比較快 ---
// 這些是在 main.js 裡面會抓的 先在這裡也準備一份 如果要共用可以想辦法傳遞
// 但通常這些 handler 函式會接收 DOM 元素作為參數 或者在 main.js 裡面傳遞
// 為了保持獨立性 暫時先假設 main.js 會把需要的元素傳進來 或者各自在自己的作用域宣告
// 這裡先不重複宣告 DOM 元素 假設呼叫它的地方會處理好

function displayErrorOnPage(errorMessageElement, message) {
    // 在指定的 errorMessageElement 上面顯示錯誤訊息
    // errorMessageElement 是一個 DOM 物件 就是畫面上那個紅紅的錯誤訊息區塊
    console.error('UI錯誤顯示: ' + message) // 控制台也印一下 方便debug
    if (errorMessageElement) {
        errorMessageElement.textContent = '錯誤: ' + message
    } else {
        console.warn('ui_handlers.js: displayErrorOnPage 找不到 errorMessageElement 啦')
    }
}

function updateConnectionStatusUI(connectionStatusElement, statusText) {
    // 更新畫面上顯示連線狀態的文字
    // connectionStatusElement 就是那個顯示「狀態：正在連接...」的 DOM 物件
    //console.log('DEBUG_UI: updateConnectionStatusUI CALLED. connectionStatusElement:', connectionStatusElement, 'statusText:', statusText, 'TYPEOF statusText:', typeof statusText); // <--- 加上這行
    if (connectionStatusElement) {
        connectionStatusElement.textContent = '狀態：' + statusText
    } else {
        console.warn('ui_handlers.js: updateConnectionStatusUI 找不到 connectionStatusElement')
    }
}

function displayMessageInChatHistoryUI(chatHistoryDiv, sender, text) {
    // 把新訊息加到聊天紀錄的框框裡面
    // chatHistoryDiv 就是那個 class="chat-history" 的 div
    // sender 是發訊息的人 例如 "你" 或 "Agent"
    // text 是訊息內容
    if (chatHistoryDiv) {
        const messageElement = document.createElement('p')
        messageElement.innerHTML = `<strong>${sender}:</strong> ${text.replace(/\n/g, '<br>')}` // 把換行符號轉成 <br>
        chatHistoryDiv.appendChild(messageElement)
        chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight // 自動捲到最下面 讓最新訊息可見
    } else {
        console.warn("ui_handlers.js: displayMessageInChatHistoryUI 找不到聊天紀錄的 div ('chat-history') 啦")
    }
}

function resetChatUI(chatInterfaceElement, endChatButtonElement, createChatButtonElement, connectButtonElement, connectionStatusElement, chatHistoryDiv) {
    // 重設聊天相關的UI元素到初始狀態 準備下一輪聊天
    // 例如隱藏聊天輸入框、顯示/隱藏按鈕之類的

    if (chatInterfaceElement) chatInterfaceElement.style.display = 'none'
    if (endChatButtonElement) endChatButtonElement.style.display = 'none'

    if (createChatButtonElement) createChatButtonElement.disabled = true // 創建聊天按鈕禁用
    if (connectButtonElement) connectButtonElement.disabled = false // 看情況決定要不要重設連接按鈕

    if (connectionStatusElement) updateConnectionStatusUI(connectionStatusElement, '未連接 請連接 Agent 開始新的對話')
    if (chatHistoryDiv) chatHistoryDiv.innerHTML = '' // 清空聊天紀錄畫面

    console.log('UI已被重設 準備好進行新的對話')
}

function showChatInterface(chatInterfaceElement, endChatButtonElement, createChatButtonElement) {
    // 顯示聊天介面 隱藏創建聊天按鈕
    if (chatInterfaceElement) chatInterfaceElement.style.display = 'flex'
    if (endChatButtonElement) endChatButtonElement.style.display = 'inline-block'
    if (createChatButtonElement) createChatButtonElement.disabled = true
}

function toggleUnmuteButton(unMuteButtonElement, agentVideoElement, show) {
    // 控制 Unmute 按鈕的顯示和文字
    if (unMuteButtonElement && agentVideoElement) {
        if (show) {
            unMuteButtonElement.style.display = 'inline-block'
            unMuteButtonElement.disabled = false
            unMuteButtonElement.textContent = agentVideoElement.muted ? '取消靜音 / Unmute' : '靜音 / Mute'
        } else {
            unMuteButtonElement.style.display = 'none'
        }
    }
}

// 也可以把按鈕的 disabled 狀態管理的函式放這裡
function setButtonDisabledState(buttonElement, isDisabled) {
    if (buttonElement) {
        buttonElement.disabled = isDisabled
    }
}


// --- UI 更新相關函式結束 ---