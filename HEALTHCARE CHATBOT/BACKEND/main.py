from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Healthcare chatbot backend running"}

@app.post("/chat")
def chat(data: dict):
    user_message = data.get("message")

    # Simple chatbot logic
    if "fever" in user_message.lower():
        reply = "You may have infection. Drink fluids and rest."
    elif "headache" in user_message.lower():
        reply = "Take rest and stay hydrated."
    else:
        reply = "Please explain symptoms clearly."

    return {"response": reply}
