// Lazy, XSS-safe syntax highlighting. The highlighter chunk (hljs + theme CSS) is
// dynamically imported the first time a code block renders.

let chunk = null;
const load = () => (chunk ||= import("./hljsChunk.js").then((m) => m.default));

// our allowlist ids → highlight.js language names
const LANG_MAP = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  python: "python", go: "go", rust: "rust", java: "java", json: "json",
  bash: "bash", sql: "sql", html: "xml", css: "css", yaml: "yaml",
  markdown: "markdown", c: "c", cpp: "cpp", csharp: "csharp", php: "php",
  ruby: "ruby", plaintext: "plaintext",
};

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Returns escaped, highlighted HTML for `content`. highlight.js ESCAPES the source before
// adding <span> markup, so the result is safe to inject. Any error / unknown language
// falls back to escaped plaintext — user code is never rendered as raw HTML.
export async function highlightCode(content, language) {
  try {
    const hljs = await load();
    const lang = LANG_MAP[language] || "plaintext";
    if (lang === "plaintext" || !hljs.getLanguage(lang)) return escapeHtml(content);
    return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(content);
  }
}
