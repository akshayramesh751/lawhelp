import os
import sys
from dotenv import load_dotenv

# Load env from ai-service/.env
load_dotenv(dotenv_path="e:/lawhelp/ai-service/.env")

gemini_key = os.environ.get("GEMINI_API_KEY")
print(f"Testing Gemini API Key: {gemini_key[:8]}...{gemini_key[-4:] if gemini_key else 'NONE'}")

try:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=gemini_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Respond with JSON: {\"status\": \"ok\", \"message\": \"API Key Valid!\"}",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0
        )
    )
    print("[SUCCESS] Gemini Response:")
    print(response.text)
except Exception as e:
    print(f"[ERROR] Error testing Gemini key: {e}")
