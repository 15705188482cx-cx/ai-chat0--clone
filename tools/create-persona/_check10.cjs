const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
const c = fs.readFileSync(p, "utf8");
const lines = c.split(/\r?\n/);
// Find all key structural elements
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (t.startsWith("export default") || t.startsWith("function ") || t.startsWith("const styles") || t.startsWith("});") || (t === "}" && i > 200 && i < 225)) {
    console.log(`L${i+1}: ${t.substring(0,70)}`);
  }
}
