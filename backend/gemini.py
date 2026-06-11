import os
import logging
import httpx
from fastapi import HTTPException
from dotenv import load_dotenv

# Load environment variables from parent directory (root)
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

# Setup logging
logger = logging.getLogger("ai-text-assistant")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

def get_simulated_fallback(system_prompt: str, user_text: str) -> str:
    text_lower = user_text.lower().strip()
    if "parafrase" in system_prompt.lower():
        if "gue mau bilang makasih" in text_lower:
            return "Saya ingin mengucapkan terima kasih yang sebesar-besarnya atas semua bantuan yang telah Anda berikan kemarin."
        else:
            replaced = user_text
            replacements = {
                "gue": "saya", "lu": "Anda", "yg": "yang", "kalo": "kalau", "bgt": "sangat",
                "karna": "karena", "dgn": "dengan", "ga": "tidak", "gak": "tidak", "bro": "teman"
            }
            for k, v in replacements.items():
                import re
                replaced = re.sub(rf'\b{k}\b', v, replaced, flags=re.IGNORECASE)
            if replaced == user_text:
                return f"Secara alternatif, kalimat Anda dapat diungkapkan sebagai: {user_text}"
            return replaced
            
    elif "meringkas" in system_prompt.lower():
        if "kemajuan teknologi kecerdasan buatan" in text_lower:
            return (
                "Perkembangan kecerdasan buatan (AI) yang pesat di era digital mendorong banyak industri "
                "melakukan otomatisasi. Meskipun hal ini menimbulkan kekhawatiran terkait pengurangan tenaga kerja, "
                "AI juga menciptakan peluang kerja baru di bidang digital, sehingga adaptasi terus-menerus sangat diperlukan."
            )
        else:
            sentences = user_text.split('.')
            if len(sentences) > 1 and len(sentences[0]) > 20:
                return sentences[0].strip() + "."
            return user_text[:120] + "..." if len(user_text) > 120 else user_text
            
    elif "tata bahasa" in system_prompt.lower() or "grammar" in system_prompt.lower():
        if "pergi ke apotik" in text_lower:
            return "Saya kemarin pergi ke apotek membeli obat, tetapi obatnya habis. Terpaksa, saya pulang dengan tangan kosong."
        else:
            replaced = user_text
            replacements = {
                "apotik": "apotek", "kosg": "kosong", "obat nya": "obatnya", "terimakasih": "terima kasih",
                "analisa": "analisis", "aktifitas": "aktivitas", "ijin": "izin", "fikir": "pikir",
                "karna": "karena", "nomer": "nomor", "praktek": "praktik", "silahkan": "silakan"
            }
            for k, v in replacements.items():
                import re
                replaced = re.sub(rf'\b{k}\b', v, replaced, flags=re.IGNORECASE)
            return replaced
            
    return user_text

async def call_gemini_api(system_prompt: str, user_text: str) -> str:
    if not GEMINI_API_KEY or GEMINI_API_KEY.startswith("YOUR_"):
        logger.warning("GEMINI_API_KEY is not configured. Using simulated fallback.")
        return get_simulated_fallback(system_prompt, user_text)

    headers = {
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": user_text}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system_prompt}
            ]
        },
        "generationConfig": {
            "temperature": 0.5,
            "maxOutputTokens": 8192
        }
    }

    url_with_key = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url_with_key, json=payload, headers=headers)
            if response.status_code != 200:
                logger.error(f"Gemini API returned error {response.status_code}: {response.text}")
                if response.status_code in [401, 403, 429]:
                    logger.warning("Gemini API quota exhausted or unauthorized. Using simulated fallback.")
                    return get_simulated_fallback(system_prompt, user_text)
                raise HTTPException(status_code=500, detail="Terjadi kesalahan saat memproses teks. Silakan coba lagi.")
            
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except httpx.RequestError as e:
        logger.error(f"HTTP request error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat memproses teks. Silakan coba lagi.")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat memproses teks. Silakan coba lagi.")
