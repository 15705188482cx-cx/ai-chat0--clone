const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// Find line 83: "            </View>"
// Need to insert </TouchableOpacity> after it and before line 84 "{item.stickerUri"
const target = "            </View>\n            {item.stickerUri";
const replacement = "            </View>\n            </TouchableOpacity>\n            {item.stickerUri";

if (c.includes(target)) {
  c = c.replace(target, replacement);
  console.log("✅ Fixed missing TouchableOpacity close tag");
} else {
  console.log("❌ Target pattern not found");
}

fs.writeFileSync(p, c, "utf8");
