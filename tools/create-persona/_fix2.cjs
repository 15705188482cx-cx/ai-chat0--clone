const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

c = c.replace('"濂?}', '"她"}');
c = c.replace('icon="📷 label="鐓х墖"', 'icon="📷" label="相片"');
c = c.replace('"♪ : "🎤"', '"♪" : "🎤"');
// Also fix the corrupted "鐓х墖" elsewhere
c = c.split("鐓х墖").join("相片");
// Fix corrupted Chinese emoji descriptions
c = c.split("馃枅").join(""); // broken emoji

fs.writeFileSync(p, c, "utf8");
console.log("Fixed specific corruption");
