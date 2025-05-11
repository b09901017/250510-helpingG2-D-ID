// api_handlers.js
// 這個檔案專門放跟後端 Flask API 溝通的函式
// 像是 fetchWithHandling 還有實際呼叫 /api/create_stream 這些端點的動作

// displayErrorOnPage 通常會在 ui_handlers.js 裡面定義
// 這裡假設 main.js 會處理好 displayErrorOnPage 的全局可用性
// 或者更標準的做法是 api_handlers.js 拋出錯誤 由呼叫它的地方 (例如 main.js) 去 catch 並顯示錯誤

async function fetchWithErrorReporting(url, options, errorDisplayFunc, statusUpdateFunc, actionDescription) {
    // 一個通用的 fetch 函式 帶有錯誤處理跟狀態更新
    // errorDisplayFunc: 一個函式 用來顯示錯誤 例如 ui_handlers.js 裡的 displayErrorOnPage
    // statusUpdateFunc: 一個函式 用來更新連線狀態 例如 ui_handlers.js 裡的 updateConnectionStatusUI
    // actionDescription: 字串 描述正在進行的操作 例如 "創建 Stream"

    if (statusUpdateFunc) statusUpdateFunc(`正在${actionDescription}...`)

    try {
        const response = await fetch(url, options)
        if (!response.ok) {
            // 試著解析後端回傳的 JSON 錯誤訊息
            let errorData = { detail: `HTTP 錯誤 ${response.status} 但無法解析錯誤內容` } // 預設錯誤
            try {
                errorData = await response.json()
            } catch (e) {
                // 如果後端回的不是 JSON (例如純文字或 HTML 錯誤頁面) 就直接用 response.text
                const textError = await response.text()
                errorData = { detail: textError || `HTTP 錯誤 ${response.status}` }
                console.warn(`api_handlers.js: ${actionDescription} API 回應非 JSON: `, textError)
            }
            const errorMessage = `${actionDescription}失敗: ${errorData.detail || JSON.stringify(errorData)}`
            if (errorDisplayFunc) errorDisplayFunc(errorMessage)
            throw new Error(errorMessage) // 把錯誤丟出去 讓呼叫的地方知道
        }
        // 如果請求成功 解析 JSON 回應
        const responseData = await response.json().catch(e => {
            // 雖然 response.ok 是 true 但如果 JSON 解析失敗 還是要處理
            const parseErrorMessage = `${actionDescription}成功但解析回應JSON失敗: ${e.message}`
            if (errorDisplayFunc) errorDisplayFunc(parseErrorMessage)
            throw new Error(parseErrorMessage)
        })
        if (statusUpdateFunc) statusUpdateFunc(`${actionDescription}成功`) // 可以選擇在這裡更新狀態 或在呼叫者那邊
        return responseData
    } catch (error) {
        // 網路錯誤或其他 fetch 本身的錯誤 (例如 DNS 找不到)
        // 或是上面丟出來的 Error
        const catchErrorMessage = `${actionDescription}時發生捕捉到的錯誤: ${error.message}`
        console.error('api_handlers.js fetchWithErrorReporting CATCH:', catchErrorMessage, error)
        if (errorDisplayFunc && !error.message.startsWith(`${actionDescription}失敗`)) {
            // 避免重複顯示已在 !response.ok 處理過的錯誤
            errorDisplayFunc(catchErrorMessage)
        }
        if (statusUpdateFunc) statusUpdateFunc(`${actionDescription}失敗`)
        throw error // 再次把錯誤丟出去
    }
}

// --- 實際呼叫各個 API 端點的函式 ---

async function callCreateStreamAPI(errorDisplayFunc, statusUpdateFunc) {
    // 呼叫後端的 /api/create_stream
    // 回傳 D-ID 給的 stream 資料 (包含 id, session_id, offer, ice_servers)
    const options = { method: 'POST' }
    return await fetchWithErrorReporting('/api/create_stream', options, errorDisplayFunc, statusUpdateFunc, '創建D-ID Stream')
}

async function callStartStreamSdpAPI(streamId, sessionId, sdpAnswer, errorDisplayFunc, statusUpdateFunc) {
    // 呼叫後端的 /api/start_stream_sdp
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            stream_id: streamId,
            session_id: sessionId,
            answer: sdpAnswer,
        }),
    }
    return await fetchWithErrorReporting('/api/start_stream_sdp', options, errorDisplayFunc, statusUpdateFunc, '發送SDP Answer')
}

async function callSendIceCandidateAPI(streamId, sessionId, candidateData, errorDisplayFunc) {
    // 呼叫後端的 /api/send_ice_candidate
    // 這個通常不需要特別更新狀態文字 錯誤會直接顯示
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            stream_id: streamId,
            session_id: sessionId,
            candidate_data: candidateData // candidateData 應該是 { candidate, sdpMid, sdpMLineIndex }
        }),
    }
    // 對於 ICE candidate 如果失敗 可能不需要讓整個流程停下來 所以 statusUpdateFunc 設 null
    return await fetchWithErrorReporting('/api/send_ice_candidate', options, errorDisplayFunc, null, '發送ICE Candidate')
}

async function callCreateChatAPI(errorDisplayFunc, statusUpdateFunc) {
    // 呼叫後端的 /api/create_chat
    // 回傳 D-ID 給的 chat 資料 (主要是 chat_id 跟 created_at)
    const options = { method: 'POST' }
    return await fetchWithErrorReporting('/api/create_chat', options, errorDisplayFunc, statusUpdateFunc, '創建聊天會話')
}

async function callSendMessageAPI(messageText, talkStreamId, talkSessionId, errorDisplayFunc, statusUpdateFunc) {
    // 呼叫後端的 /api/send_message
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: messageText,
            talk_stream_id: talkStreamId,
            talk_session_id: talkSessionId
        }),
    }
    return await fetchWithErrorReporting('/api/send_message', options, errorDisplayFunc, statusUpdateFunc, '發送訊息')
}

async function callSaveChatHistoryAPI(chatHistory, chatIdForSave, createdAtIsoForSave, errorDisplayFunc, statusUpdateFunc) {
    // 呼叫後端的 /api/save_chat_history
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatIdForSave, // 從 sessionStorage 來的 chat_id
            created_at_iso: createdAtIsoForSave, // 從 sessionStorage 來的 created_at
            messages: chatHistory
        }),
    }
    return await fetchWithErrorReporting('/api/save_chat_history', options, errorDisplayFunc, statusUpdateFunc, '儲存聊天紀錄')
}

async function callDeleteStreamAPI(streamId, sessionId, errorDisplayFunc) {
    // 呼叫後端的 /api/delete_stream
    // 通常在結束聊天或頁面關閉時呼叫 不太需要狀態更新
    if (!streamId || !sessionId) {
        console.warn('api_handlers.js: callDeleteStreamAPI streamId 或 sessionId 未提供 跳過刪除請求')
        return Promise.resolve({ message: "Stream ID 或 Session ID 未提供 未呼叫刪除API" }) // 回傳一個 resolved Promise
    }
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_id: streamId, session_id: sessionId }),
    }
    // delete stream 失敗可能不該阻斷UI流程 statusUpdateFunc 設 null
    return await fetchWithErrorReporting('/api/delete_stream', options, errorDisplayFunc, null, '刪除D-ID Stream')
}


// --- API 呼叫函式結束 ---