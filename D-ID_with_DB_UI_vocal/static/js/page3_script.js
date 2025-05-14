document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Element Selections for page3 ---
    const backButton = document.getElementById('backToPage1ButtonP3');
    const homeButton = document.getElementById('homeButtonP3');
    const pageTitleElement = document.getElementById('pageTitleP3');
    const videoElement = document.getElementById('characterVideoP3');
    const micButton = document.getElementById('micButtonP3'); // Mic button, functionality deferred

    // Modal elements
    const initialActionModal = document.getElementById('initialActionModal');
    const modalStatusDisplay = document.getElementById('modalStatusDisplay');
    const modalConnectAgentBtn = document.getElementById('modalConnectAgentBtn');
    const modalCreateChatBtn = document.getElementById('modalCreateChatBtn');

    // Text display area for AI responses
    const generatedTextDisplay = document.getElementById('generatedTextP3');

    // 聲音辨識東東：
    const micButtonIcon = micButton ? micButton.querySelector('.mic-icon-p3') : null;
    const defaultMicIconSrc = micButtonIcon ? micButtonIcon.src : ''; // 儲存預設圖示
    // 您需要新增一個錄音狀態的圖示，例如 'mic_recording.svg' 並放在 'static/images/page3/'
    const recordingMicIconSrc = "{{ url_for('static', filename='images/page3/mic_recording.svg') }}";


    // --- Global Application State and UI Element Mapping for page3 ---
    const page3UiElements = {
        connectButton: modalConnectAgentBtn,
        createChatButton: modalCreateChatBtn,
        agentVideo: videoElement,
        connectionStatus: modalStatusDisplay, // Used for status and errors
        errorMessage: modalStatusDisplay,     // Errors will also appear in the status display
        chatHistory: generatedTextDisplay,    // AI responses will appear here
        // Elements not present or not used in this version for page3:
        // chatInterface: null,
        // endChatButton: null,
        // unMuteButton: null,
        // messageInput: null
    };

    const page3GlobalAppRefs = {
        peerConnection: null,
        talkStreamId: null,
        talkSessionId: null,
        iceServers: [],
        chatHistory: [] // Stores chat messages {role, content, timestamp}
    };

    // --- UI Handler Functions (adapted for page3) ---
    // Assumes ui_handlers.js is loaded and its functions (displayErrorOnPage, updateConnectionStatusUI, displayMessageInChatHistoryUI) are globally available.
    const page3UiHandlerFunctions = {
        displayError: (msg) => {
            // Prepend "錯誤: " to the message if it's not already there
            const displayMsg = msg.startsWith('錯誤: ') ? msg : `錯誤: ${msg}`;
            if (page3UiElements.errorMessage) {
                page3UiElements.errorMessage.textContent = displayMsg;
            }
            console.error('UI Error (page3):', msg);
        },
        updateConnectionStatus: (status) => {
             if (page3UiElements.connectionStatus) {
                page3UiElements.connectionStatus.textContent = `狀態：${status}`;
            }
            console.log('UI Status Update (page3):', status);
        },
        displayMessageInChatHistory: (sender, text) => {
            // For page3, AI messages are displayed in generatedTextDisplay.
            // We'll ignore sender '你' for now as user input is deferred.
            if (sender.toLowerCase() === 'ai' || sender.toLowerCase() === 'agent' || sender.toLowerCase() === 'assistant') {
                if (page3UiElements.chatHistory) {
                    page3UiElements.chatHistory.innerHTML = text.replace(/\n/g, '<br>'); // Replace entire content
                    page3UiElements.chatHistory.scrollTop = page3UiElements.chatHistory.scrollHeight;
                }
            }
             console.log(`Message to display (page3) - Sender: ${sender}, Text: ${text}`);
        },
        resetChatUI: () => {
            if (page3UiElements.chatHistory) {
                page3UiElements.chatHistory.innerHTML = '請先完成初始設定...';
            }
            if (page3UiElements.connectButton) {
                page3UiElements.connectButton.disabled = false;
                 page3UiElements.connectButton.style.backgroundColor = ''; // Restore default background
            }
            if (page3UiElements.createChatButton) {
                page3UiElements.createChatButton.disabled = true;
            }
            if (initialActionModal && !initialActionModal.classList.contains('active')) {
                initialActionModal.classList.add('active');
            }
            page3UiHandlerFunctions.updateConnectionStatus('等待操作...');
            console.log('Chat UI Reset (page3)');
        },
        showChatInterface: () => {
            // In page3, this means the chat is ready. Hide modal, update text.
            page3UiHandlerFunctions.updateConnectionStatus("聊天會話已創建。");
            updateGeneratedTextFromScript("你好！我是林品涵。準備好開始對話了。"); // Use the local helper
            if (initialActionModal && initialActionModal.classList.contains('active')) {
                initialActionModal.classList.remove('active');
            }
            console.log('Chat Interface Shown (page3 logic: modal hidden)');
        },
        toggleUnmuteButton: (show) => {
            // page3 does not have a dedicated unmute button in this iteration.
            console.log('Toggle Unmute Button (page3): No action, show =', show);
        }
    };

    // --- API and WebRTC Handler Function Objects ---
    // Assumes api_handlers.js and webrtc_handlers.js are loaded and their functions are globally available.
    const page3ApiHandlerFunctions = {
        callCreateStreamAPI, callStartStreamSdpAPI, callSendIceCandidateAPI,
        callCreateChatAPI, callSendMessageAPI, callSaveChatHistoryAPI, callDeleteStreamAPI
    };

    const page3WebrtcManagerFunctions = {
        createPeerConnection, setupAndStartWebRTC, handleRemoteTrack, closePeerConnection
    };

    // --- Original page3 functions (e.g., for localStorage, title, video source) ---
    const userName = localStorage.getItem('userName');
    const selectedCharacter = localStorage.getItem('selectedCharacter');

    if (pageTitleElement) {
        if (userName) {
            pageTitleElement.textContent = `${userName} 的互動體驗`;
        } else {
            pageTitleElement.textContent = `互動體驗 (${selectedCharacter === 'girl' ? '角色1' : '角色2'})`;
        }
    }

    if (videoElement && selectedCharacter) {
        const videoFileName = selectedCharacter === 'girl' ? 'girl-video.mp4' : 'boy-video.mp4';
        const sourceElement = videoElement.querySelector('source[type="video/mp4"]');
        if (sourceElement) {
            sourceElement.setAttribute('src', videoFileName);
        }
        videoElement.load();
    } else if (videoElement) {
        console.warn("未選擇角色或影片元素未找到，將使用預設影片 (your-video.mp4)。");
        // Default video is already in HTML, no need to change unless it's a different default.
    }

    // --- Speech Recognition Setup --- 
    
    // 語音辨識相關變數
    let recognition = null;
    let isRecognizing = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; // 使用者說完一段話後即停止，然後回傳結果
        recognition.lang = 'zh-TW';     // 設定語言為台灣繁體中文
        recognition.interimResults = false; // 我們只需要最終結果
        recognition.maxAlternatives = 1;

        recognition.onstart = function() {
            isRecognizing = true;
            updateGeneratedTextFromScript("正在聆聽..."); // 您現有的輔助函式
            if (micButtonIcon) micButtonIcon.src = recordingMicIconSrc; // 更改麥克風圖示
            // 若有需要，可為麥克風按鈕添加樣式以提供視覺回饋，例如：micButton.classList.add('recording');
        };

        recognition.onresult = function(event) {
            const speechResult = event.results[0][0].transcript.trim();
            console.log('語音辨識結果:', speechResult);
            updateGeneratedTextFromScript(`你說: ${speechResult}`); // 顯示使用者說的話

            // <<<<< 新增/確認此處：將使用者說的話加入聊天記錄 >>>>>
        if (page3GlobalAppRefs && page3GlobalAppRefs.chatHistory) {
            page3GlobalAppRefs.chatHistory.push({
                role: 'user', // 或 '你'
                content: speechResult,
                timestamp: new Date().toISOString()
            });
            console.log('使用者訊息已加入 page3GlobalAppRefs.chatHistory:', page3GlobalAppRefs.chatHistory);
        }
        // <<<<< 新增/確認結束 >>>>>

            // 傳送給 D-ID 代理人 (重用現有邏輯)
            if (page3GlobalAppRefs.peerConnection && page3GlobalAppRefs.peerConnection.connectionState === 'connected' &&
                page3GlobalAppRefs.talkStreamId && page3GlobalAppRefs.talkSessionId) {
                page3ApiHandlerFunctions.callSendMessageAPI(
                    speechResult,
                    page3GlobalAppRefs.talkStreamId,
                    page3GlobalAppRefs.talkSessionId,
                    page3UiHandlerFunctions.displayError,
                    page3UiHandlerFunctions.updateConnectionStatus
                ).then(didApiResponse => {
                    console.log('D-ID API 對語音的回應:', didApiResponse);
                    // AI 的回應會由 data channel -> chat_handlers.js -> ui_handlers.js -> page3UiHandlerFunctions.displayMessageInChatHistory 處理
                    // 這會更新 generatedTextP3 (覆寫使用者說的話)
                }).catch(err => {
                    console.error('傳送語音訊息給 D-ID 時發生錯誤:', err);
                    page3UiHandlerFunctions.displayError('傳送語音訊息失敗');
                });
            } else {
                page3UiHandlerFunctions.displayError("無法傳送訊息，連線尚未就緒。");
                // 如果 modal 已隱藏，提示使用者完成連線/聊天創建
                if (initialActionModal && !initialActionModal.classList.contains('active')) {
                    initialActionModal.classList.add('active');
                }
            }

            // 關鍵字偵測
            const terminationKeywords = ["掰", "再見", "拜", "結束對話", "結束"];
            if (terminationKeywords.some(keyword => speechResult.includes(keyword))) {
                console.log("偵測到結束對話關鍵字。");
                updateGeneratedTextFromScript(`偵測到關鍵字: ${speechResult}。正在結束對話...`);
                initiateChatTermination();
            }
        };

        recognition.onerror = function(event) {
            isRecognizing = false;
            console.error('語音辨識錯誤:', event.error);
            let UImessage = '語音辨識發生錯誤';
            if (event.error === 'no-speech') UImessage = '沒有偵測到語音，請再試一次。';
            else if (event.error === 'audio-capture') UImessage = '無法擷取麥克風音訊。';
            else if (event.error === 'not-allowed') UImessage = '麥克風存取被拒絕。';
            updateGeneratedTextFromScript(UImessage);
            if (micButtonIcon) micButtonIcon.src = defaultMicIconSrc;
            // micButton.classList.remove('recording');
        };

        recognition.onend = function() {
            isRecognizing = false;
            if (micButtonIcon) micButtonIcon.src = defaultMicIconSrc; // 重設麥克風圖示
            // micButton.classList.remove('recording');
            console.log('語音辨識結束。');
        };

    } else {
        console.warn("此瀏覽器不支援 Web Speech API。");
        if (micButton) micButton.disabled = true;
        updateGeneratedTextFromScript("抱歉，您的瀏覽器不支援語音辨識功能。");
    }

    // 修改 page3_script.js 中的麥克風按鈕事件監聽器
