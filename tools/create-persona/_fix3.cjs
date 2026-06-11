const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// More corruption fixes
c = c.split(">鎵€鏈夎〃鎯?/Text>").join(">所有表情</Text>");
c = c.split(">鉁?/Text>").join(">✓</Text>");

// Check StyleSheet area around line 384
// The StyleSheet was modified - let me verify the structure
const sheetIdx = c.lastIndexOf("const styles = StyleSheet.create");
if (sheetIdx > 0) {
  // Find the start and end of the style object
  const objStart = c.indexOf("{", sheetIdx);
  const objEnd = c.lastIndexOf("});");
  const stylesContent = c.substring(objStart, objEnd);
  // Look for the issue at line 384 (which is in the added correction styles)
  // The issue is likely a trailing comma or malformed key
  console.log("StyleSheet OK:", stylesContent.length, "chars");
}

fs.writeFileSync(p, c, "utf8");

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
