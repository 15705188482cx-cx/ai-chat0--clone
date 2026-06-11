const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");
const lines = c.split("\n");

// Fix all known corrupted text patterns
const fixMap = {
  "馃柤锔?": "📷",
  "馃帳": "🎤",
  "鈱?": "♪",
  "馃摚": "📚",
  "馃": "",
  "????": "",
};

let fixedCount = 0;
for (const [corrupt, clean] of Object.entries(fixMap)) {
  if (c.includes(corrupt)) {
    c = c.replaceAll(corrupt, clean);
    fixedCount++;
  }
}

// Also check for ?? placeholders inside strings
// Line 106 had persona?.name ?? "??" - already fixed? Let's check
// Line 108 had "???" - check
c = c.replace('"??"', '"她"');
c = c.replace('"??}', '"她"}');
c = c.replace(/"[A-Z]{2,}"/g, (match) => match); // Don't touch normal strings

// Fix the nav title
c = c.replace(/persona\?\.name \?\? "(.)?"/g, match => {
  if (match.endsWith('"') && match.length < 30) return match;
  return 'persona?.name ?? "她"';
});

fs.writeFileSync(p, c, "utf8");

// Re-read and check
const v = fs.readFileSync(p, "utf8");
const vl = v.split("\n");
// Check common JSX areas for remaining issues
let remaining = 0;
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes("馃") || vl[i].includes("鈱") || (vl[i].includes("???") && !vl[i].includes("persona"))) {
    if (remaining < 5) console.log(`L${i+1}: ${vl[i].trim().substring(0,70)}`);
    remaining++;
  }
}
console.log(`\nRemaining corruption issues: ${remaining}`);