if (micButton) {
    // 若舊的監聽器存在，先移除 (假設 existingMicButtonClickHandler 是舊的處理函式名稱)
    // if (typeof existingMicButtonClickHandler === 'function') {
    //     micButton.removeEventListener('click', existingMicButtonClickHandler);
    // }
    micButton.addEventListener('click', function() {
        if (!recognition) {
            updateGeneratedTextFromScript("語音辨識功能不可用。");
            return;
        }

        // 檢查 D-ID 連線和聊天室是否已啟用
        if (!page3GlobalAppRefs.peerConnection || page3GlobalAppRefs.peerConnection.connectionState !== 'connected') {
            page3UiHandlerFunctions.displayError("請先連接 Agent。");
            if (initialActionModal && !initialActionModal.classList.contains('active')) {
                 initialActionModal.classList.add('active');
                 page3UiHandlerFunctions.updateConnectionStatus("請先完成連接。");
            }
            return;
        }
        if (!sessionStorage.getItem('current_chat_id')) { // 檢查聊天室是否已啟用
             page3UiHandlerFunctions.displayError("請先創建聊天。");
             if (initialActionModal && !initialActionModal.classList.contains('active')) {
                 initialActionModal.classList.add('active');
                 if(modalConnectAgentBtn) modalConnectAgentBtn.disabled = true; // 假設代理人已連接
                 if(modalCreateChatBtn) modalCreateChatBtn.disabled = false;
                 page3UiHandlerFunctions.updateConnectionStatus("請點擊創建聊天。");
             }
             return;
        }

        if (isRecognizing) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (e) {
                console.error("啟動語音辨識失敗:", e);
                updateGeneratedTextFromScript("啟動語音辨識失敗，請檢查麥克風。");
            }
        }
    });
}


