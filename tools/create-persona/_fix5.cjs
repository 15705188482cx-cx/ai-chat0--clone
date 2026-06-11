const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// Split into lines and rebuild
const lines = c.split(/\r?\n/);
const newLines = [];
let skipLine = false;
for (let i = 0; i < lines.length; i++) {
  // Skip the standalone "," line before correction styles
  if (lines[i].trim() === "," && i > 380 && lines[i-1].trim().startsWith("sendBtnText")) {
    // This is the extra comma - skip it
    continue;
  }
  newLines.push(lines[i]);
}

c = newLines.join("\n");
fs.writeFileSync(p, c, "utf8");
console.log("Fixed StyleSheet");

// Also fix line 216 - need to check context
const lines2 = c.split(/\r?\n/);
console.log("L216: " + lines2[215]?.trim().substring(0,80));

// Test TSC
const { execSync } = require("child_process");
try {
  const r = execSync("npx tsc --noEmit", { cwd: "G:/2026Work/AIchat/ai-chat-clone", timeout: 60000, encoding: "utf8" });
  const errs = r.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules"));
  console.log("TSC errors:", errs.length);
  errs.slice(0, 25).forEach(l => console.log("  " + l.trim()));
} catch (e) {
  const out = e.stdout || "";
  const errs = out.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules")).slice(0, 25);
  console.log("TSC errors:", errs.length);
  errs.forEach(l => console.log("  " + l.trim()));
}
