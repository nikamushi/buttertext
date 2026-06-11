import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

class TextRequest(BaseModel):
    text: str
    provider: str = "gemini"

@app.post("/paraphrase")
async def paraphrase(request: TextRequest):
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
    return {"result": result}

@app.post("/summary")
async def summary(request: TextRequest):
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
    return {"result": result}

@app.post("/grammar")
async def grammar(request: TextRequest):
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
    return {"result": result}

if os.getenv("VERCEL") != "1":
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles
    
    @app.get("/")
    def read_index():
        index_path = os.path.join(os.path.dirname(__file__), "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"message": "AI Text Assistant Backend is running. Frontend index.html not found."}
    
    app.mount("/", StaticFiles(directory=os.path.dirname(__file__), html=True), name="static")
