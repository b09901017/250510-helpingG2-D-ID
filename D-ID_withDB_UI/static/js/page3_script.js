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
            updateGeneratedTextFromScript("你好！我是您的虛擬助手。準備好開始對話了。"); // Use the local helper
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
    async function cleanupBeforeNavigate() {
        console.log('Page3: cleanupBeforeNavigate called.');
        if (page3GlobalAppRefs.peerConnection || page3GlobalAppRefs.talkStreamId) {
            page3UiHandlerFunctions.updateConnectionStatus('正在清理連線...');

            // Clear local chat history array (visuals cleared by resetUI or re-init)
            page3GlobalAppRefs.chatHistory = [];
            sessionStorage.removeItem('current_chat_id');
            sessionStorage.removeItem('current_chat_created_at_iso');

            if (page3GlobalAppRefs.peerConnection) {
                page3GlobalAppRefs.peerConnection = page3WebrtcManagerFunctions.closePeerConnection(page3GlobalAppRefs.peerConnection);
                 console.log('Page3: Peer connection closed via cleanup.');
            }

            if (page3GlobalAppRefs.talkStreamId && page3GlobalAppRefs.talkSessionId) {
                try {
                    console.log(`Page3: Attempting to delete stream: ${page3GlobalAppRefs.talkStreamId}`);
                    await page3ApiHandlerFunctions.callDeleteStreamAPI(
                        page3GlobalAppRefs.talkStreamId,
                        page3GlobalAppRefs.talkSessionId,
                        (msg) => console.error("Error during cleanup stream deletion (page3): ", msg)
                    );
                     console.log('Page3: Stream deletion API called.');
                } catch (err) {
                    console.error("Cleanup stream deletion API call failed (page3): ", err);
                } finally {
                    page3GlobalAppRefs.talkStreamId = null;
                    page3GlobalAppRefs.talkSessionId = null;
                }
            }
            page3UiHandlerFunctions.updateConnectionStatus('清理完成。');
            console.log('Page3: Cleanup process finished.');
        } else {
            console.log('Page3: No active connection or stream to clean up.');
        }
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