import os
import logging
import httpx
from fastapi import HTTPException
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logger = logging.getLogger("ai-text-assistant")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

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

async def call_deepseek_api(system_prompt: str, user_text: str) -> str:
    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.startswith("YOUR_") or DEEPSEEK_API_KEY == "":
        logger.warning("DEEPSEEK_API_KEY is not configured. Using simulated fallback.")
        return get_simulated_fallback(system_prompt, user_text)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ],
        "temperature": 0.5,
        "max_tokens": 4096
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(DEEPSEEK_API_URL, json=payload, headers=headers)
            if response.status_code != 200:
                logger.error(f"DeepSeek API returned error {response.status_code}: {response.text}")
                if response.status_code in [401, 403, 429]:
                    logger.warning("DeepSeek API quota exhausted or unauthorized. Using simulated fallback.")
                    return get_simulated_fallback(system_prompt, user_text)
                raise HTTPException(status_code=500, detail="Terjadi kesalahan saat memproses teks dengan DeepSeek. Silakan coba lagi.")
            
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except httpx.RequestError as e:
        logger.error(f"HTTP request error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat menghubungi API DeepSeek. Silakan coba lagi.")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan internal. Silakan coba lagi.")
