// chat_handlers.js
// 這個檔案負責處理整個聊天流程的控制
// 像是按下「創建聊天」、「傳送訊息」、「結束聊天」這些按鈕後續的主要動作

// --- 全域變數/狀態 (通常由 main.js 管理並傳入) ---
// let currentPeerConnection
// let currentTalkStreamId
// let currentTalkSessionId
// let currentChatHistoryArray
// let uiElements (一個包含所有相關 DOM 元素的物件)

// --- API 處理函式 (通常從 api_handlers.js 引入或由 main.js 傳入) ---
// let createChatApiFunc
// let sendMessageApiFunc
// let saveChatHistoryApiFunc
// let deleteStreamApiFunc

// --- UI 處理函式 (通常從 ui_handlers.js 引入或由 main.js 傳入) ---
// let displayErrorFunc
// let updateStatusFunc
// let displayMessageFunc
// let resetUiFunc
// let showChatUiFunc


async function handleConnectAndSetupWebRTC(
    uiElems, // 包含 connectionStatus, errorMessage, connectButton, createChatButton 等 DOM 元素
    apiFuncs, // 包含 callCreateStreamAPI, callStartStreamSdpAPI, callSendIceCandidateAPI
    webrtcManager, // 一個物件 包含 webrtc_handlers.js 裡的方法 例如 createPeerConnection, setupAndStartWebRTC
    globalRefs, // 一個物件 用來存取和更新全域變數 例如 peerConnection, talkStreamId, talkSessionId, iceServers
    uiFuncs // <--- 把 uiFuncs 加到這裡！
) {
    // 按下「連接 Agent」按鈕後的完整流程
    if (globalRefs.peerConnection && globalRefs.peerConnection.connectionState === 'connected') {
        uiFuncs.updateConnectionStatus('已經連接')
        return
    }
    uiFuncs.updateConnectionStatus('正在連接...')
    if (uiElems.errorMessage) uiElems.errorMessage.textContent = '' // 清除舊錯誤

    try {
        // 步驟 1 (API): 創建 D-ID Stream 取得 SDP Offer 和 ICE servers
        const streamCreationData = await apiFuncs.callCreateStreamAPI(
            (msg) => uiFuncs.displayError(msg), // displayError 函式
            (status) => uiFuncs.updateConnectionStatus(status) // updateStatus 函式
        )
        globalRefs.talkStreamId = streamCreationData.id
        globalRefs.talkSessionId = streamCreationData.session_id
        globalRefs.iceServers = streamCreationData.ice_servers
        const sdpOfferFromDid = streamCreationData.offer

        console.log('chat_handlers.js: handleConnect - Stream 已創建 ID:', globalRefs.talkStreamId)
        uiFuncs.updateConnectionStatus(`Stream 已創建 (ID: ${globalRefs.talkStreamId.substring(0,10)}...) 正在設定 WebRTC...`)

        // 步驟 2 (WebRTC): 創建並設定 Peer Connection
        globalRefs.peerConnection = webrtcManager.createPeerConnection(
            globalRefs.iceServers,
            globalRefs.talkStreamId,
            globalRefs.talkSessionId,
            // onIceCandidateCallback:
            (streamId, sessionId, candidate) => { // 把 apiFuncs.callSendIceCandidateAPI 包一層 確保參數正確
                apiFuncs.callSendIceCandidateAPI(streamId, sessionId,
                    { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex },
                    (msg) => uiFuncs.displayError(msg)
                ).catch(err => console.error('chat_handlers.js: 傳送 ICE Candidate 失敗 (內部):', err))
            },
            // onTrackCallback:
            (event) => webrtcManager.handleRemoteTrack(event, uiElems.agentVideo, uiElems.unMuteButton,
                (msg) => uiFuncs.displayError(msg),
                uiFuncs.toggleUnmuteButton // 直接傳遞 ui_handlers.js 的函式
            ),
            // onIceConnectionStateChangeCallback:
            (iceState) => {
                uiFuncs.updateConnectionStatus(`ICE 連接狀態: ${iceState}`)
                if (iceState === 'failed' || iceState === 'closed') {
                    uiFuncs.displayError('WebRTC ICE 連接失敗或關閉')
                    if (uiElems.connectButton) uiElems.connectButton.disabled = false
                    if (uiElems.createChatButton) uiElems.createChatButton.disabled = true
                }
            },
            // onConnectionStateChangeCallback:
            (connState) => {
                uiFuncs.updateConnectionStatus(`WebRTC 連接狀態: ${connState}`)
                if (connState === 'connected') {
                    uiFuncs.updateConnectionStatus('已連接！準備創建聊天')
                    if (uiElems.connectButton) uiElems.connectButton.disabled = true
                    if (uiElems.createChatButton) uiElems.createChatButton.disabled = false
                } else if (connState === 'failed') {
                    uiFuncs.displayError('WebRTC 連接失敗')
                    if (uiElems.connectButton) uiElems.connectButton.disabled = false
                    if (uiElems.createChatButton) uiElems.createChatButton.disabled = true
                }
            },
            // onDataChannelMessageCallback: (這個是核心 處理 Agent 回應)
            (messageData) => { // 這裡的 messageData 是 event.data
                // console.log('chat_handlers.js: Data Channel 收到原始訊息:', messageData) // 先註解掉 太吵
                const answerPrefix = 'chat/answer:'
                const partialPrefix = 'chat/partial:'

                if (typeof messageData === 'string' && messageData.startsWith(answerPrefix)) {
                    const decodedMessage = decodeURIComponent(messageData.substring(answerPrefix.length))
                    console.log('chat_handlers.js: Agent 回應 (完整):', decodedMessage)
                    uiFuncs.displayMessageInChatHistory('AI', decodedMessage); // 更新聊天紀錄UI
                    globalRefs.chatHistory.push({ // 更新JS內部聊天紀錄
                        role: 'assistant', content: decodedMessage, timestamp: new Date().toISOString()
                    })
                } else if (typeof messageData === 'string' && messageData.startsWith(partialPrefix)) {
                    const decodedPartialMessage = decodeURIComponent(messageData.substring(partialPrefix.length))
                    // console.log('Agent 回應 (部分):', decodedPartialMessage) // 部分訊息暫時只在 console 印
                } else if (typeof messageData === 'string' && messageData.includes('stream/started')) {
                    console.log('chat_handlers.js: Data Channel 收到 stream/started 事件')
                } else if (typeof messageData === 'string' && messageData.includes('stream/done')) {
                    console.log('chat_handlers.js: Data Channel 收到 stream/done 事件')
                }
            },
            // onDataChannelOpenCallback:
            () => {
                console.log('chat_handlers.js: Data Channel 已開啟')
                uiFuncs.updateConnectionStatus('數據通道已開啟 可以創建聊天了')
            },
            // onDataChannelCloseCallback:
            () => console.log('chat_handlers.js: Data Channel 已關閉'),
            // onDataChannelErrorCallback:
            (error) => {
                console.error('chat_handlers.js: Data Channel 錯誤:', error)
                uiFuncs.displayError(`數據通道錯誤: ${error.message || error}`)
            }
        )

        // 步驟 3 (WebRTC + API): 設定遠端描述 產生 Answer 並透過 API 送出
        await webrtcManager.setupAndStartWebRTC(
            globalRefs.peerConnection,
            sdpOfferFromDid,
            // 把 callStartStreamSdpAPI 包一層 確保 talkStreamId talkSessionId 能正確傳入
            async (sdpAnswer) => { // 這個 sdpAnswer 是 webrtcManager 產生的 localSdpAnswer
                return apiFuncs.callStartStreamSdpAPI(
                    globalRefs.talkStreamId, // 從全域引用取得
                    globalRefs.talkSessionId, // 從全域引用取得
                    sdpAnswer,
                    (msg) => uiFuncs.displayError(msg),
                    (status) => uiFuncs.updateConnectionStatus(status )
                )
            }
        )
        // 連線成功後啟用創建聊天按鈕的邏輯 應該由 peerConnection 的 connectionstatechange 事件觸發
    } catch (error) {
        // 這裡的錯誤通常是 callCreateStreamAPI 或 setupAndStartWebRTC 內部拋出的
        // displayError 應該已經在 apiFuncs 或 webrtcManager 內部被呼叫過了
        console.error('chat_handlers.js: handleConnectAndSetupWebRTC 過程中發生錯誤:', error)
        uiFuncs.updateConnectionStatus('連接失敗')
        if (uiElems.connectButton) uiElems.connectButton.disabled = false
    }
}


