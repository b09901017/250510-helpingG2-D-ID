const connectButton = document.getElementById('connect-button');
const createChatButton = document.getElementById('create-chat-button');
const sendButton = document.getElementById('send-button');
const messageInput = document.getElementById('message-input');
const agentVideo = document.getElementById('agent-video');
const connectionStatus = document.getElementById('connection-status');
const errorMessage = document.getElementById('error-message');
const chatInterface = document.getElementById('chat-interface');
const unMuteButton = document.getElementById('unmute-button');
const endChatButton = document.getElementById('end-chat-button');

let currentChatHistory = []; // 用於存儲當前對話的歷史記錄
//let agentResponseTextForHistory = ''; // 用於在 stream/started 後才加入歷史

let peerConnection;
let talkStreamId; // D-ID /talks/streams API 返回的 id
let talkSessionId; // D-ID /talks/streams API 返回的 session_id
let iceServers = [];
// let chatId; // Chat ID 將由 Flask session 管理，前端不需要直接追蹤

async function displayError(message) {
    console.error(message);
    errorMessage.textContent = `錯誤: ${message}`;
}

async function fetchWithHandling(url, options) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "無法解析錯誤回應" }));
            throw new Error(`HTTP error ${response.status}: ${errorData.detail || JSON.stringify(errorData)}`);
        }
        return response.json();
    } catch (error) {
        displayError(error.message);
        throw error; // 重新拋出以便調用者可以處理
    }
}

