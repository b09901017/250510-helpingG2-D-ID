# D-ID WebRTC 虛擬人物對話應用程式 (整合 MongoDB)

這是一個使用 Flask（Python）作為後端、搭配 HTML/CSS/JavaScript 作為前端的 Web 應用程式。主要功能是讓使用者可以透過 WebRTC 技術與 D-ID 平台上的虛擬人物（Agent）進行即時影音對話，並將對話紀錄儲存到 MongoDB 資料庫中。

此專案是基於之前的版本進行了程式碼結構的整理，將後端邏輯拆分到不同的處理函式 (handlers) 檔案中，以提高可讀性和可維護性。

## 功能

* **即時影音串流**：透過 D-ID Talks Streams API 與 WebRTC 建立與虛擬人物的即時影音連線。
* **AI 對話互動**：透過 D-ID Agents API 將使用者輸入的文字訊息傳送給虛擬人物，並接收 AI 的回應。
* **對話紀錄儲存**：在對話結束時，將前端收集到的完整對話紀錄（包含使用者和 AI 的訊息）儲存到指定的 MongoDB 資料庫中。
* **模組化後端**：Flask 後端程式碼按功能拆分成不同的 Python 檔案 (`app.py`, `did_agent_handlers.py`, `did_stream_handlers.py`, `mongo_handlers.py`)。
* **模組化前端**：JavaScript 程式碼也按功能拆分成不同的檔案 (`main.js`, `api_handlers.js`, `chat_handlers.js`, `ui_handlers.js`, `webrtc_handlers.js`)。

## 專案結構
```text
D-ID_withDB_organized/
├── app.py                     # Flask 主應用程式 設定與路由
├── did_agent_handlers.py      # D-ID Agent API (聊天) 相關邏輯
├── did_stream_handlers.py     # D-ID Talks Streams API (WebRTC) 相關邏輯
├── mongo_handlers.py          # MongoDB 資料庫操作相關邏輯
├── static/
│   ├── css/
│   │   └── style.css          # 前端樣式表
│   └── js/
│       ├── api_handlers.js    # 前端呼叫後端 API 的函式
│       ├── chat_handlers.js   # 前端聊天流程控制邏輯
│       ├── main.js            # 前端主程式、事件綁定
│       ├── ui_handlers.js     # 前端 UI 更新函式
│       └── webrtc_handlers.js # 前端 WebRTC 處理邏輯
└── templates/
    └── index.html             # 前端主頁面 HTML

## 設定與執行

1.  **安裝依賴套件**:
    在你的終端機中，進入 `D-ID_withDB_organized` 資料夾，然後執行：
    ```bash
    pip install -r requirements.txt
    ```

2.  **設定環境變數或修改程式碼**:
    打開 `app.py` 檔案，找到以下區塊並填入你的 D-ID API Key、Agent ID、Agent Source URL 以及 MongoDB 連線資訊：

    ```python
    # --- MongoDB 初始化 ---
    MONGO_URI = "YOUR_MONGODB_CONNECTION_STRING"  # <--- 在這裡填入你的 MongoDB 連線字串
    MONGO_DATABASE_NAME = "YOUR_DATABASE_NAME"     # <--- 在這裡填入你的資料庫名稱
    MONGO_COLLECTION_NAME ="YOUR_COLLECTION_NAME"  # <--- 在這裡填入你的集合名稱 (例如 "users")

    # --- 全域設定值 ---
    DID_API_KEY = "YOUR_D-ID_API_KEY"              # <--- 在這裡填入你的 D-ID API Key
    AGENT_ID = "YOUR_D-ID_AGENT_ID"                # <--- 在這裡填入你的 D-ID Agent ID
    AGENT_SOURCE_URL = "YOUR_AGENT_IMAGE_OR_VIDEO_URL" # <--- 在這裡填入你的 Agent 影像 URL

    # Flask session 需要一個 secret_key 來加密 session 資料 隨便打一串複雜的就好
    app.secret_key = 'YOUR_OWN_FLASK_SECRET_KEY'   # <--- 建議修改成你自己的密鑰
    ```
    **重要**: 請務必將 `YOUR_...` 替換成你實際的值。

3.  **執行應用程式**:
    在終端機中，確認你仍然在 `D-ID_withDB_organized` 資料夾內，然後執行：
    ```bash
    python app.py
    ```
    應用程式預設會在 `http://127.0.0.1:5000/` 或 `http://localhost:5000/` 上執行。

4.  **使用應用程式**:
    * 打開你的網頁瀏覽器，前往 `http://localhost:5000/`。
    * 點擊「連接 Agent」按鈕以建立 WebRTC 連線。
    * 連線成功後，點擊「創建聊天」按鈕。
    * 在輸入框中輸入訊息，點擊「發送」與虛擬人物對話。
    * 對話結束後，點擊「結束對話並處理紀錄」按鈕，聊天紀錄將會儲存到 MongoDB。

## 注意事項

* 請確保你的 D-ID API Key 和 Agent ID 是有效的。
* 請確保你的 MongoDB 服務正在運行，且連線字串、資料庫名稱、集合名稱都正確無誤。
* 此應用程式在儲存聊天紀錄時，目前是寫死儲存到 `user001` 文件下的 `"關於童年生活"` 分類。你可以根據需求修改 `mongo_handlers.py` 中的 `TARGET_USER_ID` 和 `CONVERSATION_CATEGORY`。
* 前端使用了 `sessionStorage` 來暫存目前的 `chat_id` 和 `created_at_iso`，以便在結束對話時傳遞給後端儲存 API。
* 後端的 `/api/export_and_process_chat` 路由已被標記為不建議使用，因為發現 D-ID 的聊天匯出 API 回傳的訊息內容常為空，已改為由前端直接傳送聊天紀錄至 `/api/save_chat_history`。