async function handleCreateChatSession(
    uiElems, // connectionStatus, errorMessage, createChatButton 等
    apiFuncs, // callCreateChatAPI
    globalRefs, // peerConnection
    uiFuncs // displayError, updateConnectionStatus, showChatInterface
) {
    // 按下「創建聊天」按鈕後的動作
    if (!globalRefs.peerConnection || globalRefs.peerConnection.connectionState !== 'connected') {
        uiFuncs.displayError('WebRTC 尚未連接 請先點擊連接 Agent')
        return
    }
    uiFuncs.updateConnectionStatus('正在創建聊天會話...')
    if (uiElems.errorMessage) uiElems.errorMessage.textContent = ''

    try {
        const chatCreationResponse = await apiFuncs.callCreateChatAPI(
            (msg) => uiFuncs.displayError(msg),
            (status) => uiFuncs.updateConnectionStatus(status)
        )
        // chat_id 現在由後端 session 管理 前端不需要直接追蹤 chat_id 變數
        // 但 D-ID 回應的 chat_id 和 created_at 可以存到 sessionStorage 供結束聊天時使用
        if (chatCreationResponse.id) {
            sessionStorage.setItem('current_chat_id', chatCreationResponse.id)
            console.log(`chat_handlers.js: 前端 sessionStorage 儲存 chat_id: ${chatCreationResponse.id}`)
        }
        if (chatCreationResponse.created) {
            sessionStorage.setItem('current_chat_created_at_iso', chatCreationResponse.created)
            console.log(`chat_handlers.js: 前端 sessionStorage 儲存 chat_created_at_iso: ${chatCreationResponse.created}`)
        }

        uiFuncs.updateConnectionStatus(`聊天會話已創建 (ID: ${chatCreationResponse.id ? chatCreationResponse.id.substring(0,10) : '未知'}...) 可以開始對話`)
        uiFuncs.showChatInterface() // 更新UI顯示

    } catch (error) {
        // displayError 應該已在 callCreateChatAPI 內部呼叫
        console.error('chat_handlers.js: 創建聊天會話失敗:', error)
        uiFuncs.updateConnectionStatus('創建聊天失敗')
    }
}

