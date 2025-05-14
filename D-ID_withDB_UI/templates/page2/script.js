document.addEventListener('DOMContentLoaded', function() {
    const selectGirlButton = document.getElementById('selectGirl');
    const selectBoyButton = document.getElementById('selectBoy');
    const backButton = document.getElementById('backToPage1Button');
    const homeButton = document.getElementById('homeButtonP2');
    const welcomeMessageElement = document.getElementById('welcomeMessageP2');

    // 顯示歡迎訊息
    const userName = localStorage.getItem('userName');
    if (userName && welcomeMessageElement) {
        welcomeMessageElement.textContent = `歡迎，${userName}！請選擇角色。`;
    } else if (welcomeMessageElement) {
        welcomeMessageElement.textContent = '請選擇角色';
    }

    // 選擇女孩
    if (selectGirlButton) {
        selectGirlButton.addEventListener('click', function() {
            console.log("選擇了：女孩 (girl)");
            localStorage.setItem('selectedCharacter', 'girl');
            window.location.href = '../page3/page3.html';
        });
    }

    // 選擇男孩
    if (selectBoyButton) {
        selectBoyButton.addEventListener('click', function() {
            console.log("選擇了：男孩 (boy)");
            localStorage.setItem('selectedCharacter', 'boy');
            window.location.href = '../page3/page3.html';
        });
    }

    // 返回 Page 1 按鈕
    if (backButton) {
        backButton.addEventListener('click', function() {
            window.location.href = '../page1/index.html';
        });
    }

    // Home 按鈕返回 Page 1
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            window.location.href = '../page1/index.html';
        });
    }
});