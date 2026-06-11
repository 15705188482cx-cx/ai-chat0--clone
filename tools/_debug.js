
// ============================================================
// 封面 & 设置页交互
// ============================================================
var coverPlaying = false;
var userSignature = '';
var audioCtx = null;
var musicGain = null;
var musicOscillators = [];

// 8-bit 伤感旋律（A小调五声音阶）
var MELODY = [
  { note: 440, dur: 0.4 },  // A4
  { note: 523, dur: 0.3 },  // C5
  { note: 587, dur: 0.5 },  // D5
  { note: 523, dur: 0.3 },  // C5
  { note: 440, dur: 0.4 },  // A4
  { note: 349, dur: 0.3 },  // F4
  { note: 330, dur: 0.6 },  // E4
  { note: 0, dur: 0.2 },    // 休止
  { note: 330, dur: 0.3 },  // E4
  { note: 349, dur: 0.3 },  // F4
  { note: 440, dur: 0.5 },  // A4
  { note: 330, dur: 0.3 },  // E4
  { note: 294, dur: 0.6 },  // D4
  { note: 0, dur: 0.3 },
  { note: 440, dur: 0.3 },  // A4
  { note: 523, dur: 0.3 },  // C5
  { note: 587, dur: 0.4 },  // D5
  { note: 659, dur: 0.5 },  // E5
  { note: 587, dur: 0.3 },  // D5
  { note: 523, dur: 0.4 },  // C5
  { note: 440, dur: 0.3 },  // A4
  { note: 349, dur: 0.3 },  // F4
  { note: 330, dur: 0.7 },  // E4
  { note: 0, dur: 0.4 },
];

function startMusic(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.06;
    musicGain.connect(audioCtx.destination);
  }
  playMelodyLoop();
}

function playMelodyLoop(){
  if(!coverPlaying) return;
  var t = audioCtx.currentTime;
  MELODY.forEach(function(m){
    if(m.note > 0){
      var osc = audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = m.note;
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + m.dur * 0.9);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(t);
      osc.stop(t + m.dur);
    }
    t += m.dur;
  });
  // 循环播放
  musicTimer = setTimeout(function(){ playMelodyLoop(); }, 0);
}
var musicTimer = null;

function toggleCoverMusic(){
  coverPlaying = !coverPlaying;
  var btn = document.getElementById('coverMusicBtn');
  var icon = document.getElementById('coverMusicIcon');
  var label = document.getElementById('coverMusicLabel');
  if(coverPlaying){
    if(!audioCtx) startMusic();
    else { coverPlaying = true; playMelodyLoop(); }
    btn.classList.add('playing');
    icon.textContent = '🎶';
    label.textContent = '正在播放...';
  } else {
    clearTimeout(musicTimer);
    btn.classList.remove('playing');
    icon.textContent = '🎵';
    label.textContent = '背景音乐';
  }
}

