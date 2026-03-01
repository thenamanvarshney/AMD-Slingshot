# 🚀 CodeReview AI - Next-Gen Version Control
**Built for the AMD Slingshot Hackathon**

CodeReview AI is an intelligent version control visualization tool. Instead of just showing raw code diffs, it uses AI to analyze entire project folders, summarize architectural changes, flag security vulnerabilities, and provide educational insights for junior developers.

## 🛠️ Tech Stack
* **Frontend:** Next.js, React, Tailwind CSS
* **Backend:** Python, FastAPI
* **AI Engine:** Google Gemini 2.5 Flash

## ✨ Features
* **Folder-Level Analysis:** Upload 'Version 1' and 'Version 2' directories to instantly see project-wide changes.
* **Security Scanning:** Automatically detects vulnerabilities like hardcoded credentials and SQL injections.
* **Educational Mentorship:** Explains *why* the new code is better (e.g., performance improvements, design patterns).

## 💻 How to Run Locally

1. **Clone the repository** to your local machine.

2. **Install frontend dependencies:** ```bash
   npm install
Install backend dependencies: ```bash
pip install fastapi uvicorn google-generativeai pydantic python-multipart


##🔑 Add your API Key: * Get a free API key from Google AI Studio.

Open the server.py file.
Find the line that says os.environ["GEMINI_API_KEY"] = "YOUR_GEMINI_API_KEY".
Replace "YOUR_GEMINI_API_KEY" with your actual key.

## Start the backend engine (in your terminal):Bash
python -m uvicorn server:app --reload
(Note for Windows users: You may need to use py -m uvicorn server:app --reload)

## Start the frontend UI (in a second terminal tab): Bash
npm run dev