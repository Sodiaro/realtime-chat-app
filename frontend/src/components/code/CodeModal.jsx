import { useState } from "react";
import { useChatStore } from "../../store/useChatStore";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

// Mirrors the server's language allowlist (ids match the highlighter LANG_MAP).
const LANGUAGES = [
  { id: "plaintext", label: "Plain text" },
  { id: "ts", label: "TypeScript" },
  { id: "tsx", label: "TSX" },
  { id: "js", label: "JavaScript" },
  { id: "jsx", label: "JSX" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "java", label: "Java" },
  { id: "json", label: "JSON" },
  { id: "bash", label: "Bash" },
  { id: "sql", label: "SQL" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "yaml", label: "YAML" },
  { id: "markdown", label: "Markdown" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
];

const MAX_BYTES = 20 * 1024;

const CodeModal = ({ onClose }) => {
  const { sendMessage } = useChatStore();
  const [language, setLanguage] = useState("js");
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");

  const bytes = new TextEncoder().encode(content).length;
  const tooBig = bytes > MAX_BYTES;
  const valid = content.trim().length > 0 && !tooBig;

  const submit = async () => {
    if (!valid) return;
    // send raw content (preserve indentation/whitespace); only filename is trimmed
    await sendMessage({ code: { language, content, filename: filename.trim() || undefined } });
    onClose();
  };

  return (
    <Modal
      title="Share code"
      onClose={onClose}
      size="lg"
      footer={
        <Button onClick={submit} disabled={!valid} size="sm" className="w-full">
          Send code
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <select
            aria-label="Language"
            className="select select-bordered select-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Filename (optional)"
            className="input input-bordered input-sm flex-1 font-mono"
            placeholder="filename.ext (optional)"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </div>

        <textarea
          aria-label="Code"
          autoFocus
          spellCheck={false}
          rows={12}
          className="textarea textarea-bordered w-full font-mono text-sm leading-relaxed"
          placeholder="Paste or type code…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className={`text-xs text-right ${tooBig ? "text-error" : "opacity-50"}`}>
          {(bytes / 1024).toFixed(1)} KB / 20 KB
        </div>
      </div>
    </Modal>
  );
};

export default CodeModal;
