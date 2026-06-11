const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split(/\r?\n/);
// Find function declaration and first hook
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("ChatScreen") || lines[i].includes("useState") || lines[i].includes("useCallback(")) {
    console.log(`L${i+1}: ${lines[i].substring(0,80)}`);
    if (lines[i].includes("ChatScreen")) break;
  }
}
