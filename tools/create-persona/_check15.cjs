const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split(/\r?\n/);
// Find all state/hook declarations
for (let i = 27; i < 100; i++) {
  if (lines[i].includes("const ") && (lines[i].includes("useState") || lines[i].includes("useCallback") || lines[i].includes("useEffect") || lines[i].includes("useRef") || lines[i].includes("useMemo"))) {
    console.log(`L${i+1}: ${lines[i].substring(0,80)}`);
  }
}
console.log("\nTotal lines:", lines.length);
