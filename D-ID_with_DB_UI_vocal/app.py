# 主要負責：
# 1. 初始化 Flask app 本身
# 2. 連接 MongoDB 資料庫
# 3. 設定一些全域會用到的東西，像是 D-ID 的 API Key 跟 API 網址
# 4. 定義所有的 API 路由 (就是那些 @app.route) 然後把實際的工作丟給其他 handler 檔案裡的函式去做 ~ 

# --- 基本的套件先匯入再說 ---
from flask import Flask, render_template, request, jsonify, session # Flask 的基本成員們
import requests # 跟外部 API 溝通全靠它
import os # os 模組 用於讀取環境變數
from datetime import datetime, timedelta, timezone # 時間處理大師
import time # 有時候需要讓程式等一下
import json # 處理 JSON 格式的好幫手
# --- 基本的套件匯入結束 ---

# --- 那些handlers也要匯入進來 ---
# 這些是剛剛辛辛苦苦把邏輯拆分出去的檔案裡的函式 好累QQ
from did_agent_handlers import handle_create_chat, handle_send_message_to_agent
from did_stream_handlers import handle_create_stream, handle_start_stream_sdp, handle_send_ice_candidate, handle_delete_stream
from mongo_handlers import handle_save_chat_history
# --- 自己的處理函式匯入結束 ---

# --- MongoDB 初始化 ---
from pymongo import MongoClient 

MONGO_URI = ""
MONGO_DATABASE_NAME = ""
MONGO_COLLECTION_NAME =""

# 試著連線看看
client = None # 先宣告一下 等等會把 MongoClient 的實例放進來
db = None     # 這也是 先宣告一下
user_collection = None # 最主要操作的那個 user collection

try:
    client = MongoClient(MONGO_URI) # 試著建立連線
    db = client[MONGO_DATABASE_NAME] # 連到指定的資料庫
    user_collection = db[MONGO_COLLECTION_NAME] # 選定要操作的 collection
    print("水啦！成功連接到 MongoDB ")
except Exception as e:
    # 如果上面任何一步出錯，例如 URI 寫錯、MongoDB 沒開、帳號密碼不對等等
    print(f"WW！連接 MongoDB 失敗了 錯誤訊息：{e}")
    # 保持 client, db, user_collection 是 None，這樣後面的程式才知道資料庫沒連上
# --- MongoDB 初始化結束 ---


# --- Flask App 初始化 ---
app = Flask(__name__) # 創建 Flask 
# --- Flask App 初始化結束 ---


# --- 全域設定值 ---
# 這些是跟 D-ID API 互動時會用到的重要資訊
DID_API_KEY = "" 
AGENT_ID = ""
AGENT_SOURCE_URL = ""

# Flask session 需要一個 secret_key 來加密 session 資料 隨便打一串複雜的就好
app.secret_key = '123' # 真的隨便打，但記得要改掉

# D-ID API 的基本網址 通常不太會變
D_ID_API_URL = "https://api.d-id.com"

# 通用的 HTTP 請求標頭 (headers) 每次跟 D-ID API 打招呼時都要帶上
common_headers_for_did = {
    "Authorization": DID_API_KEY, # 驗明正身用的 API Key
    "Content-Type": "application/json" # 告訴 D-ID 我們送過去的資料是 JSON 格式
}
# --- 全域設定值結束 ---


# --- Flask 路由定義區 ---
# 這裡是所有 API 端點 (endpoint) 的家，也就是前端可以呼叫的網址

# --- 基本的首頁路由 ---

@app.route('/')
def home_page():
    # 首頁預設導向 page1
    return render_template('page1/index.html')

@app.route('/page1')
def page1_route():
    return render_template('page1/index.html')

@app.route('/page2')
def page2_route():
    return render_template('page2/page2.html')

@app.route('/page3')
def page3_route():
    return render_template('page3/page3.html')

@app.route('/page4')
def page4_route():
    return render_template('page4/page4.html') 
# --- 基本的首頁路由結束 ---


# --- D-ID Agent API 相關路由 ---