connectButton.addEventListener('click', async () => {
    if (peerConnection && peerConnection.connectionState === 'connected') {
        connectionStatus.textContent = '狀態：已經連接';
        return;
    }
    connectionStatus.textContent = '狀態：正在連接...';
    errorMessage.textContent = ''; // 清除舊錯誤

    try {
        // 步驟 1 (Talks Streams API): 創建 Stream，獲取 SDP Offer 和 ICE servers
        const streamCreationResponse = await fetchWithHandling('/api/create_stream', { method: 'POST' });
        
        // <--- 關鍵日誌點 2.1 --->
        // 打印從後端 /api/create_stream 收到的完整回應
        //console.log('DEBUG (main.js connectButton): 從 /api/create_stream 收到的回應:', JSON.stringify(streamCreationResponse, null, 2));


        talkStreamId = streamCreationResponse.id;
        talkSessionId = streamCreationResponse.session_id; // 這個 session_id 用於 /talks/streams/* 的後續請求
        const sdpOffer = streamCreationResponse.offer;
        iceServers = streamCreationResponse.ice_servers; // D-ID 可能會提供 STUN/TURN 服務器

        // <--- 關鍵日誌點 2.2 --->
        // 打印賦值後的全局變數 talkStreamId 和 talkSessionId
        //console.log('DEBUG (main.js connectButton): 儲存的 talkStreamId:', talkStreamId);
        //console.log('DEBUG (main.js connectButton): 儲存的 talkSessionId:', talkSessionId); // **確認這個值**

        

        connectionStatus.textContent = `狀態：Stream 已創建 (ID: ${talkStreamId.substring(0,10)}...)，正在設定 WebRTC...`;

        // 步驟 2 (WebRTC): 創建 Peer Connection 並設定
        peerConnection = new RTCPeerConnection({ iceServers });

                // <--- 新增：創建 Data Channel --->
        const dataChannel = peerConnection.createDataChannel('JanusDataChannel'); // 名稱可以自訂，但 D-ID 範例常用這個
        let agentResponseText = ''; // 用於暫存可能分段的 agent 回應

        dataChannel.onopen = () => {
            console.log('Data Channel 已開啟');
            connectionStatus.textContent = '狀態：數據通道已開啟，可以發送訊息。';
        };

        dataChannel.onclose = () => {
            console.log('Data Channel 已關閉');
        };

        dataChannel.onerror = (error) => {
            console.error('Data Channel 錯誤:', error);
            displayError(`數據通道錯誤: ${error}`);
        };

        // <--- 新增：監聽 Data Channel 的 onmessage 事件 --->
        dataChannel.onmessage = (event) => {
            const message = event.data;
            console.log('收到 Data Channel 訊息:', message);

            const answerPrefix = 'chat/answer:';
            const partialPrefix = 'chat/partial:'; // 新增，用於識別部分消息

            if (typeof message === 'string' && message.startsWith(answerPrefix)) {
                const decodedMessage = decodeURIComponent(message.substring(answerPrefix.length));
                console.log('Agent 回應 (完整文本):', decodedMessage);
                // <--- 直接在這裡記錄完整的 Agent 回應 --->
                displayMessageInChatHistory('Agent', decodedMessage);

            } else if (typeof message === 'string' && message.startsWith(partialPrefix)) {
                // 這是部分消息，通常用於打字機效果，我們暫時不記錄到 history，只在 console 打印
                const decodedPartialMessage = decodeURIComponent(message.substring(partialPrefix.length));
                console.log('Agent 回應 (部分):', decodedPartialMessage);
                // 如果你想在 UI 上實現打字機效果，可以在這裡處理

            } else if (typeof message === 'string' && message.includes('stream/started')) {
                console.log('Data Channel: Stream started event received.');
                // 之前在這裡記錄 agentResponseTextForHistory，現在不需要了，因為 chat/answer 會直接記錄

            } else if (typeof message === 'string' && message.includes('stream/done')) {
                console.log('Data Channel: Stream done event received.');
            }
            // 你還可以處理其他 D-ID 可能透過 Data Channel 發送的事件
        };

        // <--- 新增：創建 Data Channel --->

        peerConnection.addEventListener('icecandidate', async (event) => {
            if (event.candidate) {
                const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
                try {
                    await fetchWithHandling('/api/send_ice_candidate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            stream_id: talkStreamId,
                            session_id: talkSessionId,
                            candidate_data: { candidate, sdpMid, sdpMLineIndex }
                        }),
                    });
                } catch (err) { /* 錯誤已在 fetchWithHandling 中顯示 */ }
            }
        });

        peerConnection.addEventListener('iceconnectionstatechange', () => {
            connectionStatus.textContent = `狀態：ICE 連接狀態: ${peerConnection.iceConnectionState}`;
            if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
                displayError('WebRTC 連接失敗或關閉。');
                connectButton.disabled = false;
                createChatButton.disabled = true;
            }
        });
        
        peerConnection.addEventListener('connectionstatechange', () => {
            connectionStatus.textContent = `狀態：WebRTC 連接狀態: ${peerConnection.connectionState}`;
            if (peerConnection.connectionState === 'connected') {
                connectionStatus.textContent = '狀態：已連接！準備創建聊天。';
                connectButton.disabled = true;
                createChatButton.disabled = false;
                 // 如果視頻是靜音的，可以嘗試在這裡取消靜音，但瀏覽器可能會阻止
                // agentVideo.muted = false; 
            } else if (peerConnection.connectionState === 'failed') {
                displayError('WebRTC 連接失敗。');
                connectButton.disabled = false;
                createChatButton.disabled = true;
            }
        });

        peerConnection.addEventListener('track', (event) => {
    connectionStatus.textContent = '狀態：接收到媒體流！';
    // event.streams 是一個 MediaStream 對象的數組。
    // 通常情況下，對於像這樣的簡單點對點連接，它將包含一個 MediaStream，
    // 其中包含音頻和視頻軌道。
    const remoteStream = event.streams && event.streams[0];
    console.log(`接收到軌道: kind=<span class="math-inline">\{event\.track\.kind\}, id\=</span>{event.track.id}`); // <--- 添加這行日誌
    if (remoteStream) {
        // 只有當新的 remoteStream 與當前 video 元素的 srcObject 不同時才進行更新
        if (agentVideo.srcObject !== remoteStream) {
            console.log('正在將新的遠程媒體流分配給 video 元素...');
            agentVideo.srcObject = remoteStream;

            // 嘗試播放視頻。處理 play() 返回的 Promise 是一個好習慣。
            agentVideo.play().then(() => {
                console.log('視頻開始播放。');
                if (agentVideo.muted) { // 只有在靜音狀態下才顯示取消靜音按鈕
                    unMuteButton.style.display = 'inline-block'; // 顯示按鈕
                    unMuteButton.disabled = false;
                }
                // 如果視頻初始是靜音以實現自動播放，你可以在這裡啟用一個取消靜音的按鈕。
                // 例如: unMuteButton.disabled = false;
            }).catch(e => {
                if (e.name === 'AbortError') {
                    // 這個錯誤可以發生，例如，如果多個軌道事件非常迅速地到達，
                    // 或者如果媒體流在播放開始前就改變了。
                    // 通常可以安全地忽略，或者只是記錄一個警告。
                    console.warn('play() 請求被中斷。如果軌道快速連續到達或媒體流更改，則可能發生這種情況。');
                } else if (e.name === 'NotAllowedError') {
                    console.error('播放錯誤: 自動播放被阻止。可能需要用戶交互才能播放視頻，或者確保視頻已靜音。');
                    // 此處可以提示用戶點擊播放，或者確保視頻 <video muted> 屬性存在。
                } else {
                    console.error("播放錯誤:", e);
                    errorMessage.textContent = `播放錯誤: ${e.message}`; // 顯示給用戶
                }
            });
            console.log('Video Element State: readyState=', agentVideo.readyState, 'networkState=', agentVideo.networkState, 'error=', agentVideo.error);
        } else {
            console.log('接收到的媒體流與當前流相同，不重新分配。');
        }
    } else {
        // 針對某些瀏覽器（例如舊版 Safari 或特定 WebRTC 協商情況）的回退處理，
        // 這些瀏覽器可能不會填充 event.streams，但會提供 event.track。
        // 這種情況在典型場景下較少見。
        if (event.track) {
            console.log('接收到單獨的 track，嘗試添加到 video 元素...');
            let currentSrcObject = agentVideo.srcObject;
            if (currentSrcObject instanceof MediaStream) {
                // 檢查 track 是否已經存在於當前的 MediaStream 中
                if (!currentSrcObject.getTracks().includes(event.track)) {
                    console.log('Track 不在當前流中，正在添加 track:', event.track);
                    currentSrcObject.addTrack(event.track);
                    // 瀏覽器對此的行為可能有所不同。
                    // 好像在某些情況下，重新分配 srcObject (即使是同一個對象) 可能有助於刷新。
                    // agentVideo.srcObject = currentSrcObject; // 可以嘗試，但通常不需要嗎??
                } else {
                    console.log('Track 已經存在於當前流中:', event.track);
                }
            } else {
                // 如果還沒有 srcObject，則創建一個新的 MediaStream
                console.log('還沒有 srcObject，創建新的 MediaStream 並添加 track:', event.track);
                let newStream = new MediaStream();
                newStream.addTrack(event.track);
                agentVideo.srcObject = newStream;
            }

            // 即使只是添加 track，也嘗試播放（如果視頻處於可播放狀態）
            // 這裡的 play() 調用也可能遇到 AbortError，如果 srcObject 在此期間被其他邏輯改變
            if (agentVideo.paused && agentVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
                 agentVideo.play().catch(e => {
                    if (e.name === 'AbortError') {
                        console.warn('play() 請求在 track 回退邏輯中被中斷。');
                    } else {
                        console.error("播放錯誤 (track 回退邏輯):", e);
                        errorMessage.textContent = `播放錯誤 (track 回退): ${e.message}`;
                    }
                });
            }
        } else {
            console.warn('接收到 track 事件，但既沒有 event.streams 也沒有 event.track。');
        }
    }
});
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpOffer));
        const sdpAnswer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(sdpAnswer);

        // 步驟 3 (Talks Streams API): 發送 SDP Answer
        await fetchWithHandling('/api/start_stream_sdp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stream_id: talkStreamId,
                session_id: talkSessionId,
                answer: sdpAnswer,
            }),
        });
        // 連接成功後，啟用創建聊天按鈕
        // WebRTC connectionstatechange 事件會處理這個

    } catch (error) {
        // displayError 已在 fetchWithHandling 中調用
        connectionStatus.textContent = '狀態：連接失敗。';
        connectButton.disabled = false;
    }
});

