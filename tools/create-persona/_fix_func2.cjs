const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// Remove the function declaration I just added
c = c.replace("export default function ChatScreen() {\n\n  return (", "\n  return (");

// Find where the component state declarations start (first useState)
const useStateIdx = c.indexOf("\n  const [");
if (useStateIdx >= 0) {
  // Find the last import statement
  const lastImportEnd = c.lastIndexOf(";");
  const lastImportEndNew = c.indexOf("\n", lastImportEnd);
  
  const before = c.substring(0, lastImportEndNew + 1);
  const after = c.substring(lastImportEndNew + 1);
  
  c = before + "\nexport default function ChatScreen() {\n" + after;
  console.log("✅ Added function before first state");
} else {
  console.log("❌ useState not found");
}

fs.writeFileSync(p, c, "utf8");

// Test TSC
const { execSync } = require("child_process");
try {
  const r = execSync("npx tsc --noEmit", { cwd: "G:/2026Work/AIchat/ai-chat-clone", timeout: 60000, encoding: "utf8" });
  const errs = r.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules"));
  console.log("TSC errors:", errs.length);
  errs.slice(0, 10).forEach(l => console.log("  " + l.trim()));
  if (errs.length === 0) console.log("✅ All clean!");
} catch (e) {
  const out = e.stdout || "";
  const errs = out.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules")).slice(0, 20);
  console.log("TSC errors:", errs.length);
  errs.forEach(l => console.log("  " + l.trim()));
}
