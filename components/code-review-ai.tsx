"use client"

import { useState, useCallback } from "react"
import {
  GitCompareArrows,
  Sparkles,
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Lightbulb,
  Trash2,
  Copy,
  Check,
  FolderOpen,
} from "lucide-react"

/* ------------------------------------------------------------------ */
/*  Types & API response shape                                          */
/* ------------------------------------------------------------------ */

interface AnalysisResult {
  changes: { text: string; type: "added" | "removed" | "modified" }[]
  security: { text: string; severity: "critical" | "warning" | "ok" }[]
  learning: {
    title: string
    before: string
    after: string
    explanation: string
  }[]
}

/** Response from POST /review-code */
interface ReviewCodeResponse {
  summary: string[]
  security_issues: string[]
  learning_moment: string
}

/** Map of filepath -> file content for folder comparison */
export type FolderFiles = Record<string, string>

type InputMode = "snippet" | "project"

const OLD_PLACEHOLDER = `function findUser(users, targetId) {
  for (let i = 0; i < users.length; i++) {
    if (users[i].id === targetId) return users[i];
  }
  return null;
}`

const NEW_PLACEHOLDER = `function findUser(users, targetId) {
  const userMap = new Map(users.map(u => [u.id, u]));
  return userMap.get(targetId) ?? null;
}`

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "__pycache__",
  ".env",
])
const IGNORED_FILES = new Set([".env"])
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".svg",
  ".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v",
  ".mp3", ".wav", ".ogg", ".m4a", ".flac",
  ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".exe", ".dll", ".so", ".dylib", ".bin",
])

function isTextFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  const lastDot = lower.lastIndexOf(".")
  const ext = lastDot >= 0 ? lower.slice(lastDot) : ""
  if (BINARY_EXTENSIONS.has(ext)) return false
  const name = lower.split("/").pop()?.split("\\").pop() ?? ""
  if (IGNORED_FILES.has(name)) return false
  const segments = filePath.replace(/\\/g, "/").split("/")
  for (const seg of segments) {
    if (IGNORED_DIRS.has(seg)) return false
  }
  return true
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file, "utf-8")
  })
}

/**
 * Read uploaded folder files; filter binary/junk; return { filepath: content }.
 */
export async function readFolderFiles(files: FileList | null): Promise<FolderFiles> {
  const out: FolderFiles = {}
  if (!files?.length) return out
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!(file instanceof File)) continue
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    if (!isTextFile(path)) continue
    try {
      const text = await readFileAsText(file)
      out[path] = text
    } catch {
      // skip unreadable (e.g. binary detected as text)
      continue
    }
  }
  return out
}