function enterApp(){
  try {
    if(coverPlaying && musicGain && audioCtx){
      musicGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
      coverPlaying = false;
      clearTimeout(musicTimer);
    }
  } catch(e){}
  var o = document.getElementById('coverOverlay');
  if(!o) return;
  o.style.opacity = '0';
  o.style.pointerEvents = 'none';
  setTimeout(function(){ o.style.display = 'none'; }, 400);
}
function updateCoverSignature(sig){
  userSignature = sig;
  document.getElementById('coverSigText').textContent = sig || '留住那些温柔的对话';
  document.getElementById('mySignatureDisplay').innerHTML = (sig||'未设置')+'<span class="arr">&gt;</span>';
}
function startEditSignature(){
  var row = document.getElementById('sigRow');
  var current = userSignature || '';
  row.innerHTML = '<span class="l">签名</span><div style="flex:1;margin-left:16px"><input id="sigInlineInput" style="width:100%;text-align:right;font-size:15px;color:#191919;border:none;outline:none;font-family:inherit;padding:0" value="'+current.replace(/"/g,'&quot;')+'" placeholder="写下你的个性签名" onblur="saveSignature()" onkeydown="if(event.key===\'Enter\')this.blur()"></div>';
  var inp = document.getElementById('sigInlineInput');
  setTimeout(function(){ inp.focus(); }, 100);
}
function saveSignature(){
  var inp = document.getElementById('sigInlineInput');
  var val = inp ? inp.value.trim() : userSignature;
  updateCoverSignature(val);
  // 恢复显示
  document.getElementById('sigRow').innerHTML = '<span class="l">签名</span><span class="v" id="mySignatureDisplay">'+(val||'未设置')+'<span class="arr">&gt;</span></span>';
  document.getElementById('sigRow').onclick = startEditSignature;
}
function editSetting(type){
  if(type==='signature'){
    var s = prompt('输入你的个性签名（将显示在启动封面）', userSignature);
    if(s!==null) updateCoverSignature(s.trim());
  } else if(type==='nickname'){
    var n = prompt('输入你的昵称', '');
    if(n!==null) showToast('昵称已更新：'+n.trim());
  }
}

// ============================================================
// 全局状态
// ============================================================
var hasData = true; // 模拟已有数据
var personas = [
  { id:'p1', name:'小仙女✨', sourceSender:'她', styleSummary:'句子偏短，常用"呜呜""想你""抱抱"，喜欢用🥺❤️😘等表情', createdAt:'2024-06-04', chatSampleIds:[], signature:'你的小可爱已上线~' },
  { id:'p2', name:'甜甜', sourceSender:'甜', styleSummary:'语气活泼，常用"哈哈""好呀"，喜欢用😂👍等表情', createdAt:'2024-06-05', chatSampleIds:[], signature:'' }
];
var conversations = [
  { id:'c1', personaId:'p1', title:'与 小仙女✨ 的对话', lastMsg:'抱抱~ 下午有空吗 想去看电影', time:'12:38', personaName:'小仙女✨' },
  { id:'c2', personaId:'p2', title:'与 甜甜 的对话', lastMsg:'好的晚安啦💤', time:'昨天', personaName:'甜甜' }
];
var currentChatPersona = null;

// ============================================================
// Emoji 数据
// ============================================================
var EMOJIS = '[微笑]🙂,[撇嘴]😏,[色]😍,[发呆]😳,[得意]😎,[流泪]😢,[害羞]😊,[闭嘴]🤐,[睡]😴,[大哭]😭,[尴尬]😅,[发怒]😡,[调皮]😜,[呲牙]😁,[惊讶]😲,[难过]😔,[酷]😐,[冷汗]😰,[抓狂]😫,[吐]🤢,[偷笑]🤭,[愉快]🥰,[白眼]🙄,[傲慢]😤,[饥饿]🤤,[困]🥱,[惊恐]😱,[流汗]😓,[憨笑]😄,[悠闲]😌,[奋斗]💪,[咒骂]🤬,[疑问]🤔,[嘘]🤫,[晕]😵,[疯了]🤪,[衰]😞,[骷髅]💀,[敲打]👊,[再见]👋,[擦汗]😅,[抠鼻]🤏,[鼓掌]👏,[糗大了]😖,[坏笑]😏,[鄙视]😒,[委屈]🥺,[快哭了]😢,[阴险]😈,[亲亲]😘,[吓]😨,[可怜]🥺,[菜刀]🔪,[西瓜]🍉,[啤酒]🍺,[篮球]🏀,[咖啡]☕,[饭]🍚,[猪头]🐷,[玫瑰]🌹,[凋谢]🥀,[嘴唇]💋,[爱心]❤️,[心碎]💔,[蛋糕]🎂,[闪电]⚡,[炸弹]💣,[刀]🗡️,[足球]⚽,[礼物]🎁,[拥抱]🤗,[强]👍,[弱]👎,[握手]🤝,[胜利]✌️,[抱拳]🙏,[勾引]👉,[拳头]✊,[爱你]🤟,[NO]🙅,[OK]🙆,[爱情]💑,[飞吻]😘,[跳跳]💃,[发抖]🥶,[怄火]🔥,[磕头]🙇,[投降]🙌'.split(',');

// 初始化表情网格
(function(){
  var grid = document.getElementById('chatEmojiGrid');
  EMOJIS.forEach(function(e){
    var p = e.split(']');
    var key = p[0]+']', emoji = p[1];
    var c = document.createElement('div');
    c.className='emoji-cell';
    c.textContent = emoji;
    c.title = key;
    c.onclick = function(){
      document.getElementById('chatInput').value += key;
      updateChatSendBtn();
    };
    grid.appendChild(c);
  });
})();

// ============================================================
// Toast
// ============================================================
var toastTimer;
function showToast(msg){
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2200);
}

// ============================================================
// Tab 切换
// ============================================================
function switchTab(name){
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  var t = document.querySelector('[data-page="'+name+'"]');
  var p = document.getElementById(name+'-page');
  if(t) t.classList.add('active');
  if(p) p.classList.add('active');
  if(name==='list') refreshConvList();
  if(name==='home') refreshHome();
  if(name==='settings') refreshSettings();
}

// ============================================================
// 首页刷新
// ============================================================
function refreshHome(){
  document.getElementById('statMsg').querySelector('.stat-v').textContent = '280 条';
  document.getElementById('statPersona').querySelector('.stat-v').textContent = personas.length + ' 个';
  document.getElementById('hintConvs').textContent = conversations.length + ' 个对话';
  document.getElementById('hintSample').textContent = '已有 280 条消息可供学习';
}

