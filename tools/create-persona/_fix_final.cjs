const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// Replace "// removed" with the actual function declaration
c = c.replace("  // removed", "export default function ChatScreen() {");

// Now remove the duplicate function declaration at the end (around line 401)
// Find the second occurrence of the function declaration
const firstIdx = c.indexOf("export default function ChatScreen() {");
const secondIdx = c.indexOf("export default function ChatScreen() {", firstIdx + 1);
if (secondIdx >= 0) {
  // Find the full line and remove it
  const lineStart = c.lastIndexOf("\n", secondIdx);
  const lineEnd = c.indexOf("\n", secondIdx);
  const before = c.substring(0, lineStart);
  const after = c.substring(lineEnd);
  c = before + after;
  console.log("Removed duplicate function declaration at line " + (c.substring(0, lineStart).split("\n").length + 1));
}

fs.writeFileSync(p, c, "utf8");

// Test TSC
const { execSync } = require("child_process");
try {
  const r = execSync("npx tsc --noEmit", { cwd: "G:/2026Work/AIchat/ai-chat-clone", timeout: 60000, encoding: "utf8" });
  const errs = r.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules"));
  console.log("TSC errors:", errs.length);
  errs.slice(0, 10).forEach(l => console.log("  " + l.trim()));
  if (errs.length === 0) console.log("\n\u2705 All clean!");
} catch (e) {
  const out = e.stdout || "";
  const errs = out.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules")).slice(0, 20);
  console.log("TSC errors:", errs.length);
  errs.forEach(l => console.log("  " + l.trim()));
}