function mapReviewResponseToResult(res: ReviewCodeResponse): AnalysisResult {
  return {
    changes: res.summary.map((text) => ({ text, type: "modified" as const })),
    security: res.security_issues.map((text) => ({
      text,
      severity: text.toLowerCase().includes("no issue") ? ("ok" as const) : ("warning" as const),
    })),
    learning: [
      {
        title: "Why the new code is better",
        before: "",
        after: "",
        explanation: res.learning_moment,
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/*  Small reusable pieces                                              */
/* ------------------------------------------------------------------ */

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-glass-border bg-glass backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  )
}

function SeverityBadge({
  severity,
}: {
  severity: "critical" | "warning" | "ok"
}) {
  const map = {
    critical: {
      bg: "bg-red-500/15",
      text: "text-red-400",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      label: "Critical",
    },
    warning: {
      bg: "bg-amber-500/15",
      text: "text-amber-400",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: "Warning",
    },
    ok: {
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: "Resolved",
    },
  } as const
  const s = map[severity]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
    >
      {s.icon}
      {s.label}
    </span>
  )
}

function ChangeBadge({ type }: { type: "added" | "removed" | "modified" }) {
  const map = {
    added: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "+" },
    removed: { bg: "bg-red-500/15", text: "text-red-400", label: "-" },
    modified: { bg: "bg-sky-500/15", text: "text-sky-400", label: "~" },
  } as const
  const c = map[type]
  return (
    <span
      className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded font-mono text-xs font-bold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Copy-to-clipboard button                                           */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])
  return (
    <button
      onClick={copy}
      aria-label="Copy to clipboard"
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Code text-area (snippet mode)                                      */
/* ------------------------------------------------------------------ */

function CodeTextArea({
  label,
  value,
  onChange,
  accentColor,
  icon,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  accentColor: string
  icon: React.ReactNode
}) {
  const lineCount = value.split("\n").length
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-glass-border bg-secondary/60 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {label}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
          <CopyButton text={value} />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label}`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-[200px] overflow-hidden rounded-b-xl border border-glass-border">
        <div
          aria-hidden
          className="pointer-events-none flex select-none flex-col items-end bg-code-bg px-3 pt-4 font-mono text-xs leading-6 text-muted-foreground/50"
        >
          {Array.from({ length: Math.max(lineCount, 16) }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <div className={`w-px ${accentColor} opacity-30`} />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="flex-1 resize-none bg-code-bg px-4 pt-4 font-mono text-sm leading-6 text-foreground/90 outline-none placeholder:text-muted-foreground/40"
          placeholder={`Paste your ${label.toLowerCase()} here...`}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Folder upload dropzone                                             */
/* ------------------------------------------------------------------ */

function FolderUploadDropzone({
  label,
  fileCount,
  reading,
  onClear,
  onFilesSelected,
  accentColor,
  icon,
}: {
  label: string
  fileCount: number
  reading?: boolean
  onClear: () => void
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void
  accentColor: string
  icon: React.ReactNode
}) {
  const inputId = label.replace(/\s+/g, "-").toLowerCase()
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-glass-border bg-secondary/60 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {label}
        </span>
        <div className="flex items-center gap-1">
          {reading ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reading...
            </span>
          ) : (
            <>
              <span className="text-xs tabular-nums text-muted-foreground">
                {fileCount} {fileCount === 1 ? "file" : "files"}
              </span>
              {fileCount > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  aria-label={`Clear ${label}`}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <label
        htmlFor={inputId}
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-b-xl border border-dashed border-glass-border bg-code-bg/50 transition-colors hover:border-primary/40 hover:bg-code-bg/80 ${accentColor} opacity-60 hover:opacity-100 ${reading ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          id={inputId}
          type="file"
          className="sr-only"
          {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          multiple
          onChange={onFilesSelected}
          disabled={reading}
        />
        {reading ? (
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        ) : (
          <FolderOpen className="h-10 w-10 text-muted-foreground" />
        )}
        <span className="text-center text-sm font-medium text-foreground">
          {reading ? "Reading files..." : "Drop folder here or click to browse"}
        </span>
        <span className="text-xs text-muted-foreground">
          Only text files; node_modules, .git, .next, etc. are ignored
        </span>
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Result cards                                                       */
/* ------------------------------------------------------------------ */

function WhatChangedCard({
  changes,
}: {
  changes: AnalysisResult["changes"]
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-3 border-b border-glass-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
          <ArrowRightLeft className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            What Changed
          </h3>
          <p className="text-xs text-muted-foreground">
            {changes.length} modifications detected
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-3 px-5 py-4">
        {changes.map((c, i) => (
          <li key={i} className="flex items-start gap-3">
            <ChangeBadge type={c.type} />
            <span className="text-sm leading-relaxed text-foreground/85">
              {c.text}
            </span>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}

function SecurityCheckCard({
  items,
}: {
  items: AnalysisResult["security"]
}) {
  const allOk = items.every((s) => s.severity === "ok")
  return (
    <GlassCard>
      <div className="flex items-center gap-3 border-b border-glass-border px-5 py-4">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            allOk
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {allOk ? (
            <ShieldCheck className="h-4.5 w-4.5" />
          ) : (
            <ShieldAlert className="h-4.5 w-4.5" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Security Check
          </h3>
          <p className="text-xs text-muted-foreground">
            {items.filter((s) => s.severity !== "ok").length === 0
              ? "No critical issues found"
              : `${items.filter((s) => s.severity !== "ok").length} issue(s) need attention`}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-3 px-5 py-4">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <SeverityBadge severity={s.severity} />
            <span className="text-sm leading-relaxed text-foreground/85">
              {s.text}
            </span>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}

function LearningMomentCard({
  items,
}: {
  items: AnalysisResult["learning"]
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-3 border-b border-glass-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <GraduationCap className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Learning Moment
          </h3>
          <p className="text-xs text-muted-foreground">
            {items.length} concepts explained
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        {items.map((l, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {l.title}
              </span>
            </div>
            {l.before || l.after ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-diff-remove px-3 py-2">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-diff-remove-text/70">
                    Before
                  </span>
                  <p className="font-mono text-xs leading-relaxed text-diff-remove-text">
                    {l.before}
                  </p>
                </div>
                <div className="rounded-lg bg-diff-add px-3 py-2">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-diff-add-text/70">
                    After
                  </span>
                  <p className="font-mono text-xs leading-relaxed text-diff-add-text">
                    {l.after}
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary/70" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {l.explanation}
              </p>
            </div>
            {i < items.length - 1 && (
              <div className="border-t border-glass-border" />
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/*  Main exported component                                            */
/* ------------------------------------------------------------------ */

const API_BASE = "http://localhost:8000"

export default function CodeReviewAI() {
  const [inputMode, setInputMode] = useState<InputMode>("snippet")
  const [oldCode, setOldCode] = useState(OLD_PLACEHOLDER)
  const [newCode, setNewCode] = useState(NEW_PLACEHOLDER)
  const [folder1Files, setFolder1Files] = useState<FolderFiles>({})
  const [folder2Files, setFolder2Files] = useState<FolderFiles>({})
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readingFolder, setReadingFolder] = useState<1 | 2 | null>(null)

  const handleFolder1Change = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setReadingFolder(1)
    try {
      const next = await readFolderFiles(files)
      setFolder1Files(next)
    } finally {
      setReadingFolder(null)
      e.target.value = ""
    }
  }, [])

  const handleFolder2Change = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setReadingFolder(2)
    try {
      const next = await readFolderFiles(files)
      setFolder2Files(next)
    } finally {
      setReadingFolder(null)
      e.target.value = ""
    }
  }, [])

  const analyze = useCallback(async () => {
    const isSnippet = inputMode === "snippet"
    if (isSnippet && (!oldCode.trim() || !newCode.trim())) return
    if (!isSnippet && (Object.keys(folder1Files).length === 0 || Object.keys(folder2Files).length === 0)) return

    setLoading(true)
    setResult(null)
    setError(null)
    const body = isSnippet
      ? { old_code: oldCode, new_code: newCode }
      : { folder1_files: folder1Files, folder2_files: folder2Files }
    try {
      const res = await fetch(`${API_BASE}/review-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.text()
        let msg = errBody
        try {
          const j = JSON.parse(errBody)
          msg = j.detail ?? errBody
        } catch {
          // use raw
        }
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg))
      }
      const data: ReviewCodeResponse = await res.json()
      setResult(mapReviewResponseToResult(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }, [inputMode, oldCode, newCode, folder1Files, folder2Files])

  const hasInput =
    inputMode === "snippet"
      ? oldCode.trim().length > 0 && newCode.trim().length > 0
      : Object.keys(folder1Files).length > 0 && Object.keys(folder2Files).length > 0

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-8 md:px-8 lg:py-12">
      {/* ---- Header --------------------------------------------------- */}
      <header className="mb-10 flex flex-col items-center text-center">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-[0_0_20px_var(--glow-muted)]">
            <GitCompareArrows className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            CodeReview
            <span className="text-primary"> AI</span>
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground text-balance">
          Compare code in Snippet Mode (paste two versions) or Project Mode
          (upload two folders). The AI will summarize changes, flag security
          issues, and explain why the new version is better.
        </p>
      </header>

      {/* ---- Mode tabs ------------------------------------------------ */}
      <div className="mb-4 flex justify-center">
        <div className="inline-flex rounded-xl border border-glass-border bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setInputMode("snippet")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              inputMode === "snippet"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Snippet Mode
          </button>
          <button
            type="button"
            onClick={() => setInputMode("project")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              inputMode === "project"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Project Mode
          </button>
        </div>
      </div>

      {/* ---- Input area (snippet or project) ------------------------- */}
      <section className="mb-6 flex flex-col gap-4 md:flex-row md:gap-5">
        {inputMode === "snippet" ? (
          <>
            <CodeTextArea
              label="Old Code"
              value={oldCode}
              onChange={setOldCode}
              accentColor="bg-diff-remove-text"
              icon={
                <span className="flex h-5 w-5 items-center justify-center rounded bg-red-500/15 font-mono text-xs font-bold text-red-400">
                  −
                </span>
              }
            />
            <CodeTextArea
              label="New Code"
              value={newCode}
              onChange={setNewCode}
              accentColor="bg-diff-add-text"
              icon={
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
                  +
                </span>
              }
            />
          </>
        ) : (
          <>
            <FolderUploadDropzone
              label="Upload Version 1 Folder"
              fileCount={Object.keys(folder1Files).length}
              reading={readingFolder === 1}
              onClear={() => setFolder1Files({})}
              onFilesSelected={handleFolder1Change}
              accentColor="bg-diff-remove-text"
              icon={
                <span className="flex h-5 w-5 items-center justify-center rounded bg-red-500/15 font-mono text-xs font-bold text-red-400">
                  1
                </span>
              }
            />
            <FolderUploadDropzone
              label="Upload Version 2 Folder"
              fileCount={Object.keys(folder2Files).length}
              reading={readingFolder === 2}
              onClear={() => setFolder2Files({})}
              onFilesSelected={handleFolder2Change}
              accentColor="bg-diff-add-text"
              icon={
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
                  2
                </span>
              }
            />
          </>
        )}
      </section>

      {/* ---- Analyze button ------------------------------------------- */}
      <div className="mb-10 flex justify-center">
        <button
          onClick={analyze}
          disabled={loading || !hasInput || readingFolder !== null}
          className="group relative inline-flex items-center gap-2.5 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_var(--glow-muted)] transition-all hover:shadow-[0_0_36px_var(--glow-strong)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
              Analyze Changes with AI
            </>
          )}
          {/* glow ring on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/0 transition-all group-hover:ring-primary/30"
          />
        </button>
      </div>

      {/* ---- Error message --------------------------------------------- */}
      {error && !loading && (
        <GlassCard className="mb-6 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3 px-5 py-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        </GlassCard>
      )}

      {/* ---- Loading skeleton ----------------------------------------- */}
      {loading && (
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <GlassCard key={i} className="animate-pulse">
              <div className="border-b border-glass-border px-5 py-4">
                <div className="h-4 w-28 rounded bg-secondary" />
              </div>
              <div className="flex flex-col gap-3 px-5 py-4">
                <div className="h-3 w-full rounded bg-secondary" />
                <div className="h-3 w-4/5 rounded bg-secondary" />
                <div className="h-3 w-3/5 rounded bg-secondary" />
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ---- Results -------------------------------------------------- */}
      {result && !loading && (
        <section className="grid gap-5 pb-12 md:grid-cols-3">
          <WhatChangedCard changes={result.changes} />
          <SecurityCheckCard items={result.security} />
          <LearningMomentCard items={result.learning} />
        </section>
      )}
    </div>
  )
}
