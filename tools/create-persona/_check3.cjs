const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split("\n");
for (const ln of [216, 251, 263, 384, 386, 387]) {
  if (lines[ln-1]) console.log(`L${ln}: ${lines[ln-1].trim().substring(0,100)}`);
}
