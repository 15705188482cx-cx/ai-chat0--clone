const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split("\n");
for (const ln of [123, 181, 216, 232, 233, 237, 243]) {
  if (lines[ln-1]) console.log(`L${ln}: ${lines[ln-1].trim().substring(0,90)}`);
}
