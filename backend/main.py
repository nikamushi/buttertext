import os
import logging
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

# Load environment variables from parent directory (root)
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-text-assistant")

app = FastAPI(title="AI Text Assistant API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from gemini import call_gemini_api
from deepseek import call_deepseek_api
from database import (
    create_user, get_user_by_username, verify_password, 
    create_session, get_user_by_session_token, delete_session, 
    get_all_users, update_user, delete_user, create_user_with_role,
    add_history, get_user_history, delete_history_item, clear_user_history,
    update_user_password, update_username
)

# Authentication Dependencies
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesi tidak valid. Silakan login terlebih dahulu.")
    token = authorization.split(" ")[1]
    user = get_user_by_session_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sesi kedaluwarsa atau tidak valid. Silakan login kembali.")
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak. Anda bukan Admin.")
    return current_user

# Pydantic Schemas
class TextRequest(BaseModel):
    text: str
    provider: str = "gemini"

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class UserUpdateRequest(BaseModel):
    username: str
    role: str
    password: str = None

class AdminCreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "user"

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# Auth & User API Endpoints
@app.post("/api/register")
def register(req: RegisterRequest):
    username_cleaned = req.username.strip()
    password_cleaned = req.password.strip()
    
    if not username_cleaned or not password_cleaned:
        raise HTTPException(status_code=400, detail="Username dan password tidak boleh kosong.")
    if len(username_cleaned) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter.")
    if len(password_cleaned) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter.")
        
    user = create_user(username_cleaned, password_cleaned)
    if not user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar.")
    return {"message": "Registrasi berhasil", "user": user}

@app.post("/api/login")
def login(req: LoginRequest):
    user = get_user_by_username(req.username)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah.")
    
    token = create_session(user["id"])
    return {
        "token": token,
        "username": user["username"],
        "role": user["role"]
    }

@app.post("/api/logout")
def logout(authorization: str = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        delete_session(token)
    return {"message": "Logout berhasil"}

class UpdateMeRequest(BaseModel):
    username: str

@app.get("/api/users/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@app.patch("/api/users/me")
def update_me(req: UpdateMeRequest, current_user: dict = Depends(get_current_user)):
    username_cleaned = req.username.strip()
    if not username_cleaned:
        raise HTTPException(status_code=400, detail="Username tidak boleh kosong.")
    if len(username_cleaned) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter.")
        
    success = update_username(current_user["id"], username_cleaned)
    if not success:
        raise HTTPException(status_code=400, detail="Gagal memperbarui username (kemungkinan sudah terpakai oleh pengguna lain).")
        
    return {"message": "Username berhasil diperbarui", "username": username_cleaned}

# Admin Management API Endpoints
@app.get("/api/users")
def list_users(admin: dict = Depends(get_admin_user)):
    return get_all_users()

@app.post("/api/users")
def admin_create_user(req: AdminCreateUserRequest, admin: dict = Depends(get_admin_user)):
    username_cleaned = req.username.strip()
    password_cleaned = req.password.strip()
    
    if not username_cleaned or not password_cleaned:
        raise HTTPException(status_code=400, detail="Username dan password tidak boleh kosong.")
    if len(username_cleaned) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter.")
    if len(password_cleaned) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter.")
    if req.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Role tidak valid.")
        
    user = create_user_with_role(username_cleaned, password_cleaned, req.role)
    if not user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar.")
    return {"message": "Pengguna berhasil dibuat", "user": user}

@app.put("/api/users/{user_id}")
def edit_user(user_id: int, req: UserUpdateRequest, admin: dict = Depends(get_admin_user)):
    if not req.username.strip():
        raise HTTPException(status_code=400, detail="Username tidak boleh kosong.")
    if req.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Role tidak valid.")
    
    success = update_user(user_id, req.username, req.role)
    if not success:
        raise HTTPException(status_code=400, detail="Gagal mengupdate user (kemungkinan username sudah terpakai).")
        
    if req.password and req.password.strip():
        password_cleaned = req.password.strip()
        if len(password_cleaned) < 6:
            raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter.")
        update_user_password(user_id, password_cleaned)
        
    return {"message": "User berhasil diupdate"}

@app.post("/api/users/change-password")
def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    user = get_user_by_username(current_user["username"])
    if not user or not verify_password(req.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama salah.")
    
    new_password_cleaned = req.new_password.strip()
    if len(new_password_cleaned) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter.")
    
    success = update_user_password(current_user["id"], new_password_cleaned)
    if not success:
        raise HTTPException(status_code=400, detail="Gagal mengganti password.")
    return {"message": "Password berhasil diubah"}

@app.delete("/api/users/{user_id}")
def remove_user(user_id: int, admin: dict = Depends(get_admin_user)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Anda tidak dapat menghapus akun Anda sendiri.")
    success = delete_user(user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Gagal menghapus user.")
    return {"message": "User berhasil dihapus"}

# History API Endpoints (Protected by Login)
@app.get("/api/history")
def get_history(current_user: dict = Depends(get_current_user)):
    return get_user_history(current_user["id"])

@app.delete("/api/history")
def clear_history(current_user: dict = Depends(get_current_user)):
    clear_user_history(current_user["id"])
    return {"message": "Riwayat berhasil dihapus"}

@app.delete("/api/history/{history_id}")
def delete_history(history_id: int, current_user: dict = Depends(get_current_user)):
    success = delete_history_item(current_user["id"], history_id)
    if not success:
        raise HTTPException(status_code=404, detail="Riwayat tidak ditemukan.")
    return {"message": "Item riwayat berhasil dihapus"}

# AI Core Endpoints (Protected by Login)
@app.post("/paraphrase")
async def paraphrase(request: TextRequest, current_user: dict = Depends(get_current_user)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Masukkan teks terlebih dahulu.")
    if len(request.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Teks terlalu pendek untuk diproses.")
    
    system_prompt = (
        "Anda adalah asisten AI ahli bahasa Indonesia dengan kemampuan parafrase tingkat lanjut. "
        "Tugas Anda adalah melakukan parafrase secara menyeluruh pada SELURUH teks yang diberikan pengguna, "
        "tidak peduli seberapa panjang teksnya. "
        "Proses setiap paragraf secara lengkap: ubah struktur kalimat, pilihan kata, dan pola kalimat "
        "agar terdengar lebih natural, variatif, dan tidak repetitif, namun tetap pertahankan makna aslinya secara utuh. "
        "Jangan memotong, meringkas, atau menghilangkan bagian mana pun dari teks asli. "
        "Hasilkan parafrase dengan jumlah paragraf dan panjang yang proporsional dengan teks asli. "
        "Kembalikan HANYA hasil parafrasenya saja, tanpa tambahan kalimat pengantar, penutup, "
        "tanda kutip pembungkus, label, atau penjelasan apa pun."
    )
    if request.provider == "deepseek":
        result = await call_deepseek_api(system_prompt, request.text)
    else:
        result = await call_gemini_api(system_prompt, request.text)
    # Catat riwayat
    add_history(current_user["id"], request.text, result, "paraphrase", request.provider)
    return {"result": result}

@app.post("/summary")
async def summary(request: TextRequest, current_user: dict = Depends(get_current_user)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Masukkan teks terlebih dahulu.")
    if len(request.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Teks terlalu pendek untuk diproses.")
    
    system_prompt = (
        "Anda adalah asisten AI ahli meringkas teks dalam bahasa Indonesia. "
        "Tugas Anda adalah membaca dan memahami SELURUH teks yang diberikan pengguna secara menyeluruh, "
        "kemudian menghasilkan ringkasan yang komprehensif namun padat. "
        "Panduan ringkasan: "
        "(1) Tangkap semua poin utama dan informasi kunci tanpa mengabaikan detail penting. "
        "(2) Jika teks asli memiliki beberapa topik/bagian, pastikan setiap bagian terwakili dalam ringkasan. "
        "(3) Panjang ringkasan harus proporsional — untuk teks sangat panjang buat 3–5 paragraf, untuk teks sedang buat 1–2 paragraf. "
        "(4) Gunakan bahasa yang lugas, jelas, dan mudah dipahami. "
        "Kembalikan HANYA hasil ringkasannya saja, tanpa tambahan kalimat pengantar, penutup, "
        "tanda kutip pembungkus, label, atau penjelasan apa pun."
    )
    if request.provider == "deepseek":
        result = await call_deepseek_api(system_prompt, request.text)
    else:
        result = await call_gemini_api(system_prompt, request.text)
    # Catat riwayat
    add_history(current_user["id"], request.text, result, "summary", request.provider)
    return {"result": result}

@app.post("/grammar")
async def grammar(request: TextRequest, current_user: dict = Depends(get_current_user)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Masukkan teks terlebih dahulu.")
    if len(request.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Teks terlalu pendek untuk diproses.")
    
    system_prompt = (
        "Anda adalah asisten AI ahli tata bahasa Indonesia sesuai kaidah EYD/PUEBI terbaru. "
        "Tugas Anda adalah memeriksa dan memperbaiki SELURUH teks yang diberikan pengguna secara menyeluruh, "
        "tidak peduli seberapa panjang teksnya — jangan pernah memotong atau menghilangkan bagian mana pun. "
        "Yang perlu diperbaiki: "
        "(1) Ejaan kata yang salah atau tidak baku (termasuk kata serapan). "
        "(2) Tata bahasa dan struktur kalimat yang tidak tepat. "
        "(3) Penggunaan tanda baca yang kurang tepat (koma, titik, tanda seru, dll). "
        "(4) Penggunaan huruf kapital yang salah (awal kalimat, nama diri, dll). "
        "(5) Kata tidak baku yang perlu diganti dengan bentuk bakunya. "
        "Pertahankan gaya dan makna penulisan asli, hanya perbaiki kesalahannya saja. "
        "Kembalikan HANYA teks hasil koreksi secara lengkap dan utuh, tanpa tambahan kalimat pengantar, "
        "penutup, label perubahan, tanda kutip pembungkus, atau penjelasan apa pun."
    )
    if request.provider == "deepseek":
        result = await call_deepseek_api(system_prompt, request.text)
    else:
        result = await call_gemini_api(system_prompt, request.text)
    # Catat riwayat
    add_history(current_user["id"], request.text, result, "grammar", request.provider)
    return {"result": result}

# Local Server Static File Routing (Disabled on Vercel)
if os.getenv("VERCEL") != "1":
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles
    
    frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
    
    @app.get("/")
    def read_index():
        index_path = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"message": "AI Text Assistant Backend is running."}
    
    @app.get("/admin")
    def read_admin():
        admin_path = os.path.join(frontend_dir, "admin.html")
        if os.path.exists(admin_path):
            return FileResponse(admin_path)
        return {"message": "admin.html not found."}
    
    @app.get("/login")
    def read_login():
        login_path = os.path.join(frontend_dir, "login.html")
        if os.path.exists(login_path):
            return FileResponse(login_path)
        return {"message": "login.html not found."}
    
    # Mount static files dari frontend folder
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