// page3_script.js 中的新函式
async function initiateChatTermination() {
    page3UiHandlerFunctions.updateConnectionStatus("正在結束對話並儲存記錄...");
    let historySavedSuccessfully = false;

    if (page3GlobalAppRefs.chatHistory && page3GlobalAppRefs.chatHistory.length > 0) {
        try {
            const chatIdForSave = sessionStorage.getItem('current_chat_id');
            const createdAtIsoForSave = sessionStorage.getItem('current_chat_created_at_iso');

            if (chatIdForSave) { // 僅在聊天室啟用時儲存
                console.log(`結束對話：儲存聊天記錄，chat_id='${chatIdForSave}'`);
                const saveResponse = await page3ApiHandlerFunctions.callSaveChatHistoryAPI(
                    page3GlobalAppRefs.chatHistory,
                    chatIdForSave,
                    createdAtIsoForSave,
                    (msg) => console.error("結束對話時儲存歷史記錄錯誤: ", msg),
                    (status) => console.log("結束對話儲存狀態:", status)
                );
                console.log("結束對話：聊天記錄已儲存:", saveResponse.message);
                historySavedSuccessfully = true;
            }
        } catch (error) {
            console.error("結束對話：儲存聊天記錄失敗:", error);
        }
    } else {
        console.log("結束對話：沒有聊天記錄可儲存。");
    }

    // 無論儲存是否成功，都清理本地歷史記錄和 session storage，但最好在嘗試儲存之後進行
    page3GlobalAppRefs.chatHistory = [];
    sessionStorage.removeItem('current_chat_id');
    sessionStorage.removeItem('current_chat_created_at_iso');

    // 呼叫主要的清理函式，並告知歷史記錄已處理 (或已嘗試處理)
    await cleanupBeforeNavigate(true); // 傳入 true 表示歷史記錄已處理

    page3UiHandlerFunctions.updateConnectionStatus("對話結束，正在跳轉...");
    window.location.href = '/page4'; // 確保 app.py 中已定義此路由
}

