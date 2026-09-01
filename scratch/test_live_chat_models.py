import os
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "server", ".env"))

gemini_key = os.environ.get("GEMINI_API_KEY")
groq_key = os.environ.get("GROQ_API_KEY")

prompt = """
Analyze if this document is one-sided or unfair:
DOCUMENT CONTEXT:
Rental agreement: Rent Rs 42,000, Deposit Rs 2,50,000. Landlord can enter anytime without notice. Tenant must give 90 days notice, landlord 0 days.

Respond with JSON:
{
  "reply": "your answer in markdown",
  "relevantClauses": [1],
  "citations": [],
  "suggestedQuestions": ["Question 1?", "Question 2?"]
}
"""

print("Testing Gemini 3.6 Flash...")
from google import genai
from google.genai import types

client = genai.Client(api_key=gemini_key)
res = client.models.generate_content(
    model="gemini-3.6-flash",
    contents=prompt,
    config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.0)
)
data = json.loads(res.text)
print("Gemini Succeeded! Reply:\n", data["reply"])

print("\nTesting Groq openai/gpt-oss-120b...")
from groq import Groq
cg = Groq(api_key=groq_key)
res_g = cg.chat.completions.create(
    model="openai/gpt-oss-120b",
    messages=[{"role": "user", "content": prompt}],
    response_format={"type": "json_object"},
    temperature=0.0
)
data_g = json.loads(res_g.choices[0].message.content)
print("Groq Succeeded! Reply:\n", data_g["reply"])
