from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

app.config['JSON_AS_ASCII'] = False

# --- 模擬的資料庫或資料來源 ---
mock_db = {
    "item1": {"name": "蘋果", "description": "好吃的大蘋果"},
    "item2": {"name": "香蕉", "description": "黃澄澄的香蕉"},
    "default": {"name": "未知物品", "description": "找不到對應的 ID"},
}


# 路由 1: 根目錄 '/' - 提供主頁面
@app.route('/')
def index():
    """顯示主要互動頁面"""
    return render_template('index.html')

# 路由 2: 取得特定項目資訊 (GET) - 使用路徑參數 <item_id>
@app.route('/item/<item_id>', methods=['GET'])
def get_item_info(item_id):
    """根據 URL 中的 item_id 回傳對應的資訊"""
    print(f"後端收到 GET 請求，請求的 item_id 是: {item_id}")

    # 從模擬資料庫中找資料，如果找不到就用預設值
    item_data = mock_db.get(item_id, mock_db["default"])

    # 回傳 JSON，包含請求的 ID 和找到的資料
    return jsonify({
        "requested_id": item_id,
        "data": item_data,
        "message": f"這是透過 GET /item/{item_id} 取得的資料"
    })

# 路由 3: 新增或更新項目資訊 (POST)
@app.route('/item/update', methods=['POST'])
def update_item():
    """接收 POST 過來的資料"""
    print("後端收到了 /item/update 的 POST 請求")

    if not request.is_json:
        return jsonify({"error": "請求必須是 JSON 格式"}), 400

    data = request.get_json()
    print(f"從前端 POST 過來的 JSON 資料: {data}")

    # 這裡可以加入更新 mock_db 的邏輯，但為了簡單，我們先省略
    item_id_to_update = data.get('id')
    new_name = data.get('name')
    if item_id_to_update and new_name:
        mock_db[item_id_to_update] = {"name": new_name, "description": "資料已更新"}

    # 回傳確認訊息和收到的資料
    return jsonify({
        "message": "後端收到了 POST 更新請求",
        "received_data": data
    })

# --- 執行 App ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)