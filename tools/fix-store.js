const fs = require('fs');
let text = fs.readFileSync('G:/2026Work/AIchat/ai-chat-clone/src/stores/chatStore.ts', 'utf8');

text = text.replace(
  "createConversation(persona.id, `与  的对话`)",
  "createConversation(persona.id, `与 ${persona.name} 的对话`)"
);

text = text.replace(
  "? 回复失败： : \"回复失败",
  '? `回复失败：${err.message}` : "回复失败'
);

fs.writeFileSync('G:/2026Work/AIchat/ai-chat-clone/src/stores/chatStore.ts', text, 'utf8');
console.log('OK');
