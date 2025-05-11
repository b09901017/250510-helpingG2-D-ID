from flask import Flask, render_template, request, jsonify
import requests
import os
from datetime import datetime, timedelta, timezone # << timedelta 新增
import time # << 新增
import zipfile # << 新增
import io # << 新增
import json # << 新增

# --- MongoDB 初始化 ---
from pymongo import MongoClient
# 從環境變數讀取，但如果未設定，則使用你 upload.js 中的預設值 (除了密碼)
MONGO_URI = ""
MONGO_DATABASE_NAME = ""
MONGO_COLLECTION_NAME =""

try:
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DATABASE_NAME]
    user_collection = db[MONGO_COLLECTION_NAME] # 我們操作的是包含 user 文件的集合
    print("成功連接到 MongoDB (用於匯出儲存)")
except Exception as e:
    print(f"連接 MongoDB 失敗 (用於匯出儲存): {e}")
    client = None
    db = None
    user_collection = None
# --- MongoDB 初始化結束 ---


app = Flask(__name__)

# 從環境變數讀取 API Key 和 Agent ID !!! 就修改這裡就好~~
DID_API_KEY = "" 
AGENT_ID = ""
AGENT_SOURCE_URL = ""

# 用於儲存每個 Flask session 的 chat_id

from flask import session
app.secret_key = '123' # 用於 Flask session 加密，隨便設置一個複雜的字串 真的就隨便

D_ID_API_URL = "https://api.d-id.com"