createChatButton.addEventListener('click', async () => {
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
        displayError('WebRTC 尚未連接，請先點擊連接 Agent。');
        return;
    }
    connectionStatus.textContent = '狀態：正在創建聊天會話...';
    errorMessage.textContent = '';

    try {
        const chatCreationResponse = await fetchWithHandling('/api/create_chat', { method: 'POST' });
        // chatId = chatCreationResponse.id; // chatId 現在由後端 session 管理
        connectionStatus.textContent = `狀態：聊天會話已創建 (ID: ${chatCreationResponse.id.substring(0,10)}...)，可以開始對話。`;

        // <--- 新增：將 chat_id 和 created_at (如果存在) 存到 sessionStorage --->
        if (chatCreationResponse.id) {
            sessionStorage.setItem('current_chat_id', chatCreationResponse.id);
            console.log(`前端 sessionStorage 儲存 chat_id: ${chatCreationResponse.id}`);
        }
        if (chatCreationResponse.created) { // D-ID 返回的 chat_data 中有 'created' 欄位
            sessionStorage.setItem('current_chat_created_at_iso', chatCreationResponse.created);
            console.log(`前端 sessionStorage 儲存 chat_created_at_iso: ${chatCreationResponse.created}`);
        }
        // --- 新增結束 ---

        createChatButton.disabled = true;
        endChatButton.style.display = 'inline-block'; // << 顯示結束按鈕
        chatInterface.style.display = 'flex';
    } catch (error) {
        // displayError 已在 fetchWithHandling 中調用
        connectionStatus.textContent = '狀態：創建聊天失敗。';
    }
});