// ============================================================
// 设置页刷新
// ============================================================
function refreshSettings(){
  document.getElementById('settingsMsgCount').textContent = '280 条';
  var cnt = personas.length;
  document.getElementById('settingsPersonaCount').innerHTML = (cnt>0?cnt+' 个分身':'未创建') + '<span class="arr">&gt;</span>';
}

// ============================================================
// 会话列表
// ============================================================
function refreshConvList(){
  var el = document.getElementById('convList');
  if(conversations.length===0){
    el.innerHTML = '<div class="empty-state"><div class="empty-emoji">💕</div><div class="empty-title">还没有对话</div><div class="empty-sub">点击右下角 + 按钮<br>导入和她的聊天记录</div><button class="empty-btn" onclick="openWizard()">导入聊天记录</button></div>';
    el.parentElement.style.position='relative';
  } else {
    var h = '';
    conversations.forEach(function(c, i){
      var avtBg = c.personaId==='p1' ? 'background:#FF9EAF' : '';
      h += '<button class="conv-item" onclick="openChat(\''+c.personaId+'\',\''+c.personaName+'\')"><div class="conv-avt" style="'+avtBg+'">'+c.personaName[0]+'</div><div class="conv-center"><div class="conv-name">'+c.personaName+'</div><div class="conv-preview">'+c.lastMsg+'</div></div><div class="conv-right"><div class="conv-time">'+c.time+'</div></div></button>';
      if(i<conversations.length-1) h += '<div class="conv-sep"></div>';
    });
    el.innerHTML = h;
    el.parentElement.style.position='relative';
  }
}

function handleFabPress(){
  var sheet = document.getElementById('actionSheet');
  var opts = document.getElementById('sheetOptions');
  if(personas.length === 0){
    // 无分身 → 直接去创建
    openPersonaSetup();
    return;
  }
  // 有分身 → 显示两个独立功能按钮
  opts.innerHTML = ''+
    '<div class="sheet-opt" onclick="doAction(\'import\')">'+
      '<span style="font-size:28px;display:block;margin-bottom:4px">📂</span>导入新的聊天记录'+
    '</div>'+
    '<div class="sheet-opt" onclick="doAction(\'persona\')" style="border-bottom:none">'+
      '<span style="font-size:28px;display:block;margin-bottom:4px">✨</span>创建新的分身'+
    '</div>';
  sheet.classList.add('show');
}
function doAction(type){
  hideSheet();
  if(type==='import') openWizard();
  if(type==='persona') openPersonaSetup();
}

// ============================================================
// 聊天页
// ============================================================
function openChat(personaId, personaName){
  currentChatPersona = personas.find(function(p){ return p.id===personaId; });
  document.getElementById('chatOverlay').classList.add('show');
  document.getElementById('mainArea').style.display = 'none';
  document.querySelector('.tab-bar').style.display = 'none';
  document.getElementById('chatNavTitle').textContent = personaName;
  document.getElementById('chatThinkingAvt').textContent = personaName[0];

  // 加载消息
  var body = document.getElementById('chatBody');
  body.innerHTML = '';
  body.appendChild(buildTimeStamp('12:30'));
  body.appendChild(buildMsg('her', personaName[0], '呜呜 想你了🥺'));
  body.appendChild(buildMsg('me', '', '我也想你呀 ❤️'));
  body.appendChild(buildTimeStamp('12:32'));
  body.appendChild(buildMsg('her', personaName[0], '今天吃了吗 我还没起床嘿嘿'));
  body.appendChild(buildMsg('me', '', '吃啦 快起来吃点东西'));
  body.appendChild(buildTimeStamp('12:35'));
  body.appendChild(buildMsg('her', personaName[0], '不想起啦 被窝里好暖和😴<br>昨晚梦到你了'));
  body.appendChild(buildMsg('me', '', '梦到什么了'));
  body.appendChild(buildMsg('her', personaName[0], '梦到我们去成都吃火锅🍲<br>好开心的'));
  body.appendChild(buildMsg('me', '', '哈哈哈 抱抱🫂'));
  body.appendChild(buildTimeStamp('12:38'));
  body.appendChild(buildMsg('her', personaName[0], '抱抱~ 下午有空吗 想去看电影'));
  body.appendChild(buildMsg('me', '', '有空的 想看什么'));

  document.getElementById('chatThinking').classList.remove('show');
  document.getElementById('chatInput').value = '';
  updateChatSendBtn();
  closeChatPanels();
  scrollChat();

  // 重置语音模式
  document.getElementById('chatInput').style.display = '';
  document.getElementById('chatRecordBtn').classList.remove('show');
  document.getElementById('chatVoiceBtn').textContent = '🎤';

  updateChatSendBtn();
}

