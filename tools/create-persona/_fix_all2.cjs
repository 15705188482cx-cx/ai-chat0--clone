const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

// Comprehensive fix map for all corrupted Chinese strings
const fixMap = {
  "寮€濮嬪拰濂硅璇磋瘽鍚?/Text>": "开始和她说说话吧</Text>",
  "鍙戦€?/Text>": "发送</Text>",
  "鏈€杩戜娇鐢?/Text>": "最近使用</Text>",
  '"鉂?}': '"❤"}',
  "鐓х墖": "相片",
  "鏂囦欢": "文件",
  "璇煶": "语音",
  "鍙栨秷": "取消",
  "纭畾": "确定",
  "鏁扮爜": "数码",
  "鍥剧墖": "图片",
  "璁剧疆": "设置",
  "杞彂": "转发",
  "澶嶅埗": "复制",
  "鍒犻櫎": "删除",
  "缂栬緫": "编辑",
  "淇濆瓨": "保存",
  "璇煶": "语音",
  "鍙戦€?": "发送",
};

for (const [from, to] of Object.entries(fixMap)) {
  c = c.split(from).join(to);
}

// Also handle emoji panel corrupted text  
// The emoji panel section has corrupted text - scan all JSX content
const mojibakeChars = /[鍔鎴閫杩濡欒細垪閰鉁犻叞椋庢牸]/;
c.replace(/>([^<]*?)<\/Text>/g, (match, content) => {
  if (mojibakeChars.test(content)) {
    console.log("Unfixed: " + match.substring(0, 50));
  }
  return match;
});

fs.writeFileSync(p, c, "utf8");
console.log("Done fixing");

// Now run TSC check
const { execSync } = require("child_process");
try {
  const r = execSync("npx tsc --noEmit", { cwd: "G:/2026Work/AIchat/ai-chat-clone", timeout: 60000, encoding: "utf8" });
  const errs = r.split("\n").filter(l => l.includes("error TS"));
  console.log("TSC errors:", errs.length);
  errs.slice(0, 10).forEach(l => console.log("  " + l.trim()));
} catch (e) {
  const out = e.stdout || e.message;
  const errs = out.split("\n").filter(l => l.includes("error TS") && !l.includes("node_modules")).slice(0, 10);
  console.log("TSC errors:", errs.length);
  errs.forEach(l => console.log("  " + l.trim()));
}