sendButton.addEventListener('click', async () => {
    const messageText = messageInput.value.trim();
    if (!messageText) {
        displayError('訊息不能為空！');
        return;
    }
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
        displayError('WebRTC 尚未連接。');
        return;
    }
    // chatId 由後端管理，前端不需要傳遞它
    if (!talkStreamId || !talkSessionId) {
        displayError('Talk Stream ID 或 Session ID 未定義。');
        return;
    }

    // <--- 新增：顯示用戶發送的消息 --->
    displayMessageInChatHistory('你', messageText);

    // <--- 關鍵日誌點 3.1 --->
    // 在發送前，打印將要傳遞給後端 /api/send_message 的 talkStreamId 和 talkSessionId
    //console.log('DEBUG (main.js sendButton): 即將發送給 /api/send_message 的 talk_stream_id:', talkStreamId);
    //console.log('DEBUG (main.js sendButton): 即將發送給 /api/send_message 的 talk_session_id:', talkSessionId); // **確認這個值**


    connectionStatus.textContent = '狀態：正在發送訊息...';
    errorMessage.textContent = '';

    try {
        // <--- 獲取並檢查 fetchWithHandling 的返回值 --->
        const didResponse = await fetchWithHandling('/api/send_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: messageText,
                talk_stream_id: talkStreamId,
                talk_session_id: talkSessionId
            }),
        });

        // <--- 打印 D-ID 的實際回應 (從你的後端轉發過來的) --->
        console.log('DEBUG (main.js sendButton): D-ID API (/agents/.../chat) 的實際回應 (透過後端):', JSON.stringify(didResponse, null, 2));

        // 即使 D-ID 返回的是 {"chatMode": "Functional", ...}，只要 HTTP 狀態是成功的 (fetchWithHandling 已處理)
        // 並且你的後端也成功代理了請求，這裡就不應該視為錯誤。
        // 我們主要依賴 Data Channel 獲取 Agent 的文本。

        messageInput.value = '';
        connectionStatus.textContent = '狀態：訊息已發送，等待 Agent 回應...'; // 更新狀態

    } catch (error) {
        // fetchWithHandling 內部已經調用了 displayError
        connectionStatus.textContent = '狀態：發送訊息失敗。';
        console.error("發送訊息時發生錯誤:", error);
        // 這裡的 error 應該是 fetchWithHandling 拋出的，包含了詳細信息
    }
});

unMuteButton.addEventListener('click', () => {
    if (agentVideo.srcObject) { // 確保視頻源已設置
        agentVideo.muted = !agentVideo.muted;
        unMuteButton.textContent = agentVideo.muted ? '取消靜音 / Unmute' : '靜音 / Mute';
        console.log(agentVideo.muted ? "視頻已靜音" : "視頻已取消靜音");
    } else {
        console.log("無法切換靜音狀態：視頻源未設置。");
    }
});

endChatButton.addEventListener('click', async () => {
    connectionStatus.textContent = '狀態：正在結束對話並儲存紀錄...';
    errorMessage.textContent = '';
    endChatButton.disabled = true;

    if (currentChatHistory.length === 0) {
        connectionStatus.textContent = '狀態：沒有對話紀錄可以儲存。';
        // 仍然可以執行關閉 WebRTC 等清理操作
        // ... (WebRTC 清理邏輯) ...
        resetUIForNewChat(); // 一個新的函式來重置UI
        return;
    }

    try {
        // <--- 修改：從 sessionStorage 獲取 chat_id 和 created_at_iso --->
        const chatIdForSave = sessionStorage.getItem('current_chat_id');
        const createdAtIsoForSave = sessionStorage.getItem('current_chat_created_at_iso');

        console.log(`準備儲存聊天紀錄: chat_id='${chatIdForSave}', created_at_iso='${createdAtIsoForSave}'`);
        console.log("要發送的 currentChatHistory:", JSON.stringify(currentChatHistory, null, 2));


        const saveResponse = await fetchWithHandling('/api/save_chat_history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // 如果 chat_id 或 created_at_iso 從 sessionStorage 獲取不到，可以選擇不傳遞或傳遞 null
                chat_id: chatIdForSave,
                created_at_iso: createdAtIsoForSave,
                messages: currentChatHistory
            }),
        });

        connectionStatus.textContent = `狀態：聊天紀錄處理完成。伺服器訊息: ${saveResponse.message || JSON.stringify(saveResponse)}`;
        if (saveResponse.saved_data) {
            console.log("儲存到 MongoDB 的數據 (來自後端確認):", JSON.stringify(saveResponse.saved_data, null, 2));
        }

        currentChatHistory = [];
        document.getElementById('chat-history').innerHTML = '';
        // 清除 sessionStorage 中的聊天特定信息
        sessionStorage.removeItem('current_chat_id');
        sessionStorage.removeItem('current_chat_created_at_iso');
        resetUIForNewChat();

    } catch (error) {
        connectionStatus.textContent = '狀態：儲存聊天紀錄失敗。';
        console.error("儲存聊天紀錄時發生錯誤:", error); // 打印詳細錯誤
        endChatButton.disabled = false;
    }
});