function closeChat(){
  document.getElementById('chatOverlay').classList.remove('show');
  document.getElementById('mainArea').style.display = 'flex';
  document.querySelector('.tab-bar').style.display = 'flex';
  refreshConvList();
}

function buildTimeStamp(time){
  var d = document.createElement('div');
  d.className = 'time-stamp';
  d.textContent = time;
  return d;
}
function buildMsg(side, avtTxt, text){
  var d = document.createElement('div');
  d.className = 'msg-item' + (side==='me'?' me':'');
  if(side==='me'){
    d.innerHTML = '<div class="avt-wrap"><div class="avt" style="background:#4A90D9">我</div></div><div class="msg-body"><div class="bubble me">'+text+'</div></div>';
  } else {
    d.innerHTML = '<div class="avt-wrap"><div class="avt her">'+avtTxt+'</div></div><div class="msg-body"><div class="bubble her">'+text+'</div></div>';
  }
  return d;
}

function scrollChat(){
  setTimeout(function(){
    var b = document.getElementById('chatBody');
    b.scrollTop = b.scrollHeight;
  }, 50);
}

// 聊天面板
function closeChatPanels(){
  document.getElementById('chatEmojiPanel').classList.remove('show');
  document.getElementById('chatFuncPanel').classList.remove('show');
}
function toggleChatEmoji(){
  document.getElementById('chatFuncPanel').classList.remove('show');
  document.getElementById('chatEmojiPanel').classList.toggle('show');
}
function toggleChatFunc(){
  document.getElementById('chatEmojiPanel').classList.remove('show');
  document.getElementById('chatFuncPanel').classList.toggle('show');
}

// 语音切换
function toggleChatVoice(){
  var input = document.getElementById('chatInput');
  var rec = document.getElementById('chatRecordBtn');
  var btn = document.getElementById('chatVoiceBtn');
  closeChatPanels();
  if(input.style.display===''){
    input.style.display='none'; rec.classList.add('show'); btn.textContent='⌨';
    updateChatSendBtn();
  } else {
    input.style.display=''; rec.classList.remove('show'); btn.textContent='🎤';
    updateChatSendBtn();
  }
}
function startRecord(){
  document.getElementById('chatRecordBtn').style.background='#E5E5E5';
}
function stopRecord(){
  document.getElementById('chatRecordBtn').style.background='#fff';
  showToast('语音录制功能未完善\n需要 expo-av 依赖');
}

function updateChatSendBtn(){
  var has = document.getElementById('chatInput').value.trim().length > 0;
  var isVoice = document.getElementById('chatInput').style.display === 'none';
  document.getElementById('chatSendBtn').classList.toggle('show', has && !isVoice);
  document.getElementById('chatPlusBtn').style.display = (has || isVoice) ? 'none' : 'flex';
}

function chatSend(){
  var input = document.getElementById('chatInput');
  var text = input.value.trim(); if(!text) return;
  input.value = ''; updateChatSendBtn(); closeChatPanels();

  var body = document.getElementById('chatBody');
  var thinking = document.getElementById('chatThinking');

  // 添加用户消息
  body.appendChild(buildMsg('me', '', text));
  thinking.classList.add('show');
  scrollChat();

  // 模拟回复
  var replies = ['哈哈哈 你真好🥰','嗯嗯 知道啦~','我也觉得诶！','好呀好呀 听你的','呜呜 感动到了😭','嘻嘻 那必须的~','你也是哦 抱抱🫂','好嘞！','哈哈哈笑死我了😂','嗯嗯 想你啦❤️','哇 真的吗！','太开心了嘿嘿~'];
  setTimeout(function(){
    thinking.classList.remove('show');
    body.appendChild(buildMsg('her', currentChatPersona?currentChatPersona.name[0]:'她', replies[Math.floor(Math.random()*replies.length)]));
    scrollChat();
    thinking.classList.add('show');
  }, 1500 + Math.random()*2000);
}

// ============================================================
// 分身创建浮层
// ============================================================
var setupStep = 'select'; // select | config | creating
var setupSelectedSender = null;
var setupPersonaName = '';
var setupPersonaSig = '';
var setupStyleSummary = null;

function openPersonaSetup(preSelected){
  setupSelectedSender = preSelected || null;
  setupPersonaName = preSelected || '';
  setupPersonaSig = '';
  setupStyleSummary = null;
  document.getElementById('personaSetupOverlay').classList.add('show');
  // 从导入页预选了发送者 → 走完整流程（选人）
  // 从首页/会话+号进入 → 直接设置样子（全新创建）
  renderSetupStep(preSelected ? 'select' : 'config');
}
function closePersonaSetup(){
  document.getElementById('personaSetupOverlay').classList.remove('show');
  refreshHome(); refreshConvList(); refreshSettings();
}

