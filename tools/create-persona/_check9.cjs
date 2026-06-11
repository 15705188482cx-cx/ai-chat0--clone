const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split(/\r?\n/);
for (let i = 214; i <= 218; i++) console.log(`L${i+1}: ${lines[i]}`);
console.log("---");
for (let i = 398; i <= 406; i++) console.log(`L${i+1}: ${lines[i]}`);
