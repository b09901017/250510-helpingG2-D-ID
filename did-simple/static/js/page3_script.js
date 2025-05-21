document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('backToPage1ButtonP3');
    const homeButton = document.getElementById('homeButtonP3');
    const pageTitleElement = document.getElementById('pageTitleP3');
    const videoElement = document.getElementById('characterVideoP3');
    const micButton = document.getElementById('micButtonP3');
    const generatedTextDisplay = document.getElementById('generatedTextP3');
    const micButtonIcon = micButton ? micButton.querySelector('.mic-icon-p3') : null;
    
    const defaultMicIconSrc = micButtonIcon ? micButtonIcon.src : '/static/images/page3/mic0.svg';
    const recordingMicIconSrc = '/static/images/page3/mic_recording.svg';

    let recognition = null;
    let isRecognizing = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function initializePage() {
        const userName = localStorage.getItem('userName');
        if (pageTitleElement) {
            pageTitleElement.textContent = userName ? `${userName} 的互動體驗` : `互動體驗`;
        }
        updateGeneratedText("點擊麥克風開始與角色對話。");

        if (SpeechRecognition) {
            setupSpeechRecognition();
        } else {
            updateGeneratedText("抱歉，您的瀏覽器不支援語音辨識功能。");
            if (micButton) micButton.style.display = 'none'; // 直接隱藏麥克風按鈕
        }
    }

    function updateGeneratedText(text) {
        if (generatedTextDisplay) {
            generatedTextDisplay.innerHTML = text;
        }
        console.log("狀態/訊息:", text);
    }

    function setupSpeechRecognition() {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'zh-TW';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = function() {
            isRecognizing = true;
            updateGeneratedText("正在聆聽...");
            if (micButtonIcon) micButtonIcon.src = recordingMicIconSrc;
            if (micButton) micButton.disabled = true; // 聆聽時禁用按鈕避免重複觸發
        };

        recognition.onresult = async function(event) {
            const speechResult = event.results[0][0].transcript.trim();
            updateGeneratedText(`你說: ${speechResult}`);
            
            if (speechResult) {
                updateGeneratedText(`AI 正在準備回應 "${speechResult}"...`);
                try {
                    const response = await fetch('/api/generate_talk', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ text: speechResult }),
                    });
                    const data = await response.json();

                    if (data.video_url) {
                        updateGeneratedText(`AI 正在播放影片...`);
                        videoElement.src = data.video_url;
                        videoElement.muted = false; // 嘗試解除靜音
                        videoElement.play();
                    } else {
                        updateGeneratedText(`影片生成失敗: ${data.details || data.error || '未知錯誤'}`);
                        if (micButton) micButton.disabled = false; // 失敗時重新啟用麥克風
                    }
                } catch (error) {
                    updateGeneratedText(`處理請求時發生錯誤: ${error.message}`);
                    if (micButton) micButton.disabled = false; // 失敗時重新啟用麥克風
                }
            } else {
                updateGeneratedText("沒有辨識到有效的語音內容。");
                if (micButton) micButton.disabled = false; // 沒有辨識到也啟用麥克風
            }

            const terminationKeywords = ["掰掰", "再見", "拜拜", "結束對話", "結束"];
            if (terminationKeywords.some(keyword => speechResult.includes(keyword))) {
                updateGeneratedText("偵測到結束關鍵字，正在結束對話...");
                window.location.href = '/page4';
            }
        };

        recognition.onerror = function(event) {
            updateGeneratedText(`語音辨識錯誤: ${event.error}`);
            // 錯誤發生後，確保 onend 會被調用以重設狀態
        };

        recognition.onend = function() {
            isRecognizing = false;
            if (micButtonIcon) micButtonIcon.src = defaultMicIconSrc;
            if (micButton) micButton.disabled = false; // 辨識結束後重新啟用按鈕
            console.log('語音辨識結束。');
        };
    }

    if (micButton && SpeechRecognition) {
        micButton.addEventListener('click', function() {
            if (!isRecognizing) { // 只有在沒有辨識中才啟動
                try {
                    recognition.start();
                } catch(e) {
                    updateGeneratedText("啟動語音辨識失敗，請檢查麥克風權限。");
                    if (micButton) micButton.disabled = false;
                }
            }
        });
    }

    if (backButton) {
        backButton.addEventListener('click', function() {
            if (recognition && isRecognizing) recognition.abort();
            window.location.href = '/page2';
        });
    }
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            if (recognition && isRecognizing) recognition.abort();
            window.location.href = '/page1';
        });
    }

    if (videoElement) {
        videoElement.onended = function() {
            updateGeneratedText("影片播放完畢。點擊麥克風再次對話。");
            if (micButton) micButton.disabled = false;
        };
        videoElement.onerror = function() {
            updateGeneratedText("影片播放時發生錯誤。");
             if (micButton) micButton.disabled = false;
        }
    }

    initializePage();
});