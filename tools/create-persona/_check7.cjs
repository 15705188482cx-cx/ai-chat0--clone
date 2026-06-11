const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split(/\r?\n/);
// Find the component function declaration
for (let i = 0; i < 50; i++) {
  if (lines[i].includes("function") || lines[i].includes("export")) {
    console.log(`L${i+1}: ${lines[i].trim()}`);
  }
}
