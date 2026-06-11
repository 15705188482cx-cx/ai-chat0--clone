const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");
const m1 = 'import { addCorrection } from "../../modules/persona/personaService";';
const m2 = "const renderMessage";
const i1 = c.indexOf(m1);
const i2 = c.indexOf(m2);
if (i1 < 0 || i2 < 0) { console.log("Markers not found"); process.exit(1); }
const before = c.substring(0, i1 + m1.length);
const after = c.substring(i2);
fs.writeFileSync(p, before + "\n\n" + after, "utf8");
console.log("Cleaned corrupted code");
