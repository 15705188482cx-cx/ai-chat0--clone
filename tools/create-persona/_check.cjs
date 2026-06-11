const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split("\n");
console.log("L106:", lines[105]);
console.log("L108 (originally 108 but maybe shifted):", lines[107]);
console.log("L135:", lines[134]);
console.log("L145:", lines[144]);
