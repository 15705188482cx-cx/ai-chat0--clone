const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// 1. Remove the current function declaration at line 99
c = c.replace("export default function ChatScreen() {", "");

// 2. Find any line after imports that has "useState" or "useCallback" or "useEffect"
// Find the first occurrence of these after the last import
const lastImportIdx = c.lastIndexOf("import ");
const lastImportEnd = c.indexOf(";", lastImportIdx);
const afterImports = c.substring(lastImportEnd + 1);

// Find the first hook call
const hookMatch = afterImports.search(/\n  const \[|\n  const \w+ = use/);
if (hookMatch >= 0) {
  const insertPoint = lastImportEnd + 1 + hookMatch;
  c = c.substring(0, insertPoint) + "\nexport default function ChatScreen() {\n" + c.substring(insertPoint);
  console.log("Inserted function declaration before first hook");
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