function renderSetupStep(step){
  setupStep = step;
  var el = document.getElementById('personaSetupContent');
  // 可选的发送者（排除"我"）
  var senders = ['她','甜','李四','王五'].filter(function(s){ return s!=='我'; });

  if(step==='select'){
    var h = '<div style="padding:20px">';
    h += '<div style="font-size:22px;font-weight:700;color:#191919;margin-bottom:6px">创建她的 AI 分身</div>';
    h += '<div style="font-size:14px;color:#999;margin-bottom:16px;line-height:20px">AI 将学习她的说话方式，让你们继续聊天</div>';
    h += '<div style="font-size:13px;color:#888;margin-bottom:8px">选择模仿对象</div>';

    // 已匹配的发送者优先显示
    var matchedSenders = personas.map(function(p){ return p.sourceSender; });
    var orderedSenders = [];
    senders.forEach(function(s){
      if(matchedSenders.indexOf(s)>=0 && orderedSenders.indexOf(s)<0) orderedSenders.push(s);
    });
    senders.forEach(function(s){
      if(orderedSenders.indexOf(s)<0) orderedSenders.push(s);
    });

    orderedSenders.forEach(function(name){
      var isSel = setupSelectedSender===name;
      var isMatched = matchedSenders.indexOf(name)>=0;
      var matchedPersona = personas.find(function(p){ return p.sourceSender===name; });
      h += '<div style="display:flex;align-items:center;padding:14px 0;border-bottom:1px solid #EEE;cursor:pointer;'+(isSel?'background:#FFF0F3;margin:0 -20px;padding-left:20px;padding-right:20px;border-radius:8px':'')+'" onclick="selectSenderForSetup(\''+name+'\')">';
      h += '<div style="width:44px;height:44px;border-radius:50%;background:'+(isSel?'#FF9EAF':'#4A90D9')+';display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:#fff;margin-right:12px;flex-shrink:0">'+name[0]+'</div>';
      h += '<div style="flex:1"><div style="font-size:16px;font-weight:500;color:#191919">'+name+'</div><div style="font-size:12px;color:'+(isMatched?'#07C160':'#B0B0B0')+';margin-top:2px">'+(isMatched?'已创建分身：'+matchedPersona.name:'点击选择')+'</div></div>';
      if(isSel) h += '<div style="width:24px;height:24px;border-radius:50%;background:#07C160;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">✓</div>';
      h += '</div>';
    });

    if(setupSelectedSender){
      h += '<button class="btn-green" style="width:100%;margin-top:20px" onclick="proceedToConfig()">下一步：设置她的样子</button>';
    }
    h += '</div>';
    el.innerHTML = h;
  } else if(step==='config'){
    var h = '<div style="padding:20px">';
    h += '<div style="font-size:22px;font-weight:700;color:#191919;margin-bottom:6px">设置她的样子</div>';
    h += '<div style="font-size:14px;color:#999;margin-bottom:20px;line-height:20px">'+(setupSelectedSender?'为「'+setupSelectedSender+'」创建分身，':'')+'设置头像、昵称和签名</div>';

    // 头像
    h += '<div style="text-align:center;margin-bottom:20px">';
    var avtChar = setupSelectedSender ? setupSelectedSender[0] : (setupPersonaName[0] || '她');
    h += '<div style="width:80px;height:80px;border-radius:50%;background:#FF9EAF;display:inline-flex;align-items:center;justify-content:center;font-size:32px;font-weight:600;color:#fff;cursor:pointer;border:2px solid #FFE4E1;margin-bottom:8px" onclick="showToast(\'从相册选择头像\\n（需 expo-image-picker）\')">'+avtChar+'</div>';
    h += '<div style="font-size:13px;color:#999">点击设置头像</div>';
    h += '</div>';

    // 昵称
    h += '<div style="background:#fff;border-radius:8px;padding:14px 16px;margin-bottom:10px;border:1px solid #E5E5E5">';
    h += '<div style="font-size:13px;color:#888;margin-bottom:4px">昵称</div>';
    h += '<input style="width:100%;font-size:16px;border:none;outline:none;font-family:inherit;color:#191919" id="setupNameInput" value="'+setupPersonaName+'" placeholder="她的昵称" oninput="setupPersonaName=this.value">';
    h += '</div>';

    // 签名
    h += '<div style="background:#fff;border-radius:8px;padding:14px 16px;margin-bottom:16px;border:1px solid #E5E5E5">';
    h += '<div style="font-size:13px;color:#888;margin-bottom:4px">签名（可选）</div>';
    h += '<input style="width:100%;font-size:16px;border:none;outline:none;font-family:inherit;color:#191919" id="setupSigInput" value="'+setupPersonaSig+'" placeholder="她的个性签名" oninput="setupPersonaSig=this.value">';
    h += '</div>';

    // 风格预览（仅当有发送者时显示）
    if(setupSelectedSender){
      h += '<div style="background:#fff;border-radius:8px;padding:14px 16px;margin-bottom:16px;border:1px solid #E5E5E5">';
      h += '<div style="font-size:13px;color:#888;margin-bottom:8px">她的说话风格</div>';
      if(setupStyleSummary){
        h += '<div style="font-size:14px;color:#333;line-height:22px">'+setupStyleSummary+'</div>';
      } else {
        h += '<div style="display:flex;align-items:center;gap:8px"><div style="width:16px;height:16px;border-radius:50%;border:2px solid #07C160;border-top-color:transparent;animation:spin .8s linear infinite"></div><span style="font-size:14px;color:#999">正在分析她的说话风格...</span></div>';
      }
      h += '</div>';
    }

    h += '<button class="btn-green" style="width:100%" onclick="createPersona()">💕 创建</button>';
    h += '</div>';
    el.innerHTML = h;

    // 分析风格（仅当有发送者时）
    if(setupSelectedSender && !setupStyleSummary){
      setTimeout(function(){
        setupStyleSummary = '句子偏短，常用"呜呜""想你""抱抱""好呀"，喜欢用🥺❤️😘😂等表情，偶尔用颜文字和叠词，不使用句号结尾';
        renderSetupStep('config');
      }, 1500);
    }
  }
}