async function handleSendMessage(
    uiElems, // messageInput, errorMessage, connectionStatus, chatHistory
    apiFuncs, // callSendMessageAPI
    globalRefs, // peerConnection, talkStreamId, talkSessionId, chatHistory (JS 陣列)
    uiFuncs // displayError, updateConnectionStatus, displayMessageInChatHistory
) {
    // 按下「傳送」按鈕後的動作
    const messageText = uiElems.messageInput.value.trim()
    if (!messageText) {
        uiFuncs.displayError('訊息不能為空！')
        return
    }
    if (!globalRefs.peerConnection || globalRefs.peerConnection.connectionState !== 'connected') {
        uiFuncs.displayError('WebRTC 尚未連接')
        return
    }
    if (!globalRefs.talkStreamId || !globalRefs.talkSessionId) {
        uiFuncs.displayError('Talk Stream ID 或 Session ID 未定義')
        return
    }

    // 先在畫面上顯示使用者發送的訊息
    uiFuncs.displayMessageInChatHistory('你', messageText)
    globalRefs.chatHistory.push({ // 更新JS內部聊天紀錄
        role: 'user', content: messageText, timestamp: new Date().toISOString()
    })

    console.log('chat_handlers.js: 準備發送訊息.. 在等等')
    uiFuncs.updateConnectionStatus('正在發送訊息... 不要動哦！')
    if (uiElems.errorMessage) uiElems.errorMessage.textContent = ''

    try {
        // 呼叫後端API傳送訊息 D-ID的回應現在主要靠DataChannel拿
        // callSendMessageAPI 成功只代表後端已成功代理請求給D-ID
        const didApiResponse = await apiFuncs.callSendMessageAPI(
            messageText,
            globalRefs.talkStreamId,
            globalRefs.talkSessionId,
            (msg) => uiFuncs.displayError( msg),
            (status) => uiFuncs.updateConnectionStatus(status)
        )
        console.log('chat_handlers.js: D-ID /agents/.../chat API 的回應 (透過後端):', didApiResponse) // 印出看看D-ID同步回了什麼

        uiElems.messageInput.value = '' // 清空輸入框
        uiFuncs.updateConnectionStatus('訊息已發送 等待 Agent 回應...')

    } catch (error) {
        // displayError 應該已在 callSendMessageAPI 內部呼叫
        console.error('chat_handlers.js: 發送訊息過程中發生錯誤:', error)
        uiFuncs.updateConnectionStatus('發送訊息失敗')
    }
}

