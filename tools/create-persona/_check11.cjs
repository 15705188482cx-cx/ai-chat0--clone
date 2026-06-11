const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split(/\r?\n/);
for (const ln of [218, 219, 220, 221, 222, 399, 400, 401, 402, 403, 404]) {
  if (lines[ln-1]) console.log(`L${ln}: ${lines[ln-1]}`);
}
