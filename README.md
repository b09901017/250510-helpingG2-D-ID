# D-ID 虛擬人互動應用程式 (整合語音輸入與 MongoDB) - D-ID_with_DB_UI_vocal

本專案是一個基於 Web 技術的應用程式，允許使用者透過多頁面介面與 D-ID 平台的虛擬數位人進行互動。使用者可以輸入姓名、選擇角色，然後進入互動頁面。在互動頁面，使用者可以透過**語音輸入**與虛擬人交談，AI 的回應也會以語音和文字形式呈現。當使用者說出特定關鍵字（如「掰掰」、「再見」）時，對話將自動結束，完整的聊天記錄會儲存到 MongoDB 資料庫，並跳轉至結束頁面。

此版本 (`D-ID_with_DB_UI_vocal`) 是在 `D-ID_withDB_UI` 的基礎上進行了功能增強，主要加入了語音辨識互動和流程自動化。

## 主要功能

* **多頁面使用者介面 (UI)**：
    * **Page 1**: 使用者名稱輸入。
    * **Page 2**: 角色選擇（例如：女孩、男孩）。
    * **Page 3**: 主要互動頁面，包含：
        * 虛擬人視訊播放。
        * **語音輸入**: 使用者可點擊麥克風按鈕，透過瀏覽器的 Web Speech API 進行語音輸入。
        * **文字顯示**: 使用者說的話和 AI 的回覆會依序顯示在指定的文字區域。
        * **自動解除靜音**: 當 WebRTC 連線成功且視訊開始播放後，會嘗試自動解除影片靜音。
        * **關鍵字結束對話**: 當使用者說出如「掰掰」、「再見」等關鍵字時，自動觸發結束流程。
    * **Page 4**: 對話結束頁面。
* **即時影音串流**：透過 D-ID Talks Streams API 與 WebRTC 建立與虛擬人的即時影音連線。
* **AI 對話互動**：
    * 使用者的語音輸入轉換為文字後，透過 D-ID Agents API 傳送給虛擬人。
    * 接收 AI 的回應並透過 WebRTC Data Channel 將文字顯示在 UI 上，同時虛擬人也會說出回應。
* **完整對話紀錄儲存**：在對話結束時（無論是透過關鍵字觸發或頁面導航），前端會收集包含使用者和 AI 雙方的完整對話紀錄，並將其儲存到指定的 MongoDB 資料庫中。
* **模組化後端 (Flask)**：
    * `app.py`: Flask 主應用程式，處理路由和基本設定。
    * `did_agent_handlers.py`: 處理與 D-ID Agent API (聊天邏輯) 相關的請求。
    * `did_stream_handlers.py`: 處理與 D-ID Talks Streams API (WebRTC 視訊串流) 相關的請求。
    * `mongo_handlers.py`: 處理與 MongoDB 資料庫操作相關的邏輯。
* **模組化前端 (JavaScript)**：
    * `page1_script.js`, `page2_script.js`, `page3_script.js`: 各頁面特定的 JavaScript 邏輯。
    * `api_handlers.js`: 處理前端呼叫後端 API 的函式。
    * `chat_handlers.js`: 控制聊天流程的主要邏輯 (連接、建立聊天、發送訊息、結束等)。
    * `ui_handlers.js`: 更新使用者介面顯示的函式。
    * `webrtc_handlers.js`: 處理 WebRTC 連線建立、媒體串流等的函式。

## 專案結構 (D-ID_with_DB_UI_vocal)
```text
D-ID_with_DB_UI_vocal/
├── app.py                     # Flask 主應用程式
├── did_agent_handlers.py      # D-ID Agent API 處理
├── did_stream_handlers.py     # D-ID Talks Streams API 處理
├── mongo_handlers.py          # MongoDB 操作處理
├── requirements.txt           # Python 依賴套件
├── static/
│   ├── css/
│   │   ├── page1_style.css
│   │   ├── page1_vars.css
│   │   ├── page2_style.css
│   │   ├── page2_vars.css
│   │   ├── page3_style.css
│   │   └── page3_vars.css
│   ├── images/                # 存放所有圖片資源
│   │   ├── page1/
│   │   ├── page2/
│   │   └── page3/
│   │       └── mic_recording.svg # (建議) 麥克風錄音狀態圖示
│   └── js/
│       ├── api_handlers.js
│       ├── chat_handlers.js
│       ├── page1_script.js
│       ├── page2_script.js
│       ├── page3_script.js    # 包含語音辨識和關鍵字結束邏輯
│       ├── ui_handlers.js
│       └── webrtc_handlers.js
└── templates/
├── page1/
│   └── index.html
├── page2/
│   └── page2.html
├── page3/
│   └── page3.html
└── page4/                 # 新增
└── page4.html         # 新增 - 對話結束頁面
```
## 設定與執行

