"""

FastAPI backend for AI Code Review.
POST /review-code with old_code and new_code; returns Gemini 1.5 Pro analysis as JSON.
"""
import os
import json
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import google.generativeai as genai

app = FastAPI(title="Code Review AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewRequest(BaseModel):
    old_code: str
    new_code: str


class ReviewResponse(BaseModel):
    summary: list[str]
    security_issues: list[str]
    learning_moment: str


SYSTEM_PROMPT = """You are a code review assistant. Compare the OLD code and NEW code.

Return a strict JSON object with exactly these three keys (no markdown, no code fences):
- "summary": array of strings. Each string is one bullet point describing what changed (e.g. "Replaced linear search with Map for O(1) lookups").
- "security_issues": array of strings. List any security vulnerabilities in either version, or note "No issues found" if none.
- "learning_moment": a single string explaining why the new code is better (teach the developer).

Output only valid JSON, nothing else."""


def extract_json(text: str) -> dict:
    """Try to parse JSON from model output, stripping markdown if present."""
    text = text.strip()
    # Remove optional markdown code fence
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    return json.loads(text)


@app.post("/review-code", response_model=ReviewResponse)
async def review_code(req: ReviewRequest):
    os.environ["GEMINI_API_KEY"] = "YOUR_GEMINI_API_KEY"
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set.",
        )

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )

    user_content = f"""OLD CODE:
```
{req.old_code}
```

NEW CODE:
```
{req.new_code}
```

Compare them and return the JSON object as instructed."""

    try:
        response = model.generate_content(
            [SYSTEM_PROMPT, user_content],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")

    if not response or not response.text:
        raise HTTPException(status_code=502, detail="Empty response from Gemini.")

    try:
        data = extract_json(response.text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned invalid JSON: {e}. Raw: {response.text[:500]}",
        )

    summary = data.get("summary")
    security_issues = data.get("security_issues")
    learning_moment = data.get("learning_moment")

    if summary is None or not isinstance(summary, list):
        summary = []
    if security_issues is None or not isinstance(security_issues, list):
        security_issues = []
    if learning_moment is None or not isinstance(learning_moment, str):
        learning_moment = str(learning_moment or "No explanation provided.")

    return ReviewResponse(
        summary=[str(s) for s in summary],
        security_issues=[str(s) for s in security_issues],
        learning_moment=learning_moment,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