function selectSenderForSetup(name){
  setupSelectedSender = name;
  setupPersonaName = name;
  setupStyleSummary = null;
  renderSetupStep('select');
}

function proceedToConfig(){
  renderSetupStep('config');
}

function createPersona(){
  var name = setupPersonaName.trim();
  if(!name){ showToast('请输入她的昵称'); return; }
  var sourceSender = setupSelectedSender || name; // 无发送者时，用昵称作为 source_sender

  // 检查是否已存在同名分身
  var exists = personas.find(function(p){ return p.sourceSender===sourceSender; });
  if(exists){
    showToast('「'+sourceSender+'」已有分身「'+exists.name+'」\n请通过导入向导添加数据');
    return;
  }
  var newPersona = {
    id: 'p'+(personas.length+1)+'_'+Date.now(),
    name: name,
    sourceSender: sourceSender,
    styleSummary: setupStyleSummary || '（暂无聊天记录，导入后将自动分析风格）',
    createdAt: new Date().toISOString().slice(0,10),
    chatSampleIds: [],
    signature: setupPersonaSig
  };
  personas.push(newPersona);
  conversations.push({
    id: 'c'+(conversations.length+1)+'_'+Date.now(),
    personaId: newPersona.id,
    title: '与 '+name+' 的对话',
    lastMsg: '开始对话吧 💕',
    time: '刚刚',
    personaName: name
  });
  showToast('✅ 分身「'+name+'」创建成功！\n自动创建会话，可开始聊天');
  closePersonaSetup();
}

// ============================================================
// 导入向导
// ============================================================
var wizStep = 0; // 0=选择, 1=解析中, 2=结果
var wizParseResult = null;
var wizParticipants = [];

function openWizard(){
  wizStep = 0; wizParseResult = null; wizParticipants = [];
  document.getElementById('wizardOverlay').classList.add('show');
  renderWizard('select');
}

function closeWizard(){
  document.getElementById('wizardOverlay').classList.remove('show');
  refreshHome(); refreshConvList(); refreshSettings();
}

function renderWizard(step){
  var stepsEl = document.getElementById('wizSteps');
  var bodyEl = document.getElementById('wizBody');
  var labels = ['选择文件','解析中','完成'];
  var dots = '<div class="wiz-steps-bar">';
  labels.forEach(function(l, i){
    var cls = '';
    if(step==='select'&&i===0) cls='on';
    if(step==='parsing'&&i===0) cls='done';
    if(step==='parsing'&&i===1) cls='on';
    if(step==='result'&&i<=1) cls='done';
    if(step==='result'&&i===2) cls='on';
    dots += '<div class="wiz-step-item"><div class="wiz-step-dot '+cls+'">'+(cls==='done'?'✓':'')+'</div><div class="wiz-step-label '+(cls==='on'?'on':'')+'">'+l+'</div></div>';
    if(i<2) dots += '<div class="wiz-step-line '+(i<=0&&step!=='select'?'done':'')+'"></div>';
  });
  dots += '</div>';
  stepsEl.innerHTML = dots;

  if(step==='select'){
    bodyEl.innerHTML = '<div class="wiz-select-area">'+
      '<div class="wiz-file-drop" onclick="simulateFilePick()">'+
        '<div class="wiz-file-icon">📂</div>'+
        '<div class="wiz-file-title">选择聊天记录文件</div>'+
        '<div class="wiz-file-hint">支持微信导出的 TXT 和 JSON 格式<br>文件大小不超过 50MB</div>'+
      '</div>'+
      '<div style="font-size:11px;color:#CCC;margin-top:20px">提示：导出时选择你和她的聊天即可</div>'+
    '</div>';
  } else if(step==='parsing'){
    bodyEl.innerHTML = '<div class="wiz-parsing-wrap">'+
      '<div class="wiz-spin"></div>'+
      '<div class="wiz-parsing-title">正在解析聊天记录</div>'+
      '<div class="wiz-parsing-file">chat_full.txt</div>'+
      '<div class="wiz-prog-bar"><div class="wiz-prog-fill" id="progFill" style="width:0%"></div></div>'+
      '<div class="wiz-prog-text" id="progText">0 / 280 条</div>'+
    '</div>';
  } else {
    renderResultStep(bodyEl);
  }
}

