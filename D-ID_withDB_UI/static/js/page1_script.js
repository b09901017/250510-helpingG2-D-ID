document.addEventListener('DOMContentLoaded', function() {
    const userNameInput = document.getElementById('userNameInput');
    const nextPageButton = document.getElementById('nextPageButton');
    const homeButton = document.getElementById('homeButton');
    const settingsButton = document.getElementById('settingsButton'); // 假設右上角是設定按鈕

    // 處理跳轉到下一頁的函數
    function goToNextPage() {
        const userName = userNameInput.value.trim(); // 去除前後空格

        if (userName === "") {
            alert("請輸入使用者姓名！");
            userNameInput.focus(); // 讓使用者可以繼續輸入
            return;
        }

        // 1. Console log 輸入的名稱
        console.log("使用者名稱:", userName);

        // 2. 儲存到 localStorage (全域儲存)
        try {
            localStorage.setItem('userName', userName);
            console.log(`'${userName}' 已儲存到 localStorage。`);
        } catch (e) {
            console.error("儲存到 localStorage 失敗:", e);
            alert("儲存使用者名稱失敗，可能您的瀏覽器不支援或已滿。");
            return; // 如果儲存失敗，可能不應該繼續
        }

        // 3. 跳轉到下一頁
        window.location.href = '/page2';
    }

    // 點擊“下一步”按鈕
    if (nextPageButton) {
        nextPageButton.addEventListener('click', goToNextPage);
    } else {
        console.error("Button with id 'nextPageButton' not found.");
    }

    // 在輸入框按 Enter 鍵
    if (userNameInput) {
        userNameInput.addEventListener('keypress', function(event) {
            // keyCode 13 是 Enter 鍵
            if (event.key === 'Enter' || event.keyCode === 13) {
                event.preventDefault(); // 防止表單預設提交行為 (如果有的話)
                goToNextPage();
            }
        });
    } else {
        console.error("Input with id 'userNameInput' not found.");
    }

    // 點擊 Home 按鈕回到本頁 (重新載入)
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            // 可以直接重新載入，或導向到 index.html
            window.location.href = '/page1'; // 或者 window.location.reload();
        });
    } else {
        console.error("Button with id 'homeButton' not found.");
    }

    // 右上角設定按鈕的範例事件 (您可以自行修改其功能)
    if (settingsButton) {
        settingsButton.addEventListener('click', function() {
            alert('設定按鈕被點擊！您可以在此處添加具體功能。');
            // 例如：顯示設定選單、跳轉到設定頁面等
        });
    }

});