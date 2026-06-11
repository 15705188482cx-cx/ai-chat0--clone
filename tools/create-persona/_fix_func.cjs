const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// Find "  return (" and add function declaration before it
// The return is the JSX render section
const returnIdx = c.indexOf("\n  return (");
if (returnIdx >= 0) {
  // Find the line before "  return ("
  const beforeReturn = c.substring(0, returnIdx);
  const lastLineEnd = beforeReturn.lastIndexOf("\n");
  
  // Insert function declaration
  c = c.substring(0, lastLineEnd) + "\n\nexport default function ChatScreen() {\n" + c.substring(lastLineEnd);
  console.log("✅ Added ChatScreen function declaration");
}

fs.writeFileSync(p, c, "utf8");

// Test TSC
const { execSync } = require("child_process");
try {
  const r = execSync("npx tsc --noEmit", { cwd: "G:/2026Work/AIchat/ai-chat-clone", timeout: 60000, encoding: "utf8" });
  const errs = r.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules"));
  console.log("TSC errors:", errs.length);
  errs.slice(0, 10).forEach(l => console.log("  " + l.trim()));
  if (errs.length === 0) console.log("\n✅ All clean!");
} catch (e) {
  const out = e.stdout || "";
  const errs = out.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules")).slice(0, 20);
  console.log("TSC errors:", errs.length);
  errs.forEach(l => console.log("  " + l.trim()));
}
