import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv(dotenv_path="e:/lawhelp/ai-service/.env")
groq_key = os.environ.get("GROQ_API_KEY")
print(f"Testing Groq API Key: {groq_key[:8]}...{groq_key[-4:] if groq_key else 'NONE'}")

try:
    client = Groq(api_key=groq_key)
    res = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": "Respond with JSON: {\"status\": \"ok\", \"service\": \"groq\"}"}],
        response_format={"type": "json_object"}
    )
    print("[SUCCESS] Groq Response:")
    print(res.choices[0].message.content)
except Exception as e:
    print(f"[ERROR] Groq key test failed: {e}")
