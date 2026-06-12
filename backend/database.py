import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta

# Database path - use /tmp/buttertext.db on Vercel to avoid read-only filesystem issues
if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/buttertext.db"
else:
    # Database is at project root (one level up from backend/)
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "buttertext.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # Create History Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_text TEXT NOT NULL,
        processed_text TEXT NOT NULL,
        mode TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()

# Password Hashing Functions
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"{salt}:{pw_hash}"

def verify_password(password: str, hashed_password: str) -> bool:
    try:
        salt, pw_hash = hashed_password.split(':')
        new_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return new_hash == pw_hash
    except Exception:
        return False

# User Helper Functions
def create_user(username: str, password_raw: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # If this is the first user, make them admin automatically
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    role = "admin" if count == 0 else "user"
    
    password_hash = hash_password(password_raw)
    
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username.lower().strip(), password_hash, role)
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return {"id": user_id, "username": username, "role": role}
    except sqlite3.IntegrityError:
        conn.close()
        return None

def create_user_with_role(username: str, password_raw: str, role: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    password_hash = hash_password(password_raw)
    
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username.lower().strip(), password_hash, role)
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return {"id": user_id, "username": username, "role": role}
    except sqlite3.IntegrityError:
        conn.close()
        return None

def get_user_by_username(username: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username.lower().strip(),))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_user_by_id(user_id: int) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, created_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_all_users() -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_user(user_id: int, username: str, role: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Periksa apakah username sudah dipakai oleh pengguna LAIN
        cursor.execute("SELECT id FROM users WHERE username = ? AND id != ?", (username.lower().strip(), user_id))
        if cursor.fetchone():
            conn.close()
            return False
        
        cursor.execute(
            "UPDATE users SET username = ?, role = ? WHERE id = ?",
            (username.lower().strip(), role, user_id)
        )
        conn.commit()
        
        # Pastikan user tersebut memang ada
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        exists = cursor.fetchone() is not None
        conn.close()
        return exists
    except sqlite3.IntegrityError:
        conn.close()
        return False

def update_user_password(user_id: int, password_raw: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    password_hash = hash_password(password_raw)
    try:
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (password_hash, user_id)
        )
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        return success
    except Exception:
        conn.close()
        return False

def delete_user(user_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    user_deleted = cursor.rowcount > 0
    cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return user_deleted

# Session Management Functions
def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7) # 7 days session
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at.isoformat())
    )
    conn.commit()
    conn.close()
    return token

def get_user_by_session_token(token: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.role, s.expires_at 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = ?
    """, (token,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        session_data = dict(row)
        expires_at = datetime.fromisoformat(session_data['expires_at'])
        if datetime.utcnow() < expires_at:
            return {
                "id": session_data["id"],
                "username": session_data["username"],
                "role": session_data["role"]
            }
        else:
            # Session expired, delete it
            delete_session(token)
    return None

def delete_session(token: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

# History Helper Functions
def add_history(user_id: int, original_text: str, processed_text: str, mode: str, provider: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO history (user_id, original_text, processed_text, mode, provider) VALUES (?, ?, ?, ?, ?)",
            (user_id, original_text, processed_text, mode, provider)
        )
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        return success
    except Exception as e:
        print(f"Error adding history: {e}")
        conn.close()
        return False

def get_user_history(user_id: int) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, original_text, processed_text, mode, provider, created_at FROM history WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_history_item(user_id: int, history_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM history WHERE id = ? AND user_id = ?", (history_id, user_id))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success

def clear_user_history(user_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM history WHERE user_id = ?", (user_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success

def update_username(user_id: int, username: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if username is already taken by someone else
        cursor.execute("SELECT id FROM users WHERE username = ? AND id != ?", (username.lower().strip(), user_id))
        if cursor.fetchone():
            conn.close()
            return False
        cursor.execute("UPDATE users SET username = ? WHERE id = ?", (username.lower().strip(), user_id))
        conn.commit()
        conn.close()
        return True
    except Exception:
        conn.close()
        return False

# Initialize DB on import
init_db()

