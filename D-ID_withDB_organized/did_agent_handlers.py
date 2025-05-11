# 這個檔案會處理 /api/create_chat 和 /api/send_message 的核心邏輯。
# 這裡是放跟 D-ID Agent API 互動的處理函式的地方啦～

from flask import jsonify, session # 從 flask 匯入 jsonify 跟 session，這樣才能回傳 JSON 跟用 session 存東西
import requests 
import json 
from datetime import datetime, timezone # datetime 跟 timezone 處理時間用的，像是訊息時間戳記

def handle_create_chat(d_id_api_url, agent_id, common_headers):
    """
    這支函式專門處理「創建一個新的聊天室 (Chat session)」的苦差事。
    會跟 D-ID 的 /agents/{AGENT_ID}/chat 這個 API 端點打交道。
    成功的話，會把 D-ID 給的 chat_id 存到 Flask 的 session 裡面。
    """
    # --- 開始跟 D-ID 說我們要開新的聊天室 ---
    #print(f"DEBUG (did_agent_handlers.py): 準備跟 D-ID 說，我們要用 Agent ID '{agent_id}' 開一個新聊天室。")
    try:
        response = requests.post(
            f"{d_id_api_url}/agents/{agent_id}/chat", # 組出正確的 API 網址
            headers=common_headers, # 把通用的請求標頭帶上
            json={} # D-ID 說這個請求不用帶任何資料，給個空就好
        )
        response.raise_for_status() # 如果 D-ID 回應說有錯 (像 400, 500 之類的)，這行會直接丟出錯誤，省得我們自己判斷
        chat_data = response.json() # 把 D-ID 回的 JSON 資料轉成 Python 的字典
        chat_id = chat_data.get('id') # 從回傳資料中拿出最重要的 'id'，也就是聊天室 ID
        chat_created_at = chat_data.get('created') # 順便也拿一下聊天室的創建時間

        if chat_id:
            session['chat_id'] = chat_id # 把聊天室 ID 存到 session，這樣同一個使用者下次來才知道是哪個聊天室
            #print(f"DEBUG (did_agent_handlers.py): 聊天室開好啦！D-ID 給的 chat_id 是 '{chat_id}'，已經存到 session 囉。")
        else:
            # 這種情況很少見，但還是記錄一下比較保險
            #print("錯誤 (did_agent_handlers.py): D-ID 回應了，但是裡面竟然沒有 chat_id？！這下糗了。")
            return jsonify({"error": "D-ID 回應中找不到 chat_id，怪怪的喔～"}), 500

        if chat_created_at:
            session['chat_created_at_iso'] = chat_created_at # 把 D-ID 給的 ISO 格式時間字串直接存起來
            #print(f"DEBUG (did_agent_handlers.py): 這個聊天室的創建時間是 '{chat_created_at}'，也存到 session 的 'chat_created_at_iso' 欄位了。")
        else:
            #print("注意 (did_agent_handlers.py): D-ID 回應中沒有 'created' (創建時間) 欄位，但應該不影響使用。")
            session.pop('chat_created_at_iso', None) # 如果沒有，就確保 session 裡這個欄位是空的

        return jsonify(chat_data) # 把 D-ID 回的完整資料回傳給前端
    except requests.exceptions.RequestException as e:
        # 跟 D-ID 溝通時網路如果出問題，或是 D-ID 就是不開心，就會跑到這裡
        #print(f"錯誤 (did_agent_handlers.py): 創建聊天室時跟 D-ID API 溝通失敗了啦！錯誤訊息：{e}")
        if e.response is not None:
            print(f"D-ID 的錯誤回應內容：{e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    except Exception as ex:
        # 萬一有什麼沒想到的鳥事發生，也把它抓起來
        #print(f"天啊 (did_agent_handlers.py): 創建聊天室時發生了意料之外的錯誤：{ex}")
        import traceback
        traceback.print_exc() # 把詳細的錯誤堆疊印出來，方便debug
        return jsonify({"error": "創建聊天室的時候發生了一些意想不到的狀況，請稍後再試。"}), 500
    # --- 跟 D-ID 說我們要開新的聊天室結束 ---

def handle_send_message_to_agent(d_id_api_url, agent_id, common_headers, user_message, talk_stream_id, talk_session_id):
    """
    這支函式負責把使用者說的話，透過 D-ID 的 Agent API 送給 AI 角色。
    會用到 /agents/{AGENT_ID}/chat/{CHAT_ID} 這個端點。
    """
    # --- 開始把使用者的話丟給 D-ID Agent ---
    chat_id = session.get('chat_id') # 先從 session 把之前存的 chat_id 拿出來

    # 基本檢查，看看該有的東西有沒有少
    if not chat_id:
        #print("錯誤 (did_agent_handlers.py): Session 裡找不到 chat_id，是不是忘了先呼叫 /api/create_chat 開聊天室啊？")
        return jsonify({"error": "聊天室還沒開啦，請先呼叫 /api/create_chat。"}), 400
    if not user_message:
        #print("錯誤 (did_agent_handlers.py): 使用者想傳送空訊息？這不行喔。")
        return jsonify({"error": "訊息內容不能是空的啦！"}), 400
    if not talk_stream_id or not talk_session_id:
        #print(f"錯誤 (did_agent_handlers.py): 傳送訊息時少了 talk_stream_id ('{talk_stream_id}') 或 talk_session_id ('{talk_session_id}')。")
        return jsonify({"error": "哎呀，talk_stream_id 或 talk_session_id 不見了，這很重要耶！"}), 400

    # D-ID 對時間格式有特殊要求，我們要乖乖照做
    created_at_timestamp = datetime.now(timezone.utc).strftime("%m/%d/%Y, %H:%M:%S")
    #print(f"DEBUG (did_agent_handlers.py): 幫使用者訊息加上時間戳記: {created_at_timestamp}")

    # 把要送給 D-ID 的資料包裝好，也就是所謂的 payload
    payload = {
        "streamId": talk_stream_id,
        "sessionId": talk_session_id, # 這個 session ID 是 /talks/streams API 給的那個喔
        "messages": [
            {
                "role": "user", # 當然是使用者說的話
                "content": user_message, # 使用者實際的訊息內容
                "created_at": created_at_timestamp # 剛剛弄好的時間戳記
            }
        ]
    }

    #print(f"DEBUG (did_agent_handlers.py): 準備要送給 D-ID Agent (Agent ID: {agent_id}, Chat ID: {chat_id}) 的訊息 payload 長這樣：")
    print(json.dumps(payload, indent=2, ensure_ascii=False)) # 把 payload 印清楚一點，方便檢查

    try:
        response = requests.post(
            f"{d_id_api_url}/agents/{agent_id}/chat/{chat_id}", # 注意網址裡有 AGENT_ID 跟 CHAT_ID
            headers=common_headers,
            json=payload
        )
        # 不管 D-ID 回什麼，先印出來看看狀態碼跟內容，方便偵錯
        #print(f"DEBUG (did_agent_handlers.py): D-ID Agent API 回應的狀態碼: {response.status_code}")
        try:
            response_data_for_log = response.json()
            #print(f"DEBUG (did_agent_handlers.py): D-ID Agent API 回應的 JSON 內容: {json.dumps(response_data_for_log, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            # 如果回應的不是 JSON (例如 D-ID 伺服器掛了回 HTML 錯誤頁面)
            response_data_for_log = {"error_text_from_did": response.text}
            #print(f"DEBUG (did_agent_handlers.py): D-ID Agent API 回應的不是 JSON，是純文字內容: {response.text}")

        response.raise_for_status() # 再一次，有錯就讓它直接噴出來
        return jsonify(response.json()) # 把 D-ID 的回應原封不動傳給前端

    except requests.exceptions.RequestException as e:
        #print(f"錯誤 (did_agent_handlers.py): 把訊息送給 D-ID Agent 時出包了：{e}")
        if e.response is not None:
            print(f"D-ID 的錯誤回應內容：{e.response.text}")
            # 回傳給前端的 details 盡可能用 D-ID 回的文字，如果 D-ID 回的不是 JSON，就用 .text
            try:
                details_from_did = e.response.json()
            except json.JSONDecodeError:
                details_from_did = e.response.text
            return jsonify({"error": str(e), "details": details_from_did}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    # --- 把使用者的話丟給 D-ID Agent 結束 ---