function resetUIForNewChat() {
    chatInterface.style.display = 'none';
    endChatButton.style.display = 'none';
    createChatButton.disabled = false;
    connectButton.disabled = false; // 或者根據你的流程決定是否重置 connectButton

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        console.log("WebRTC 連線已關閉 (resetUI)");
    }
    if (talkStreamId && talkSessionId) {
        // 仍然建議通知後端刪除 D-ID 上的 stream，以釋放資源
        fetch('/api/delete_stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stream_id: talkStreamId, session_id: talkSessionId }),
        }).then(res => res.json())
          .then(data => console.log('Delete stream response (resetUI):', data))
          .catch(err => console.error('Error deleting stream (resetUI):', err));
        talkStreamId = null;
        talkSessionId = null;
    }
    connectionStatus.textContent = '狀態：未連接。請連接 Agent 開始新的對話。';
}

// 在 createChatButton 成功創建聊天後，也可以考慮在前端某處（例如 sessionStorage）保存 chat_id 和 created_at_iso
// 這樣在 save_chat_history 時可以一起發送給後端，方便後端知道這個聊天記錄對應哪個 D-ID chat session
// 例如，在 createChatButton.addEventListener('click', ...) 成功後：
// sessionStorage.setItem('frontend_chat_id', chatCreationResponse.id);
// sessionStorage.setItem('frontend_chat_created_at_iso', chatCreationResponse.created); // 假設 chatCreationResponse 包含 created

// 在 main.js 的頂部或合適的位置添加這個函式
function displayMessageInChatHistory(sender, text) {
    const chatHistoryDiv = document.getElementById('chat-history'); // 假設你有一個 ID 為 chat-history 的 div
    if (chatHistoryDiv) {
        const messageElement = document.createElement('p');
        messageElement.innerHTML = `<strong>${sender}:</strong> ${text.replace(/\n/g, '<br>')}`; // 處理換行
        chatHistoryDiv.appendChild(messageElement);
        chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight; // 自動滾動到底部
    } else {
        console.warn("找不到 ID 為 'chat-history' 的元素來顯示聊天記錄。");
    }

    // <--- 新增：將消息存入 currentChatHistory --->
    currentChatHistory.push({
        role: sender.toLowerCase() === '你' ? 'user' : 'assistant', // 或 'agent'
        content: text,
        timestamp: new Date().toISOString() // 使用 ISO 格式的時間戳
    });
    console.log("Current Chat History:", currentChatHistory); // 方便調試
}

// 處理頁面卸載，嘗試關閉 stream
window.addEventListener('beforeunload', async (event) => {
    if (peerConnection && talkStreamId && talkSessionId) {
        // 這裡不能直接 await，因為 beforeunload 是同步的
        // 可以嘗試用 navigator.sendBeacon，但它通常用於小數據量的 POST
        // 最好的方式是讓 D-ID 的超時機制來處理，或者用戶明確點擊“斷開”按鈕
        try {
             // 可能需要一個“斷開連接”按鈕來明確調用這個 但是為啥移植錯阿 氣死
            // fetch('/api/delete_stream', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ stream_id: talkStreamId, session_id: talkSessionId }),
            //     keepalive: true // 嘗試在頁面卸載時保持請求
            // });
            console.log("頁面即將卸載，應在此處處理stream關閉。建議使用明確的'斷開'按鈕。");
        } catch(e) {
            console.error("關閉 stream 時出錯: ", e);
        }
    }
});