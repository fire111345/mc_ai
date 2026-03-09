from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

from uti import is_high_risk_message
from uti import build_system_prompt
from uti import generate_ai_reply
from huggingface_hub import InferenceClient
import os

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# -----------------------------
# 数据库模型
# -----------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

class ChatSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False, default='新对话')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

class ChatRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False, index=True)
    username = db.Column(db.String(80), nullable=False)
    user_message = db.Column(db.Text, nullable=False)
    ai_reply = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class MoodRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    mood = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# -----------------------------
# 初始化数据库
# -----------------------------
with app.app_context():
    db.create_all()

# -----------------------------
# 工具函数
# -----------------------------
def current_user():
    return session.get('username')

def get_or_create_default_chat_session(username):
    chat_session = (
        ChatSession.query
        .filter_by(username=username)
        .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        .first()
    )

    if not chat_session:
        chat_session = ChatSession(username=username, title='新对话')
        db.session.add(chat_session)
        db.session.commit()

    return chat_session

def fake_ai_reply(message):
    if not message.strip():
        return "你可以再多和我说一点，我会认真听。"
    return f"我听到你说：{message}。谢谢你愿意表达自己，如果你愿意，我们可以继续聊聊你的感受。"

# -----------------------------
# 页面路由
# -----------------------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/chat_page')
def chat_page():
    if not current_user():
        return redirect(url_for('login_page'))
    return render_template('chat.html')

@app.route('/mood_page')
def mood_page():
    if not current_user():
        return redirect(url_for('login_page'))
    return render_template('mood.html')

@app.route('/profile_page')
def profile_page():
    if not current_user():
        return redirect(url_for('login_page'))
    return render_template('profile.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

# -----------------------------
# API 路由
# -----------------------------
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'success': False, 'message': '用户名和密码不能为空'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': '用户名已存在'}), 400

    hashed_password = generate_password_hash(password)
    user = User(username=username, password=hashed_password)
    db.session.add(user)
    db.session.commit()

    return jsonify({'success': True, 'message': '注册成功'})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({'success': False, 'message': '用户名或密码错误'}), 401

    session['username'] = username
    return jsonify({
        'success': True,
        'message': '登录成功',
        'data': {
            'username': username
        }
    })

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.pop('username', None)
    return jsonify({'success': True, 'message': '已退出登录'})

@app.route('/api/me', methods=['GET'])
def api_me():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    return jsonify({
        'success': True,
        'data': {
            'username': username
        }
    })

@app.route('/api/profile', methods=['GET'])
def api_profile():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    moods = MoodRecord.query.filter_by(username=username).order_by(MoodRecord.created_at.desc()).all()

    total_mood_count = len(moods)
    latest_mood = moods[0].mood if moods else '暂无记录'
    latest_mood_time = moods[0].created_at.strftime('%Y-%m-%d %H:%M:%S') if moods else '暂无记录'

    return jsonify({
        'success': True,
        'data': {
            'username': username,
            'total_mood_count': total_mood_count,
            'latest_mood': latest_mood,
            'latest_mood_time': latest_mood_time
        }
    })

@app.route('/api/chat_sessions', methods=['GET'])
def api_chat_sessions():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    sessions = (
        ChatSession.query
        .filter_by(username=username)
        .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        .all()
    )

    if not sessions:
        default_session = ChatSession(username=username, title='新对话')
        db.session.add(default_session)
        db.session.commit()
        sessions = [default_session]

    data = []
    for s in sessions:
        data.append({
            'id': s.id,
            'title': s.title,
            'created_at': s.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': s.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({'success': True, 'data': data})

@app.route('/api/chat_sessions', methods=['POST'])
def api_create_chat_session():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    data = request.get_json(silent=True) or {}
    title = data.get('title', '').strip() or '新对话'

    chat_session = ChatSession(username=username, title=title)
    db.session.add(chat_session)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': '会话创建成功',
        'data': {
            'id': chat_session.id,
            'title': chat_session.title,
            'created_at': chat_session.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': chat_session.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        }
    })

@app.route('/api/chat_sessions/<int:session_id>', methods=['PUT'])
def api_rename_chat_session(session_id):
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    chat_session = ChatSession.query.filter_by(id=session_id, username=username).first()
    if not chat_session:
        return jsonify({'success': False, 'message': '会话不存在'}), 404

    data = request.get_json(silent=True) or {}
    title = data.get('title', '').strip()

    if not title:
        return jsonify({'success': False, 'message': '会话名称不能为空'}), 400

    chat_session.title = title
    chat_session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'success': True, 'message': '会话重命名成功'})

