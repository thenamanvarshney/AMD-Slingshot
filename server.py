"""
FastAPI backend for AI Code Review.
POST /review-code with folder1_files and folder2_files (dict of path -> content);
returns Gemini 2.5 Flash analysis as JSON (summary, security_issues, learning_moment).
"""
import os
import json
import re
import difflib

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
    old_code: str | None = None
    new_code: str | None = None
    folder1_files: dict[str, str] | None = None
    folder2_files: dict[str, str] | None = None


class ReviewResponse(BaseModel):
    summary: list[str]
    security_issues: list[str]
    learning_moment: str


def build_folder_comparison(f1: dict[str, str], f2: dict[str, str]) -> str:
    """Produce a string: added files, deleted files, and unified diffs for modified files."""
    set1 = set(f1.keys())
    set2 = set(f2.keys())
    added = sorted(set2 - set1)
    deleted = sorted(set1 - set2)
    modified = sorted(k for k in set1 & set2 if f1[k] != f2[k])

    lines: list[str] = []
    lines.append("=== ADDED FILES (in Version 2 only) ===")
    if added:
        for path in added:
            lines.append(f"  + {path}")
            content = f2[path]
            if len(content) > 50_000:
                content = content[:50_000] + "\n... [truncated]\n"
            lines.append("--- content ---")
            lines.append(content)
            lines.append("")
    else:
        lines.append("  (none)")
    lines.append("")

    lines.append("=== DELETED FILES (in Version 1 only) ===")
    if deleted:
        for path in deleted:
            lines.append(f"  - {path}")
    else:
        lines.append("  (none)")
    lines.append("")

    lines.append("=== MODIFIED FILES (diff) ===")
    if modified:
        for path in modified:
            lines.append(f"  ~ {path}")
            a_lines = f1[path].splitlines(keepends=True)
            b_lines = f2[path].splitlines(keepends=True)
            diff = difflib.unified_diff(
                a_lines,
                b_lines,
                fromfile=f"v1/{path}",
                tofile=f"v2/{path}",
                lineterm="",
            )
            diff_text = "".join(diff)
            if len(diff_text) > 30_000:
                diff_text = diff_text[:30_000] + "\n... [truncated]\n"
            lines.append(diff_text)
            lines.append("")
    else:
        lines.append("  (none)")

    return "\n".join(lines)


SNIPPET_SYSTEM_PROMPT = """You are a code review assistant. Compare the OLD code and NEW code (single file snippet).

Return a strict JSON object with exactly these three keys (no markdown, no code fences):
- "summary": array of strings. Each string is one bullet point describing what changed (e.g. "Replaced linear search with Map for O(1) lookups").
- "security_issues": array of strings. List any security vulnerabilities in either version, or note "No issues found" if none.
- "learning_moment": a single string explaining why the new code is better (teach the developer).

Output only valid JSON, nothing else."""

PROJECT_SYSTEM_PROMPT = """You are a code review assistant. You are given a text that describes the differences between two project folder versions:
- ADDED FILES: files that exist only in Version 2
- DELETED FILES: files that exist only in Version 1
- MODIFIED FILES: unified diffs for files that changed

Analyze the overall changes and return a strict JSON object with exactly these three keys (no markdown, no code fences):
- "summary": array of strings. Each string is one bullet point describing what changed across the project (e.g. "Added new API route in src/api.py", "Removed deprecated config").
- "security_issues": array of strings. List any security vulnerabilities introduced or fixed, or note "No issues found" if none.
- "learning_moment": a single string explaining why the new version is better (teach the developer).

Output only valid JSON, nothing else."""


def extract_json(text: str) -> dict:
    """Try to parse JSON from model output, stripping markdown if present."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    return json.loads(text)


def _call_gemini(system_prompt: str, user_content: str) -> str:
    api_key = "YOUR_GEMINI_API_KEY"
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
    response = model.generate_content([system_prompt, user_content])
    if not response or not response.text:
        raise HTTPException(status_code=502, detail="Empty response from Gemini.")
    return response.text


@app.post("/review-code", response_model=ReviewResponse)
async def review_code(req: ReviewRequest):
    has_snippet = req.old_code is not None and req.new_code is not None
    has_folders = (
        req.folder1_files is not None
        and req.folder2_files is not None
        and len(req.folder1_files) >= 0
        and len(req.folder2_files) >= 0
    )

    if has_snippet:
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
            response_text = _call_gemini(SNIPPET_SYSTEM_PROMPT, user_content)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")
    elif has_folders:
        comparison = build_folder_comparison(req.folder1_files, req.folder2_files)
        if len(comparison) > 900_000:
            comparison = comparison[:900_000] + "\n\n... [output truncated for context limit]\n"
        user_content = f"""FOLDER COMPARISON (Version 1 vs Version 2):

{comparison}

Analyze the changes and return the JSON object as instructed."""
        try:
            response_text = _call_gemini(PROJECT_SYSTEM_PROMPT, user_content)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either old_code and new_code (snippet mode) or folder1_files and folder2_files (project mode).",
        )

    try:
        data = extract_json(response_text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned invalid JSON: {e}. Raw: {response_text[:500]}",
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
