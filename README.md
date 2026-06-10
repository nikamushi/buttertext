# ButterText

Asisten teks berbasis AI untuk bahasa Indonesia. Mendukung tiga fitur utama: **parafrase**, **ringkasan**, dan **koreksi grammar** — dengan pilihan model AI antara Google Gemini dan DeepSeek.

![Tech Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)
![Frontend](https://img.shields.io/badge/Frontend-Tailwind%20CSS-38BDF8?style=flat-square&logo=tailwindcss)
![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=flat-square&logo=python)

---

## Fitur

| Fitur | Deskripsi |
|---|---|
| **Parafrase** | Mengubah struktur dan pilihan kata teks tanpa mengubah makna aslinya |
| **Ringkasan** | Merangkum teks panjang menjadi poin-poin utama yang padat |
| **Grammar** | Memeriksa dan memperbaiki ejaan, tanda baca, serta tata bahasa sesuai EYD/PUEBI |

- Pilihan model AI: **Gemini 2.5 Flash** atau **DeepSeek Chat**
- Fallback otomatis ke mode simulasi jika API key belum dikonfigurasi
- Antarmuka responsif dengan skeleton loading dan toast notification

---

## Tech Stack

- **Backend**: FastAPI + Uvicorn
- **Frontend**: HTML, Tailwind CSS (CDN), Vanilla JavaScript
- **HTTP Client**: httpx (async)
- **AI Providers**: Google Gemini API, DeepSeek API

---

## Instalasi

### 1. Clone repository

```bash
git clone <url-repo-ini>
cd buttertext
```

### 2. Buat virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Konfigurasi API Key

Salin file `.env.example` menjadi `.env`, lalu isi dengan API key kamu:

```bash
copy .env.example .env
```

Edit file `.env`:

```env
GEMINI_API_KEY=isi_dengan_api_key_gemini_kamu
DEEPSEEK_API_KEY=isi_dengan_api_key_deepseek_kamu
```

- Gemini API Key: [https://aistudio.google.com/](https://aistudio.google.com/)
- DeepSeek API Key: [https://platform.deepseek.com/](https://platform.deepseek.com/)

> Jika API key tidak diisi, aplikasi akan tetap berjalan menggunakan fallback simulasi lokal.

---

## Menjalankan Aplikasi

```bash
uvicorn main:app --reload
```

Buka browser dan akses: [http://localhost:8000](http://localhost:8000)

---

## Struktur Proyek

```
buttertext/
├── main.py          # Entry point FastAPI, definisi semua endpoint
├── gemini.py        # Integrasi Google Gemini API
├── deepseek.py      # Integrasi DeepSeek API
├── index.html       # Halaman frontend utama
├── app.js           # Logika frontend (tab switching, API calls, UI state)
├── style.css        # Custom CSS (animasi, shimmer, toast)
├── requirements.txt # Daftar dependensi Python
├── .env             # API keys (tidak di-commit)
└── .env.example     # Template konfigurasi environment
```

---

## API Endpoints

Semua endpoint menerima `POST` request dengan body JSON:

```json
{
  "text": "teks yang ingin diproses",
  "provider": "gemini"
}
```

> `provider` bisa diisi `"gemini"` (default) atau `"deepseek"`.

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/paraphrase` | Parafrase teks |
| `POST` | `/summary` | Ringkas teks |
| `POST` | `/grammar` | Koreksi grammar teks |
| `GET` | `/` | Serve halaman frontend |

**Contoh response:**

```json
{
  "result": "Teks hasil pemrosesan AI..."
}
```

---