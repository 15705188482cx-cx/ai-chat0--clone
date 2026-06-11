const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split("\n");
for (let i = 382; i <= 397; i++) {
  if (lines[i]) console.log(`L${i+1}: ${JSON.stringify(lines[i])}`);
}