// 與音辨識結束

    // Helper function to update the main text display area from this script
    function updateGeneratedTextFromScript(text) {
        if (generatedTextDisplay) {
            generatedTextDisplay.innerHTML = text;
            generatedTextDisplay.scrollTop = generatedTextDisplay.scrollHeight;
        }
        console.log("Generated Text Updated (from script.js helper):", text);
    }

    // --- Event Listeners for Modal Buttons ---
    if (modalConnectAgentBtn) {
        modalConnectAgentBtn.addEventListener('click', async function() {
            console.log('Connect Agent button clicked (page3)');
            // Disable button during connection attempt
            modalConnectAgentBtn.disabled = true;
            modalCreateChatBtn.disabled = true; // Also disable create chat until connection is successful

            try {
                await handleConnectAndSetupWebRTC( // This function is from chat_handlers.js
                    page3UiElements,
                    page3ApiHandlerFunctions,
                    page3WebrtcManagerFunctions,
                    page3GlobalAppRefs,
                    page3UiHandlerFunctions
                );
                // If handleConnectAndSetupWebRTC is successful, it should call callbacks that enable modalCreateChatBtn
                // and disable modalConnectAgentBtn via onConnectionStateChangeCallback in chat_handlers.js
                // For example, if connectionstate is 'connected'.
            } catch (error) {
                console.error("Error during handleConnectAndSetupWebRTC (page3):", error);
                page3UiHandlerFunctions.displayError(error.message || "連接 Agent 失敗，請重試。");
                modalConnectAgentBtn.disabled = false; // Re-enable on failure
                modalCreateChatBtn.disabled = true;
            }
        });
    }

    if (modalCreateChatBtn) {
        modalCreateChatBtn.addEventListener('click', async function() {
            console.log('Create Chat button clicked (page3)');
            if (!page3GlobalAppRefs.peerConnection || page3GlobalAppRefs.peerConnection.connectionState !== 'connected') {
                page3UiHandlerFunctions.displayError("請先成功連接 Agent。");
                return;
            }
            modalCreateChatBtn.disabled = true; // Disable during attempt

            try {
                await handleCreateChatSession( // This function is from chat_handlers.js
                    page3UiElements,
                    page3ApiHandlerFunctions,
                    page3GlobalAppRefs,
                    page3UiHandlerFunctions // This includes showChatInterface to hide modal on success
                );
            } catch (error) {
                console.error("Error during handleCreateChatSession (page3):", error);
                page3UiHandlerFunctions.displayError(error.message || "創建聊天失敗，請重試。");
                // Only re-enable if agent is still connected
                if (page3GlobalAppRefs.peerConnection && page3GlobalAppRefs.peerConnection.connectionState === 'connected') {
                    modalCreateChatBtn.disabled = false;
                }
            }
        });
    }

    // --- Cleanup and Navigation ---
    async function cleanupBeforeNavigate(historyAlreadyHandled = false) {
    console.log('Page3: cleanupBeforeNavigate 被呼叫。歷史記錄是否已處理:', historyAlreadyHandled);
    page3UiHandlerFunctions.updateConnectionStatus('正在清理連線...');

    // 1. 如果歷史記錄尚未由結束流程處理，則儲存聊天記錄
    if (!historyAlreadyHandled && page3GlobalAppRefs.chatHistory && page3GlobalAppRefs.chatHistory.length > 0) {
        try {
            const chatIdForSave = sessionStorage.getItem('current_chat_id');
            const createdAtIsoForSave = sessionStorage.getItem('current_chat_created_at_iso');
            if (chatIdForSave) {
                console.log(`清理：儲存聊天記錄，chat_id='${chatIdForSave}'`);
                await page3ApiHandlerFunctions.callSaveChatHistoryAPI(
                    page3GlobalAppRefs.chatHistory,
                    chatIdForSave,
                    createdAtIsoForSave,
                    (msg) => console.error("清理時儲存歷史記錄錯誤: ", msg),
                    (status) => console.log("清理儲存狀態:", status)
                );
                console.log('清理：聊天記錄儲存嘗試完成。');
            }
        } catch (error) {
            console.error("清理：儲存聊天記錄失敗:", error);
        }
    }

    // 清理時務必清除本地 JS 歷史記錄陣列和 session storage
    page3GlobalAppRefs.chatHistory = [];
    sessionStorage.removeItem('current_chat_id');
    sessionStorage.removeItem('current_chat_created_at_iso');

    // 2. 關閉 WebRTC
    if (page3GlobalAppRefs.peerConnection) {
        page3GlobalAppRefs.peerConnection = page3WebrtcManagerFunctions.closePeerConnection(page3GlobalAppRefs.peerConnection);
    }

    // 3. 刪除 D-ID Stream
    if (page3GlobalAppRefs.talkStreamId && page3GlobalAppRefs.talkSessionId) {
        try {
            await page3ApiHandlerFunctions.callDeleteStreamAPI(
                page3GlobalAppRefs.talkStreamId,
                page3GlobalAppRefs.talkSessionId,
                (msg) => console.error("清理時刪除 stream 錯誤: ", msg)
            );
        } catch (err) {
            console.error("清理時刪除 stream API 呼叫失敗: ", err);
        } finally {
            page3GlobalAppRefs.talkStreamId = null;
            page3GlobalAppRefs.talkSessionId = null;
        }
    }
    page3UiHandlerFunctions.updateConnectionStatus('清理完成。');
    console.log('Page3: 清理程序完成。');
}

    if (backButton) {
        backButton.addEventListener('click', async function() {
            await cleanupBeforeNavigate();
            window.location.href = '/page1'; // Adjust path if necessary
        });
    }

    if (homeButton) {
        homeButton.addEventListener('click', async function() {
            await cleanupBeforeNavigate();
            window.location.href = '/page2'; // Adjust path if necessary
        });
    }

    window.addEventListener('beforeunload', (event) => {
        // This is a best-effort attempt. Modern browsers are restrictive.
        // Using sendBeacon is more reliable for unload events if your backend supports it for delete_stream.
        console.log('Page3: beforeunload event triggered.');
        if (page3GlobalAppRefs.talkStreamId && page3GlobalAppRefs.talkSessionId) {
            const payload = JSON.stringify({
                stream_id: page3GlobalAppRefs.talkStreamId,
                session_id: page3GlobalAppRefs.talkSessionId
            });
            // navigator.sendBeacon might be an option if your /api/delete_stream endpoint is simple
            // and can handle 'application/json' Content-Type via sendBeacon.
            // For now, this is a placeholder for synchronous cleanup if absolutely needed,
            // but true sync XHR is deprecated and often blocked.
            // The primary cleanup should happen on explicit navigation (back/home buttons).

            // A fetch with keepalive is better if sendBeacon is not an option
            if (typeof fetch === "function" && typeof navigator.sendBeacon !== "function") { // Check if fetch is available and sendBeacon isn't preferred/used
                 try {
                    fetch('/api/delete_stream', { // Ensure this path is correct from page3's perspective
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload,
                        keepalive: true
                    });
                    console.log('Page3: Sent fetch with keepalive to delete stream on unload.');
                } catch (e) {
                    console.error("Page3: Error sending fetch with keepalive for stream deletion:", e);
                }
            } else if (typeof navigator.sendBeacon === "function") {
                 // If you adapt your backend to handle sendBeacon (which often sends data as application/x-www-form-urlencoded or text/plain by default)
                 // navigator.sendBeacon('/api/delete_stream_beacon', payload); // Example
                 console.log('Page3: Consider using navigator.sendBeacon if backend supports it.');
            }
        }
    });

    // --- Initial Page Setup ---
    function initializePage() {
        updateGeneratedTextFromScript("請在彈出視窗中完成初始設定以開始互動。");
        if (initialActionModal && !initialActionModal.classList.contains('active')) {
            initialActionModal.classList.add('active');
        }
        page3UiHandlerFunctions.resetChatUI(); // This will set buttons and status correctly

        // Ensure global refs are clean
        if (page3GlobalAppRefs.peerConnection) {
            page3GlobalAppRefs.peerConnection = page3WebrtcManagerFunctions.closePeerConnection(page3GlobalAppRefs.peerConnection);
        }
        page3GlobalAppRefs.talkStreamId = null;
        page3GlobalAppRefs.talkSessionId = null;
        page3GlobalAppRefs.iceServers = [];
        page3GlobalAppRefs.chatHistory = [];
        console.log('Page Initialized (page3)');
    }

    initializePage(); // Call initialization
});