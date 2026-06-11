const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split(/\r?\n/);
// Find function declaration
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("export default function") || lines[i].includes("ChatScreen")) {
    console.log(`L${i+1}: ${lines[i]}`);
  }
}
// Show lines 30-50
console.log("\nL30-50:");
for (let i = 29; i < 50; i++) console.log(`L${i+1}: ${lines[i].substring(0,70)}`);
