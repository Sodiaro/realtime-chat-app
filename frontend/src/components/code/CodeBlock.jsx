import { useEffect, useState } from "react";
import { Copy, Download, Check, ChevronDown, ChevronUp, Sparkles, X, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { useDevModeStore } from "../../store/useDevModeStore";
import { highlightCode } from "./highlighter.js";

// file extension per language, for the Download default name
const EXT = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", python: "py", go: "go", rust: "rs",
  java: "java", json: "json", bash: "sh", sql: "sql", html: "html", css: "css",
  yaml: "yml", markdown: "md", c: "c", cpp: "cpp", csharp: "cs", php: "php",
  ruby: "rb", plaintext: "txt",
};

// AI entry points (stubs — the real engine arrives in Phase 7)
const AI_ACTIONS = {
  explain: { label: "Explain", desc: "Walks through what this snippet does, step by step." },
  refactor: { label: "Refactor", desc: "Suggests a cleaner, more idiomatic version." },
  review: { label: "Review", desc: "Flags likely bugs, style issues and security risks." },
};

const COLLAPSE_LINES = 16;

// Renders a code message: header (language · filename · Copy · Download · AI) + a dark,
// syntax-highlighted, horizontally-scrollable body that collapses when long, plus AI
// entry points (Explain/Refactor/Review) shown to Dev Mode viewers.
const CodeBlock = ({ code }) => {
  const { language = "plaintext", content = "", filename } = code || {};
  const devAvailable = useDevModeStore((s) => Boolean(s.flags?.dev_mode));
  const [html, setHtml] = useState(null); // null until the highlighter chunk loads
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiAction, setAiAction] = useState("explain");

  const lineCount = content.split("\n").length;
  const collapsible = lineCount > COLLAPSE_LINES;

  useEffect(() => {
    let active = true;
    highlightCode(content, language).then((h) => active && setHtml(h));
    return () => {
      active = false;
    };
  }, [content, language]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const download = () => {
    const name = (filename || `snippet.${EXT[language] || "txt"}`).replace(/[/\\]/g, "");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-1 w-full max-w-[min(78vw,440px)] rounded-lg overflow-hidden border border-black/30 bg-[#0d1117] text-[#c9d1d9]">
      {/* header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.06] text-xs">
        <span className="font-mono uppercase tracking-wide text-[10px] px-1.5 py-0.5 rounded bg-white/10">
          {language}
        </span>
        {filename && <span className="font-mono truncate opacity-70">{filename}</span>}
        <div className="ml-auto flex items-center gap-0.5">
          {devAvailable && (
            <button
              onClick={() => setAiOpen((v) => !v)}
              title="AI actions"
              aria-label="AI actions"
              aria-expanded={aiOpen}
              className={`p-1 rounded hover:bg-white/10 ${aiOpen ? "bg-white/10 text-primary" : ""}`}
            >
              <Sparkles className="size-3.5" />
            </button>
          )}
          <button onClick={copy} title="Copy code" aria-label="Copy code" className="p-1 rounded hover:bg-white/10">
            {copied ? <Check className="size-3.5 text-green-400" /> : <Copy className="size-3.5" />}
          </button>
          <button onClick={download} title="Download snippet" aria-label="Download snippet" className="p-1 rounded hover:bg-white/10">
            <Download className="size-3.5" />
          </button>
        </div>
      </div>

      {/* body */}
      <pre className={`m-0 overflow-x-auto ${collapsible && !expanded ? "max-h-72 overflow-y-hidden" : ""}`}>
        {html != null ? (
          <code
            className="hljs block !bg-transparent p-3 text-[13px] leading-relaxed font-mono"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <code className="block p-3 text-[13px] leading-relaxed font-mono whitespace-pre">{content}</code>
        )}
      </pre>

      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-xs py-1.5 bg-white/[0.06] hover:bg-white/10 flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3.5" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" /> Show all {lineCount} lines
            </>
          )}
        </button>
      )}

      {/* AI actions (stub — real engine in Phase 7) */}
      {devAvailable && aiOpen && (
        <div className="border-t border-white/10 bg-white/[0.03] p-3 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-medium">
              <Sparkles className="size-3.5 text-primary" /> AI
            </span>
            <div className="flex gap-1">
              {Object.entries(AI_ACTIONS).map(([id, a]) => (
                <button
                  key={id}
                  onClick={() => setAiAction(id)}
                  aria-pressed={aiAction === id}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    aiAction === id ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAiOpen(false)}
              aria-label="Close AI panel"
              className="ml-auto p-0.5 rounded hover:bg-white/10"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-white/70">{AI_ACTIONS[aiAction].desc}</p>
          <p className="text-white/40 flex items-center gap-1">
            <Clock className="size-3" /> Coming in Phase 7 — AI Developer Assistant.
          </p>
        </div>
      )}
    </div>
  );
};

export default CodeBlock;