@app.route('/api/chat_sessions/<int:session_id>', methods=['DELETE'])
def api_delete_chat_session(session_id):
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    chat_session = ChatSession.query.filter_by(id=session_id, username=username).first()
    if not chat_session:
        return jsonify({'success': False, 'message': '会话不存在'}), 404

    ChatRecord.query.filter_by(session_id=session_id, username=username).delete()
    db.session.delete(chat_session)
    db.session.commit()

    remain_count = ChatSession.query.filter_by(username=username).count()
    if remain_count == 0:
        new_session = ChatSession(username=username, title='新对话')
        db.session.add(new_session)
        db.session.commit()

    return jsonify({'success': True, 'message': '会话删除成功'})

@app.route('/api/chat', methods=['POST'])
def api_chat():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    data = request.get_json(silent=True) or {}
    message = data.get('message', '').strip()
    session_id = data.get('session_id')

    if not message:
        return jsonify({'success': False, 'message': '消息不能为空'}), 400

    if session_id:
        chat_session = ChatSession.query.filter_by(id=session_id, username=username).first()
        if not chat_session:
            return jsonify({'success': False, 'message': '会话不存在'}), 404
    else:
        chat_session = get_or_create_default_chat_session(username)

    try:
        reply = generate_ai_reply(message)
    except Exception as e:
        print("HF API 调用失败：", e)
        reply = "我刚刚有点走神了，暂时没能成功回复你。你可以稍后再试一次。"

    if chat_session.title == '新对话':
        chat_session.title = message[:12] if len(message) <= 12 else message[:12] + '...'

    chat_session.updated_at = datetime.utcnow()

    record = ChatRecord(
        session_id=chat_session.id,
        username=username,
        user_message=message,
        ai_reply=reply
    )
    db.session.add(record)
    db.session.commit()

    return jsonify({
        'success': True,
        'data': {
            'reply': reply,
            'session_id': chat_session.id,
            'session_title': chat_session.title
        }
    })

@app.route('/api/chat_history', methods=['GET'])
def api_chat_history():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    session_id = request.args.get('session_id', type=int)

    if session_id:
        chat_session = ChatSession.query.filter_by(id=session_id, username=username).first()
        if not chat_session:
            return jsonify({'success': False, 'message': '会话不存在'}), 404
    else:
        chat_session = get_or_create_default_chat_session(username)
        session_id = chat_session.id

    records = (
        ChatRecord.query
        .filter_by(username=username, session_id=session_id)
        .order_by(ChatRecord.created_at.asc())
        .all()
    )

    data = []
    for r in records:
        data.append({
            'user_message': r.user_message,
            'ai_reply': r.ai_reply,
            'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({
        'success': True,
        'data': data,
        'session_id': session_id
    })



@app.route('/api/mood', methods=['POST'])
def api_mood():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    data = request.get_json(silent=True) or {}
    mood = data.get('mood', '').strip()
    content = data.get('content', '').strip()

    if not mood:
        return jsonify({'success': False, 'message': '请选择心情'}), 400

    record = MoodRecord(username=username, mood=mood, content=content)
    db.session.add(record)
    db.session.commit()

    return jsonify({'success': True, 'message': '心情记录保存成功'})

@app.route('/api/moods', methods=['GET'])
def api_moods():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    records = MoodRecord.query.filter_by(username=username).order_by(MoodRecord.created_at.desc()).all()

    data = []
    for r in records:
        data.append({
            'mood': r.mood,
            'content': r.content,
            'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({'success': True, 'data': data})

@app.route('/api/moods/clear', methods=['POST'])
def api_clear_moods():
    username = current_user()
    if not username:
        return jsonify({'success': False, 'message': '未登录'}), 401

    MoodRecord.query.filter_by(username=username).delete()
    db.session.commit()

    return jsonify({'success': True, 'message': '已清空全部心情记录'})

if __name__ == '__main__':
    app.run(debug=True)