async function handleEndChatAndSaveHistory(
    uiElems, // connectionStatus, errorMessage, endChatButton 等
    apiFuncs, // callSaveChatHistoryAPI, callDeleteStreamAPI
    webrtcManager, // closePeerConnection
    globalRefs, // chatHistory, peerConnection, talkStreamId, talkSessionId
    uiFuncs
) {
    // 按下「結束聊天」按鈕後的動作
    uiFuncs.updateConnectionStatus('正在結束對話並儲存紀錄...')
    if (uiElems.errorMessage) uiElems.errorMessage.textContent = ''
    if (uiElems.endChatButton) uiElems.endChatButton.disabled = true

    // 如果聊天紀錄是空的 就不浪費資源去呼叫儲存API
    if (globalRefs.chatHistory.length === 0) {
        uiFuncs.updateConnectionStatus('沒有對話紀錄可以儲存')
    } else {
        try {
            const chatIdForSave = sessionStorage.getItem('current_chat_id')
            const createdAtIsoForSave = sessionStorage.getItem('current_chat_created_at_iso')

            console.log(`chat_handlers.js: 準備儲存聊天紀錄到後端 chatId='${chatIdForSave}', createdAt='${createdAtIsoForSave}'`)
            const saveResponse = await apiFuncs.callSaveChatHistoryAPI(
                globalRefs.chatHistory,
                chatIdForSave,
                createdAtIsoForSave,
                (msg) => uiFuncs.displayError(msg),
                (status) => uiFuncs.updateConnectionStatus(status)
            )
            uiFuncs.updateConnectionStatus(`聊天紀錄處理完成 伺服器訊息: ${saveResponse.message || JSON.stringify(saveResponse)}`)
            if (saveResponse.saved_data) {
                console.log('chat_handlers.js: 儲存到 MongoDB 的數據 (來自後端確認):', saveResponse.saved_data)
            }
        } catch (error) {
            console.error('chat_handlers.js: 儲存聊天紀錄時發生錯誤:', error)
            uiFuncs.updateConnectionStatus('儲存聊天紀錄失敗')
            // 即使儲存失敗 還是要繼續清理流程 所以不 return
        }
    }

    // --- 清理工作 ---
    globalRefs.chatHistory = [] // 清空JS內部聊天紀錄
    sessionStorage.removeItem('current_chat_id') // 清除sessionStorage
    sessionStorage.removeItem('current_chat_created_at_iso')

    // 關閉 WebRTC 連線
    if (globalRefs.peerConnection) {
        globalRefs.peerConnection = webrtcManager.closePeerConnection(globalRefs.peerConnection)
    }

    // 通知後端刪除 D-ID Stream
    if (globalRefs.talkStreamId && globalRefs.talkSessionId) {
        apiFuncs.callDeleteStreamAPI(globalRefs.talkStreamId, globalRefs.talkSessionId,
            (msg) => uiFuncs.displayError(msg) // 刪除Stream的錯誤也顯示一下
        )
        .then(delRes => console.log('chat_handlers.js: 刪除 Stream API 回應 (清理階段):', delRes))
        .catch(delErr => console.error('chat_handlers.js: 刪除 Stream API 呼叫失敗 (清理階段):', delErr))
        .finally(() => { // 無論刪除成功與否 都清掉本地ID
            globalRefs.talkStreamId = null
            globalRefs.talkSessionId = null
        })
    } else { // 如果本來就沒有ID 也要確保清空
        globalRefs.talkStreamId = null
        globalRefs.talkSessionId = null
    }


    uiFuncs.resetChatUI( // 重設UI到初始狀態
        // uiElems.chatInterface,
        // uiElems.endChatButton,
        // uiElems.createChatButton,
        // uiElems.connectButton,
        // uiElems.connectionStatus,
        // uiElems.chatHistory // chatHistory DIV element for clearing
    )
    if (uiElems.endChatButton) uiElems.endChatButton.disabled = false // 最後再把結束按鈕 re-enable 以防萬一 (雖然 resetUI 應該會處理)
}


// --- 聊天流程函式結束 ---