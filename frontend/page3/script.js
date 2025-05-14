document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('backToPage1ButtonP3');
    const homeButton = document.getElementById('homeButtonP3');
    const pageTitleElement = document.getElementById('pageTitleP3');
    const videoElement = document.getElementById('characterVideoP3');

    // 懸浮框元素
    const initialActionModal = document.getElementById('initialActionModal');
    const modalStatusDisplay = document.getElementById('modalStatusDisplay');
    const modalConnectAgentBtn = document.getElementById('modalConnectAgentBtn');
    const modalCreateChatBtn = document.getElementById('modalCreateChatBtn');
    // const closeModalBtn = document.getElementById('closeModalBtn'); // 如果有獨立關閉按鈕

    const micButton = document.getElementById('micButtonP3');
    const generatedTextDisplay = document.getElementById('generatedTextP3');

    let agentConnected = false; // 追蹤 Agent 連接狀態

    // 從 localStorage 獲取使用者和角色資訊
    const userName = localStorage.getItem('userName');
    const selectedCharacter = localStorage.getItem('selectedCharacter');

    // 更新頁面標題
    if (pageTitleElement) {
        if (userName) {
            pageTitleElement.textContent = `${userName} 的互動體驗`;
        } else {
            pageTitleElement.textContent = `互動體驗 (${selectedCharacter === 'girl' ? '角色1' : '角色2'})`;
        }
    }

    // 根據選擇的角色設定 video source
    if (videoElement && selectedCharacter) {
        const videoFileName = selectedCharacter === 'girl' ? 'girl-video.mp4' : 'boy-video.mp4';
        const sourceElement = videoElement.querySelector('source[type="video/mp4"]');
        if (sourceElement) {
            sourceElement.setAttribute('src', videoFileName);
        }
        videoElement.load();
    } else if (videoElement) {
        console.warn("未選擇角色或影片元素未找到，將使用預設影片。");
        const sourceElement = videoElement.querySelector('source[type="video/mp4"]');
        if (sourceElement) {
            sourceElement.setAttribute('src', 'default-video.mp4');
        }
        videoElement.load();
    }

    // --- 更新狀態和文字顯示的函數 ---
    function updateModalStatus(text) {
        if (modalStatusDisplay) {
            modalStatusDisplay.textContent = `狀態：${text}`;
        }
        console.log("Modal Status Updated:", text);
    }

    function updateGeneratedText(text) {
        if (generatedTextDisplay) {
            generatedTextDisplay.innerHTML = text;
            generatedTextDisplay.scrollTop = generatedTextDisplay.scrollHeight;
        }
        console.log("Generated Text Updated:", text);
    }

    // --- 懸浮框按鈕事件 ---
    if (modalConnectAgentBtn) {
        modalConnectAgentBtn.addEventListener('click', function() {
            updateModalStatus("正在嘗試連接 Agent...");
            // TODO: 實際的連接 Agent 邏輯
            setTimeout(() => { // 模擬異步操作
                const isSuccess = true; // 提高成功率以便測試
                if (isSuccess) {
                    agentConnected = true;
                    updateModalStatus("已成功連接 Agent！請創建聊天。");
                    if (modalCreateChatBtn) {
                        modalCreateChatBtn.disabled = false; // 啟用創建聊天按鈕
                        modalCreateChatBtn.style.backgroundColor = ''; // 恢復預設背景色
                    }
                    modalConnectAgentBtn.disabled = true; // 連接成功後禁用自己
                } else {
                    agentConnected = false;
                    updateModalStatus("連接 Agent 失敗，請重試。");
                     if (modalCreateChatBtn) {
                        modalCreateChatBtn.disabled = true;
                    }
                }
            }, 1500);
        });
    }

    if (modalCreateChatBtn) {
        modalCreateChatBtn.addEventListener('click', function() {
            if (!agentConnected) {
                updateModalStatus("請先成功連接 Agent。");
                return;
            }
            updateModalStatus("正在創建聊天會話...");
            // TODO: 實際的創建聊天邏輯
            setTimeout(() => {
                updateModalStatus("聊天會話已創建。");
                updateGeneratedText("你好！我是您的虛擬助手。今天想聊些什麼呢？<br>您可以透過麥克風與我交談。");
                // 隱藏懸浮框
                if (initialActionModal) {
                    initialActionModal.classList.remove('active');
                }
            }, 1000);
        });
    }


    // --- 導航按鈕 ---
    if (backButton) {
        backButton.addEventListener('click', function() {
            window.location.href = '../page1/index.html';
        });
    }
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            window.location.href = '../page2/page2.html';
        });
    }

    // --- 初始狀態設定 ---
    function initializePage() {
        updateGeneratedText("請在彈出視窗中完成初始設定以開始互動。");
        if (initialActionModal) {
            initialActionModal.classList.add('active'); // 頁面載入時顯示懸浮框
        }
        updateModalStatus("等待操作...");
        if (modalCreateChatBtn) {
            modalCreateChatBtn.disabled = true; // 確保創建聊天初始是禁用的
        }
        agentConnected = false;
    }

    initializePage(); // 初始化頁面

});