# 這個檔案會處理 /api/save_chat_history 的核心邏輯
# 這個檔案是我們跟 MongoDB 資料庫打交道的秘密基地！
# 主要就是把前端傳來的聊天紀錄好好地存到 MongoDB 裡面去。

from flask import jsonify, session # jsonify 用來回傳 JSON，session 用來拿聊天室的額外資訊
from datetime import datetime, timezone # datetime 跟 timezone 處理日期時間，像是決定聊天紀錄要存到哪一天的資料夾
import json # json 只是方便我們印東西看而已

def handle_save_chat_history(user_collection_db, messages_from_frontend, frontend_chat_id, frontend_chat_created_at_iso):
    """
    這支函式是儲存聊天紀錄到 MongoDB 的核心苦力。
    它會接收從前端整理好的聊天訊息陣列，然後想辦法塞到 MongoDB 裡面。
    user_collection_db 就是我們在 app.py 連線好的那個 user_collection 物件。
    """
    # --- 開始把前端的聊天紀錄塞到 MongoDB ---
    print(f"DEBUG (mongo_handlers.py): 收到了前端傳來的聊天紀錄，準備存到 MongoDB。前端傳來的 chat_id (參考用): {frontend_chat_id}")

    # 先檢查一下最基本的東西
    if not messages_from_frontend:
        print("錯誤 (mongo_handlers.py): 前端說要存聊天紀錄，結果一條訊息都沒給？這是在哈囉？")
        return jsonify({"error": "沒有收到任何聊天訊息啦，是要存什麼？"}), 400

    if user_collection_db is None:
        # 這種情況通常是 app.py 一開始連 MongoDB 就失敗了
        print("嚴重錯誤 (mongo_handlers.py): MongoDB 根本沒連上啊！聊天紀錄存不了了，哭哭。")
        return jsonify({"error": "MongoDB 未連接，無法儲存聊天紀錄。"}), 500

    # --- 決定這筆聊天紀錄要用哪個日期當作分類的 key ---
    # 我們的目標是把聊天紀錄存在 MongoDB 的 "user001" 文件 -> "關於童年生活" 這個大分類 -> "YYYY-MM-DD" 這個日期子分類底下
    conversation_date_str_to_use = None # 先宣告一個變數，等等拿來放最後決定的日期字串

    # 規則一：優先使用前端傳過來的 `frontend_chat_created_at_iso` (聊天室創建時間)
    if frontend_chat_created_at_iso:
        try:
            # D-ID 給的時間格式是 "YYYY-MM-DDTHH:MM:SS.sssZ"，我們要把它轉成 "YYYY-MM-DD"
            # .replace("Z", "+00:00") 是為了讓 fromisoformat 正確識別它是 UTC 時間
            conversation_date_str_to_use = datetime.fromisoformat(frontend_chat_created_at_iso.replace("Z", "+00:00")).strftime('%Y-%m-%d')
            print(f"DEBUG (mongo_handlers.py): 使用前端提供的聊天創建時間 ('{frontend_chat_created_at_iso}') 計算出日期鍵是: {conversation_date_str_to_use}")
        except (ValueError, TypeError) as e:
            # 如果前端傳來的時間格式怪怪的，或根本不是字串，就會跑到這裡
            print(f"注意 (mongo_handlers.py): 解析前端給的 created_at_iso ('{frontend_chat_created_at_iso}') 失敗了耶: {e}。沒關係，我們試試看 Flask session 裡有沒有存。")
            # 這時候 conversation_date_str_to_use 還是 None，會掉到下一個判斷

    # 規則二：如果前端沒給，或給了但格式不對，那就試試看 Flask session 裡有沒有存 `chat_created_at_iso`
    if not conversation_date_str_to_use: # 只有在上面沒成功設定時才進來
        flask_session_created_at_iso = session.get('chat_created_at_iso')
        if flask_session_created_at_iso:
            try:
                conversation_date_str_to_use = datetime.fromisoformat(flask_session_created_at_iso.replace("Z", "+00:00")).strftime('%Y-%m-%d')
                print(f"DEBUG (mongo_handlers.py): 前端沒給或格式錯，所以改用 Flask session 裡的聊天創建時間 ('{flask_session_created_at_iso}')，算出來的日期鍵是: {conversation_date_str_to_use}")
            except (ValueError, TypeError) as e_sess:
                print(f"注意 (mongo_handlers.py): 連 Flask session 裡的 chat_created_at_iso ('{flask_session_created_at_iso}') 格式也怪怪的 ({e_sess})。看來只好用今天的日期了。")
                # conversation_date_str_to_use 還是 None

    # 規則三：如果上面兩種方法都失敗了，那就只好用「現在」的日期了 (UTC 標準時間)
    if not conversation_date_str_to_use:
        conversation_date_str_to_use = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        print(f"DEBUG (mongo_handlers.py): 前端跟 Flask session 都沒輒，只好用今天的日期 '{conversation_date_str_to_use}' 當作日期鍵了。")
    # --- 日期鍵決定完畢 ---

    # --- 把前端傳來的訊息格式化一下，變成我們要存到 MongoDB 的樣子 ---
    # 前端傳來的是 [{role: 'user', content: '你好'}, {role: 'assistant', content: '你好呀'}] 這種
    # 我們想在 MongoDB 存成 ["User: 你好", "Assistant: 你好呀"] 這種字串陣列
    formatted_messages_for_mongo = []
    for msg in messages_from_frontend:
        role = msg.get("role", "不明角色").capitalize() # 如果沒 role 就叫「不明角色」，然後首字大寫
        content = msg.get("content", "") # 內容如果沒有就空字串
        # timestamp = msg.get("timestamp") # 前端也有傳時間戳，看你要不要用，這裡我們先不用
        formatted_messages_for_mongo.append(f"{role}: {content}")
    # --- 訊息格式化完畢 ---

    # --- 設定一些固定的儲存目標 ---
    TARGET_USER_ID = "user001"  # 目前先寫死是 user001，以後可以改的
    CONVERSATION_CATEGORY = "關於童年生活" # 目前也先寫死是這個分類
    # --- 儲存目標設定完畢 ---

    # 印一下準備要幹嘛，讓我們心裡有個底
    print(f"\n--------- 準備把前端聊天紀錄更新到 MongoDB ({TARGET_USER_ID}) ---------")
    print(f"目標分類: {CONVERSATION_CATEGORY}, 目標日期鍵: {conversation_date_str_to_use}")
    print(f"總共要儲存 {len(formatted_messages_for_mongo)} 條格式化後的訊息。")
    print("看一下原始訊息長怎樣 (只印前幾條，不然太多了):")
    for i, msg_obj in enumerate(messages_from_frontend[:3]): # 只印前3條
        print(f"  第 {i+1} 條. 角色: {msg_obj.get('role')}, 內容 (前50字): {msg_obj.get('content', '')[:50]}..., 時間戳: {msg_obj.get('timestamp')}")


    # 準備好等等要回傳給前端的資料，讓前端也知道存了啥
    saved_data_for_response = {
        "user_id": TARGET_USER_ID,
        "category": CONVERSATION_CATEGORY,
        "date": conversation_date_str_to_use, # 用我們最後決定的日期
        "messages": formatted_messages_for_mongo, # 存進 MongoDB 的那些格式化訊息
        "original_chat_id_from_did_session": session.get('chat_id'), # 把 Flask session 裡的 D-ID chat_id 也順便回傳一下
        "frontend_chat_id_received": frontend_chat_id # 確認一下從前端收到的 chat_id (雖然這裡沒直接用，但印出來看看也好)
    }
    mongodb_update_result_raw = None # 用來存 MongoDB 回應的原始結果

    try:
        # 這是 MongoDB 欄位的路徑，例如 "關於童年生活.2024-05-10"
        update_field_key = f"{CONVERSATION_CATEGORY}.{conversation_date_str_to_use}"

        # --- 先看看這位 user001 在 MongoDB 裡存不存在 ---
        user_doc = user_collection_db.find_one({"_id": TARGET_USER_ID})
        if not user_doc:
            # 如果 user001 是第一次來，資料庫裡還沒有他的文件
            print(f"INFO (mongo_handlers.py): 用戶 {TARGET_USER_ID} 在資料庫裡還不存在，現在來幫他建立一個新的文件。")
            initial_user_data = {
                "_id": TARGET_USER_ID,
                "姓名": "王老先生", # 預設值，可以之後再改
                "年齡": 80,       # 預設值
                "性別": "男",     # 預設值
                "健康狀況": "失智症", # 預設值
                "日常注意事項": "防範跌倒", # 預設值
                "頭像": "https://your-cdn.com/avatar/user001.png", # 你的預設頭像圖檔網址
                # 根據 upload.js 結構，最好把所有可能的分類都先初始化成空物件 {}
                "關於童年生活": {},
                "關於家庭與親人": {},
                "關於日常與食物": {},
                "關於日常活動與身體記憶": {},
                "關於舊時光與生活": {},
                "關於好友與旅遊": {}
            }
            # 然後把這次的聊天紀錄直接塞到對應的分類跟日期底下
            initial_user_data[CONVERSATION_CATEGORY][conversation_date_str_to_use] = formatted_messages_for_mongo
            insert_result = user_collection_db.insert_one(initial_user_data)
            mongodb_update_result_raw = {"acknowledged": insert_result.acknowledged, "inserted_id": str(insert_result.inserted_id)}
            message_to_client = f"太棒了！成功為新用戶 {TARGET_USER_ID} 創建了資料文件，並且把這次的聊天紀錄存到 MongoDB 囉。"
        else:
            # 如果 user001 已經是老朋友了，資料庫裡有他的文件
            print(f"INFO (mongo_handlers.py): 用戶 {TARGET_USER_ID} 已經存在資料庫了，準備來更新/追加這次的聊天紀錄。")
            # 我們要用 $push 把新的訊息「追加」到舊的訊息陣列後面
            # 如果那個日期的聊天紀錄還不存在，MongoDB 的 $push 很聰明，會自動幫我們建一個新的陣列
            update_operation = {
                '$push': {
                    update_field_key: {'$each': formatted_messages_for_mongo} # '$each' 讓我們可以一次 push 多個元素
                }
            }
            # upsert=True 的意思是，如果 CONVERSATION_CATEGORY 這個大分類本身不存在，MongoDB 也會幫我們建好它
            # 這樣比較保險
            update_result_obj = user_collection_db.update_one(
                {"_id": TARGET_USER_ID}, # 找到 user001
                update_operation,        # 執行追加操作
                upsert=True              # 如果路徑上的欄位不存在，就創建它
            )
            mongodb_update_result_raw = update_result_obj.raw_result # 把 MongoDB 回的原始結果存起來
            if update_result_obj.acknowledged: # MongoDB 有沒有說收到指令了
                if update_result_obj.modified_count > 0 or update_result_obj.upserted_id:
                    # modified_count > 0 表示有舊資料被更新了
                    # upserted_id 表示有新資料被插入了 (例如日期是新的)
                    message_to_client = f"讚喔！成功把用戶 {TARGET_USER_ID} 的聊天紀錄更新到 MongoDB 了。"
                else:
                    # 雖然 MongoDB 說收到了，但實際上沒有改到任何東西
                    # 可能是因為傳了空的訊息陣列，或是其他 MongoDB 覺得不用改的情況
                    message_to_client = f"嗯...找到了用戶 {TARGET_USER_ID} 的文件，但聊天紀錄好像沒有被修改到耶 (可能是空的，或已經存過了？)。"
            else:
                message_to_client = f"哎呀，MongoDB 更新操作好像沒有被確認耶 (針對用戶 {TARGET_USER_ID})，怪怪的。"
        # --- MongoDB 操作結束 ---

        print(f"INFO (mongo_handlers.py): {message_to_client}") # 把結果印到後台日誌
        print(f"INFO (mongo_handlers.py): 這次儲存到 MongoDB 的內容 (存在 '{update_field_key}' 底下) 有這些：")
        for line in formatted_messages_for_mongo:
            print(f"  - {line}") # 把存進去的每一條訊息也印出來看看

        # --- 清理工作：把這次聊天用的 chat_id 跟創建時間從 Flask session 裡移除 ---
        # 這樣下次開新的聊天室時，才不會用到舊的 ID
        session.pop('chat_id', None) # 如果 session 裡沒有 'chat_id' 也不會壞掉
        session.pop('chat_created_at_iso', None) # 同上
        print(f"INFO (mongo_handlers.py): 已經把這次聊天用的 chat_id 和 chat_created_at_iso 從 Flask session 清掉了，準備好迎接下一次聊天！")
        # --- 清理工作結束 ---

        return jsonify({"message": message_to_client, "saved_data": saved_data_for_response, "mongodb_result": str(mongodb_update_result_raw)}), 200

    except Exception as e:
        # 萬一上面所有跟 MongoDB 打交道的過程出了什麼差錯，就會跑到這裡
        print(f"嚴重錯誤 (mongo_handlers.py): 把聊天紀錄存到 MongoDB 的時候發生了天大的錯誤：{e}")
        import traceback
        traceback.print_exc() # 把詳細的錯誤訊息印出來，超級重要！
        return jsonify({"error": f"嗚嗚，存到 MongoDB 失敗了啦: {str(e)}"}), 500
    # --- 把前端的聊天紀錄塞到 MongoDB 結束 ---