1.  **安裝依賴套件**:
    在您的終端機中，進入 `D-ID_with_DB_UI_vocal` 資料夾，然後安裝 Python 套件：
    ```bash
    cd D-ID_with_DB_UI_vocal
    pip install -r requirements.txt
    ```

2.  **設定環境變數或修改程式碼 (`app.py`)**:
    打開 `app.py` 檔案，找到以下區塊並填入您的 D-ID API Key、Agent ID、Agent Source URL 以及 MongoDB 連線資訊：

    ```python
    # --- MongoDB 初始化 ---
    MONGO_URI = "YOUR_MONGODB_CONNECTION_STRING"  # <--- 在這裡填入您的 MongoDB 連線字串
    MONGO_DATABASE_NAME = "YOUR_DATABASE_NAME"    # <--- 在這裡填入您的資料庫名稱
    MONGO_COLLECTION_NAME ="YOUR_COLLECTION_NAME" # <--- 在這裡填入您的集合名稱

    # --- 全域設定值 ---
    DID_API_KEY = "Basic YOUR_D-ID_API_KEY_HERE"             # <--- 在這裡填入您的 D-ID API Key (通常是 "Basic " 開頭的字串)
    AGENT_ID = "YOUR_D-ID_AGENT_ID"               # <--- 在這裡填入您的 D-ID Agent ID
    AGENT_SOURCE_URL = "YOUR_AGENT_IMAGE_OR_VIDEO_URL" # <--- 在這裡填入您的 Agent 影像 URL

    # Flask session 需要一個 secret_key 來加密 session 資料
    app.secret_key = 'YOUR_VERY_OWN_FLASK_SECRET_KEY'   # <--- 強烈建議修改成您自己的複雜密鑰
    ```
    **重要**: 請務必將 `YOUR_...` 替換成您實際的值。

3.  **確認麥克風圖示**:
    * 如果您希望在語音辨識時變更麥克風圖示，請確保在 `static/images/page3/` 路徑下有一個名為 `mic_recording.svg` (或其他您在 `page3_script.js` 中指定的名稱) 的圖示檔案。

4.  **執行應用程式**:
    在終端機中，確認您仍然在 `D-ID_with_DB_UI_vocal` 資料夾內，然後執行：
    ```bash
    python app.py
    ```
    應用程式預設會在 `http://127.0.0.1:5000/` 或 `http://localhost:5000/` 上執行。

5.  **使用應用程式**:
    * 打開您的網頁瀏覽器（建議使用支援 Web Speech API 的現代瀏覽器，如 Chrome），前往 `http://localhost:5000/`。
    * **Page 1**: 輸入您的姓名，點擊「下一步」圖示。
    * **Page 2**: 選擇您想互動的角色。
    * **Page 3**:
        * 等待彈出視窗中的指示。
        * 點擊「連接 Agent」按鈕以建立 WebRTC 連線。
        * 連線成功後，點擊「創建聊天」按鈕。
        * 此時，虛擬人影片應會開始播放，並嘗試自動解除靜音（若瀏覽器允許）。
        * 點擊**麥克風按鈕**開始說話。說完後，您的話語會顯示在文字區，並傳送給 AI。
        * AI 的回應會覆寫文字區的內容，虛擬人也會說出回應。
        * 若要結束對話，可以說出「掰掰」、「再見」等關鍵字。系統會自動儲存對話記錄並跳轉到 Page 4。
        * 若直接點擊「返回」或「回首頁」按鈕離開此頁面，系統也會嘗試儲存當前的聊天記錄。
    * **Page 4**: 顯示對話結束訊息。

## 注意事項

* **瀏覽器支援**: 語音辨識功能依賴瀏覽器的 Web Speech API。請確保使用支援此 API 的瀏覽器（如 Chrome）。
* **麥克風權限**: 瀏覽器會請求麥克風使用權限，使用者需要允許才能使用語音輸入功能。
* **自動解除靜音**: 瀏覽器對於有聲媒體的自動播放政策可能導致自動解除靜音失敗。此時，如果沒有提供手動靜音/取消靜音按鈕，聲音將保持靜音。
* **MongoDB 設定**: 請確保您的 MongoDB 服務正在運行，且連線字串、資料庫名稱、集合名稱都正確無誤。
* **聊天記錄格式**: 儲存到 MongoDB 的聊天記錄格式為包含多個物件的陣列，每個物件代表一條訊息，包含 `role` (`user` 或 `assistant`)、`content` (訊息內容) 和 `timestamp` (ISO 格式時間戳)。
* **錯誤處理**: 前後端程式碼中包含基本的錯誤處理和日誌記錄，方便追蹤問題。