@app.route('/api/create_chat', methods=['POST'])
def create_chat_session_route():
    """
    前端會呼叫這個 API 來請 D-ID 開一個新的聊天室 (Chat Session)
    實際的工作會丟給 did_agent_handlers.py 裡面的 handle_create_chat 函式去做
    """
    #print("DEBUG (app.py): 收到前端請求，要開一個新的 D-ID 聊天室 (/api/create_chat)。")
    # 把需要的設定值傳給處理函式
    return handle_create_chat(D_ID_API_URL, AGENT_ID, common_headers_for_did)

@app.route('/api/send_message', methods=['POST'])
def send_message_to_did_agent_route():
    """
    前端用這個 API 把使用者輸入的訊息送給 D-ID 的 AI 角色
    實際的工作會丟給 did_agent_handlers.py 裡面的 handle_send_message_to_agent
    """
    print("DEBUG (app.py): 收到前端請求，要把訊息送給 D-ID Agent (/api/send_message)。")
    data_from_frontend = request.json # 從前端來的 JSON 資料，裡面應該有 message, talk_stream_id, talk_session_id
    user_message_content = data_from_frontend.get('message')
    talk_stream_id_from_frontend = data_from_frontend.get('talk_stream_id')
    talk_session_id_from_frontend = data_from_frontend.get('talk_session_id')

    # 把從前端收到的資料 連同全域設定 一起丟給處理函式
    return handle_send_message_to_agent(
        D_ID_API_URL,
        AGENT_ID,
        common_headers_for_did,
        user_message_content,
        talk_stream_id_from_frontend,
        talk_session_id_from_frontend
    )
# --- D-ID Agent API 相關路由結束 ---


# --- D-ID Talks Streams API (WebRTC) 相關路由 ---

@app.route('/api/create_stream', methods=['POST'])
def create_webrtc_stream_route():
    """
    這是 WebRTC 流程的第一步：請 D-ID 創建一個影音串流
    D-ID 會回傳 SDP offer 跟 ICE server 資訊
    工作丟給 did_stream_handlers.py 裡的 handle_create_stream
    """
    #print("DEBUG (app.py): 收到前端請求，要創建 D-ID WebRTC stream (/api/create_stream)")
    return handle_create_stream(D_ID_API_URL, common_headers_for_did, AGENT_SOURCE_URL)

@app.route('/api/start_stream_sdp', methods=['POST'])
def start_webrtc_stream_sdp_route():
    """
    WebRTC 流程第二步：前端把它的 SDP answer 送過來 我們要轉交給 D-ID
    工作丟給 did_stream_handlers.py 裡的 handle_start_stream_sdp
    """
    #print("DEBUG (app.py): 收到前端請求，要傳送 SDP Answer 給 D-ID (/api/start_stream_sdp)")
    data_from_frontend = request.json
    stream_id = data_from_frontend.get('stream_id') # 這個是 talk_stream_id
    session_id_for_stream = data_from_frontend.get('session_id') # 這個是 talk_session_id
    sdp_answer_from_frontend = data_from_frontend.get('answer') # 瀏覽器產生的 SDP Answer

    return handle_start_stream_sdp(
        D_ID_API_URL,
        common_headers_for_did,
        stream_id,
        session_id_for_stream,
        sdp_answer_from_frontend
    )

@app.route('/api/send_ice_candidate', methods=['POST'])
def send_webrtc_ice_candidate_route():
    """
    WebRTC 流程第三步：前端發現了 ICE candidate，我們要幫忙轉送給 D-ID。
    工作丟給 did_stream_handlers.py 裡的 handle_send_ice_candidate。
    """
    #print("DEBUG (app.py): 收到前端請求，要傳送 ICE Candidate 給 D-ID (/api/send_ice_candidate)。")
    data_from_frontend = request.json
    stream_id = data_from_frontend.get('stream_id') # talk_stream_id
    session_id_for_stream = data_from_frontend.get('session_id') # talk_session_id
    ice_candidate_payload = data_from_frontend.get('candidate_data') # 包含 candidate, sdpMid, sdpMLineIndex

    return handle_send_ice_candidate(
        D_ID_API_URL,
        common_headers_for_did,
        stream_id,
        session_id_for_stream,
        ice_candidate_payload
    )

