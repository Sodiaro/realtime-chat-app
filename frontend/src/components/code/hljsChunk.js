// The heavy highlighter + its theme CSS, isolated into one module so they ship as a
// single lazy chunk — loaded only when a code message first renders, so Chat Mode (and
// the main bundle) pay nothing.
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark.css";

export default hljs;