function simulateFilePick(){
  renderWizard('parsing');
  var fill = document.getElementById('progFill');
  var text = document.getElementById('progText');
  var i = 0;
  var timer = setInterval(function(){
    i += Math.floor(Math.random()*40)+10;
    if(i>=280){ i=280; clearInterval(timer); finishParse(); }
    var pct = Math.round(i/280*100);
    if(fill) fill.style.width = pct+'%';
    if(text) text.textContent = i+' / 280 条';
  }, 200);
}

function finishParse(){
  // 模拟解析结果：参与者"我"和"她"
  wizParticipants = [
    { senderName:'她', persona: personas.find(function(p){ return p.sourceSender==='她'; }) || null },
    { senderName:'甜', persona: personas.find(function(p){ return p.sourceSender==='甜'; }) || null }
  ];
  wizParseResult = { totalMessages:280, participants:['我','她','甜'], timeStart:'2024-01-01', timeEnd:'2024-03-31', imageCount:12 };
  renderWizard('result');
}

function renderResultStep(el){
  var h = '';
  h += '<div class="result-icon">✓</div>';
  h += '<div style="font-size:22px;font-weight:700;color:#191919;margin-bottom:20px">解析完成</div>';

  // 摘要
  h += '<div class="summary-card">';
  h += '<div class="summary-r"><span class="summary-l">消息总数</span><span class="summary-v">280 条</span></div>';
  h += '<div class="summary-r"><span class="summary-l">参与者</span><span class="summary-v">我、她、甜</span></div>';
  h += '<div class="summary-r"><span class="summary-l">时间跨度</span><span class="summary-v">2024-01-01 ~ 2024-03-31</span></div>';
  h += '<div class="summary-r"><span class="summary-l">图片消息</span><span class="summary-v">12 张</span></div>';
  h += '</div>';

  // 参与者分配
  h += '<div class="match-card">';
  h += '<div class="match-title">将这些记录分配给谁？</div>';
  h += '<div class="match-hint">选择已有分身添加数据，或为新联系人创建分身</div>';

  wizParticipants.forEach(function(m){
    var avtBg = m.persona ? 'background:#FF9EAF' : 'background:#4A90D9';
    h += '<div class="match-item">';
    h += '<div class="match-info"><div class="match-avt" style="'+avtBg+'">'+m.senderName[0]+'</div><div><div class="match-name">「'+m.senderName+'」</div>';
    if(m.persona){
      h += '<div class="match-status matched">已匹配分身：'+m.persona.name+'</div>';
    } else {
      h += '<div class="match-status unmatched">未匹配到分身</div>';
    }
    h += '</div></div>';
    if(m.persona){
      h += '<button class="btn-green-sm" onclick="addToPersona(\''+m.persona.id+'\',\''+m.persona.name+'\',\''+m.senderName+'\')">添加到此分身</button>';
    } else {
      h += '<button class="btn-outline" onclick="createForSender(\''+m.senderName+'\')">创建分身</button>';
    }
    h += '</div>';
  });
  h += '</div>';

  h += '<button class="btn-gray-link" onclick="closeWizard()">仅导入数据，暂不分配</button>';
  h += '<button class="btn-text-link" onclick="showToast(\'重新选择其他文件\');renderWizard(\'select\')">重新导入其他文件</button>';

  el.innerHTML = h;
}

function addToPersona(personaId, personaName, senderName){
  showToast('✅ 已添加到「'+personaName+'」\n新增 30 条样本，风格摘要已更新\n（调用 addSamplesToPersona）');
  // 模拟：更新对话列表的最后消息
  var conv = conversations.find(function(c){ return c.personaId===personaId; });
  if(conv){
    conv.lastMsg = '[新增了来自「'+senderName+'」的记录]';
    conv.time = '刚刚';
  }
  closeWizard();
}