common_headers = {
    "Authorization": DID_API_KEY,
    "Content-Type": "application/json"
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/create_stream', methods=['POST'])
def create_stream():
    """
    步驟 1 (Talks Streams API): 創建一個新的 stream
    """
    try:
        response = requests.post(
            f"{D_ID_API_URL}/talks/streams",
            headers=common_headers,
            json={"source_url": AGENT_SOURCE_URL}
        )
        response.raise_for_status() # 如果請求失敗 (狀態碼 4xx or 5xx), 會拋出 HTTPError 頭痛QQ
        stream_data = response.json()

        # <--- 關鍵日誌點 1.1 --->
        # 打印從 D-ID /talks/streams API 收到的完整回應
        #print(f"DEBUG (app.py /api/create_stream): D-ID /talks/streams 回應: {json.dumps(stream_data, indent=2, ensure_ascii=False)}")

        # 從 stream_data 中提取 id 和 session_id
        talk_stream_id_from_did = stream_data.get('id')
        talk_session_id_from_did = stream_data.get('session_id')

        # <--- 關鍵日誌點 1.2 --->
        # 打印提取出來的 talk_stream_id 和 talk_session_id
        #print(f"DEBUG (app.py /api/create_stream): 提取到的 talk_stream_id: {talk_stream_id_from_did}")
        #print(f"DEBUG (app.py /api/create_stream): 提取到的 talk_session_id: {talk_session_id_from_did}")

        # stream_data 應該包含: id (talk_stream_id), session_id (talk_session_id), offer, ice_servers
        return jsonify(stream_data)
    except requests.exceptions.RequestException as e:
        print(f"Error creating stream: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500


@app.route('/api/start_stream_sdp', methods=['POST'])
def start_stream_sdp():
    """
    步驟 2 (Talks Streams API): 發送 SDP answer
    """
    data = request.json
    stream_id = data.get('stream_id') # 這是 talk_stream_id
    session_id = data.get('session_id') # 這是 talk_session_id
    answer = data.get('answer') # 這是 SDP answer

    if not all([stream_id, session_id, answer]):
        return jsonify({"error": "Missing stream_id, session_id, or answer"}), 400

    try:
        response = requests.post(
            f"{D_ID_API_URL}/talks/streams/{stream_id}/sdp",
            headers=common_headers,
            json={
                "answer": answer,
                "session_id": session_id
            }
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        print(f"Error sending SDP answer: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500


@app.route('/api/send_ice_candidate', methods=['POST'])
def send_ice_candidate():
    """
    步驟 3 (Talks Streams API): 發送 ICE candidate
    """
    data = request.json
    stream_id = data.get('stream_id') # 這是 talk_stream_id
    session_id = data.get('session_id') # 這是 talk_session_id
    candidate_data = data.get('candidate_data') # 包含 candidate, sdpMid, sdpMLineIndex

    if not all([stream_id, session_id, candidate_data]):
        return jsonify({"error": "Missing stream_id, session_id, or candidate_data"}), 400

    payload = {
        "candidate": candidate_data.get("candidate"),
        "sdpMid": candidate_data.get("sdpMid"),
        "sdpMLineIndex": candidate_data.get("sdpMLineIndex"),
        "session_id": session_id
    }

    try:
        response = requests.post(
            f"{D_ID_API_URL}/talks/streams/{stream_id}/ice",
            headers=common_headers,
            json=payload
        )
        response.raise_for_status()
        return jsonify(response.json()) # 或者只是 jsonify({"status": "success"}) 真的是翻死
    except requests.exceptions.RequestException as e:
        print(f"Error sending ICE candidate: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500

@app.route('/api/create_chat', methods=['POST'])
def create_chat():
    """
    步驟 2 (Agent API): 創建一個新的 Chat session
    """
    try:
        response = requests.post(
            f"{D_ID_API_URL}/agents/{AGENT_ID}/chat",
            headers=common_headers,
            json={} # 請求體為空
        )
        response.raise_for_status()
        chat_data = response.json()
        chat_id = chat_data.get('id')
        chat_created_at = chat_data.get('created') # D-ID 返回的是類似 "2024-02-22T11:53:37.108Z" 的格式

        if chat_id:
            session['chat_id'] = chat_id
            print(f"Chat session created successfully, chat_id: {chat_id} stored in session.") # 新增日誌
        else:
            print("Error: chat_id not found in D-ID response for create_chat.") # 新增日誌
            return jsonify({"error": "chat_id not found in D-ID response"}), 500

        if chat_created_at:
            # D-ID 返回的 'created' 欄位本身就是 ISO 8601 格式，可以直接使用
            # 或者，如果你想確保它是 UTC 並重新格式化（雖然通常不需要）
            # dt_obj = datetime.fromisoformat(chat_created_at.replace("Z", "+00:00"))
            # session['chat_created_at_iso'] = dt_obj.strftime('%Y-%m-%dT%H:%M:%SZ')
            session['chat_created_at_iso'] = chat_created_at # 直接使用 D-ID 的時間字串
            print(f"Chat creation time: {chat_created_at} stored in session as chat_created_at_iso.") # 新增日誌
        else:
            print("Warning: 'created' timestamp not found in D-ID response for create_chat.")
            # 即使沒有創建時間，也可能允許繼續，但匯出時會用預設範圍
            session.pop('chat_created_at_iso', None) # 確保如果沒有則清除

        return jsonify(chat_data)
    except requests.exceptions.RequestException as e:
        print(f"Error creating chat: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    except Exception as ex: # 捕捉其他可能的錯誤
        print(f"An unexpected error occurred in create_chat: {ex}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while creating chat."}), 500



@app.route('/api/send_message', methods=['POST'])
def send_message_to_agent():
    """
    步驟 3 (Agent API): 發送消息到 Chat session
    """
    data = request.json
    user_message = data.get('message')
    talk_stream_id = data.get('talk_stream_id')
    talk_session_id = data.get('talk_session_id')

    chat_id = session.get('chat_id')

    # <--- 關鍵日誌點 4.1 --->
    # 打印從前端接收到的 talk_stream_id 和 talk_session_id
    #print(f"DEBUG (app.py /api/send_message): 從前端接收到的 talk_stream_id: {talk_stream_id}")
    #print(f"DEBUG (app.py /api/send_message): 從前端接收到的 talk_session_id: {talk_session_id}") # **確認這個值**


    if not chat_id:
        return jsonify({"error": "Chat session not created yet. Call /api/create_chat first."}), 400
    if not user_message:
        return jsonify({"error": "Message content is empty"}), 400
    if not talk_stream_id or not talk_session_id:
        return jsonify({"error": "talk_stream_id or talk_session_id is missing"}), 400

    # 獲取當前UTC時間並格式化為 D-ID期望的格式 "MM/DD/YYYY, HH:MM:SS" 紀錄一下好白癡
    # D-ID 的範例是 "03/03/2024, 18:15:00"
    # Python 的 strftime 與此格式對應的是 "%m/%d/%Y, %H:%M:%S"
    created_at_timestamp = datetime.now(timezone.utc).strftime("%m/%d/%Y, %H:%M:%S")


    payload = {
        "streamId": talk_stream_id,
        "sessionId": talk_session_id,
        "messages": [
            {
                "role": "user",
                "content": user_message,
                "created_at": created_at_timestamp 
            }
        ]
    }
    # <--- 關鍵日誌點 4.2 (你已有的日誌，但再次確認) --->
    #print(f"DEBUG (app.py /api/send_message): 嘗試向 D-ID 發送消息。Agent ID: {AGENT_ID}, Chat ID: {chat_id}")
    #print(f"DEBUG (app.py /api/send_message): 發送給 D-ID 的 Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}") # **確認這裡的 sessionId**

    try:
        response = requests.post(
            f"{D_ID_API_URL}/agents/{AGENT_ID}/chat/{chat_id}",
            headers=common_headers,
            json=payload
        )
        print(f"DEBUG: D-ID 回應狀態碼: {response.status_code}")
        try:
            response_data = response.json()
            print(f"DEBUG: D-ID 回應 JSON: {json.dumps(response_data, indent=2, ensure_ascii=False)}") # ensure_ascii=False
        except json.JSONDecodeError:
            response_data = {"error": "無法解析 D-ID 的 JSON 回應", "text": response.text}
            print(f"DEBUG: D-ID 回應文本 (非 JSON): {response.text}")   
        
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        print(f"Error sending message to agent: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/delete_stream', methods=['POST'])
def delete_stream():
    data = request.json
    stream_id = data.get('stream_id') # 這是 talk_stream_id
    session_id = data.get('session_id') # 這是 talk_session_id

    if not all([stream_id, session_id]):
        return jsonify({"error": "Missing stream_id or session_id"}), 400

    try:
        response = requests.delete(
            f"{D_ID_API_URL}/talks/streams/{stream_id}",
            headers=common_headers,
            json={"session_id": session_id}
        )
        response.raise_for_status()
        return jsonify({"status": "Stream deleted successfully", "details": response.json() if response.content else ""})
    except requests.exceptions.RequestException as e:
        print(f"Error deleting stream: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    
    ################  以下是匯出聊天紀錄的 API 端點 (但是因為caht export 出來的message一直是[] 空的 所以改成/api/save_chat_history) ################

# @app.route('/api/export_and_process_chat', methods=['POST'])
# def export_and_process_chat():
#     # ... (之前的檢查不變) ...

#     current_chat_id = session.get('chat_id')
#     chat_created_at_iso_str = session.get('chat_created_at_iso')

#     if not current_chat_id:
#         print("警告：在 session 中找不到 chat_id。將嘗試匯出用戶的最近紀錄。")
#         # return jsonify({"error": "Chat session ID not found. Cannot process specific chat."}), 400 # 可以考慮返回錯誤

#     print(f"Retrieved from session: chat_id='{current_chat_id}', chat_created_at_iso='{chat_created_at_iso_str}'")

#     time_to_for_export = datetime.now(timezone.utc) + timedelta(minutes=10) # 結束時間稍微往後推，確保包含所有訊息

#     if chat_created_at_iso_str:
#         try:
#             # D-ID 的 'created' 格式是 "YYYY-MM-DDTHH:MM:SS.sssZ"
#             # Python 的 fromisoformat 可以處理這種格式 (包括 Z)
#             chat_start_time_utc = datetime.fromisoformat(chat_created_at_iso_str.replace("Z", "+00:00"))
#             # 為了保險，讓 'from' 時間比實際開始時間早一點
#             time_from_for_export = chat_start_time_utc - timedelta(minutes=5)
#             print(f"使用 session 中的聊天創建時間 ({chat_created_at_iso_str}) 計算 'from' 時間: {time_from_for_export.strftime('%Y-%m-%dT%H:%M:%SZ')}")
#         except ValueError as e:
#             print(f"錯誤：解析 session 中的 chat_created_at_iso ('{chat_created_at_iso_str}') 失敗: {e}。將使用預設時間範圍。")
#             # 如果解析失敗，退回到較寬泛的時間範圍
#             time_from_for_export = time_to_for_export - timedelta(hours=1, minutes=15) # 預設匯出過去1小時15分鐘 (因為 time_to 加了10分鐘)
#     else:
#         print("警告：Session 中未找到 chat_created_at_iso。將使用預設的較寬泛時間範圍。")
#         time_from_for_export = time_to_for_export - timedelta(hours=1, minutes=15)

#     export_request_payload = {
#         "agent_id": AGENT_ID,
#         "from": time_from_for_export.strftime('%Y-%m-%dT%H:%M:%SZ'),
#         "to": time_to_for_export.strftime('%Y-%m-%dT%H:%M:%SZ')
#     }
#     # 如果 current_chat_id 存在，可以考慮傳遞它，雖然 D-ID API 不直接用它，但對於日誌或未來可能的 API 變更有用
#     # if current_chat_id:
#     #     export_request_payload["metadata_filter"] = {"chat_id": current_chat_id} # 假設D-ID支持此類過濾（目前文檔未提及）

#     print(f"請求聊天紀錄匯出，Agent ID: {AGENT_ID}, From: {export_request_payload['from']}, To: {export_request_payload['to']}")

#     # --- 後續的 API 呼叫、輪詢、ZIP 處理和 MongoDB 更新邏輯 ---
#     # ... (這部分邏輯，特別是輪詢和錯誤處理，你的程式碼看起來已經比較健壯了) ...
#     # 主要需要確保的是，如果 D-ID 返回 "No chats found in range" 且你確定聊天確實發生了，
#     # 那問題幾乎肯定是時間範圍不對，或者聊天數據在 D-ID 端還沒準備好。

#     try:
#         # ... (你的 export_init_response, 輪詢, zip 處理, mongodb 更新邏輯) ...
#         # 在輪詢失敗或 D-ID 返回 error status 時，確保返回清晰的錯誤信息給前端
#         # 例如，在輪詢中，如果 status_data.get("status") == "error":
#         #    error_message_from_did = status_data.get("error", "Unknown error from D-ID export")
#         #    print(f"D-ID 聊天紀錄匯出失敗: {error_message_from_did}, Details: {status_data}")
#         #    return jsonify({"error": f"D-ID chat export failed: {error_message_from_did}", "details": status_data}), 500

#         # 檢查你的輪詢邏輯，特別是這裡：
#         # elif current_status in ["failed", "error"]:
#         #     error_message_from_did = status_data.get("error", f"Chat export failed with status: {current_status}")
#         #     print(f"聊天紀錄匯出明確失敗。狀態: {current_status}, D-ID 錯誤: '{error_message_from_did}', 回應: {status_data}")
#         #     return jsonify({"error": error_message_from_did, "details": status_data}), 500 # 確保返回 500 給前端

#         # 如果 ZIP 處理後 extracted_chat_messages_for_mongo 為空:
#         # if not extracted_chat_messages_for_mongo:
#         #     print(f"在 ZIP 檔案中未找到或未成功處理任何與 chat_id {current_chat_id} 相關的聊天訊息內容。使用的時間範圍 From: {export_request_payload['from']}, To: {export_request_payload['to']}")
#         #     # ...
#         #     return jsonify({"message": "Chat export processed, but no relevant chat messages were extracted. Check time range or D-ID logs.", "details": status_data, "time_range_used": export_request_payload}), 200

#         # 你的現有代碼對這部分的處理已經比較完善，主要是確保錯誤信息能傳達到前端。
#         # 以下是你的代碼中已有的健壯的錯誤處理部分，應該能捕獲到 D-ID 的 "No chats found" 錯誤：
#         export_init_response = requests.post(
#             f"{D_ID_API_URL}/agents/chats/exports",
#             headers=common_headers,
#             json=export_request_payload
#         )
#         export_init_response.raise_for_status()
#         export_init_data = export_init_response.json()
#         export_id = export_init_data.get("export_id") or export_init_data.get("id") # 確保能獲取 export_id
#         if not export_id:
#             print(f"創建匯出請求失敗，未找到 export_id。回應: {export_init_data}")
#             return jsonify({"error": "Failed to create chat export: export_id not found in D-ID response.", "details": export_init_data}), 500
        
#         print(f"聊天紀錄匯出請求已創建，Export ID: {export_id}")

#         export_status_url = f"{D_ID_API_URL}/agents/chats/exports/{export_id}"
#         max_retries = 12
#         retry_delay = 7 # 稍微增加輪詢延遲，給D-ID更多時間處理
#         result_url = None
#         status_data = {} 

#         for i in range(max_retries):
#             print(f"正在獲取匯出狀態 (嘗試 {i+1}/{max_retries})...")
#             time.sleep(retry_delay)
#             status_response = requests.get(export_status_url, headers=common_headers)
#             status_response.raise_for_status() 
#             status_data = status_response.json()
#             current_status = status_data.get("status")
#             print(f"匯出狀態回應: {current_status}, Details: {status_data}")

#             if current_status == "done":
#                 if status_data.get("result") and status_data["result"].get("result_url"):
#                     result_url = status_data["result"]["result_url"]
#                     print(f"匯出完成，ZIP 檔案下載連結: {result_url}")
#                     break
#                 # 處理 D-ID 返回 "done" 但 "total_files_count": 0 且沒有 "error" 字段的情況
#                 elif status_data.get("total_files_count", -1) == 0 and not status_data.get("error"): # 檢查 total_files_count
#                     print(f"匯出完成 (status: done)，但 D-ID 報告 total_files_count 為 0。時間範圍內沒有找到聊天記錄。From: {export_request_payload['from']}, To: {export_request_payload['to']}")
#                     session.pop('chat_id', None)
#                     session.pop('chat_created_at_iso', None)
#                     return jsonify({"message": "Chat export completed successfully according to D-ID, but no chat logs were found for the specified time range.", "details": status_data, "requested_range": export_request_payload}), 200 # 返回200，但前端應提示用戶
#                 else: 
#                     print(f"匯出完成但 result_url 缺失，或 total_files_count 未明確為0但無URL。回應: {status_data}")
#                     return jsonify({"error": "Chat export status is 'done' but result_url is missing or data is inconsistent.", "details": status_data}), 500
#             elif current_status in ["failed", "error"]:
#                 error_message_from_did = status_data.get("error", f"Chat export failed with status: {current_status}")
#                 print(f"聊天紀錄匯出明確失敗。狀態: {current_status}, D-ID 錯誤: '{error_message_from_did}', 回應: {status_data}")
#                 return jsonify({"error": error_message_from_did, "details": status_data}), 500 
#         else: 
#             last_status = status_data.get('status', 'unknown')
#             print(f"獲取聊天紀錄匯出結果超時。最後狀態: {last_status}, 回應: {status_data}")
#             return jsonify({"error": "Timeout waiting for chat export to complete", "last_status": last_status, "details": status_data}), 500

#         if not result_url: 
#             print("嚴重錯誤：result_url 未設定，即使輪詢邏輯聲稱已完成或超時前未獲取。")
#             # 此處確保如果上面沒有明確返回，這裡也有一個錯誤路徑
#             return jsonify({"error": "Internal server error: result_url was not obtained. Check D-ID export status.", "details": status_data}), 500

#         # ----- 後續的 ZIP 處理和 MongoDB 更新邏輯 (你的代碼看起來OK) -----
#         print(f"正在下載 ZIP 檔案從: {result_url}")
#         zip_response = requests.get(result_url)
#         zip_response.raise_for_status()

#         extracted_chat_messages_for_mongo = []
#         processed_specific_chat = False # 標記是否處理了目標 chat_id

#         with zipfile.ZipFile(io.BytesIO(zip_response.content)) as z:
#             for filename in z.namelist():
#                 if filename.endswith('.json'):
#                     # 從檔名提取 chat_id，例如 "1715855558332#cht_9e_qi7Us0-zdqo2qwMvz6.json" -> "cht_9e_qi7Us0-zdqo2qwMvz6"
#                     file_chat_id_match = filename.split('#')[-1].replace(".json", "")

#                     # 如果 session 中有 current_chat_id，則只處理該 chat_id 的文件
#                     if current_chat_id and file_chat_id_match != current_chat_id:
#                         print(f"  跳過檔案 {filename} (chat_id: {file_chat_id_match})，與當前 session ({current_chat_id}) 不符。")
#                         continue
                    
#                     print(f"  正在處理檔案: {filename} (匹配的 chat_id: {file_chat_id_match})")
#                     processed_specific_chat = True # 標記至少有一個檔案被嘗試處理
#                     with z.open(filename) as json_file:
#                         try:
#                             chat_data_from_zip = json.load(json_file)
#                             # 再次確認 chat_data_from_zip 中的 chatId 是否與 current_chat_id 匹配（如果 current_chat_id 存在）
#                             if current_chat_id and chat_data_from_zip.get("chatId") != current_chat_id:
#                                 print(f"    警告：檔案 {filename} 中的 chatId ({chat_data_from_zip.get('chatId')}) 與 session 中的 current_chat_id ({current_chat_id}) 不符，跳過此文件內容。")
#                                 continue

#                             messages_from_export = chat_data_from_zip.get("messages", [])
#                             if messages_from_export:
#                                 print(f"    檔案 {filename} 包含 {len(messages_from_export)} 條訊息。")
#                                 for msg in messages_from_export:
#                                     role = msg.get("role", "unknown").capitalize()
#                                     content = msg.get("content", "")
#                                     formatted_message = f"{role}: {content}"
#                                     extracted_chat_messages_for_mongo.append(formatted_message)
#                                     print(f"      提取到訊息: {formatted_message[:80]}...") # 打印提取的訊息 (部分)
#                             else:
#                                 print(f"    檔案 {filename} 中未找到 'messages' 或為空。")
#                         except json.JSONDecodeError as e_json:
#                             print(f"    解析 JSON 檔案 {filename} 失敗: {e_json}")
#                         except Exception as e_file:
#                             print(f"    處理檔案 {filename} 時發生其他錯誤: {e_file}")
        
#         if not extracted_chat_messages_for_mongo:
#             message_to_client = "Chat export processed. "
#             if current_chat_id and not processed_specific_chat:
#                  message_to_client += f"No ZIP file found specifically for chat ID {current_chat_id}. This might be due to the time range or the chat not being available for export from D-ID."
#             elif not current_chat_id and not processed_specific_chat: # 沒指定 chat_id 且 zip 也空
#                 message_to_client += "No chat message files were found in the downloaded ZIP archive. The time range might not contain any chats."
#             else: # 處理了檔案但沒提取到訊息
#                 message_to_client += f"No relevant messages were extracted from the chat log(s) for chat ID {current_chat_id if current_chat_id else 'any chat in range'}. The content might be empty or not in the expected format."
            
#             print(message_to_client + f" 時間範圍: From: {export_request_payload['from']}, To: {export_request_payload['to']}")
#             session.pop('chat_id', None)
#             session.pop('chat_created_at_iso', None)
#             # 即使沒有提取到訊息，也應該返回 200，因為 D-ID 的匯出步驟本身可能成功了（只是內容為空）
#             return jsonify({"message": message_to_client, "details": status_data, "requested_range": export_request_payload}), 200

#         # ----- 更新到 MongoDB -----
#         # ... (你的 MongoDB 更新邏輯看起來沒問題，主要目標是 "關於童年生活") ...
#         TARGET_USER_ID = "user001" 
#         CONVERSATION_CATEGORY = "關於童年生活" # 儲存到此分類
        
#         conversation_date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d') 
#         if chat_created_at_iso_str:
#             try:
#                 conversation_date_str = datetime.fromisoformat(chat_created_at_iso_str.replace("Z", "+00:00")).strftime('%Y-%m-%d')
#             except ValueError:
#                 print(f"警告：再次解析 session 中的 chat_created_at_iso ('{chat_created_at_iso_str}') 失敗，將使用當前日期。")
        
#         print(f"\n--------- 準備更新到 MongoDB ({TARGET_USER_ID}) ---------")
#         print(f"分類: {CONVERSATION_CATEGORY}, 日期鍵: {conversation_date_str}")
#         print(f"將儲存 {len(extracted_chat_messages_for_mongo)} 條訊息。")
        
#         final_message_for_client = "Chat processing initiated."
#         update_result_obj_raw = None # 用於儲存 MongoDB 的原始回應

#         if user_collection is not None:
#             try:
#                 # 確保路徑是正確的 "關於童年生活.YYYY-MM-DD"
#                 update_field_key = f"{CONVERSATION_CATEGORY}.{conversation_date_str}"
                
#                 # 檢查 user001 是否存在，如果不存在則創建基本結構
#                 user_doc = user_collection.find_one({"_id": TARGET_USER_ID})
#                 if not user_doc:
#                     print(f"用戶 {TARGET_USER_ID} 不存在，將創建新文件。")
#                     initial_user_data = {
#                         "_id": TARGET_USER_ID,
#                         "姓名": "王老先生", # 或其他預設值
#                         "年齡": 80,
#                         "性別":"男",
#                         "健康狀況": "失智症",
#                         "日常注意事項": "防範跌倒",
#                         "頭像": "https://your-cdn.com/avatar/user001.png",
#                         CONVERSATION_CATEGORY: {
#                             conversation_date_str: extracted_chat_messages_for_mongo
#                         }
#                         # 可以根據你的 upload.js 初始化其他類別為空字典
#                         # "關於家庭與親人": {},
#                         # ...
#                     }
#                     insert_result = user_collection.insert_one(initial_user_data)
#                     update_result_obj_raw = insert_result.acknowledged # 簡化，實際是 insert_result
#                     if insert_result.acknowledged:
#                         final_message_for_client = f"成功為新用戶 {TARGET_USER_ID} 創建文件並插入聊天紀錄到 MongoDB。"
#                     else:
#                         final_message_for_client = f"為新用戶 {TARGET_USER_ID} 創建文件失敗。"

#                 else: # 用戶已存在，更新對話紀錄
#                     print(f"用戶 {TARGET_USER_ID} 已存在，將更新/追加聊天紀錄。")
#                     update_operation = {
#                         '$push': { # 使用 $push 將新訊息追加到現有數組
#                             update_field_key: {'$each': extracted_chat_messages_for_mongo}
#                         }
#                     }
#                     # 如果 CONVERSATION_CATEGORY 或 日期鍵 可能不存在，需要更複雜的更新或 $set
#                     # 但根據你的 upload.js 結構，我們假設 CONVERSATION_CATEGORY 總是在那裡
#                     # 如果日期鍵不存在，MongoDB 的 $push 會自動創建它作為一個數組
                    
#                     update_result_obj = user_collection.update_one(
#                         {"_id": TARGET_USER_ID},
#                         update_operation,
#                         upsert=False # 因為我們已經處理了用戶不存在的情況，這裡不需要 upsert
#                                     # 如果上面沒有檢查用戶是否存在，則 upsert=True
#                     )
#                     update_result_obj_raw = update_result_obj.raw_result

#                     if update_result_obj.acknowledged:
#                         if update_result_obj.modified_count > 0:
#                             final_message_for_client = f"成功更新用戶 {TARGET_USER_ID} 的聊天紀錄到 MongoDB。"
#                         elif update_result_obj.matched_count > 0 and update_result_obj.modified_count == 0:
#                             # 可能是因為 extracted_chat_messages_for_mongo 為空，或者其他原因導致沒有修改
#                             final_message_for_client = f"找到用戶 {TARGET_USER_ID} 的文件，但聊天紀錄未被修改 (可能是重複數據或空數據)。"
#                         else: # matched_count == 0 (理論上不應該發生，因為上面檢查了)
#                             final_message_for_client = f"未能找到用戶 {TARGET_USER_ID} 以更新 (與初始檢查不一致)。"
#                         print(final_message_for_client)
#                     else:
#                         final_message_for_client = f"MongoDB 更新操作未被確認 (user {TARGET_USER_ID})."
#                         print(final_message_for_client)

#             except Exception as e_mongo:
#                 final_message_for_client = f"儲存聊天紀錄到 MongoDB 時發生錯誤 (user {TARGET_USER_ID}): {e_mongo}"
#                 print(final_message_for_client)
#                 import traceback
#                 traceback.print_exc()
#         else:
#             final_message_for_client = "MongoDB 未連接，聊天紀錄已提取但未儲存。"
#             print(final_message_for_client)

#         session.pop('chat_id', None)
#         session.pop('chat_created_at_iso', None)
#         print(f"Flask session for chat_id and chat_created_at_iso has been cleared.")
#         return jsonify({"message": final_message_for_client, 
#                         "mongodb_update_result": str(update_result_obj_raw) if update_result_obj_raw else "N/A",
#                         "extracted_message_count": len(extracted_chat_messages_for_mongo)
#                         }), 200
    
#     except requests.exceptions.HTTPError as e_http:
#         error_details_text = "No response body"
#         status_code_to_return = 500 
#         if e_http.response is not None:
#             try:
#                 error_details_text = e_http.response.json() 
#             except json.JSONDecodeError:
#                 error_details_text = e_http.response.text 
#             status_code_to_return = e_http.response.status_code
#         print(f"請求 D-ID Chats Export API 時發生 HTTP 錯誤: {e_http}, 回應狀態碼: {status_code_to_return}, 回應內容: {error_details_text}")
#         return jsonify({"error": f"HTTP error with D-ID API ({e_http.request.method} {e_http.request.url})", "details": error_details_text}), status_code_to_return
    
#     except requests.exceptions.RequestException as e_req: 
#         print(f"請求 D-ID Chats Export API 時發生錯誤: {e_req}")
#         return jsonify({"error": f"Request error with D-ID API: {str(e_req)}"}), 500
    
#     except Exception as e_general: 
#         print(f"處理聊天紀錄時發生未預期錯誤: {e_general}")
#         import traceback
#         traceback.print_exc()
#         return jsonify({"error": f"An unexpected error occurred during chat processing: {str(e_general)}"}), 500
    
@app.route('/api/save_chat_history', methods=['POST'])
def save_chat_history():
    data = request.json
    messages_from_frontend = data.get('messages', []) # 這是包含 {role, content, timestamp} 的陣列
    frontend_chat_id = data.get('chat_id') # 從前端獲取 chat_id (可選，主要用於日誌)
    frontend_chat_created_at_iso = data.get('created_at_iso') # 從前端獲取創建時間
    # 你也可以從前端接收 chat_id 和 created_at_iso (如果前端保存了)
    # frontend_chat_id = data.get('chat_id')
    # frontend_chat_created_at_iso = data.get('created_at_iso')

    if not messages_from_frontend:
        return jsonify({"error": "沒有收到任何聊天訊息。"}), 400

    if user_collection is None:
        return jsonify({"error": "MongoDB 未連接，無法儲存聊天紀錄。"}), 500

     # 決定 conversation_date_str
    conversation_date_str_to_use = None
    if frontend_chat_created_at_iso: # 優先使用前端傳遞的創建時間
        try:
            conversation_date_str_to_use = datetime.fromisoformat(frontend_chat_created_at_iso.replace("Z", "+00:00")).strftime('%Y-%m-%d')
            print(f"使用前端提供的聊天創建時間 ('{frontend_chat_created_at_iso}') 計算日期鍵: {conversation_date_str_to_use}")
        except (ValueError, TypeError) as e:
            print(f"解析前端提供的 created_at_iso ('{frontend_chat_created_at_iso}') 失敗: {e}。嘗試從 Flask session 獲取。")
            # 如果前端傳的值有問題，再嘗試 Flask session
            flask_session_created_at_iso = session.get('chat_created_at_iso')
            if flask_session_created_at_iso:
                try:
                    conversation_date_str_to_use = datetime.fromisoformat(flask_session_created_at_iso.replace("Z", "+00:00")).strftime('%Y-%m-%d')
                    print(f"使用 Flask session 中的聊天創建時間 ('{flask_session_created_at_iso}') 計算日期鍵: {conversation_date_str_to_use}")
                except (ValueError, TypeError) as e_sess:
                    print(f"解析 Flask session 中的 chat_created_at_iso ('{flask_session_created_at_iso}') 也失敗: {e_sess}。將使用當前日期。")
    else: # 如果前端沒有傳遞，嘗試 Flask session
        flask_session_created_at_iso = session.get('chat_created_at_iso')
        if flask_session_created_at_iso:
            try:
                conversation_date_str_to_use = datetime.fromisoformat(flask_session_created_at_iso.replace("Z", "+00:00")).strftime('%Y-%m-%d')
                print(f"前端未提供 created_at_iso，使用 Flask session 中的聊天創建時間 ('{flask_session_created_at_iso}') 計算日期鍵: {conversation_date_str_to_use}")
            except (ValueError, TypeError) as e_sess:
                 print(f"前端未提供 created_at_iso，解析 Flask session 中的 chat_created_at_iso ('{flask_session_created_at_iso}') 失敗: {e_sess}。將使用當前日期。")

    if not conversation_date_str_to_use: # 如果以上都失敗，則使用當前日期
        conversation_date_str_to_use = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        print(f"無法從前端或 Flask session 獲取有效的聊天創建時間，使用當前日期作為日期鍵: {conversation_date_str_to_use}")


    # 格式化從前端收到的消息以符合你的 MongoDB 結構 (例如 "Role: Content")
    formatted_messages_for_mongo = []
    for msg in messages_from_frontend:
        role = msg.get("role", "unknown").capitalize()
        content = msg.get("content", "")
        # timestamp = msg.get("timestamp", new Date().toISOString()) # 你可以選擇是否使用前端的時間戳
        formatted_messages_for_mongo.append(f"{role}: {content}")

    TARGET_USER_ID = "user001"  # 或者將來可以從 session 或請求中獲取
    CONVERSATION_CATEGORY = "關於童年生活" # 你指定的分類

    # 使用聊天開始的時間作為日期鍵 (如果前端傳遞了 created_at_iso)
    # 否則，可以使用當前日期，或者從 Flask session 中獲取之前儲存的 chat_created_at_iso
    conversation_date_str = session.get('chat_created_at_iso')
    if conversation_date_str:
        try:
            conversation_date_str = datetime.fromisoformat(conversation_date_str.replace("Z", "+00:00")).strftime('%Y-%m-%d')
        except ValueError:
            print(f"解析 session 中的 chat_created_at_iso ('{conversation_date_str}') 失敗，將使用當前日期。")
            conversation_date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    else: # 如果 session 中也沒有，則使用當前日期
        conversation_date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')


    print(f"\n--------- 準備將前端聊天紀錄更新到 MongoDB ({TARGET_USER_ID}) ---------")
    print(f"分類: {CONVERSATION_CATEGORY}, 日期鍵: {conversation_date_str}")
    print(f"將儲存 {len(formatted_messages_for_mongo)} 條格式化後的訊息。")
    print("原始訊息 (前幾條):")
    for i, msg_obj in enumerate(messages_from_frontend[:3]): # 打印前3條原始消息
        print(f"  {i+1}. Role: {msg_obj.get('role')}, Content: {msg_obj.get('content', '')[:50]}..., Timestamp: {msg_obj.get('timestamp')}")


    saved_data_for_response = {
        "user_id": TARGET_USER_ID,
        "category": CONVERSATION_CATEGORY,
        "date": conversation_date_str_to_use, # 使用確定的日期
        "messages": formatted_messages_for_mongo,
        "original_chat_id_from_did_session": session.get('chat_id'), # 可以把 Flask session 中的 D-ID chat_id 也返回
        "frontend_chat_id_received": frontend_chat_id # 確認從前端收到的 chat_id
    }
    mongodb_update_result_raw = None

    try:
        update_field_key = f"{CONVERSATION_CATEGORY}.{conversation_date_str}"

        # 檢查 user001 是否存在，如果不存在則創建基本結構
        user_doc = user_collection.find_one({"_id": TARGET_USER_ID})
        if not user_doc:
            print(f"用戶 {TARGET_USER_ID} 不存在，將創建新文件。")
            initial_user_data = {
                "_id": TARGET_USER_ID,
                "姓名": "王老先生", # 或其他預設值
                "年齡": 80,
                "性別": "男",
                "健康狀況": "失智症",
                "日常注意事項": "防範跌倒",
                "頭像": "https://your-cdn.com/avatar/user001.png", # 你的預設頭像
                # 初始化所有預期分類為空字典，或根據你的 upload.js 結構
                "關於童年生活": {},
                "關於家庭與親人": {},
                "關於日常與食物": {},
                "關於日常活動與身體記憶": {},
                "關於舊時光與生活": {},
                "關於好友與旅遊": {}
            }
            # 將當前對話插入
            initial_user_data[CONVERSATION_CATEGORY][conversation_date_str] = formatted_messages_for_mongo
            insert_result = user_collection.insert_one(initial_user_data)
            mongodb_update_result_raw = {"acknowledged": insert_result.acknowledged, "inserted_id": str(insert_result.inserted_id)}
            message_to_client = f"成功為新用戶 {TARGET_USER_ID} 創建文件並插入聊天紀錄到 MongoDB。"
        else:
            print(f"用戶 {TARGET_USER_ID} 已存在，將更新/追加聊天紀錄。")
            update_operation = {
                '$push': { # 使用 $push 將新訊息追加到現有數組
                    update_field_key: {'$each': formatted_messages_for_mongo}
                }
            }
            # 如果日期鍵下的數組可能不存在，MongoDB 的 $push 會自動創建它
            update_result_obj = user_collection.update_one(
                {"_id": TARGET_USER_ID},
                update_operation,
                upsert=True # 雖然上面檢查了，但用 upsert=True 更保險，如果 CONVERSATION_CATEGORY 本身不存在，也能創建
            )
            mongodb_update_result_raw = update_result_obj.raw_result
            if update_result_obj.acknowledged:
                if update_result_obj.modified_count > 0 or update_result_obj.upserted_id:
                    message_to_client = f"成功更新用戶 {TARGET_USER_ID} 的聊天紀錄到 MongoDB。"
                else:
                    message_to_client = f"找到用戶 {TARGET_USER_ID} 的文件，但聊天紀錄未被修改 (可能是空數據或已存在)。"
            else:
                message_to_client = f"MongoDB 更新操作未被確認 (user {TARGET_USER_ID})."

        print(message_to_client)
        print(f"儲存到 MongoDB 的內容 ({update_field_key}):")
        for line in formatted_messages_for_mongo:
            print(f"  - {line}")

        # 清理 Flask session 中的 chat_id 和創建時間，為下一次對話做準備
        session.pop('chat_id', None)
        session.pop('chat_created_at_iso', None)
        print(f"Flask session for chat_id and chat_created_at_iso has been cleared after saving history.")

        return jsonify({"message": message_to_client, "saved_data": saved_data_for_response, "mongodb_result": str(mongodb_update_result_raw)}), 200

    except Exception as e:
        print(f"儲存聊天紀錄到 MongoDB 時發生錯誤: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"儲存到 MongoDB 失敗: {str(e)}"}), 500

# 關於 `/api/export_and_process_chat`，你可以：
# 1. 完全刪除它。
# 2. 或者保留它，但內部邏輯可以簡化為只做一些清理工作，或者返回一個提示說此功能已由前端記錄取代。
#    例如，如果你仍然想透過 D-ID 的匯出作為備份或驗證，可以保留部分邏輯，但不依賴它來獲取消息。
#    但根據你的需求，直接從前端收集是最可靠的。

if __name__ == '__main__':
    # 記得在生產環境中關閉 debug 模式 真的搞
    # 使用 waitress 或 gunicorn 等 WSGI 服務器部署
    app.run(debug=True, port=5000)