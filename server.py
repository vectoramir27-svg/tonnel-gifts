import os
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TARGET_API = "https://api.telegram-gifts.ru"
DEFAULT_ACCESS_TOKEN = "gifts.wss"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
ASSETS_DIR = os.path.join(PUBLIC_DIR, "assets")

# Прокси для API
@app.api_route("/api-proxy/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_telegram_gifts(path: str, request: Request):
    url = f"{TARGET_API}/{path}"
    params = dict(request.query_params)
    if "accessToken" not in params:
        params["accessToken"] = DEFAULT_ACCESS_TOKEN

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient() as client:
        body = await request.body()
        resp = await client.request(
            method=request.method,
            url=url,
            params=params,
            headers=headers,
            content=body,
            timeout=20.0
        )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("content-type")
        )

# Явная раздача папки assets
if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# Отдача статики и SPA fallback
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    file_path = os.path.join(PUBLIC_DIR, full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(PUBLIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    print("🚀 Сервер запущен: http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)