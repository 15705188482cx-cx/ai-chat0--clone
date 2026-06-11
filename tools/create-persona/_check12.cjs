const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split(/\r?\n/);
for (let i = 94; i <= 105; i++) console.log(`L${i+1}: ${lines[i]}`);
