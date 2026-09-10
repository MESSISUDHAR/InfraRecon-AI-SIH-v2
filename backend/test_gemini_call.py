import os
import httpx
import json
import time
from pathlib import Path
import dotenv

root_env = Path("..") / ".env"
backend_env = Path(".env")
if root_env.exists():
    dotenv.load_dotenv(root_env)
if backend_env.exists():
    dotenv.load_dotenv(backend_env)

api_key = os.getenv("GEMINI_API_KEY", "").strip()
model = "gemini-3.6-flash"
url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

payload = {
    "contents": [
        {"role": "user", "parts": [{"text": "Return a JSON object with key 'result' and value 'success'"}]}
    ],
    "generationConfig": {
        "responseMimeType": "application/json"
    }
}

for attempt in range(1, 4):
    t0 = time.time()
    print(f"Attempt {attempt}: Sending request to {model}...")
    try:
        with httpx.Client(timeout=35.0) as client:
            resp = client.post(url, json=payload)
        elapsed = time.time() - t0
        print(f"Status: {resp.status_code} in {elapsed:.2f}s")
        print("Response JSON:")
        print(resp.text)
        if resp.status_code == 200:
            break
    except Exception as e:
        print(f"Error ({type(e).__name__}): {e}")
    time.sleep(2)
