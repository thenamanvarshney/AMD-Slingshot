# CodeReview AI - Next-Gen Version Control
**Built for the AMD Slingshot Hackathon**

CodeReview AI is an intelligent version control visualization tool. Instead of just showing raw code diffs, it uses AI to analyze entire project folders or single code snippets, summarize architectural changes, flag security vulnerabilities, and provide educational insights for developers.

## Tech Stack
* **Frontend:** Next.js, React, Tailwind CSS
* **Backend:** Python, FastAPI
* **AI Engine:** Google Gemini 2.5 Flash
* **Enterprise Target:** Architected to run locally on AMD ROCm software and AMD Instinct Accelerators for total code privacy.

## Features
* **Dual Input Modes:** Toggle between "Snippet Mode" for quick text pasting and "Project Mode" to upload entire Version 1 and Version 2 directories.
* **Smart Folder Analysis:** Instantly see project-wide architecture changes. The frontend automatically filters out junk files and binaries (like `node_modules`).
* **Security Scanning:** Automatically detects vulnerabilities like hardcoded credentials and SQL injections.
* **Educational Mentorship:** Explains why the new code is better (e.g., performance improvements, design patterns, input validation) to mentor junior developers.

## How to Run Locally

### 1. Clone the repository
Download the code to your local machine.

### 2. Setup the Frontend
Open a terminal in the project folder and install the UI dependencies:
```bash
npm install
### 3. Setup the Backend
Open a second terminal and install the Python dependencies:

Bash
pip install fastapi uvicorn google-generativeai pydantic python-multipart
(If you are on Windows, try py -m pip install fastapi uvicorn google-generativeai pydantic python-multipart)

### 4. Add your API Key
You must add your own Gemini API key for the AI analysis to work.

Get a free API key from Google AI Studio.

Open the server.py file in your code editor.

Find this exact line near the top:
os.environ["GEMINI_API_KEY"] = "YOUR_GEMINI_API_KEY"

Replace "YOUR_GEMINI_API_KEY" with your actual API key. Save the file.

### 5. Start the Engines
Start the backend server:

Bash
python -m uvicorn server:app --reload
(Windows users: Use py -m uvicorn server:app --reload)

Start the frontend UI:

Bash
npm run dev
Open http://localhost:3000 in your browser to use the app!