@app.route('/api/delete_stream', methods=['POST'])
def delete_webrtc_stream_route():
    """
    當 WebRTC 串流結束時，前端可以呼叫這個 API 來通知 D-ID 把串流資源清掉
    工作丟給 did_stream_handlers.py 裡的 handle_delete_stream
    """
    #print("DEBUG (app.py): 收到前端請求，要刪除 D-ID WebRTC stream (/api/delete_stream)。")
    data_from_frontend = request.json
    stream_id_to_delete = data_from_frontend.get('stream_id') # talk_stream_id
    session_id_for_stream_deletion = data_from_frontend.get('session_id') # talk_session_id

    return handle_delete_stream(
        D_ID_API_URL,
        common_headers_for_did,
        stream_id_to_delete,
        session_id_for_stream_deletion
    )
# --- D-ID Talks Streams API (WebRTC) 相關路由結束 ---


# --- 聊天紀錄儲存到 MongoDB 的路由 ---
@app.route('/api/save_chat_history', methods=['POST'])
def save_chat_history_to_mongo_route():
    """
    這個 API 是讓前端把整理好的聊天紀錄 (一個包含多筆訊息的陣列) 送過來，
    然後我們會把它存到 MongoDB 資料庫裡
    實際的儲存工作交給 mongo_handlers.py 裡的 handle_save_chat_history
    """
    #print("DEBUG (app.py): 收到前端請求，要把聊天紀錄存到 MongoDB (/api/save_chat_history)。")
    data_from_frontend = request.json
    messages_array = data_from_frontend.get('messages', []) # 訊息陣列
    chat_id_from_frontend_for_log = data_from_frontend.get('chat_id') # 從前端傳來的 chat_id (參考用)
    chat_created_at_iso_from_frontend = data_from_frontend.get('created_at_iso') # 從前端傳來的聊天室創建時間

    # 把 MongoDB 的 user_collection (如果成功連線的話) 跟前端來的資料都丟給處理函式
    return handle_save_chat_history(
        user_collection, # 注意，這裡是把 app.py 全域範圍的 user_collection 傳過去
        messages_array,
        chat_id_from_frontend_for_log,
        chat_created_at_iso_from_frontend
    )
# --- 聊天紀錄儲存到 MongoDB 的路由結束 ---

# --- 舊的 /api/export_and_process_chat 路由 ---
# 這個路由的邏輯已經被 /api/save_chat_history 取代，因為 D-ID 的 chat export message 一直是空的
# 記得 如果取消註解，裡面用到的 time, zipfile, io 等模組也要確保在檔案開頭有 import ~
"""
@app.route('/api/export_and_process_chat', methods=['POST'])
def export_and_process_chat_route():
    # 這部分的邏輯，因為 D-ID 的 export messages 都是空的，
    # 已經被 /api/save_chat_history (從前端直接接收訊息) 的方式取代了。
    # 目前 我們先讓它回傳一個提示訊息。
    print("注意 (app.py): /api/export_and_process_chat 這個路由目前已不建議使用，請改用 /api/save_chat_history。")
    return jsonify({
        "warning": "此 /api/export_and_process_chat 功能已由 /api/save_chat_history (直接從前端收集訊息) 取代。",
        "message": "D-ID 的聊天匯出功能 (chat export) 先前觀察到匯出的 messages 陣列為空，因此改為前端主動傳送聊天紀錄。"
    }), 410 # 410 Gone 表示這個資源以前存在但現在沒了
"""
# --- 舊的 /api/export_and_process_chat 路由結束 ---


# --- 讓 Flask App 跑起來 ---
if __name__ == '__main__':
    # 這段程式碼只有在你直接執行 python app.py 時才會跑
    # 如果是用 Gunicorn 或 Waitress 這種 WSGI 伺服器來部署，它們會用自己的方式來啟動 app
    print("Flask App 準備要跑起來囉！")
    app.run(debug=True, port=5000) # debug=True 會在程式碼變動時自動重載，還會顯示詳細錯誤訊息
# --- 讓 Flask App 跑起來結束 ---
