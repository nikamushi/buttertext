import os
import sys
from fastapi.responses import FileResponse

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app

@app.get("/")
async def read_index():
    public_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "index.html")
    if os.path.exists(public_path):
        return FileResponse(public_path)
    return {"message": "index.html not found"}

handler = app
