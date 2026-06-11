const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// Fix corrupted Chinese text in the rendering area
const fixes = [
  // Line 106: persona?.name ?? "??
  ['persona?.name ?? "??', "persona?.name ?? " + '"她"'],
  // Line 108: >???</Text>  
  ['>???</Text>', ">路路路</Text>"],
  // Line 135 area (need to check what's there)
];

for (const [from, to] of fixes) {
  if (c.includes(from)) {
    c = c.replace(from, to);
    console.log("Fixed: " + from.substring(0, 30) + "...");
  } else {
    console.log("Not found: " + from.substring(0, 30) + "...");
  }
}

// Check line 135
const lines = c.split("\n");
console.log("\nLine 135:", lines[134]);
console.log("Line 145:", lines[144]);

fs.writeFileSync(p, c, "utf8");