function createForSender(senderName){
  closeWizard();
  setTimeout(function(){ openPersonaSetup(senderName); }, 300);
}

// ============================================================
// 分身管理浮层
// ============================================================
function openPersonaManage(){
  document.getElementById('personaOverlay').classList.add('show');
  renderPersonaList();
}
function closePersonaOverlay(){
  document.getElementById('personaOverlay').classList.remove('show');
  refreshSettings();
}
function renderPersonaList(){
  var el = document.getElementById('personaContent');
  if(personas.length===0){
    el.innerHTML = '<div style="text-align:center;padding-top:80px"><div style="font-size:56px;margin-bottom:12px">👤</div><div style="font-size:16px;color:#999;margin-bottom:20px">还没有创建分身</div><button class="btn-green" onclick="showToast(\'→ 跳转 /persona/setup\')">去创建</button></div>';
    return;
  }
  var h = '';
  personas.forEach(function(p){
    h += '<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:12px">';
    h += '<div style="display:flex;align-items:center;margin-bottom:12px">';
    h += '<div style="width:56px;height:56px;border-radius:50%;background:#FF9EAF;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;color:#fff;margin-right:14px;cursor:pointer" onclick="showToast(\'点击更换头像\\n（需 expo-image-picker）\')">'+p.name[0]+'</div>';
    h += '<div style="flex:1"><div style="font-size:18px;font-weight:600;color:#191919;margin-bottom:2px">'+p.name+'</div><div style="font-size:13px;color:#888">模仿对象：'+p.sourceSender+'</div><div style="font-size:12px;color:#BBB">创建于 '+p.createdAt+'</div></div>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;padding:8px 0;border-top:1px solid #EEE;cursor:pointer" onclick="var s=prompt(\'编辑个性签名\',\''+(p.signature||'')+'\');if(s!==null){p.signature=s.trim();renderPersonaList();}"><span style="font-size:14px;color:#999;margin-right:8px">个性签名</span><span style="flex:1;font-size:14px;color:#333;text-align:right">'+(p.signature||'未设置')+'</span><span style="font-size:14px;color:#CCC;margin-left:8px">&gt;</span></div>';
    // 添加聊天记录按钮
    h += '<button style="display:flex;align-items:center;width:100%;padding:10px 12px;margin-top:8px;background:#F9FDF9;border-radius:8px;border:1px solid #E0F0E0;cursor:pointer;font-family:inherit" onclick="openWizard()">';
    h += '<span style="font-size:18px;margin-right:8px">📂</span><span style="font-size:14px;font-weight:500;color:#07C160;margin-right:8px">添加聊天记录</span><span style="flex:1;font-size:11px;color:#999;text-align:right">导入与「'+p.sourceSender+'」的更多记录</span>';
    h += '</button>';

    // 操作区：开始聊天 + 删除
    h += '<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #F0F0F0">';
    h += '<button style="flex:1;background:#07C160;color:#fff;border:none;border-radius:8px;padding:10px 0;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit" onclick="openChatForPersona(\''+p.id+'\',\''+p.name+'\')">💬 开始聊天</button>';
    h += '<button style="background:#fff;color:#E74C3C;border:1px solid #FCC;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px" onclick="deletePersona(\''+p.id+'\',\''+p.name+'\')">🗑 删除</button>';
    h += '</div>';
    h += '</div>';
  });
  h += '<button style="display:flex;align-items:center;justify-content:center;width:100%;padding:16px;border-radius:12px;border:1px dashed #E5E5E5;background:#fff;cursor:pointer;font-family:inherit;gap:8px" onclick="showToast(\'→ 跳转 /persona/setup\')"><span style="font-size:22px;color:#07C160">+</span><span style="font-size:16px;color:#07C160;font-weight:500">创建新的分身</span></button>';
  el.innerHTML = h;
}

function deletePersona(id, name){
  if(confirm('确认删除「'+name+'」？\n删除后相关对话也会被删除。此操作不可撤销。')){
    personas = personas.filter(function(p){ return p.id!==id; });
    conversations = conversations.filter(function(c){ return c.personaId!==id; });
    showToast('🗑 「'+name+'」已删除');
    renderPersonaList();
    refreshConvList(); refreshHome(); refreshSettings();
  }
}

function openChatForPersona(personaId, personaName){
  closePersonaOverlay();
  setTimeout(function(){ openChat(personaId, personaName); }, 200);
}

  if(type==='persona') openPersonaSetup();
}
function hideSheet(){ document.getElementById('actionSheet').classList.remove('show'); }

// ============================================================
// 初始化
// ============================================================
refreshHome();
refreshConvList();
refreshSettings();
updateChatSendBtn();
