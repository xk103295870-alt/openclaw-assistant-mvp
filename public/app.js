// ===== 搴旂敤鐘舵€?=====
let appState = 'welcome'; // welcome | idle | listening | thinking | speaking | followup | goodbye
let isFirstLaunch = true;
let isRecording = false;
let isProcessing = false;
let isSpeaking = false;
let audioStream = null;
let audioContext = null;
let audioWorkletNode = null;
let audioPlayer = null;
let followupTimer = null;
let bubbleHideTimer = null;
let auraAnimator = null;
const ENABLE_CHARACTER_BACKGROUND_EFFECTS = false;
const ENABLE_AVATAR_HEAD_BUBBLE = false;
let executeTimer = null;
let accumulatedTranscript = '';
let lastAIResponse = ''; // 缂撳瓨鏈€杩戜竴娆?AI 鍥炲锛岀敤浜庢墦鏂悗鏌ョ湅
let countdownInterval = null;

// ===== 瑙掕壊绯荤粺 =====
const CHARACTER_PROFILES = {
  lobster: {
    id: 'lobster',
    name: '小龙虾',
    desc: '活泼可爱的助手角色',
    icon: 'mdi:fish',
    welcomeText: '你好，我是你的助手小龙虾。有什么我可以帮你？',
    thinkingPrompts: [
      '请稍等，我正在处理...',
      '让我想一下...',
      '正在为你查询信息...'
    ],
    videos: {
      welcome: 'lobster-welcome.mp4',
      idle: 'lobster-listening.mp4',
      listening: 'lobster-listening.mp4',
      thinking: 'lobster-thinking.mp4',
      speaking: 'lobster-speaking.mp4',
      followup: 'lobster-listening.mp4',
      goodbye: 'lobster-idle.mp4'
    },
    auraColors: {
      idle: { r: 102, g: 126, b: 234 },
      listening: { r: 239, g: 68, b: 68 },
      thinking: { r: 245, g: 158, b: 11 },
      speaking: { r: 118, g: 75, b: 162 }
    },
    defaultVoice: 'Lovely_Girl'
  },
  amy: {
    id: 'amy',
    name: 'Amy',
    desc: '温柔知性的女助手',
    icon: 'mdi:account-heart',
    welcomeText: '你好，我是 Amy，很高兴为你服务。',
    thinkingPrompts: [
      '请稍等，我来查一下...',
      '正在思考中...',
      '马上就好...'
    ],
    videos: {
      welcome: 'amy-welcome.mp4',
      idle: 'amy-listening.mp4',
      listening: 'amy-listening.mp4',
      thinking: 'amy-listening.mp4',
      speaking: 'amy-speaking.mp4',
      followup: 'amy-listening.mp4',
      goodbye: 'amy-listening.mp4'
    },
    auraColors: {
      idle: { r: 255, g: 154, b: 162 },
      listening: { r: 255, g: 107, b: 157 },
      thinking: { r: 255, g: 183, b: 178 },
      speaking: { r: 255, g: 134, b: 154 }
    },
    defaultVoice: 'Arrogant_Miss'
  },
  kelly: {
    id: 'kelly',
    name: 'Kelly',
    desc: 'Stylish virtual assistant',
    icon: 'mdi:account-star',
    welcomeText: 'Hi, I am Kelly. Ready when you are.',
    thinkingPrompts: [
      '嗯。让我多想想.',
      '正在为你工作呢',
      '快想好了，别催我哟'
    ],
    videos: {
      welcome: 'kelly-welcome.mp4',
      idle: 'kelly-idle.mp4',
      listening: 'kelly-listening.mp4',
      thinking: 'kelly-thinking.mp4',
      speaking: 'kelly-speaking.mp4',
      followup: 'kelly-listening.mp4',
      goodbye: 'kelly-idle.mp4'
    },
    auraColors: {
      idle: { r: 99, g: 102, b: 241 },
      listening: { r: 59, g: 130, b: 246 },
      thinking: { r: 245, g: 158, b: 11 },
      speaking: { r: 168, g: 85, b: 247 }
    },
    defaultVoice: 'Lovely_Girl'
  },
  cat: {
    id: 'cat',
    name: '喵助理',
    desc: '优雅慵懒的猫咪助手',
    icon: 'mdi:cat',
    welcomeText: '喵，我是喵助理，有什么要我帮忙的吗？',
    thinkingPrompts: [
      '喵，正在想办法...',
      '稍等一下...',
      '我在查询中...'
    ],
    videos: {
      welcome: 'cat-welcome.mp4',
      idle: 'cat-idle.mp4',
      listening: 'cat-listening.mp4',
      thinking: 'cat-thinking.mp4',
      speaking: 'cat-speaking.mp4',
      followup: 'cat-listening.mp4',
      goodbye: 'cat-idle.mp4'
    },
    auraColors: {
      idle: { r: 255, g: 183, b: 77 },
      listening: { r: 255, g: 107, b: 107 },
      thinking: { r: 255, g: 213, b: 79 },
      speaking: { r: 171, g: 130, b: 255 }
    },
    defaultVoice: 'Sweet_Girl_2'
  },
  robot: {
    id: 'robot',
    name: '机甲助手',
    desc: '高效精准的机器人助手',
    icon: 'mdi:robot',
    welcomeText: '系统已就绪，我是机甲助手。',
    thinkingPrompts: [
      '正在分析数据...',
      '计算处理中...',
      '检索信息中...'
    ],
    videos: {
      welcome: 'robot-welcome.mp4',
      idle: 'robot-idle.mp4',
      listening: 'robot-listening.mp4',
      thinking: 'robot-thinking.mp4',
      speaking: 'robot-speaking.mp4',
      followup: 'robot-listening.mp4',
      goodbye: 'robot-idle.mp4'
    },
    auraColors: {
      idle: { r: 0, g: 200, b: 255 },
      listening: { r: 0, g: 255, b: 150 },
      thinking: { r: 255, g: 200, b: 0 },
      speaking: { r: 0, g: 150, b: 255 }
    },
    defaultVoice: 'Robot_Armor'
  }
};

let currentCharacter = CHARACTER_PROFILES.kelly;
const AVAILABLE_CHARACTER_IDS = ['lobster', 'amy', 'kelly'];
const CHARACTER_SELECTION_STORAGE_KEY = 'openclaw_selected_character_v1';
const VOICE_SELECTION_STORAGE_KEY = 'openclaw_selected_voice_v1';

// 褰撳墠瑙掕壊鐨勮棰戠姸鎬佹槧灏勶紙鍔ㄦ€佸垏鎹級
let VIDEO_SOURCES = { ...currentCharacter.videos };

// 杩介棶鍚庣瓑寰呯敤鎴峰洖澶嶇殑瓒呮椂锛?0绉掓棤鍝嶅簲鍥炲埌idle锛?
const FOLLOWUP_TIMEOUT = 30000;
// 姘旀场鑷姩闅愯棌鏃堕棿
const BUBBLE_AUTO_HIDE = 12000;
// 寤惰繜鎵ц鏃堕棿锛堢敤鎴峰仠椤垮悗绛夊緟鐨勬椂闂达紝浠?0绉掍紭鍖栦负3绉掞級
const EXECUTE_DELAY = 3000;

// 澶勭悊涓殑鎻愮ず璇粠褰撳墠瑙掕壊閰嶇疆鑾峰彇
function getThinkingPrompts() {
  return currentCharacter.thinkingPrompts;
}

function saveSelectedCharacter(characterId) {
  try {
    localStorage.setItem(CHARACTER_SELECTION_STORAGE_KEY, characterId);
  } catch (error) {
    console.warn('[Character] save selected character failed:', error);
  }
}

function loadSelectedCharacter() {
  try {
    const characterId = localStorage.getItem(CHARACTER_SELECTION_STORAGE_KEY);
    if (!characterId) return null;
    if (!AVAILABLE_CHARACTER_IDS.includes(characterId)) return null;
    return CHARACTER_PROFILES[characterId] || null;
  } catch (error) {
    console.warn('[Character] load selected character failed:', error);
    return null;
  }
}

function applySavedCharacterSelection() {
  const savedCharacter = loadSelectedCharacter();
  if (!savedCharacter) return;

  currentCharacter = savedCharacter;
  VIDEO_SOURCES = { ...savedCharacter.videos };

  if (ENABLE_CHARACTER_BACKGROUND_EFFECTS && auraAnimator && savedCharacter.auraColors) {
    auraAnimator.updateColors(savedCharacter.auraColors);
  }
}

function saveSelectedVoice(voiceId) {
  try {
    localStorage.setItem(VOICE_SELECTION_STORAGE_KEY, voiceId);
  } catch (error) {
    console.warn('[Voice] save selected voice failed:', error);
  }
}

function loadSelectedVoice() {
  try {
    return localStorage.getItem(VOICE_SELECTION_STORAGE_KEY) || '';
  } catch (error) {
    console.warn('[Voice] load selected voice failed:', error);
    return '';
  }
}

// ===== DOM 鍏冪礌 =====
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const statusHint = document.getElementById('status-hint');
const lobsterArea = document.getElementById('lobster-area');
const avatarPanel = document.querySelector('.avatar-panel');
const lobsterChar = document.getElementById('lobster-char');
const stateIndicator = document.getElementById('state-indicator');
const stateDot = stateIndicator.querySelector('.state-dot');
const stateText = document.getElementById('state-text');
const languageToggleBtn = document.getElementById('language-toggle-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const fileUploadBtn = document.getElementById('file-upload-btn');
const fileInput = document.getElementById('file-input');
const attachmentSummaryEl = document.getElementById('attachment-summary');
const tapHint = document.getElementById('tap-hint');
const listeningPulseRing = document.getElementById('listening-pulse-ring');
const chatHistoryEl = document.getElementById('chat-history');
const chatEmptyEl = document.getElementById('chat-empty');
const clearHistoryBtn = document.getElementById('clear-history-btn');

const CHAT_HISTORY_STORAGE_KEY = 'openclaw_assistant_chat_history_v1';
const CHAT_HISTORY_LIMIT = 200;
let chatHistory = [];
let selectedChatFiles = [];
const UI_LANGUAGE_STORAGE_KEY = 'clawk_ui_language_v1';

const LANGUAGE_REGISTRY = {
  zh: {
    'app.windowTitle': 'Claw K',
    'app.brand': 'Claw K',
    'header.expand': '\u5c55\u5f00',
    'header.character': '\u5207\u6362\u89d2\u8272',
    'header.voice': '\u5207\u6362\u97f3\u8272',
    'header.skills': '\u6280\u80fd',
    'header.cron': '\u5b9a\u65f6\u4efb\u52a1',
    'header.language': '\u5207\u6362\u8bed\u8a00',
    'header.minimize': '\u6700\u5c0f\u5316',
    'header.close': '\u5173\u95ed',
    'state.welcome': '\u6b22\u8fce\u4f7f\u7528 {name}',
    'state.idle': '\u70b9\u51fb\u6211\u5f00\u59cb\u5bf9\u8bdd',
    'state.listening': '\u8046\u542c\u4e2d...',
    'state.listeningHint': '\u8bf7\u8bf4\u8bdd...',
    'state.thinking': '\u601d\u8003\u4e2d...',
    'state.thinkingHint': '\u6b63\u5728\u5206\u6790\u4f60\u7684\u95ee\u9898',
    'state.speaking': '\u56de\u590d\u4e2d...',
    'state.speakingHint': '\u6b63\u5728\u4e3a\u4f60\u89e3\u7b54',
    'state.followup': '\u7ee7\u7eed\u8bf4\u8bdd\uff0c\u6211\u5728\u542c...',
    'state.followupHint': '\u53ef\u4ee5\u7ee7\u7eed\u63d0\u95ee',
    'state.goodbye': '\u518d\u89c1',
    'state.goodbyeHint': '\u671f\u5f85\u4e0b\u6b21\u89c1\u9762',
    'chat.title': '\u804a\u5929\u8bb0\u5f55',
    'chat.clear': '\u6e05\u7a7a',
    'chat.empty': '\u6682\u65e0\u804a\u5929\u8bb0\u5f55\uff0c\u5f00\u59cb\u5bf9\u8bdd\u5427\u3002',
    'chat.inputPlaceholder': '\u8f93\u5165\u6587\u5b57\u4e0e\u6211\u5bf9\u8bdd...',
    'chat.send': '\u53d1\u9001',
    'chat.upload': '\u4e0a\u4f20\u9644\u4ef6',
    'chat.attach.selectedCount': '\u5df2\u9644\u52a0 {count} \u4e2a\u6587\u4ef6',
    'chat.attach.more': '\u7b49 {count} \u4e2a',
    'chat.attach.defaultPrompt': '\u8bf7\u5148\u9605\u8bfb\u4e0b\u9762\u6587\u4ef6\uff0c\u518d\u7ed9\u51fa\u5904\u7406\u7ed3\u679c\u3002',
    'chat.attach.sectionTitle': '\u672c\u6b21\u5904\u7406\u6587\u4ef6\uff1a',
    'character.title': '\u9009\u62e9\u89d2\u8272',
    'voice.title': '\u9009\u62e9\u97f3\u8272',
    'voice.addCustomTitle': '\u65b0\u589e\u81ea\u5b9a\u4e49\u97f3\u8272',
    'voice.filter.all': '\u5168\u90e8',
    'voice.filter.zh': '\u4e2d\u6587',
    'voice.custom.id': 'Voice ID',
    'voice.custom.idPlaceholder': '\u4f8b\u5982\uff1attv-voice-xxxx',
    'voice.custom.name': '\u540d\u79f0',
    'voice.custom.namePlaceholder': '\u663e\u793a\u540d\u79f0\uff08\u53ef\u9009\uff09',
    'voice.custom.description': '\u63cf\u8ff0',
    'voice.custom.descriptionPlaceholder': '\u63cf\u8ff0\uff08\u53ef\u9009\uff09',
    'voice.custom.language': '\u8bed\u8a00',
    'common.save': '\u4fdd\u5b58',
    'common.cancel': '\u53d6\u6d88',
    'common.reset': '\u6e05\u7a7a',
    'skills.title': '\u6280\u80fd',
    'skills.openDir': '\u6253\u5f00\u6280\u80fd\u76ee\u5f55',
    'skills.refresh': '\u5237\u65b0\u6280\u80fd',
    'skills.add.button': '\u6dfb\u52a0\u6280\u80fd',
    'skills.add.placeholder': 'skill slug\uff0c\u4f8b\u5982 owner/my-skill',
    'skills.add.hint': '\u901a\u8fc7 ClawHub slug \u5b89\u88c5\uff0c\u7b49\u4ef7\u4e8e `clawhub install <skill-slug>`\u3002',
    'skills.add.invalidSlug': '\u8bf7\u8f93\u5165\u5408\u6cd5\u7684 Skill slug\uff08\u53ea\u5141\u8bb8\u5b57\u6bcd\u3001\u6570\u5b57\u3001\u70b9\u3001\u4e0b\u5212\u7ebf\u3001\u659c\u6760\u3001\u8fde\u5b57\u7b26\uff09\u3002',
    'skills.add.installing': '\u6b63\u5728\u5b89\u88c5 Skill...',
    'skills.meta.workspace': 'workspace',
    'skills.meta.managed': 'managed',
    'skills.empty': '\u6682\u65e0\u6280\u80fd',
    'skills.badge.eligible': '\u53ef\u7528',
    'skills.badge.blocked': '\u53d7\u9650',
    'skills.badge.disabled': '\u5df2\u7981\u7528',
    'skills.badge.allowlistBlocked': 'allowlist \u9650\u5236',
    'skills.missing': '\u7f3a\u5931',
    'skills.btn.enable': '\u542f\u7528',
    'skills.btn.disable': '\u7981\u7528',
    'skills.btn.saveKey': '\u4fdd\u5b58 Key',
    'skills.error.apiUnavailable': 'skills API \u4e0d\u53ef\u7528',
    'cron.title': '\u5b9a\u65f6\u4efb\u52a1',
    'cron.refresh': '\u5237\u65b0\u4efb\u52a1',
    'cron.form.name': '\u540d\u79f0',
    'cron.form.namePlaceholder': '\u4f8b\u5982\uff1a\u65e9\u62a5',
    'cron.form.description': '\u63cf\u8ff0\uff08\u53ef\u9009\uff09',
    'cron.form.descriptionPlaceholder': '\u4f8b\u5982\uff1a\u6bcf\u5929 8 \u70b9\u53d1\u9001\u603b\u7ed3',
    'cron.form.expr': 'Cron \u8868\u8fbe\u5f0f',
    'cron.form.exprPlaceholder': '\u4f8b\u5982\uff1a0 8 * * *',
    'cron.form.tz': '\u65f6\u533a\uff08\u53ef\u9009\uff09',
    'cron.form.tzPlaceholder': '\u4f8b\u5982\uff1aAmerica/Los_Angeles',
    'cron.form.message': '\u4efb\u52a1\u5185\u5bb9',
    'cron.form.messagePlaceholder': '\u4f8b\u5982\uff1a\u603b\u7ed3\u6628\u665a\u5230\u73b0\u5728\u7684\u91cd\u8981\u6d88\u606f',
    'cron.form.delivery': '\u63a8\u9001\u901a\u9053\uff08\u53ef\u9009\uff09',
    'cron.form.deliveryNone': '\u4e0d\u6307\u5b9a',
    'cron.form.toPlaceholder': 'to \u76ee\u6807\uff08\u53ef\u9009\uff09',
    'cron.form.create': '\u521b\u5efa\u4efb\u52a1',
    'cron.empty': '\u6682\u65e0\u5b9a\u65f6\u4efb\u52a1',
    'cron.error.apiUnavailable': 'cron API \u4e0d\u53ef\u7528',
    'cron.error.nameRequired': '\u4efb\u52a1\u540d\u79f0\u5fc5\u586b\u3002',
    'cron.error.exprRequired': 'Cron \u8868\u8fbe\u5f0f\u5fc5\u586b\u3002',
    'cron.error.messageRequired': '\u4efb\u52a1\u5185\u5bb9\u5fc5\u586b\u3002',
    'cron.btn.enable': '\u542f\u7528',
    'cron.btn.disable': '\u7981\u7528',
    'cron.btn.runNow': '\u7acb\u5373\u6267\u884c',
    'cron.btn.delete': '\u5220\u9664',
    'cron.badge.enabled': '\u5df2\u542f\u7528',
    'cron.badge.disabled': '\u5df2\u7981\u7528',
    'cron.badge.last': '\u6700\u8fd1',
    'cron.label.scheduleUnknown': '\u8c03\u5ea6\uff1a\u672a\u77e5',
    'cron.label.unnamed': '\uff08\u672a\u547d\u540d\uff09',
    'cron.label.description': '\u63cf\u8ff0',
    'cron.label.message': '\u5185\u5bb9',
    'cron.label.nextRun': '\u4e0b\u6b21\u8fd0\u884c',
    'cron.label.lastRun': '\u4e0a\u6b21\u8fd0\u884c',
    'cron.label.error': '\u9519\u8bef',
    'cron.confirm.delete': '\u5220\u9664\u5b9a\u65f6\u4efb\u52a1\u201c{name}\u201d\uff1f'
  },
  en: {
    'app.windowTitle': 'Claw K',
    'app.brand': 'Claw K',
    'header.expand': 'Expand',
    'header.character': 'Switch Character',
    'header.voice': 'Switch Voice',
    'header.skills': 'Skills',
    'header.cron': 'Scheduled Tasks',
    'header.language': 'Switch Language',
    'header.minimize': 'Minimize',
    'header.close': 'Close',
    'state.welcome': 'Welcome to {name}',
    'state.idle': 'Tap me to start chatting',
    'state.listening': 'Listening...',
    'state.listeningHint': 'Please speak...',
    'state.thinking': 'Thinking...',
    'state.thinkingHint': 'Analyzing your question',
    'state.speaking': 'Responding...',
    'state.speakingHint': 'Preparing your answer',
    'state.followup': 'Keep talking, I am listening...',
    'state.followupHint': 'You can continue asking',
    'state.goodbye': 'Goodbye',
    'state.goodbyeHint': 'See you next time',
    'chat.title': 'Chat History',
    'chat.clear': 'Clear',
    'chat.empty': 'No chat history yet. Start a conversation.',
    'chat.inputPlaceholder': 'Type a message...',
    'chat.send': 'Send',
    'chat.upload': 'Attach files',
    'chat.attach.selectedCount': '{count} file(s) attached',
    'chat.attach.more': 'and {count} more',
    'chat.attach.defaultPrompt': 'Please read the files below and then provide the result.',
    'chat.attach.sectionTitle': 'Files to process:',
    'character.title': 'Choose Character',
    'voice.title': 'Choose Voice',
    'voice.addCustomTitle': 'Add Custom Voice',
    'voice.filter.all': 'All',
    'voice.filter.zh': 'Chinese',
    'voice.custom.id': 'Voice ID',
    'voice.custom.idPlaceholder': 'e.g. ttv-voice-xxxx',
    'voice.custom.name': 'Name',
    'voice.custom.namePlaceholder': 'Display name (optional)',
    'voice.custom.description': 'Description',
    'voice.custom.descriptionPlaceholder': 'Description (optional)',
    'voice.custom.language': 'Language',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.reset': 'Reset',
    'skills.title': 'Skills',
    'skills.openDir': 'Open managed skills directory',
    'skills.refresh': 'Refresh skills',
    'skills.add.button': 'Add Skill',
    'skills.add.placeholder': 'skill slug, e.g. owner/my-skill',
    'skills.add.hint': 'Install by ClawHub slug (equivalent to `clawhub install <skill-slug>`).',
    'skills.add.invalidSlug': 'Please enter a valid skill slug (letters, numbers, dot, underscore, slash, hyphen).',
    'skills.add.installing': 'Installing skill...',
    'skills.meta.workspace': 'workspace',
    'skills.meta.managed': 'managed',
    'skills.empty': 'No skills available.',
    'skills.badge.eligible': 'eligible',
    'skills.badge.blocked': 'blocked',
    'skills.badge.disabled': 'disabled',
    'skills.badge.allowlistBlocked': 'allowlist blocked',
    'skills.missing': 'Missing',
    'skills.btn.enable': 'Enable',
    'skills.btn.disable': 'Disable',
    'skills.btn.saveKey': 'Save key',
    'skills.error.apiUnavailable': 'skills API unavailable',
    'cron.title': 'Scheduled Tasks',
    'cron.refresh': 'Refresh tasks',
    'cron.form.name': 'Name',
    'cron.form.namePlaceholder': 'e.g. Morning Brief',
    'cron.form.description': 'Description (optional)',
    'cron.form.descriptionPlaceholder': 'e.g. Send summary at 8:00 every day',
    'cron.form.expr': 'Cron Expression',
    'cron.form.exprPlaceholder': 'e.g. 0 8 * * *',
    'cron.form.tz': 'Timezone (optional)',
    'cron.form.tzPlaceholder': 'e.g. America/Los_Angeles',
    'cron.form.message': 'Task Message',
    'cron.form.messagePlaceholder': 'e.g. Summarize the important updates since last night',
    'cron.form.delivery': 'Delivery Channel (optional)',
    'cron.form.deliveryNone': 'None',
    'cron.form.toPlaceholder': 'target (optional)',
    'cron.form.create': 'Create Task',
    'cron.empty': 'No cron jobs yet.',
    'cron.error.apiUnavailable': 'cron API unavailable',
    'cron.error.nameRequired': 'Cron name is required.',
    'cron.error.exprRequired': 'Cron expression is required.',
    'cron.error.messageRequired': 'Task message is required.',
    'cron.btn.enable': 'Enable',
    'cron.btn.disable': 'Disable',
    'cron.btn.runNow': 'Run now',
    'cron.btn.delete': 'Delete',
    'cron.badge.enabled': 'enabled',
    'cron.badge.disabled': 'disabled',
    'cron.badge.last': 'last',
    'cron.label.scheduleUnknown': 'schedule: unknown',
    'cron.label.unnamed': '(unnamed)',
    'cron.label.description': 'Description',
    'cron.label.message': 'Message',
    'cron.label.nextRun': 'Next run',
    'cron.label.lastRun': 'Last run',
    'cron.label.error': 'Error',
    'cron.confirm.delete': 'Delete cron job "{name}"?'
  }
};
const DEFAULT_LANGUAGE = 'zh';
const SUPPORTED_LANGUAGES = ['zh', 'en'];
let currentLanguage = resolveLanguage(localStorage.getItem(UI_LANGUAGE_STORAGE_KEY));

function normalizeLanguageKey(value) {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-');
}

function resolveLanguage(value) {
  const normalized = normalizeLanguageKey(value);
  if (!normalized) return DEFAULT_LANGUAGE;
  if (LANGUAGE_REGISTRY[normalized]) return normalized;

  if (normalized.startsWith('zh') && LANGUAGE_REGISTRY.zh) return 'zh';
  if (normalized.startsWith('en') && LANGUAGE_REGISTRY.en) return 'en';

  const primary = normalized.split('-')[0];
  if (LANGUAGE_REGISTRY[primary]) return primary;

  return DEFAULT_LANGUAGE;
}

function registerLanguage(language, dictionary) {
  const key = normalizeLanguageKey(language);
  if (!key || !dictionary || typeof dictionary !== 'object') return;

  LANGUAGE_REGISTRY[key] = {
    ...(LANGUAGE_REGISTRY[key] || {}),
    ...dictionary
  };
  if (!SUPPORTED_LANGUAGES.includes(key)) {
    SUPPORTED_LANGUAGES.push(key);
  }
}

function getLanguageBadgeLabel(language) {
  const key = normalizeLanguageKey(language);
  if (!key) return 'EN';
  if (key === 'zh' || key.startsWith('zh-')) return '\u4e2d';
  return key.slice(0, 2).toUpperCase();
}

function t(key, params = {}) {
  const langDict = LANGUAGE_REGISTRY[currentLanguage] || {};
  const fallbackDict = LANGUAGE_REGISTRY.en || {};
  const template = langDict[key] ?? fallbackDict[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? ''));
}

function setLanguage(language) {
  currentLanguage = resolveLanguage(language);
  try {
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch (error) {}
  applyI18n();
}

function toggleLanguage() {
  const currentIndex = SUPPORTED_LANGUAGES.indexOf(currentLanguage);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % SUPPORTED_LANGUAGES.length : 0;
  setLanguage(SUPPORTED_LANGUAGES[nextIndex]);
}

window.ClawKI18n = {
  registerLanguage,
  setLanguage,
  getLanguage: () => currentLanguage,
  t
};

function applyI18n() {
  const html = document.documentElement;
  if (html) {
    html.lang = currentLanguage === 'zh' ? 'zh-CN' : currentLanguage;
  }
  document.title = t('app.windowTitle');

  const languageLabel = document.getElementById('language-label');
  if (languageLabel) {
    languageLabel.textContent = getLanguageBadgeLabel(currentLanguage);
  }

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) return;
    element.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const key = element.getAttribute('data-i18n-title');
    if (!key) return;
    element.setAttribute('title', t(key));
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (!key) return;
    element.setAttribute('placeholder', t(key));
  });

  refreshStateTextByLanguage();

  if (chatHistory.length === 0) {
    renderChatHistory();
  }

  renderSkillsPanelMeta();
  renderSkillsList();
  renderCronList();
  renderAttachmentSummary();
}

function refreshStateTextByLanguage() {
  if (!stateText || !statusHint) return;

  switch (appState) {
    case 'welcome':
      stateText.textContent = t('state.welcome', { name: currentCharacter.name });
      statusHint.textContent = '';
      break;
    case 'idle':
      stateText.textContent = t('state.idle');
      statusHint.textContent = '';
      break;
    case 'listening':
      stateText.textContent = t('state.listening');
      statusHint.textContent = t('state.listeningHint');
      break;
    case 'thinking':
      stateText.textContent = t('state.thinking');
      statusHint.textContent = t('state.thinkingHint');
      break;
    case 'speaking':
      stateText.textContent = t('state.speaking');
      statusHint.textContent = t('state.speakingHint');
      break;
    case 'followup':
      stateText.textContent = t('state.followup');
      statusHint.textContent = t('state.followupHint');
      break;
    case 'goodbye':
      stateText.textContent = t('state.goodbye');
      statusHint.textContent = t('state.goodbyeHint');
      break;
    default:
      stateText.textContent = t('state.idle');
      statusHint.textContent = '';
      break;
  }
}

// ===== 鍒濆鍖栧厜鐜姩鐢?=====
document.addEventListener('DOMContentLoaded', () => {
  if (!ENABLE_AVATAR_HEAD_BUBBLE) {
    if (avatarPanel) {
      avatarPanel.classList.add('hide-speech-bubble');
    }
    if (speechBubble) {
      speechBubble.style.display = 'none';
    }
  }

  const canvas = document.getElementById('aura-canvas');
  if (!ENABLE_CHARACTER_BACKGROUND_EFFECTS) {
    lobsterArea.classList.add('no-bg-effects');
    if (canvas) {
      canvas.style.display = 'none';
    }
    if (listeningPulseRing) {
      listeningPulseRing.classList.add('hidden');
    }
  } else if (canvas && window.OrbAnimator) {
    auraAnimator = new OrbAnimator(canvas);
  }

  applySavedCharacterSelection();
  saveSelectedCharacter(currentCharacter.id);

  initDeepgramListeners();
  initCustomVoices();
  initVoice();
  initTaskListeners();
  initMiniMode();
  initStreamingTTS();  // 鍒濆鍖栨祦寮?TTS 鐩戝惉
  initFilePathClickHandler();
  initChatHistory();  // 鍒濆鍖栨枃浠惰矾寰勭偣鍑诲鐞?
  applyI18n();

  // 棣栨鍚姩鎾斁娆㈣繋瑙嗛
  if (isFirstLaunch) {
    playWelcomeVideo();
  }

  console.log('[榫欒櫨鍔╂墜] 宸插垵濮嬪寲');
});

// ===== 鍒濆鍖栦换鍔＄洃鍚櫒 =====
function initTaskListeners() {
  window.electronAPI.task.onCompleted((data) => {
    console.log('[OpenClaw Assistant] Task completed:', data.taskId);

    const cleanResult = cleanMarkdown(data.result);
    const completionText = `Task completed: ${cleanResult}`;

    showBubble(completionText);
    addChatMessage('assistant', completionText, { name: currentCharacter.name });

    playTextToSpeech(completionText).catch((err) => {
      console.warn('[OpenClaw Assistant] Task completion TTS failed:', err);
    });

    setAppState('speaking');

    setTimeout(() => {
      if (appState === 'speaking') {
        setAppState('idle');
      }
    }, 5000);
  });

  window.electronAPI.task.onFailed((data) => {
    console.error('[OpenClaw Assistant] Task failed:', data.taskId, data.error);

    const cleanError = cleanMarkdown(data.error);
    const failedText = `Task failed: ${cleanError}`;

    showBubble(failedText);
    addChatMessage('assistant', failedText, { name: currentCharacter.name });

    playTextToSpeech(failedText).catch((err) => {
      console.warn('[OpenClaw Assistant] Task failed TTS failed:', err);
    });
  });
}

function setAppState(newState) {
  appState = newState;
  clearTimeout(followupTimer);

  // 鏇存柊榫欒櫨鍔ㄧ敾class
  lobsterChar.className = 'lobster-character';
  stateDot.className = 'state-dot';
  statusHint.className = 'status-hint';

  // 鎺у埗鐐瑰嚮寮曞鍜岃剦鍐茬幆
  if (newState === 'idle') {
    tapHint.classList.remove('hidden');
  } else {
    tapHint.classList.add('hidden');
  }
  if (listeningPulseRing) {
    if (ENABLE_CHARACTER_BACKGROUND_EFFECTS && (newState === 'listening' || newState === 'followup')) {
      listeningPulseRing.classList.remove('hidden');
    } else {
      listeningPulseRing.classList.add('hidden');
    }
  }

  // 鍒囨崲瑙嗛婧?
  switchVideo(newState);

  switch (newState) {
    case 'welcome':
      tapHint.classList.add('hidden');
      stateText.textContent = t('state.welcome', { name: currentCharacter.name });
      statusHint.textContent = '';
      break;
    case 'idle':
      stateText.textContent = t('state.idle');
      statusHint.textContent = '';
      break;
    case 'listening':
      lobsterChar.classList.add('listening');
      stateDot.classList.add('listening');
      statusHint.classList.add('listening');
      stateText.textContent = t('state.listening');
      statusHint.textContent = t('state.listeningHint');
      break;
    case 'thinking':
      lobsterChar.classList.add('thinking');
      stateDot.classList.add('thinking');
      statusHint.classList.add('thinking');
      stateText.textContent = t('state.thinking');
      statusHint.textContent = t('state.thinkingHint');
      showBubble('<div class="thinking-dots"><span></span><span></span><span></span></div>', false);
      break;
    case 'speaking':
      lobsterChar.classList.add('speaking');
      stateDot.classList.add('speaking');
      statusHint.classList.add('speaking');
      stateText.textContent = t('state.speaking');
      statusHint.textContent = t('state.speakingHint');
      break;
    case 'followup':
      // TTS鎾畬鍚庣瓑寰呯敤鎴风户缁璇?
      lobsterChar.classList.add('listening');
      stateDot.classList.add('listening');
      statusHint.classList.add('listening');
      stateText.textContent = t('state.followup');
      statusHint.textContent = t('state.followupHint');
      // 瓒呮椂鍥炲埌idle
      followupTimer = setTimeout(() => {
        console.log('[Claw K] Follow-up timeout, returning to idle');
        stopRecording().then(() => {
          setAppState('idle');
          hideBubble(2000);
        });
      }, FOLLOWUP_TIMEOUT);
      break;
    case 'goodbye':
      stateText.textContent = t('state.goodbye');
      statusHint.textContent = t('state.goodbyeHint');
      break;
  }

  // 鍚屾鍏夌幆鍔ㄧ敾鐘舵€?
  if (auraAnimator) {
    const orbState = newState === 'followup' ? 'listening' : newState;
    auraAnimator.setState(orbState);
  }

  // 鍚屾鎮诞鐞冪姸鎬?
  if (isMiniMode) {
    setMiniOrbState(newState);
  }
}

// 闇€瑕佹挱鏀捐棰戣嚜甯﹂煶棰戠殑鐘舵€?
const VIDEO_WITH_AUDIO = ['welcome', 'thinking'];

// ===== 瑙嗛鍒囨崲鍔熻兘 =====
function switchVideo(state) {
  const videoSource = VIDEO_SOURCES[state] || VIDEO_SOURCES.idle;
  const videoElement = document.getElementById('lobster-char');

  if (videoElement && videoElement.tagName === 'VIDEO') {
    const sourceElement = videoElement.querySelector('source');
    const currentSrc = sourceElement ? sourceElement.src : '';
    const newSrc = videoSource;

    // 鍙湪瑙嗛婧愪笉鍚屾椂鎵嶅垏鎹?
    if (!currentSrc.endsWith(newSrc)) {
      console.log(`[瑙嗛鍒囨崲] ${state} -> ${videoSource}`);

      // 娣诲姞杩囨浮鍔ㄧ敾
      videoElement.classList.add('video-transition');
      setTimeout(() => videoElement.classList.remove('video-transition'), 400);

      // 淇濆瓨褰撳墠鎾斁鐘舵€?
      const wasPlaying = !videoElement.paused;

      // 鏇存柊瑙嗛婧?
      if (sourceElement) {
        sourceElement.src = newSrc;
      }

      // 鏍规嵁鐘舵€佸喅瀹氭槸鍚﹀惎鐢ㄨ棰戦煶棰?
      const useVideoAudio = VIDEO_WITH_AUDIO.includes(state);
      videoElement.muted = !useVideoAudio;

      // 閲嶆柊鍔犺浇骞舵挱鏀?
      videoElement.load();
      if (wasPlaying || useVideoAudio) {
        videoElement.play().catch(err => {
          console.warn('[瑙嗛鎾斁] 鑷姩鎾斁澶辫触:', err);
          // 濡傛灉鏈夊０鎾斁澶辫触锛岄檷绾т负闈欓煶鎾斁
          if (useVideoAudio) {
            videoElement.muted = true;
            videoElement.play().catch(() => {});
          }
        });
      }
    } else {
      // 瑙嗛婧愮浉鍚岋紝浣嗗彲鑳介渶瑕佹洿鏂伴煶棰戠姸鎬?
      const useVideoAudio = VIDEO_WITH_AUDIO.includes(state);
      videoElement.muted = !useVideoAudio;
    }
  }
}

// ===== 鎾斁娆㈣繋瑙嗛 =====
function playWelcomeVideo() {
  console.log('[榫欒櫨鍔╂墜] 鎾斁娆㈣繋瑙嗛');
  setAppState('welcome');

  const videoElement = document.getElementById('lobster-char');
  if (videoElement && videoElement.tagName === 'VIDEO') {
    // 绉婚櫎 loop 灞炴€э紝璁╂杩庤棰戝彧鎾斁涓€娆?
    videoElement.loop = false;
    // 浣跨敤瑙嗛鑷甫闊抽锛堝彇娑堥潤闊筹級
    videoElement.muted = false;

    // 鐩戝惉瑙嗛鎾斁缁撴潫
    videoElement.onended = () => {
      console.log('[Claw K] Welcome video ended, switching to idle');
      videoElement.loop = true; // 鎭㈠寰幆鎾斁
      videoElement.muted = true; // 鎭㈠闈欓煶锛堝叾浠栫姸鎬佽棰戜笉闇€瑕佸０闊筹級
      videoElement.onended = null; // 绉婚櫎浜嬩欢鐩戝惉
      isFirstLaunch = false;
      setAppState('idle');
    };

    // 纭繚瑙嗛鎾斁锛堝厛灏濊瘯鏈夊０鎾斁锛屽け璐ュ垯闈欓煶鎾斁+TTS鍏滃簳锛?
    videoElement.play().catch(err => {
      console.warn('[瑙嗛鎾斁] 娆㈣繋瑙嗛鏈夊０鎾斁澶辫触锛屽皾璇曢潤闊虫挱鏀?TTS鍏滃簳:', err);
      videoElement.muted = true;
      videoElement.play().catch(err2 => {
        console.warn('[瑙嗛鎾斁] 娆㈣繋瑙嗛鑷姩鎾斁瀹屽叏澶辫触:', err2);
        videoElement.loop = true;
        isFirstLaunch = false;
        setAppState('idle');
      });
      // 闈欓煶鎾斁鎴愬姛鏃讹紝鐢═TS鍏滃簳娆㈣繋璇煶
      playWelcomeAudioFallback();
    });
  }
}

// ===== 鎾斁娆㈣繋璇煶锛堝厹搴曪細瑙嗛鏃犳硶鏈夊０鎾斁鏃朵娇鐢═TS锛?=====
async function playWelcomeAudioFallback() {
  try {
    await playTextToSpeech(currentCharacter.welcomeText);
  } catch (error) {
    console.warn('[榫欒櫨鍔╂墜] 娆㈣繋璇煶TTS鍏滃簳鎾斁澶辫触:', error);
  }
}

// ===== 姘旀场鏄剧ず =====
function showBubble(content, isUserSpeech = false) {
  if (!ENABLE_AVATAR_HEAD_BUBBLE || !speechBubble || !bubbleText) return;

  clearTimeout(bubbleHideTimer);
  speechBubble.style.display = 'block';

  if (isUserSpeech) {
    speechBubble.className = 'speech-bubble user-speech';
    bubbleText.innerHTML = content;
  } else {
    speechBubble.className = 'speech-bubble ai-response';
    // 妫€娴嬫枃浠惰矾寰勫苟杞崲涓哄彲鐐瑰嚮閾炬帴
    bubbleText.innerHTML = linkifyFilePaths(content);
  }

  // 鑷姩闅愯棌
  bubbleHideTimer = setTimeout(() => {
    hideBubble();
  }, BUBBLE_AUTO_HIDE);
}

// 鎵撳瓧鏈烘晥鏋滄樉绀?AI 鍥炲
function showBubbleWithTyping(content) {
  if (!ENABLE_AVATAR_HEAD_BUBBLE || !speechBubble || !bubbleText) return;

  clearTimeout(bubbleHideTimer);
  speechBubble.style.display = 'block';
  speechBubble.className = 'speech-bubble ai-response';
  bubbleText.innerHTML = '';

  let index = 0;
  const typingSpeed = 30; // 姣忎釜瀛楃鐨勫欢杩燂紙姣锛?

  function typeNextChar() {
    if (index < content.length) {
      bubbleText.innerHTML += content.charAt(index);
      index++;
      setTimeout(typeNextChar, typingSpeed);
    } else {
      // 鎵撳瓧瀹屾垚鍚庤拷鍔犳煡鐪嬪叏鏂囨寜閽?
      appendViewTextBtn(content);
      // 鑷姩闅愯棌
      bubbleHideTimer = setTimeout(() => {
        hideBubble();
      }, BUBBLE_AUTO_HIDE);
    }
  }

  typeNextChar();
}

// 甯︽煡鐪嬫枃鏈寜閽殑姘旀场锛堢敤浜庢墦鏂悗灞曠ず锛?
function showBubbleWithViewBtn(fullText, isInterrupted = false) {
  if (!ENABLE_AVATAR_HEAD_BUBBLE || !speechBubble || !bubbleText) return;

  clearTimeout(bubbleHideTimer);
  speechBubble.style.display = 'block';
  speechBubble.className = 'speech-bubble ai-response';

  const preview = fullText.length > 40 ? fullText.substring(0, 40) + '...' : fullText;
  const label = isInterrupted ? '宸叉墦鏂紝鐐瑰嚮鏌ョ湅瀹屾暣鍥炲' : '鐐瑰嚮鏌ョ湅瀹屾暣鍥炲';

  bubbleText.innerHTML = `<span class="bubble-preview">${escapeHtml(preview)}</span>`;
  appendViewTextBtn(fullText, label);

  bubbleHideTimer = setTimeout(() => {
    hideBubble();
  }, BUBBLE_AUTO_HIDE * 2); // 鎵撴柇鍚庣粰鏇撮暱鐨勫睍绀烘椂闂?
}

// 杩藉姞"鏌ョ湅鍏ㄦ枃"鎸夐挳鍒版皵娉″簳閮?
function appendViewTextBtn(fullText, label) {
  if (!fullText || fullText.length < 20) return; // 鐭枃鏈笉闇€瑕佹寜閽?

  const btnWrap = document.createElement('div');
  btnWrap.className = 'view-text-btn-wrap';
  btnWrap.innerHTML = `<button class="view-text-btn">${label || '鏌ョ湅瀹屾暣鏂囨湰'}</button>`;
  bubbleText.appendChild(btnWrap);

  btnWrap.querySelector('.view-text-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openTextViewer(fullText);
  });
}

// 鍏ㄦ枃鏌ョ湅娴眰
function openTextViewer(text) {
  // 绉婚櫎宸叉湁鐨勬诞灞?
  const existing = document.getElementById('text-viewer');
  if (existing) existing.remove();

  const viewer = document.createElement('div');
  viewer.id = 'text-viewer';
  viewer.className = 'text-viewer';
  viewer.innerHTML = `
    <div class="text-viewer-header">
      <span class="text-viewer-title">${escapeHtml(t('chat.title'))}</span>
      <button class="text-viewer-close" id="text-viewer-close">脳</button>
    </div>
    <div class="text-viewer-body">${escapeHtml(text)}</div>
  `;

  document.querySelector('.widget-container').appendChild(viewer);

  viewer.querySelector('#text-viewer-close').addEventListener('click', (e) => {
    e.stopPropagation();
    viewer.classList.add('closing');
    setTimeout(() => viewer.remove(), 250);
  });
}

function hideBubble(delay) {
  if (!ENABLE_AVATAR_HEAD_BUBBLE || !speechBubble) return;

  if (delay) {
    clearTimeout(bubbleHideTimer);
    bubbleHideTimer = setTimeout(() => {
      fadeOutBubble();
    }, delay);
  } else {
    fadeOutBubble();
  }
}

function fadeOutBubble() {
  if (!speechBubble) return;

  speechBubble.style.transition = 'opacity 0.3s ease-out';
  speechBubble.style.opacity = '0';
  setTimeout(() => {
    speechBubble.style.display = 'none';
    speechBubble.style.opacity = '1';
    speechBubble.style.transition = '';
  }, 300);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 娓呯悊 markdown 鏍煎紡绗﹀彿锛?*鍔犵矖**銆?鏂滀綋*銆亊~鍒犻櫎绾縹~ 绛夛級
function initChatHistory() {
  if (!chatHistoryEl) return;

  loadChatHistory();
  renderChatHistory();

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chatHistory = [];
      saveChatHistory();
      renderChatHistory();
    });
  }
}

function normalizeChatRole(rawRole, rawName) {
  const role = String(rawRole || '').trim().toLowerCase();
  if (role === 'user' || role === 'you' || role === 'human' || role === 'operator' || role === 'me') {
    return 'user';
  }
  if (role === 'assistant' || role === 'ai' || role === 'bot' || role === 'agent' || role === 'kelly' || role === 'claw k') {
    return 'assistant';
  }

  const name = String(rawName || '').trim().toLowerCase();
  if (name === 'you' || name === 'me') return 'user';
  return 'assistant';
}

function loadChatHistory() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) {
      chatHistory = [];
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      chatHistory = [];
      return;
    }

    chatHistory = parsed
      .filter((item) => item && typeof item.text === 'string')
      .map((item) => ({
        ...item,
        role: normalizeChatRole(item.role, item.name),
        name: String(item.name || '').trim()
      }))
      .slice(-CHAT_HISTORY_LIMIT);
  } catch (error) {
    console.warn('[Chat History] Load failed:', error);
    chatHistory = [];
  }
}

function saveChatHistory() {
  try {
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(chatHistory.slice(-CHAT_HISTORY_LIMIT)));
  } catch (error) {
    console.warn('[Chat History] Save failed:', error);
  }
}

function formatChatTime(ts) {
  const date = ts ? new Date(ts) : new Date();
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function renderChatMessageContent(message) {
  const safeText = escapeHtml(message.text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>');

  if (message.role === 'assistant') {
    return linkifyFilePaths(safeText);
  }
  return safeText;
}

function renderChatHistory() {
  if (!chatHistoryEl) return;

  if (!chatHistory.length) {
    chatHistoryEl.innerHTML = `<div class="chat-empty" id="chat-empty">${escapeHtml(t('chat.empty'))}</div>`;
    return;
  }

  chatHistoryEl.innerHTML = chatHistory.map((message) => {
    const normalizedRole = normalizeChatRole(message.role, message.name);
    const roleClass = normalizedRole === 'user' ? 'user' : 'assistant';
    const roleName = escapeHtml(message.name || (normalizedRole === 'user' ? 'You' : currentCharacter.name));
    const timeText = formatChatTime(message.ts);
    const contentHtml = renderChatMessageContent({ ...message, role: normalizedRole });

    return `
      <div class="chat-message ${roleClass}">
        <div class="chat-message-meta">
          <span class="chat-message-role">${roleName}</span>
          <span class="chat-message-time">${timeText}</span>
        </div>
        <div class="chat-message-content">${contentHtml}</div>
      </div>
    `;
  }).join('');

  chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
}

function addChatMessage(role, text, options = {}) {
  const normalizedText = (text || '').trim();
  if (!normalizedText) return;

  const roleValue = role === 'user' ? 'user' : 'assistant';
  const displayName = options.name || (roleValue === 'user' ? 'You' : currentCharacter.name);

  chatHistory.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: roleValue,
    name: displayName,
    text: normalizedText,
    ts: Date.now()
  });

  if (chatHistory.length > CHAT_HISTORY_LIMIT) {
    chatHistory = chatHistory.slice(-CHAT_HISTORY_LIMIT);
  }

  saveChatHistory();
  renderChatHistory();
}

function cleanMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // **鍔犵矖**
    .replace(/\*(.+?)\*/g, '$1')      // *鏂滀綋*
    .replace(/~~(.+?)~~/g, '$1')      // ~~鍒犻櫎绾縹~
    .replace(/`(.+?)`/g, '$1');       // `浠ｇ爜`
}

// 妫€娴嬫枃鏈腑鐨勬枃浠惰矾寰勫苟杞崲涓哄彲鐐瑰嚮閾炬帴
function linkifyFilePaths(text) {
  if (!text) return text;

  // 鏂囦欢璺緞姝ｅ垯琛ㄨ揪寮忥紙鏇村鏉剧殑鍖归厤锛?
  // 鍖归厤: ~/xxx, /Users/xxx, /home/xxx 绛?
  // 鏀寔涓枃銆佺┖鏍笺€佸悇绉嶇壒娈婂瓧绗?
  const filePathRegex = /(~\/[^\s`'"<>|]+|\/(?:Users|home|System|Applications|Library|tmp|var|etc)[^\s`'"<>|]*)/g;

  return text.replace(filePathRegex, (match) => {
    // 娓呯悊鏈熬鐨勬爣鐐圭鍙?
    let cleanPath = match.replace(/[銆傦紝,锛?锛?锛?锛?\]]+$/g, '');

    // 鍒涘缓鍙偣鍑荤殑閾炬帴
    return `<span class="file-path" data-path="${escapeHtml(cleanPath)}" title="鐐瑰嚮鍦?Finder 涓樉绀?>${escapeHtml(cleanPath)}</span>`;
  });
}

// 鎵撴柇褰撳墠浠诲姟锛堟煡璇㈡垨鎾斁锛?
function interruptCurrentTask() {
  console.log('[榫欒櫨鍔╂墜] 鎵撴柇褰撳墠浠诲姟');

  // 璁剧疆涓柇鏍囧織
  isProcessing = false;

  // 涓柇 TTS
  interruptTTS();

  // 娓呯┖闊抽闃熷垪
  audioQueue = [];
  isPlayingQueue = false;
  streamingTextBuffer = '';

  // 閲嶇疆鐘舵€?
  setAppState('idle');
  showBubble('\u5df2\u6253\u65ad');
}

// 鍒濆鍖栨枃浠惰矾寰勭偣鍑讳簨浠剁洃鍚?
function initFilePathClickHandler() {
  document.addEventListener('click', async (e) => {
    const pathElement = e.target.closest('.file-path');
    if (pathElement) {
      e.stopPropagation();
      const filePath = pathElement.dataset.path;

      console.log('[File] 鐐瑰嚮鏂囦欢璺緞:', filePath);

      try {
        const result = await window.electronAPI.file.showInFolder(filePath);
        if (result.success) {
          // 鏄剧ず鎴愬姛鍙嶉
          pathElement.classList.add('clicked');
          setTimeout(() => pathElement.classList.remove('clicked'), 500);
        } else {
          console.warn('[File] 鎵撳紑澶辫触:', result.error);
          // 鏄剧ず閿欒鎻愮ず
          showBubble(`鏃犳硶鎵撳紑璺緞: ${result.error}`);
        }
      } catch (err) {
        console.error('[File] 璋冪敤澶辫触:', err);
      }
    }
  });
}

// 鍒濆鍖栨枃浠惰矾寰勭偣鍑讳簨浠剁洃鍚?
function initFilePathClickHandler() {
  document.addEventListener('click', async (e) => {
    const pathElement = e.target.closest('.file-path');
    if (pathElement) {
      e.stopPropagation();
      const filePath = pathElement.dataset.path;

      console.log('[File] 鐐瑰嚮鏂囦欢璺緞:', filePath);

      try {
        const result = await window.electronAPI.file.showInFolder(filePath);
        if (result.success) {
          // 鏄剧ず鎴愬姛鍙嶉
          pathElement.classList.add('clicked');
          setTimeout(() => pathElement.classList.remove('clicked'), 500);
        } else {
          console.warn('[File] 鎵撳紑澶辫触:', result.error);
          // 鏄剧ず閿欒鎻愮ず
          showBubble(`鏃犳硶鎵撳紑璺緞: ${result.error}`);
        }
      } catch (err) {
        console.error('[File] 璋冪敤澶辫触:', err);
      }
    }
  });
}

// ===== Deepgram 浜嬩欢鐩戝惉 =====
function initDeepgramListeners() {
  window.electronAPI.deepgram.removeAllListeners();

  window.electronAPI.deepgram.onConnected(() => {
    console.log('[Claw K] Deepgram connected');
  });

  window.electronAPI.deepgram.onTranscript((data) => {
    const { transcript, isFinal } = data;
    const transcriptType = isFinal ? 'final' : 'partial';
    console.log(`[Claw K] Transcript [${transcriptType}]: "${transcript}"`);

    if (isFinal) {
      if (transcript.trim().length > 0) {
        // 绱Н璇嗗埆缁撴灉
        if (accumulatedTranscript.length > 0) {
          accumulatedTranscript += ' ' + transcript.trim();
        } else {
          accumulatedTranscript = transcript.trim();
        }

        // 鏄剧ず绱Н鐨勭敤鎴疯闊?
        showBubble('馃帳 ' + escapeHtml(accumulatedTranscript), true);

        // 娓呴櫎涔嬪墠鐨勬墽琛屽畾鏃跺櫒
        clearTimeout(executeTimer);

        // 寤惰繜鎵ц锛氱瓑寰呯敤鎴峰仠椤垮悗鎵ц鍛戒护锛坲tterance_end 浜嬩欢鍙彁鍓嶈Е鍙戯級
        executeTimer = setTimeout(() => {
          console.log('[Claw K] Speech pause timeout, executing command');
          clearInterval(countdownInterval);
          const commandToExecute = accumulatedTranscript;
          accumulatedTranscript = '';

          stopRecording().then(() => {
            handleCommand(commandToExecute);
          });
        }, EXECUTE_DELAY);

        // 鍊掕鏃舵樉绀?
        let countdown = Math.ceil(EXECUTE_DELAY / 1000);
        clearInterval(countdownInterval);
        statusHint.textContent = `${countdown}\u79d2\u540e\u6267\u884c... \u7ee7\u7eed\u8bf4\u8bdd\u53ef\u91cd\u7f6e`;
        countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            statusHint.textContent = `${countdown}\u79d2\u540e\u6267\u884c... \u7ee7\u7eed\u8bf4\u8bdd\u53ef\u91cd\u7f6e`;
          } else {
            clearInterval(countdownInterval);
          }
        }, 1000);
      }
    } else {
      // 瀹炴椂鏄剧ず璇嗗埆涓殑鏂囧瓧
      if (transcript.trim().length > 0) {
        statusHint.textContent = transcript + '...';
      }
    }
  });

  // 鐩戝惉璇煶缁撴潫浜嬩欢锛圖eepgram 妫€娴嬪埌鐢ㄦ埛鍋滄璇磋瘽锛?
  window.electronAPI.deepgram.onUtteranceEnd(() => {
    console.log('[榫欒櫨鍔╂墜] 妫€娴嬪埌璇煶缁撴潫');
    if (accumulatedTranscript.trim().length > 0) {
      // 鐢ㄦ埛鏈夋湁鏁堣闊充笖宸插仠姝㈣璇濓紝绔嬪嵆鎵ц
      clearTimeout(executeTimer);
      clearInterval(countdownInterval);
      console.log('[Claw K] Utterance ended, executing command now');
      const commandToExecute = accumulatedTranscript;
      accumulatedTranscript = '';
      stopRecording().then(() => {
        handleCommand(commandToExecute);
      });
    }
  });

  window.electronAPI.deepgram.onError((error) => {
    console.error('[榫欒櫨鍔╂墜] Deepgram 閿欒:', error);
    stopRecording();
    setAppState('idle');
    showBubble('璇嗗埆鍑洪敊浜嗭紝鍐嶇偣鎴戣瘯璇曞惂');
  });

  window.electronAPI.deepgram.onClosed(() => {
    console.log('[榫欒櫨鍔╂墜] Deepgram 杩炴帴鍏抽棴');
  });
}

// ===== 涓柇 TTS =====
// 娴佸紡 TTS 闊抽闃熷垪
let audioQueue = [];
let isPlayingQueue = false;
let streamingTextBuffer = '';
let browserTTSUtterance = null;

function stopBrowserSpeech() {
  if (window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore cancel errors
    }
  }
  browserTTSUtterance = null;
}

function speakWithBrowserTTS(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      resolve(false);
      return;
    }

    try {
      stopBrowserSpeech();
      const utterance = new window.SpeechSynthesisUtterance(String(text || ''));
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => {
        if (browserTTSUtterance === utterance) browserTTSUtterance = null;
        resolve(true);
      };
      utterance.onerror = () => {
        if (browserTTSUtterance === utterance) browserTTSUtterance = null;
        resolve(false);
      };
      browserTTSUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      resolve(false);
    }
  });
}

function interruptTTS() {
  // 鍋滄褰撳墠鎾斁
  if (audioPlayer) {
    try {
      audioPlayer.onended = null;
      audioPlayer.pause();
    } catch (e) { /* ignore */ }
    audioPlayer = null;
  }
  // 娓呯┖闃熷垪
  audioQueue = [];
  isPlayingQueue = false;
  streamingTextBuffer = '';
  stopBrowserSpeech();
  isSpeaking = false;
  // 閫氱煡涓昏繘绋嬪仠姝?TTS 鐢熸垚
  window.electronAPI.tts.stop();
}

// ===== 娴佸紡 TTS 鍒濆鍖?=====
function initStreamingTTS() {
  // 鐩戝惉闊抽鍧?
  window.electronAPI.deepgram.onAudioChunk(async (data) => {
    console.log(`[TTS] 鏀跺埌闊抽鍧?#${data.sentenceId}`);

    audioQueue.push(data);

    if (!isPlayingQueue) {
      await processAudioQueue();
    }
  });

  // 鐩戝惉棣栦釜鍙ュ瓙锛堝垏鎹㈢姸鎬侊紝浣嗕笉鎻愬墠鏄剧ず鏂囨湰锛?
  window.electronAPI.deepgram.onFirstSentence((data) => {
    console.log('[TTS] First sentence received, preparing playback');
    // 鍒囨崲鍒?speaking 鐘舵€?
    if (appState === 'thinking') {
      setAppState('speaking');
    }
    // 涓嶆彁鍓嶆樉绀烘枃鏈紝绛夐煶棰戞挱鏀炬椂鍐嶆樉绀?
  });
}

// 澶勭悊闊抽闃熷垪
async function processAudioQueue() {
  if (isPlayingQueue || audioQueue.length === 0) return;

  isPlayingQueue = true;

  while (audioQueue.length > 0) {
    const item = audioQueue.shift();

    // 鎾斁闊抽锛堥煶棰戝紑濮嬫挱鏀炬椂鎵嶆樉绀烘枃鏈級
    await playAudioChunk(item.audio, item.text);
  }

  isPlayingQueue = false;
  isSpeaking = false;

  // TTS 鎾斁瀹屾瘯锛岃繘鍏ヨ拷闂ā寮?
  if (appState === 'speaking') {
    isProcessing = false;
    setAppState('followup');
    await startRecording();
  }
}

// 鎾斁鍗曚釜闊抽鍧楋紙闊抽寮€濮嬫挱鏀炬椂鎵嶆樉绀哄搴旀枃鏈級
function playAudioChunk(audioBase64, text) {
  return new Promise((resolve) => {
    const audioDataUrl = 'data:audio/mp3;base64,' + audioBase64;
    const audio = new Audio(audioDataUrl);

    // 闊抽寮€濮嬫挱鏀炬椂鎵嶆樉绀烘枃鏈?
    audio.onplay = () => {
      // 杩藉姞鏂囨湰鍒扮紦鍐插尯骞舵洿鏂版樉绀?
      if (streamingTextBuffer && !streamingTextBuffer.includes(text)) {
        streamingTextBuffer += text;
      } else {
        streamingTextBuffer = text;
      }
      showBubble(escapeHtml(streamingTextBuffer));
    };

    audio.onended = () => {
      resolve();
    };

    audio.onerror = () => {
      resolve();
    };

    audio.play().catch(() => resolve());

    audioPlayer = audio;
  });
}

// ===== 褰曢煶鎺у埗 =====
async function startRecording() {
  if (isRecording || isProcessing) return;

  try {
    interruptTTS();

    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000
      }
    });

    const result = await window.electronAPI.deepgram.startListening();
    if (!result.success) {
      showBubble('\u8bed\u97f3\u8bc6\u522b\u542f\u52a8\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u914d\u7f6e');
      setAppState('idle');
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
      return;
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });

    await audioContext.audioWorklet.addModule('audio-processor.js');
    const source = audioContext.createMediaStreamSource(audioStream);
    audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

    audioWorkletNode.port.onmessage = (event) => {
      if (isRecording && event.data) {
        const uint8 = new Uint8Array(event.data);
        window.electronAPI.deepgram.sendAudio(uint8);
      }
    };

    source.connect(audioWorkletNode);
    isRecording = true;

  } catch (error) {
    console.error('[榫欒櫨鍔╂墜] 褰曢煶澶辫触:', error);
    setAppState('idle');
    if (error.name === 'NotAllowedError') {
      showBubble('璇峰厑璁歌闂害鍏嬮鍚庡啀鐐规垜');
    } else if (error.name === 'NotFoundError') {
      showBubble('娌℃娴嬪埌楹﹀厠椋庡摝');
    } else {
      showBubble('褰曢煶鍚姩澶辫触: ' + error.message);
    }
  }
}

async function stopRecording() {
  if (!isRecording) return;

  isRecording = false;

  // 娓呴櫎鎵ц瀹氭椂鍣ㄥ拰鍊掕鏃?
  clearTimeout(executeTimer);
  clearInterval(countdownInterval);
  executeTimer = null;

  if (audioWorkletNode) {
    audioWorkletNode.disconnect();
    try { audioWorkletNode.port.close(); } catch (e) {}
    audioWorkletNode = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    await audioContext.close();
    audioContext = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }

  await window.electronAPI.deepgram.stopListening();
}

// ===== 鐐瑰嚮榫欒櫨 鈫?寮€濮嬭亞鍚?=====
async function onLobsterClick() {
  // speaking 鐘舵€佷笅鍏佽鎵撴柇 鈫?鐩存帴杩涘叆鑱嗗惉锛堟棤闇€鍐嶆鐐瑰嚮锛?
  if (appState === 'speaking') {
    interruptTTS();
    isProcessing = false;
    if (lastAIResponse) {
      showBubbleWithViewBtn(lastAIResponse, true);
    }
    // 鎵撴柇鍚庣洿鎺ュ紑濮嬭亞鍚?
    accumulatedTranscript = '';
    setAppState('listening');
    await startRecording();
    return;
  }

  // thinking 鐘舵€佷笅鍏佽鎵撴柇 鈫?鍋滄褰撳墠浠诲姟
  if (appState === 'thinking') {
    console.log('[榫欒櫨鍔╂墜] 鎵撴柇鏌ヨ浠诲姟');
    interruptCurrentTask();
    return;
  }

  if (isProcessing) return;

  if (appState === 'listening' || appState === 'followup') {
    // 鍐嶆鐐瑰嚮 鈫?鍋滄鑱嗗惉
    clearTimeout(executeTimer);
    accumulatedTranscript = '';
    await stopRecording();
    setAppState('idle');
    return;
  }

  // 娓呯┖涔嬪墠鐨勭疮绉枃鏈?
  accumulatedTranscript = '';

  // 婵€娲诲姩鐢?
  lobsterChar.classList.add('active');
  setTimeout(() => lobsterChar.classList.remove('active'), 600);

  // 寮€濮嬭亞鍚?
  hideBubble();
  setAppState('listening');
  await startRecording();
}

// ===== 澶勭悊鍛戒护 =====
async function handleCommand(command) {
  const normalizedCommand = (command || '').trim();
  if (!normalizedCommand || isProcessing) return;

  addChatMessage('user', normalizedCommand, { name: 'You' });

  const asyncKeywords = [
    'later',
    'after this',
    '\u7a0d\u540e',
    '\u5f85\u4f1a',
    '\u67e5\u5b8c\u544a\u8bc9\u6211',
    '\u5b8c\u6210\u540e\u544a\u8bc9\u6211',
    '\u5904\u7406\u5b8c\u544a\u8bc9\u6211'
  ];
  const isAsyncTask = asyncKeywords.some((keyword) => normalizedCommand.toLowerCase().includes(keyword.toLowerCase()));

  const goodbyeKeywords = ['bye', 'goodbye', '\u518d\u89c1', '\u62dc\u62dc', '\u9000\u51fa', '\u5173\u95ed'];
  const lowerCommand = normalizedCommand.toLowerCase();
  const isGoodbye = goodbyeKeywords.some((keyword) => lowerCommand.includes(keyword.toLowerCase()));

  if (isAsyncTask) {
    await handleAsyncTask(normalizedCommand);
  } else {
    await handleSyncTask(normalizedCommand, isGoodbye);
  }
}

async function handleAsyncTask(command) {
  isProcessing = true;

  try {
    const result = await window.electronAPI.task.create(command);

    if (result.success) {
      console.log(`[OpenClaw Assistant] Async task created: ${result.taskId}`);

      const feedbackMessages = [
        'Got it. I will process this and update you shortly.',
        "Received. I'm on it and will report back when done.",
        "Understood. I'll handle it first, then reply with results.",
        "No problem. I'll complete this and notify you."
      ];
      const feedback = feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)];

      showBubble(feedback);
      addChatMessage('assistant', feedback, { name: currentCharacter.name });
      await playTextToSpeech(feedback);

      setAppState('idle');
    }
  } catch (error) {
    console.error('[OpenClaw Assistant] Async task creation failed:', error);
    const failText = 'Task creation failed, please retry.';
    showBubble(failText);
    addChatMessage('assistant', failText, { name: currentCharacter.name });
    setAppState('idle');
  } finally {
    isProcessing = false;
  }
}

async function handleSyncTask(command, isGoodbye) {
  isProcessing = true;

  setAppState('thinking');

  const prompts = getThinkingPrompts();
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  showBubble(randomPrompt);

  // 閲嶇疆娴佸紡 TTS 鐘舵€?
  streamingTextBuffer = '';
  audioQueue = [];
  isPlayingQueue = false;
  isSpeaking = true;  // 鏍囪姝ｅ湪鎾斁

  try {
    const result = await window.electronAPI.executeCommand(command);

    // 娓呯悊 markdown 绗﹀彿
    const cleanedMessage = cleanMarkdown(result.message);

    // 缂撳瓨 AI 鍥炲锛堢敤浜庢墦鏂悗鏌ョ湅锛?
    lastAIResponse = cleanedMessage;
    addChatMessage('assistant', cleanedMessage, { name: currentCharacter.name });

    // 娴佸紡 TTS 宸茬粡鍦ㄥ悗鍙版挱鏀撅紙鐢?initStreamingTTS 鐩戝惉浜嬩欢椹卞姩锛?
    // 濡傛灉娌℃湁鏀跺埌闊抽鍧楋紙渚嬪 Clawdbot 杩斿洖绌猴級锛屼娇鐢ㄤ紶缁?TTS 浣滀负澶囬€?
    if (audioQueue.length === 0 && !isPlayingQueue) {
      // 娌℃湁鏀跺埌娴佸紡闊抽锛屼娇鐢ㄤ紶缁?TTS
      setAppState('speaking');
      showBubbleWithViewBtn(cleanedMessage);
      await playTextToSpeech(cleanedMessage);

      // TTS 鎾斁瀹屽悗锛屽啀鏄剧ず鏂囧瓧
      showBubbleWithTyping(escapeHtml(cleanedMessage));

      // 濡傛灉鏄憡鍒锛屾挱鏀惧憡鍒姩鐢?
      if (isGoodbye) {
        setAppState('goodbye');
        isProcessing = false;
        setTimeout(() => {
          setAppState('idle');
        }, 3000);
      } else {
        // 杩涘叆杩介棶妯″紡
        isProcessing = false;
        setAppState('followup');
        await startRecording();
      }
    }
    // 濡傛灉鏄憡鍒锛岀壒娈婂鐞?
    if (isGoodbye) {
      setAppState('goodbye');
      isProcessing = false;
      setTimeout(() => {
        setAppState('idle');
      }, 3000);
    }
    // 鍚﹀垯娴佸紡 TTS 浼氬湪 processAudioQueue 涓嚜鍔ㄨ繘鍏?followup 妯″紡

  } catch (error) {
    console.error('[OpenClaw Assistant] Command handling failed:', error);
    const errorText = 'Something went wrong. Please try again.';
    showBubble(errorText);
    addChatMessage('assistant', errorText, { name: currentCharacter.name });
    setAppState('idle');
    isProcessing = false;
    isSpeaking = false;
  }
}



// ===== TTS 鎾斁 =====
async function playTextToSpeech(text) {
  if (isSpeaking) interruptTTS();

  try {
    isSpeaking = true;
    const result = await window.electronAPI.deepgram.textToSpeech(text);

    if (!result.success) {
      console.warn('[榫欒櫨鍔╂墜] TTS 澶辫触:', result.error);
      const spoken = await speakWithBrowserTTS(text);
      isSpeaking = false;
      if (!spoken) {
        audioPlayer = null;
      }
      return;
    }

    const audioDataUrl = 'data:audio/mp3;base64,' + result.audio;

    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }

    audioPlayer = new Audio(audioDataUrl);

    return new Promise((resolve) => {
      audioPlayer.onended = () => {
        isSpeaking = false;
        audioPlayer = null;
        resolve();
      };

      audioPlayer.onerror = (e) => {
        console.error('[榫欒櫨鍔╂墜] TTS 鎾斁閿欒:', e);
        isSpeaking = false;
        audioPlayer = null;
        resolve();
      };

      audioPlayer.play().catch((err) => {
        console.error('[榫欒櫨鍔╂墜] TTS play() 澶辫触:', err);
        isSpeaking = false;
        audioPlayer = null;
        resolve();
      });
    });
  } catch (error) {
    console.error('[榫欒櫨鍔╂墜] TTS 澶辫触:', error);
    const spoken = await speakWithBrowserTTS(text);
    isSpeaking = false;
    if (!spoken) {
      audioPlayer = null;
    }
  }
}

// ===== 闊宠壊閫夋嫨 =====
const voicePanel = document.getElementById('voice-panel');
const voiceList = document.getElementById('voice-list');
const voiceSelectBtn = document.getElementById('voice-select-btn');
const closeVoicePanel = document.getElementById('close-voice-panel');
const addCustomVoiceBtn = document.getElementById('add-custom-voice-btn');
const customVoiceForm = document.getElementById('custom-voice-form');
const customVoiceIdInput = document.getElementById('custom-voice-id');
const customVoiceNameInput = document.getElementById('custom-voice-name');
const customVoiceDescInput = document.getElementById('custom-voice-desc');
const customVoiceLangSelect = document.getElementById('custom-voice-lang');
const customVoiceError = document.getElementById('custom-voice-form-error');
const customVoiceSaveBtn = document.getElementById('custom-voice-save-btn');
const customVoiceCancelBtn = document.getElementById('custom-voice-cancel-btn');
const CUSTOM_VOICE_STORAGE_KEY = 'openclaw_custom_voices_v1';

// MiniMax 绯荤粺闊宠壊鍒楄〃锛堜腑鏂?+ 鑻辨枃锛?
const VOICE_OPTIONS = [
  // ===== 鎺ㄨ崘 =====
  { group: '鎺ㄨ崘', lang: 'all', voices: [
    { id: 'Lovely_Girl',         icon: 'mdi:ribbon', name: '鍙埍濂冲',     desc: '鐢滅編鍙埍', gender: 'female' },
    { id: 'Lively_Girl',         icon: 'mdi:star-four-points', name: '娲绘臣濂冲',     desc: '鍏冩皵婊℃弧', gender: 'female' },
    { id: 'Decent_Boy',          icon: 'mdi:account', name: '闃冲厜鐢峰',     desc: '娓呯埥骞插噣', gender: 'male' },
    { id: 'Friendly_Person',     icon: 'mdi:emoticon-happy', name: '鍙嬪杽浜哄＋',     desc: '浜插垏鑷劧', gender: 'female' },
  ]},
  // ===== 涓枃濂冲０ =====
  { group: '涓枃濂冲０', lang: 'zh', voices: [
    { id: 'Chinese (Mandarin)_Cute_Spirit',       icon: 'mdi:face-woman-shimmer', name: '鍙埍绮剧伒',   desc: '鐏靛姩鍙埍', gender: 'female' },
    { id: 'Chinese (Mandarin)_Warm_Girl',         icon: 'mdi:flower', name: '娓╂殩濂冲',   desc: '娓╂煍娌绘剤', gender: 'female' },
    { id: 'Chinese (Mandarin)_Soft_Girl',         icon: 'mdi:cloud', name: 'Soft Girl',   desc: 'Soft and delicate', gender: 'female' },
    { id: 'Chinese (Mandarin)_Crisp_Girl',        icon: 'mdi:bell', name: '娓呰剢濂冲',   desc: '娓呬寒鑴嗗', gender: 'female' },
    { id: 'Chinese (Mandarin)_BashfulGirl',       icon: 'mdi:emoticon-blush', name: '瀹崇緸濂冲',   desc: '鍚搫瀹崇緸', gender: 'female' },
    { id: 'Chinese (Mandarin)_Warm_Bestie',       icon: 'mdi:heart', name: '鏆栧績闂鸿湝',   desc: '浜插垏娓╂殩', gender: 'female' },
    { id: 'Chinese (Mandarin)_IntellectualGirl',  icon: 'mdi:book-open-page-variant', name: 'Intellectual Girl',   desc: 'Intellectual and elegant', gender: 'female' },
    { id: 'Chinese (Mandarin)_Sweet_Lady',        icon: 'mdi:flower-rose', name: '鐢滅編濂冲＋',   desc: '鎴愮啛鐢滅編', gender: 'female' },
    { id: 'Chinese (Mandarin)_Mature_Woman',      icon: 'mdi:account-tie', name: 'Mature Woman',   desc: 'Calm and steady', gender: 'female' },
    { id: 'Chinese (Mandarin)_News_Anchor',       icon: 'mdi:television', name: '鏂伴椈涓绘挱',   desc: '鏍囧噯鎾煶', gender: 'female' },
    { id: 'Arrogant_Miss',                        icon: 'mdi:crown', name: '鍌插▏灏忓',   desc: '楂樺喎鍌插▏', gender: 'female' },
    { id: 'Sweet_Girl_2',                         icon: 'mdi:candy', name: '鐢滅敎濂冲',   desc: '鐢滆湝娓╂煍', gender: 'female' },
    { id: 'Exuberant_Girl',                       icon: 'mdi:party-popper', name: '鐑儏濂冲',   desc: '娲诲姏鍥涘皠', gender: 'female' },
    { id: 'Inspirational_girl',                   icon: 'mdi:sparkles', name: 'Inspirational Girl',   desc: 'Positive energy', gender: 'female' },
    { id: 'Calm_Woman',                           icon: 'mdi:yoga', name: 'Calm Woman',   desc: 'Calm and soothing', gender: 'female' },
    { id: 'Wise_Woman',                           icon: 'mdi:book', name: 'Wise Woman',   desc: 'Mature and professional', gender: 'female' },
    { id: 'Imposing_Manner',                      icon: 'mdi:chess-queen', name: '姘斿満濂崇帇',   desc: '闇告皵鍗佽冻', gender: 'female' },
  ]},
  // ===== 涓枃鐢峰０ =====
  { group: '涓枃鐢峰０', lang: 'zh', voices: [
    { id: 'Chinese (Mandarin)_Gentle_Youth',       icon: 'mdi:weather-night', name: '娓╂煍灏戝勾',   desc: '娓╂煍缁嗚吇', gender: 'male' },
    { id: 'Chinese (Mandarin)_Straightforward_Boy',icon: 'mdi:arm-flex', name: '鐩寸埥鐢峰',   desc: '鐩寸巼骞茶剢', gender: 'male' },
    { id: 'Chinese (Mandarin)_Pure-hearted_Boy',   icon: 'mdi:heart-outline', name: '绾湡鐢峰',   desc: '绾噣娓呮緢', gender: 'male' },
    { id: 'Chinese (Mandarin)_Gentleman',          icon: 'mdi:hat-fedora', name: '缁呭＋',       desc: '鍎掗泤鏈夌ぜ', gender: 'male' },
    { id: 'Chinese (Mandarin)_Male_Announcer',     icon: 'mdi:microphone', name: '鐢锋挱闊冲憳',   desc: '娴戝帤鎾煶', gender: 'male' },
    { id: 'Chinese (Mandarin)_Radio_Host',         icon: 'mdi:radio', name: '鐢靛彴涓绘寔',   desc: '娣卞鐢靛彴', gender: 'male' },
    { id: 'Chinese (Mandarin)_Reliable_Executive', icon: 'mdi:tie', name: '闈犺氨楂樼',   desc: '绋抽噸涓撲笟', gender: 'male' },
    { id: 'Young_Knight',                          icon: 'mdi:sword-cross', name: 'Young Knight',   desc: 'Youthful spirit', gender: 'male' },
    { id: 'Casual_Guy',                            icon: 'mdi:sunglasses', name: 'Casual Guy',   desc: 'Relaxed style', gender: 'male' },
    { id: 'Patient_Man',                           icon: 'mdi:tree', name: '鑰愬績鐢峰＋',   desc: '娓╁拰鑰愬績', gender: 'male' },
    { id: 'Deep_Voice_Man',                        icon: 'mdi:microphone-variant', name: '浣庢矇鐢峰０',   desc: '娴戝帤鏈夊姏', gender: 'male' },
    { id: 'Determined_Man',                        icon: 'mdi:target', name: '鍧氭瘏鐢峰＋',   desc: '鏋滄柇鍧氬畾', gender: 'male' },
    { id: 'Elegant_Man',                           icon: 'mdi:glass-wine', name: '浼橀泤鐢峰＋',   desc: '鍎掗泤绮捐嚧', gender: 'male' },
    { id: 'Robot_Armor',                           icon: 'mdi:robot', name: 'Robot Armor',   desc: 'Robotic style', gender: 'male' },
  ]},
  // ===== 鑻辨枃濂冲０ =====
  { group: 'English Female', lang: 'en', voices: [
    { id: 'English_expressive_narrator',    icon: 'mdi:book-open', name: 'Narrator',       desc: 'Expressive storyteller', gender: 'female' },
    { id: 'English_radiant_girl',           icon: 'mdi:star-four-points', name: 'Radiant Girl',   desc: 'Bright and cheerful', gender: 'female' },
    { id: 'English_compelling_lady',        icon: 'mdi:briefcase', name: 'Compelling Lady',desc: 'Professional tone', gender: 'female' },
    { id: 'English_sweet_lady',             icon: 'mdi:flower', name: 'Sweet Lady',     desc: 'Gentle and warm', gender: 'female' },
    { id: 'English_warm_woman',             icon: 'mdi:coffee', name: 'Warm Woman',     desc: 'Comforting voice', gender: 'female' },
    { id: 'English_cute_girl',              icon: 'mdi:ribbon', name: 'Cute Girl',      desc: 'Adorable tone', gender: 'female' },
    { id: 'English_lively_girl',            icon: 'mdi:party-popper', name: 'Lively Girl',    desc: 'Energetic vibe', gender: 'female' },
    { id: 'English_confident_woman',        icon: 'mdi:account-tie', name: 'Confident Woman',desc: 'Strong presence', gender: 'female' },
  ]},
  // ===== 鑻辨枃鐢峰０ =====
  { group: 'English Male', lang: 'en', voices: [
    { id: 'English_magnetic_male',          icon: 'mdi:microphone', name: 'Magnetic Male',  desc: 'Deep and rich', gender: 'male' },
    { id: 'English_calm_man',               icon: 'mdi:yoga', name: 'Calm Man',       desc: 'Soothing voice', gender: 'male' },
    { id: 'English_gentle_man',             icon: 'mdi:hat-fedora', name: 'Gentleman',      desc: 'Refined tone', gender: 'male' },
    { id: 'English_casual_guy',             icon: 'mdi:sunglasses', name: 'Casual Guy',     desc: 'Relaxed style', gender: 'male' },
    { id: 'English_young_man',              icon: 'mdi:account', name: 'Young Man',      desc: 'Youthful energy', gender: 'male' },
    { id: 'English_professional_man',       icon: 'mdi:tie', name: 'Professional',   desc: 'Business tone', gender: 'male' },
    { id: 'English_storyteller',            icon: 'mdi:book-open-page-variant', name: 'Storyteller',    desc: 'Narrative voice', gender: 'male' },
    { id: 'English_friendly_man',           icon: 'mdi:emoticon-happy', name: 'Friendly Man',   desc: 'Approachable', gender: 'male' },
  ]},
];

let currentSelectedVoice = 'Lovely_Girl';
let currentFilter = 'all'; // all | zh | en
let previewingVoice = null;
let customVoices = [];

function normalizeCustomVoice(rawVoice) {
  if (!rawVoice || typeof rawVoice !== 'object') return null;

  const id = String(rawVoice.id || '').trim();
  if (!id) return null;

  const langRaw = String(rawVoice.lang || 'all').toLowerCase();
  const lang = ['all', 'zh', 'en'].includes(langRaw) ? langRaw : 'all';

  return {
    id,
    icon: rawVoice.icon || 'mdi:account-voice',
    name: String(rawVoice.name || id).trim() || id,
    desc: String(rawVoice.desc || 'Custom voice').trim() || 'Custom voice',
    gender: rawVoice.gender === 'male' ? 'male' : 'female',
    lang,
    custom: true
  };
}

function loadCustomVoices() {
  try {
    const raw = localStorage.getItem(CUSTOM_VOICE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    const list = [];

    for (const item of parsed) {
      const normalized = normalizeCustomVoice(item);
      if (!normalized) continue;
      if (seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      list.push(normalized);
    }

    return list;
  } catch (error) {
    console.warn('[Voice] load custom voices failed:', error);
    return [];
  }
}

function saveCustomVoices() {
  try {
    localStorage.setItem(CUSTOM_VOICE_STORAGE_KEY, JSON.stringify(customVoices));
  } catch (error) {
    console.warn('[Voice] save custom voices failed:', error);
  }
}

function getAllVoiceGroups() {
  const baseGroups = VOICE_OPTIONS.map((group) => ({
    group: group.group,
    lang: group.lang,
    voices: [...group.voices]
  }));

  if (customVoices.length > 0) {
    baseGroups.unshift({
      group: 'Custom',
      lang: 'all',
      voices: [...customVoices]
    });
  }

  return baseGroups;
}

function shouldShowVoiceInFilter(voice, groupLang) {
  if (currentFilter === 'all') return true;

  if (groupLang !== 'all') {
    return groupLang === currentFilter;
  }

  const voiceLang = String(voice.lang || 'all').toLowerCase();
  return voiceLang === 'all' || voiceLang === currentFilter;
}

function findVoiceById(voiceId) {
  const allGroups = getAllVoiceGroups();
  for (const group of allGroups) {
    const voice = group.voices.find((item) => item.id === voiceId);
    if (voice) {
      return voice;
    }
  }
  return null;
}

function setCustomVoiceFormError(message = '') {
  if (!customVoiceError) return;
  customVoiceError.textContent = message;
}

function resetCustomVoiceForm() {
  if (customVoiceIdInput) customVoiceIdInput.value = '';
  if (customVoiceNameInput) customVoiceNameInput.value = '';
  if (customVoiceDescInput) customVoiceDescInput.value = '';
  if (customVoiceLangSelect) customVoiceLangSelect.value = 'all';
  setCustomVoiceFormError('');
}

function toggleCustomVoiceForm(show) {
  if (!customVoiceForm) return;

  if (show) {
    customVoiceForm.classList.remove('hidden');
    setCustomVoiceFormError('');
    if (customVoiceIdInput) {
      customVoiceIdInput.focus();
      customVoiceIdInput.select();
    }
  } else {
    customVoiceForm.classList.add('hidden');
    resetCustomVoiceForm();
  }
}

async function submitCustomVoiceForm() {
  const voiceId = (customVoiceIdInput?.value || '').trim();
  const name = (customVoiceNameInput?.value || '').trim();
  const desc = (customVoiceDescInput?.value || '').trim();
  const langInput = (customVoiceLangSelect?.value || 'all').trim().toLowerCase();
  const lang = ['all', 'zh', 'en'].includes(langInput) ? langInput : 'all';

  if (!voiceId) {
    setCustomVoiceFormError('voice_id is required.');
    return;
  }

  if (findVoiceById(voiceId)) {
    setCustomVoiceFormError('voice_id already exists.');
    return;
  }

  const newVoice = normalizeCustomVoice({
    id: voiceId,
    name: name || voiceId,
    desc: desc || 'Custom voice',
    lang,
    icon: 'mdi:account-voice',
    custom: true
  });

  if (!newVoice) {
    setCustomVoiceFormError('Invalid custom voice config.');
    return;
  }

  customVoices.unshift(newVoice);
  saveCustomVoices();
  renderVoiceList();
  toggleCustomVoiceForm(false);
  await selectVoice(newVoice.id);
}

function initCustomVoices() {
  customVoices = loadCustomVoices();
  toggleCustomVoiceForm(false);

  if (addCustomVoiceBtn) {
    addCustomVoiceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = customVoiceForm?.classList.contains('hidden');
      toggleCustomVoiceForm(isHidden);
    });
  }

  if (customVoiceSaveBtn) {
    customVoiceSaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      submitCustomVoiceForm();
    });
  }

  if (customVoiceCancelBtn) {
    customVoiceCancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCustomVoiceForm(false);
    });
  }

  if (customVoiceIdInput) {
    customVoiceIdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitCustomVoiceForm();
      }
    });
  }
}

async function removeCustomVoice(voiceId) {
  const exists = customVoices.some((voice) => voice.id === voiceId);
  if (!exists) return;

  const ok = window.confirm(`Delete custom voice: ${voiceId} ?`);
  if (!ok) return;

  customVoices = customVoices.filter((voice) => voice.id !== voiceId);
  saveCustomVoices();

  if (currentSelectedVoice === voiceId) {
    await selectVoice(currentCharacter.defaultVoice || 'Lovely_Girl');
    return;
  }

  renderVoiceList();
}

function renderVoiceList() {
  voiceList.innerHTML = '';

  const groups = getAllVoiceGroups();

  groups.forEach((group) => {
    const visibleVoices = group.voices.filter((voice) => shouldShowVoiceInFilter(voice, group.lang));
    if (visibleVoices.length === 0) return;

    const groupLabel = document.createElement('div');
    groupLabel.className = 'voice-group-label';
    groupLabel.textContent = group.group;
    voiceList.appendChild(groupLabel);

    visibleVoices.forEach((voice) => {
      const item = document.createElement('div');
      item.className = 'voice-item' + (voice.id === currentSelectedVoice ? ' active' : '');
      item.innerHTML = `
        <span class="voice-icon"><span class="iconify" data-icon="${voice.icon}"></span></span>
        <div class="voice-info">
          <div class="voice-name">${voice.name}</div>
          <div class="voice-desc">${voice.desc}</div>
        </div>
        <button class="voice-preview-btn" data-voice="${voice.id}" title="Preview">
          <span class="iconify" data-icon="mdi:play"></span>
        </button>
        ${voice.custom ? `<button class="voice-remove-btn" data-remove-voice="${voice.id}" title="Delete custom voice"><span class="iconify" data-icon="mdi:delete-outline"></span></button>` : ''}
        ${voice.id === currentSelectedVoice ? '<span class="voice-check"><span class="iconify" data-icon="mdi:check"></span></span>' : ''}
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.voice-preview-btn') || e.target.closest('.voice-remove-btn')) {
          return;
        }
        selectVoice(voice.id);
      });

      const previewBtn = item.querySelector('.voice-preview-btn');
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewVoice(voice.id, voice.name);
      });

      const removeBtn = item.querySelector('.voice-remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeCustomVoice(voice.id);
        });
      }

      voiceList.appendChild(item);
    });
  });
}

function setFilter(filter) {
  currentFilter = filter;
  // 鏇存柊绛涢€夋寜閽姸鎬?
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderVoiceList();
}

async function previewVoice(voiceId, voiceName) {
  if (previewingVoice === voiceId) return;

  previewingVoice = voiceId;
  const previewText = voiceId.startsWith('English') ? 'Hello! Nice to meet you.' : '浣犲ソ锛屽緢楂樺叴璁よ瘑浣狅紒';

  try {
    // 涓存椂璁剧疆闊宠壊
    await window.electronAPI.tts.setVoice(voiceId);
    const result = await window.electronAPI.deepgram.textToSpeech(previewText);

    if (result.success) {
      const audio = new Audio('data:audio/mp3;base64,' + result.audio);
      audio.onended = () => { previewingVoice = null; };
      audio.onerror = () => { previewingVoice = null; };
      await audio.play();
    }

    // 鎭㈠鍘熼煶鑹?
    await window.electronAPI.tts.setVoice(currentSelectedVoice);
  } catch (e) {
    console.error('[榫欒櫨鍔╂墜] 璇曞惉澶辫触:', e);
    previewingVoice = null;
    await window.electronAPI.tts.setVoice(currentSelectedVoice);
  }
}

async function selectVoice(voiceId) {
  currentSelectedVoice = voiceId;
  await window.electronAPI.tts.setVoice(voiceId);
  saveSelectedVoice(voiceId);
  renderVoiceList();

  const selected = findVoiceById(voiceId);
  const voiceName = selected?.name || voiceId;
  showBubble(`Voice switched: ${escapeHtml(voiceName)}`);

  setTimeout(() => {
    voicePanel.style.display = 'none';
  }, 600);
}

function openVoicePanel() {
  hideOverlayPanels('voice');
  currentFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === 'all');
  });
  renderVoiceList();
  toggleCustomVoiceForm(false);
  voicePanel.style.display = 'flex';

  // 缁戝畾绛涢€夋寜閽簨浠?
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => setFilter(btn.dataset.filter);
  });
}

// 鍒濆鍖栨椂鑾峰彇褰撳墠闊宠壊
async function initVoice() {
  const savedVoiceId = loadSelectedVoice();
  let targetVoiceId = savedVoiceId;

  if (!targetVoiceId) {
    try {
      const result = await window.electronAPI.tts.getVoice();
      if (result.voiceId) {
        targetVoiceId = result.voiceId;
      }
    } catch (e) {}
  }

  if (!targetVoiceId) {
    targetVoiceId = currentCharacter.defaultVoice || 'Lovely_Girl';
  }

  currentSelectedVoice = targetVoiceId;

  try {
    await window.electronAPI.tts.setVoice(targetVoiceId);
    saveSelectedVoice(targetVoiceId);
    return;
  } catch (e) {}

  const fallbackVoiceId = currentCharacter.defaultVoice || 'Lovely_Girl';
  currentSelectedVoice = fallbackVoiceId;
  try {
    await window.electronAPI.tts.setVoice(fallbackVoiceId);
    saveSelectedVoice(fallbackVoiceId);
  } catch (e) {}
}

// ===== 瑙掕壊鍒囨崲 =====
const characterPanel = document.getElementById('character-panel');
const characterList = document.getElementById('character-list');
const characterSelectBtn = document.getElementById('character-select-btn');
const closeCharacterPanel = document.getElementById('close-character-panel');

function renderCharacterList() {
  characterList.innerHTML = '';

  // 妫€鏌ヨ鑹茶棰戣祫婧愭槸鍚﹀彲鐢?
  const availableCharacters = AVAILABLE_CHARACTER_IDS; // 鏈夎棰戣祫婧愮殑瑙掕壊

  Object.values(CHARACTER_PROFILES).forEach(char => {
    const item = document.createElement('div');
    item.className = 'character-item' + (char.id === currentCharacter.id ? ' active' : '');

    const isAvailable = availableCharacters.includes(char.id);

    item.innerHTML = `
      <span class="character-icon"><span class="iconify" data-icon="${char.icon}"></span></span>
      <div class="character-info">
        <div class="character-name">${char.name}${!isAvailable ? ' <span class="coming-soon">鍗冲皢涓婄嚎</span>' : ''}</div>
        <div class="character-desc">${char.desc}</div>
      </div>
      ${char.id === currentCharacter.id ? '<span class="character-check"><span class="iconify" data-icon="mdi:check"></span></span>' : ''}
    `;

    if (isAvailable) {
      item.addEventListener('click', () => {
        switchCharacter(char.id);
      });
    } else {
      item.classList.add('disabled');
    }

    characterList.appendChild(item);
  });
}

async function switchCharacter(characterId) {
  const newChar = CHARACTER_PROFILES[characterId];
  if (!newChar || newChar.id === currentCharacter.id) return;

  console.log(`[瑙掕壊鍒囨崲] ${currentCharacter.name} 鈫?${newChar.name}`);

  // 鏇存柊瑙掕壊
  currentCharacter = newChar;
  VIDEO_SOURCES = { ...newChar.videos };
  saveSelectedCharacter(newChar.id);

  // 鏇存柊鍏夌幆棰滆壊
  if (ENABLE_CHARACTER_BACKGROUND_EFFECTS && auraAnimator && newChar.auraColors) {
    auraAnimator.updateColors(newChar.auraColors);
  }

  // 鍒囨崲榛樿闊宠壊
  currentSelectedVoice = newChar.defaultVoice;
  try {
    await window.electronAPI.tts.setVoice(newChar.defaultVoice);
    saveSelectedVoice(newChar.defaultVoice);
  } catch (e) {}

  // 鍏抽棴闈㈡澘
  characterPanel.style.display = 'none';

  // 鏄剧ず鍒囨崲鎻愮ず
  showBubble(`\u5df2\u5207\u6362\u4e3a\u300c${escapeHtml(newChar.name)}\u300d`);

  // 閲嶆柊鎾斁娆㈣繋鍔ㄧ敾
  isFirstLaunch = true;
  playWelcomeVideo();

  // 鍒锋柊瑙掕壊鍒楄〃鍜岄煶鑹插垪琛?
  renderCharacterList();
  renderVoiceList();
}

function openCharacterPanel() {
  hideOverlayPanels('character');
  renderCharacterList();
  characterPanel.style.display = 'flex';
}

// ===== 鎮诞鐞冩ā寮?=====
// ===== Skills / Cron panels =====
const skillsPanelBtn = document.getElementById('skills-panel-btn');
const skillsPanel = document.getElementById('skills-panel');
const closeSkillsPanelBtn = document.getElementById('close-skills-panel');
const refreshSkillsBtn = document.getElementById('refresh-skills-btn');
const openManagedSkillsDirBtn = document.getElementById('open-managed-skills-dir-btn');
const skillsPanelMeta = document.getElementById('skills-panel-meta');
const skillsPanelError = document.getElementById('skills-panel-error');
const skillsList = document.getElementById('skills-list');
const skillsSlugInput = document.getElementById('skills-slug-input');
const skillsInstallBtn = document.getElementById('skills-install-btn');

const cronPanelBtn = document.getElementById('cron-panel-btn');
const cronPanel = document.getElementById('cron-panel');
const closeCronPanelBtn = document.getElementById('close-cron-panel');
const refreshCronBtn = document.getElementById('refresh-cron-btn');
const cronPanelError = document.getElementById('cron-panel-error');
const cronList = document.getElementById('cron-list');
const cronNameInput = document.getElementById('cron-name-input');
const cronDescInput = document.getElementById('cron-desc-input');
const cronExprInput = document.getElementById('cron-expr-input');
const cronTzInput = document.getElementById('cron-tz-input');
const cronMessageInput = document.getElementById('cron-message-input');
const cronDeliveryChannelInput = document.getElementById('cron-delivery-channel-input');
const cronDeliveryToInput = document.getElementById('cron-delivery-to-input');
const cronCreateBtn = document.getElementById('cron-create-btn');
const cronResetBtn = document.getElementById('cron-reset-btn');

let skillsReportState = null;
let skillsBusyKey = '';
let skillsAdding = false;
const skillApiKeyDrafts = {};

let cronJobsState = [];
let cronBusy = false;

function hideOverlayPanels(except = '') {
  const panels = [
    ['voice', voicePanel],
    ['character', characterPanel],
    ['skills', skillsPanel],
    ['cron', cronPanel]
  ];
  for (const [name, panel] of panels) {
    if (!panel) continue;
    if (name !== except) {
      panel.style.display = 'none';
    }
  }
}

function setPanelError(element, message = '') {
  if (!element) return;
  element.textContent = message;
}

function formatDateTimeLabel(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  try {
    return new Date(ms).toLocaleString();
  } catch (error) {
    return '--';
  }
}

function getSkillMissingTags(skill) {
  const missing = skill?.missing || {};
  const tags = [];

  const bins = Array.isArray(missing.bins) ? missing.bins : [];
  const env = Array.isArray(missing.env) ? missing.env : [];
  const config = Array.isArray(missing.config) ? missing.config : [];
  const os = Array.isArray(missing.os) ? missing.os : [];

  bins.forEach((value) => tags.push(`bin:${value}`));
  env.forEach((value) => tags.push(`env:${value}`));
  config.forEach((value) => tags.push(`config:${value}`));
  os.forEach((value) => tags.push(`os:${value}`));

  return tags;
}

function ensureSkillDrafts() {
  const skills = Array.isArray(skillsReportState?.skills) ? skillsReportState.skills : [];
  skills.forEach((skill) => {
    const key = String(skill?.skillKey || '').trim();
    if (!key || !skill?.primaryEnv) return;
    if (typeof skillApiKeyDrafts[key] !== 'string') {
      skillApiKeyDrafts[key] = '';
    }
  });
}

function renderSkillsPanelMeta() {
  if (!skillsPanelMeta) return;
  const workspaceDir = String(skillsReportState?.workspaceDir || '').trim();
  const managedDir = String(skillsReportState?.managedSkillsDir || '').trim();
  skillsPanelMeta.textContent =
    `${t('skills.meta.workspace')}: ${workspaceDir || '-'}\n${t('skills.meta.managed')}: ${managedDir || '-'}`;
}

function renderSkillsList() {
  if (!skillsList) return;
  skillsList.innerHTML = '';
  syncSkillAddControls();

  const skills = Array.isArray(skillsReportState?.skills) ? skillsReportState.skills : [];
  if (skills.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'skills-empty';
    empty.textContent = t('skills.empty');
    skillsList.appendChild(empty);
    return;
  }

  skills.forEach((skill) => {
    const skillKey = String(skill?.skillKey || '').trim();
    const title = `${skill?.emoji ? `${skill.emoji} ` : ''}${String(skill?.name || skillKey || 'Skill')}`;
    const description = String(skill?.description || '').trim();
    const source = String(skill?.source || '-');
    const missingTags = getSkillMissingTags(skill);
    const installOptions = Array.isArray(skill?.install) ? skill.install : [];
    const preferredInstall = installOptions[0] || null;
    const canInstall = Boolean(preferredInstall && Array.isArray(skill?.missing?.bins) && skill.missing.bins.length > 0);
    const busy = skillsBusyKey === skillKey;

    const card = document.createElement('div');
    card.className = 'skill-item';

    const header = document.createElement('div');
    header.className = 'skill-item-header';

    const headerMain = document.createElement('div');
    const titleEl = document.createElement('h4');
    titleEl.className = 'skill-item-title';
    titleEl.textContent = title;
    headerMain.appendChild(titleEl);

    if (description) {
      const sub = document.createElement('div');
      sub.className = 'skill-item-sub';
      sub.textContent = description;
      headerMain.appendChild(sub);
    }

    const badges = document.createElement('div');
    badges.className = 'skill-badges';

    const sourceChip = document.createElement('span');
    sourceChip.className = 'status-chip';
    sourceChip.textContent = source;
    badges.appendChild(sourceChip);

    const eligibleChip = document.createElement('span');
    eligibleChip.className = `status-chip ${skill?.eligible ? 'ok' : 'warn'}`;
    eligibleChip.textContent = skill?.eligible ? t('skills.badge.eligible') : t('skills.badge.blocked');
    badges.appendChild(eligibleChip);

    if (skill?.disabled) {
      const disabledChip = document.createElement('span');
      disabledChip.className = 'status-chip warn';
      disabledChip.textContent = t('skills.badge.disabled');
      badges.appendChild(disabledChip);
    }

    if (skill?.blockedByAllowlist) {
      const blockedChip = document.createElement('span');
      blockedChip.className = 'status-chip bad';
      blockedChip.textContent = t('skills.badge.allowlistBlocked');
      badges.appendChild(blockedChip);
    }

    headerMain.appendChild(badges);
    header.appendChild(headerMain);

    const actions = document.createElement('div');
    actions.className = 'skill-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'skill-action-btn';
    toggleBtn.disabled = busy || skillsAdding || !skillKey;
    toggleBtn.textContent = skill?.disabled ? t('skills.btn.enable') : t('skills.btn.disable');
    toggleBtn.addEventListener('click', () => {
      if (!skillKey) return;
      setSkillEnabled(skillKey, Boolean(skill?.disabled));
    });
    actions.appendChild(toggleBtn);

    if (canInstall && preferredInstall) {
      const installBtn = document.createElement('button');
      installBtn.className = 'skill-action-btn primary';
      installBtn.disabled = busy || skillsAdding || !skillKey;
      installBtn.textContent = String(preferredInstall?.label || preferredInstall?.id || 'Install');
      installBtn.addEventListener('click', () => {
        installSkillOption(skillKey, String(skill?.name || ''), String(preferredInstall?.id || ''));
      });
      actions.appendChild(installBtn);
    }

    header.appendChild(actions);
    card.appendChild(header);

    if (missingTags.length > 0) {
      const body = document.createElement('div');
      body.className = 'skill-item-body';
      body.textContent = `${t('skills.missing')}: ${missingTags.join(', ')}`;
      card.appendChild(body);
    }

    if (skill?.primaryEnv) {
      const keyRow = document.createElement('div');
      keyRow.className = 'skill-key-row';

      const input = document.createElement('input');
      input.className = 'skill-key-input';
      input.type = 'password';
      input.placeholder = `${skill.primaryEnv} value`;
      input.value = String(skillApiKeyDrafts[skillKey] || '');
      input.addEventListener('input', () => {
        skillApiKeyDrafts[skillKey] = input.value;
      });

      const saveBtn = document.createElement('button');
      saveBtn.className = 'skill-action-btn primary';
      saveBtn.disabled = busy || skillsAdding || !skillKey;
      saveBtn.textContent = t('skills.btn.saveKey');
      saveBtn.addEventListener('click', () => {
        saveSkillApiKey(skillKey);
      });

      keyRow.appendChild(input);
      keyRow.appendChild(saveBtn);
      card.appendChild(keyRow);
    }

    skillsList.appendChild(card);
  });
}

function syncSkillAddControls() {
  if (skillsInstallBtn) {
    skillsInstallBtn.disabled = skillsAdding;
    skillsInstallBtn.textContent = skillsAdding ? t('skills.add.installing') : t('skills.add.button');
  }
  if (skillsSlugInput) {
    skillsSlugInput.disabled = skillsAdding;
  }
}

async function refreshSkillsReport() {
  if (!window?.electronAPI?.skills) {
    setPanelError(skillsPanelError, t('skills.error.apiUnavailable'));
    return;
  }

  try {
    setPanelError(skillsPanelError, '');
    const result = await window.electronAPI.skills.list();
    if (!result?.success) {
      throw new Error(result?.error || 'skills.list failed');
    }
    skillsReportState = result.report || null;
    ensureSkillDrafts();
    renderSkillsPanelMeta();
    renderSkillsList();
  } catch (error) {
    setPanelError(skillsPanelError, error?.message || String(error));
    renderSkillsPanelMeta();
    renderSkillsList();
  } finally {
    syncSkillAddControls();
  }
}

async function setSkillEnabled(skillKey, enabled) {
  if (!skillKey || !window?.electronAPI?.skills) return;
  skillsBusyKey = skillKey;
  renderSkillsList();

  try {
    const result = await window.electronAPI.skills.setEnabled(skillKey, enabled);
    if (!result?.success) {
      throw new Error(result?.error || 'skills.update failed');
    }
    await refreshSkillsReport();
  } catch (error) {
    setPanelError(skillsPanelError, error?.message || String(error));
  } finally {
    skillsBusyKey = '';
    renderSkillsList();
  }
}

async function saveSkillApiKey(skillKey) {
  if (!skillKey || !window?.electronAPI?.skills) return;
  skillsBusyKey = skillKey;
  renderSkillsList();

  try {
    const apiKey = String(skillApiKeyDrafts[skillKey] || '');
    const result = await window.electronAPI.skills.setApiKey(skillKey, apiKey);
    if (!result?.success) {
      throw new Error(result?.error || 'skills.update apiKey failed');
    }
    await refreshSkillsReport();
  } catch (error) {
    setPanelError(skillsPanelError, error?.message || String(error));
  } finally {
    skillsBusyKey = '';
    renderSkillsList();
  }
}

async function installSkillOption(skillKey, name, installId) {
  if (!skillKey || !name || !installId || !window?.electronAPI?.skills) return;
  skillsBusyKey = skillKey;
  renderSkillsList();

  try {
    const result = await window.electronAPI.skills.install({ name, installId });
    if (!result?.success) {
      throw new Error(result?.error || 'skills.install failed');
    }
    await refreshSkillsReport();
  } catch (error) {
    setPanelError(skillsPanelError, error?.message || String(error));
  } finally {
    skillsBusyKey = '';
    renderSkillsList();
  }
}

async function openManagedSkillsDir() {
  if (!window?.electronAPI?.skills) return;

  try {
    const result = await window.electronAPI.skills.openManagedDir();
    if (result?.success) return;

    const workspaceDir = String(skillsReportState?.workspaceDir || '').trim();
    const managedDir = String(skillsReportState?.managedSkillsDir || '').trim();
    let workspaceSkillsDir = '';
    if (workspaceDir) {
      const separator = workspaceDir.includes('\\') ? '\\' : '/';
      workspaceSkillsDir = `${workspaceDir.replace(/[\\/]+$/, '')}${separator}skills`;
    }

    const fallbackDirs = [workspaceSkillsDir, managedDir].filter(Boolean);
    if (window?.electronAPI?.shell?.openPath) {
      for (const dir of fallbackDirs) {
        const fallback = await window.electronAPI.shell.openPath(dir);
        if (fallback?.success) return;
      }
    }

    throw new Error(result?.error || 'open directory failed');
  } catch (error) {
    setPanelError(skillsPanelError, error?.message || String(error));
  }
}

async function addSkillFromSlug() {
  if (skillsAdding || !window?.electronAPI?.skills) return;

  const slug = String(skillsSlugInput?.value || '').trim();
  if (!slug || !/^[A-Za-z0-9._/-]+$/.test(slug)) {
    setPanelError(skillsPanelError, t('skills.add.invalidSlug'));
    return;
  }

  skillsAdding = true;
  syncSkillAddControls();

  try {
    setPanelError(skillsPanelError, '');
    const workspaceDir = String(skillsReportState?.workspaceDir || '').trim();
    const result = await window.electronAPI.skills.installFromClawHub({ slug, workspaceDir });
    if (!result?.success) {
      throw new Error(result?.error || 'clawhub install failed');
    }

    if (skillsSlugInput) {
      skillsSlugInput.value = '';
    }
    await refreshSkillsReport();
  } catch (error) {
    setPanelError(skillsPanelError, error?.message || String(error));
  } finally {
    skillsAdding = false;
    syncSkillAddControls();
  }
}

function openSkillsPanel() {
  hideOverlayPanels('skills');
  if (skillsPanel) {
    skillsPanel.style.display = 'flex';
  }
  syncSkillAddControls();
  refreshSkillsReport();
}

function resetCronForm() {
  if (cronNameInput) cronNameInput.value = '';
  if (cronDescInput) cronDescInput.value = '';
  if (cronExprInput) cronExprInput.value = '';
  if (cronTzInput) cronTzInput.value = '';
  if (cronMessageInput) cronMessageInput.value = '';
  if (cronDeliveryChannelInput) cronDeliveryChannelInput.value = '';
  if (cronDeliveryToInput) cronDeliveryToInput.value = '';
}

function collectCronCreateInput() {
  const name = String(cronNameInput?.value || '').trim();
  const description = String(cronDescInput?.value || '').trim();
  const scheduleExpr = String(cronExprInput?.value || '').trim();
  const scheduleTz = String(cronTzInput?.value || '').trim();
  const message = String(cronMessageInput?.value || '').trim();
  const deliveryChannel = String(cronDeliveryChannelInput?.value || '').trim();
  const deliveryTo = String(cronDeliveryToInput?.value || '').trim();

  if (!name) {
    throw new Error(t('cron.error.nameRequired'));
  }
  if (!scheduleExpr) {
    throw new Error(t('cron.error.exprRequired'));
  }
  if (!message) {
    throw new Error(t('cron.error.messageRequired'));
  }

  return {
    name,
    description: description || undefined,
    scheduleExpr,
    scheduleTz: scheduleTz || undefined,
    message,
    enabled: true,
    deliveryChannel: deliveryChannel || undefined,
    deliveryTo: deliveryTo || undefined
  };
}

function renderCronList() {
  if (!cronList) return;
  cronList.innerHTML = '';

  if (!Array.isArray(cronJobsState) || cronJobsState.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cron-empty';
    empty.textContent = t('cron.empty');
    cronList.appendChild(empty);
    return;
  }

  cronJobsState.forEach((job) => {
    const id = String(job?.id || '').trim();

    const card = document.createElement('div');
    card.className = 'cron-item';

    const header = document.createElement('div');
    header.className = 'cron-item-header';

    const main = document.createElement('div');
    const title = document.createElement('h4');
    title.className = 'cron-item-title';
    title.textContent = String(job?.name || t('cron.label.unnamed'));
    main.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'cron-item-sub';
    sub.textContent = String(job?.scheduleLabel || t('cron.label.scheduleUnknown'));
    main.appendChild(sub);

    const badges = document.createElement('div');
    badges.className = 'cron-badges';

    const enabledChip = document.createElement('span');
    enabledChip.className = `status-chip ${job?.enabled ? 'ok' : 'warn'}`;
    enabledChip.textContent = job?.enabled ? t('cron.badge.enabled') : t('cron.badge.disabled');
    badges.appendChild(enabledChip);

    const status = String(job?.lastStatus || '').trim();
    if (status) {
      const statusChip = document.createElement('span');
      statusChip.className = `status-chip ${status === 'ok' ? 'ok' : status === 'error' ? 'bad' : 'warn'}`;
      statusChip.textContent = `${t('cron.badge.last')}: ${status}`;
      badges.appendChild(statusChip);
    }

    main.appendChild(badges);
    header.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'cron-item-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'cron-action-btn';
    toggleBtn.disabled = cronBusy || !id;
    toggleBtn.textContent = job?.enabled ? t('cron.btn.disable') : t('cron.btn.enable');
    toggleBtn.addEventListener('click', () => {
      toggleCronJobEnabled(id, !job?.enabled);
    });
    actions.appendChild(toggleBtn);

    const runBtn = document.createElement('button');
    runBtn.className = 'cron-action-btn primary';
    runBtn.disabled = cronBusy || !id;
    runBtn.textContent = t('cron.btn.runNow');
    runBtn.addEventListener('click', () => {
      runCronJobNow(id);
    });
    actions.appendChild(runBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'cron-action-btn danger';
    removeBtn.disabled = cronBusy || !id;
    removeBtn.textContent = t('cron.btn.delete');
    removeBtn.addEventListener('click', () => {
      removeCronJob(id, String(job?.name || ''));
    });
    actions.appendChild(removeBtn);

    header.appendChild(actions);
    card.appendChild(header);

    const bodyParts = [];
    if (job?.description) bodyParts.push(`${t('cron.label.description')}: ${String(job.description)}`);
    if (job?.message) bodyParts.push(`${t('cron.label.message')}: ${String(job.message)}`);
    if (job?.nextRunAtMs) bodyParts.push(`${t('cron.label.nextRun')}: ${formatDateTimeLabel(Number(job.nextRunAtMs))}`);
    if (job?.lastRunAtMs) bodyParts.push(`${t('cron.label.lastRun')}: ${formatDateTimeLabel(Number(job.lastRunAtMs))}`);
    if (job?.lastError) bodyParts.push(`${t('cron.label.error')}: ${String(job.lastError)}`);

    if (bodyParts.length > 0) {
      const body = document.createElement('div');
      body.className = 'cron-item-body';
      body.textContent = bodyParts.join('\n');
      card.appendChild(body);
    }

    cronList.appendChild(card);
  });
}

async function refreshCronJobs() {
  if (!window?.electronAPI?.cron) {
    setPanelError(cronPanelError, t('cron.error.apiUnavailable'));
    return;
  }

  try {
    setPanelError(cronPanelError, '');
    const result = await window.electronAPI.cron.list();
    if (!result?.success) {
      throw new Error(result?.error || 'cron.list failed');
    }

    const jobs = Array.isArray(result?.jobs) ? result.jobs : [];
    cronJobsState = jobs.sort((a, b) => {
      const enabledDelta = Number(Boolean(b?.enabled)) - Number(Boolean(a?.enabled));
      if (enabledDelta !== 0) return enabledDelta;
      const nextA = Number(a?.nextRunAtMs || 0);
      const nextB = Number(b?.nextRunAtMs || 0);
      if (nextA && nextB) return nextA - nextB;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });

    renderCronList();
  } catch (error) {
    setPanelError(cronPanelError, error?.message || String(error));
    renderCronList();
  }
}

async function createCronJob() {
  if (cronBusy || !window?.electronAPI?.cron) return;

  try {
    setPanelError(cronPanelError, '');
    const input = collectCronCreateInput();
    cronBusy = true;
    renderCronList();

    const result = await window.electronAPI.cron.add(input);
    if (!result?.success) {
      throw new Error(result?.error || 'cron.add failed');
    }

    resetCronForm();
    await refreshCronJobs();
  } catch (error) {
    setPanelError(cronPanelError, error?.message || String(error));
  } finally {
    cronBusy = false;
    renderCronList();
  }
}

async function toggleCronJobEnabled(id, enabled) {
  if (!id || cronBusy || !window?.electronAPI?.cron) return;
  cronBusy = true;
  renderCronList();

  try {
    const result = await window.electronAPI.cron.toggle(id, enabled);
    if (!result?.success) {
      throw new Error(result?.error || 'cron.update failed');
    }
    await refreshCronJobs();
  } catch (error) {
    setPanelError(cronPanelError, error?.message || String(error));
  } finally {
    cronBusy = false;
    renderCronList();
  }
}

async function runCronJobNow(id) {
  if (!id || cronBusy || !window?.electronAPI?.cron) return;
  cronBusy = true;
  renderCronList();

  try {
    const result = await window.electronAPI.cron.runNow(id);
    if (!result?.success) {
      throw new Error(result?.error || 'cron.run failed');
    }
    await refreshCronJobs();
  } catch (error) {
    setPanelError(cronPanelError, error?.message || String(error));
  } finally {
    cronBusy = false;
    renderCronList();
  }
}

async function removeCronJob(id, name) {
  if (!id || cronBusy || !window?.electronAPI?.cron) return;
  const ok = window.confirm(t('cron.confirm.delete', { name: name || id }));
  if (!ok) return;

  cronBusy = true;
  renderCronList();

  try {
    const result = await window.electronAPI.cron.remove(id);
    if (!result?.success) {
      throw new Error(result?.error || 'cron.remove failed');
    }
    await refreshCronJobs();
  } catch (error) {
    setPanelError(cronPanelError, error?.message || String(error));
  } finally {
    cronBusy = false;
    renderCronList();
  }
}

function openCronPanel() {
  hideOverlayPanels('cron');
  if (cronPanel) {
    cronPanel.style.display = 'flex';
  }
  refreshCronJobs();
}

const miniOrb = document.getElementById('mini-orb');
const widgetContainer = document.getElementById('widget-container');
const miniOrbVideo = document.getElementById('mini-orb-video');
let isMiniMode = false;
let miniOrbClickTimer = null;
let miniOrbIgnoreClickUntil = 0;
const miniDragState = {
  active: false,
  moved: false,
  startScreenX: 0,
  startScreenY: 0,
  offsetX: 0,
  offsetY: 0
};

function clearMiniDragListeners() {
  document.removeEventListener('mousemove', onMiniOrbMouseMove);
  document.removeEventListener('mouseup', onMiniOrbMouseUp);
}

function cancelMiniOrbDrag() {
  miniDragState.active = false;
  miniDragState.moved = false;
  clearMiniDragListeners();
  if (miniOrb) {
    miniOrb.classList.remove('dragging');
  }
}

async function onMiniOrbMouseDown(event) {
  if (!isMiniMode || !miniOrb) return;
  if (event.button !== 0) return;
  if (event.target.closest('.mini-expand-btn')) return;
  if (!window?.electronAPI?.getWindowBounds || !window?.electronAPI?.moveMiniWindow) return;

  const boundsResult = await window.electronAPI.getWindowBounds();
  if (!boundsResult?.success || !boundsResult?.bounds) return;

  const bounds = boundsResult.bounds;
  miniDragState.active = true;
  miniDragState.moved = false;
  miniDragState.startScreenX = event.screenX;
  miniDragState.startScreenY = event.screenY;
  miniDragState.offsetX = event.screenX - Number(bounds.x || 0);
  miniDragState.offsetY = event.screenY - Number(bounds.y || 0);

  miniOrb.classList.add('dragging');
  document.addEventListener('mousemove', onMiniOrbMouseMove);
  document.addEventListener('mouseup', onMiniOrbMouseUp);
}

function onMiniOrbMouseMove(event) {
  if (!miniDragState.active || !isMiniMode) return;
  const deltaX = Math.abs(event.screenX - miniDragState.startScreenX);
  const deltaY = Math.abs(event.screenY - miniDragState.startScreenY);
  if (deltaX > 2 || deltaY > 2) {
    miniDragState.moved = true;
  }

  if (!window?.electronAPI?.moveMiniWindow) return;
  const x = event.screenX - miniDragState.offsetX;
  const y = event.screenY - miniDragState.offsetY;
  window.electronAPI.moveMiniWindow({ x, y }).catch(() => {});
}

function onMiniOrbMouseUp() {
  if (!miniDragState.active) return;

  const moved = miniDragState.moved;
  cancelMiniOrbDrag();

  if (moved) {
    miniOrbIgnoreClickUntil = Date.now() + 280;
    if (miniOrbClickTimer) {
      clearTimeout(miniOrbClickTimer);
      miniOrbClickTimer = null;
    }
  }
}

function initMiniMode() {
  // 鐩戝惉涓昏繘绋嬬殑杩蜂綘妯″紡鍒囨崲
  window.electronAPI.onMiniMode((isMini) => {
    if (isMini) {
      enterMiniMode();
    } else {
      exitMiniMode();
    }
  });

  // 鍗曞嚮鎮诞鐞?= 寮€濮?鍋滄鑱嗗惉锛涘弻鍑绘偓娴悆 = 鎭㈠澶х獥鍙?
  miniOrb.addEventListener('mousedown', (e) => {
    onMiniOrbMouseDown(e).catch(() => {});
  });

  miniOrb.addEventListener('click', (e) => {
    if (Date.now() < miniOrbIgnoreClickUntil) return;
    console.log('[鎮诞鐞僝 鐐瑰嚮浜嬩欢瑙﹀彂, isMiniMode:', isMiniMode, 'target:', e.target.className);
    // 鐐瑰嚮鏀惧ぇ鎸夐挳鏃朵笉澶勭悊
    if (e.target.closest('.mini-expand-btn')) return;

    if (miniOrbClickTimer) {
      // 鍙屽嚮锛氭仮澶嶅ぇ绐楀彛
      clearTimeout(miniOrbClickTimer);
      miniOrbClickTimer = null;
      console.log('[MiniOrb] Double click -> restore main window');
      window.electronAPI.restoreWindow();
    } else {
      // 绛夊緟鍒ゆ柇鏄惁鍙屽嚮
      miniOrbClickTimer = setTimeout(() => {
        miniOrbClickTimer = null;
        console.log('[鎮诞鐞僝 鍗曞嚮 鈫?鍒囨崲鑱嗗惉');
        // 鍗曞嚮锛氬垏鎹㈣亞鍚?
        onMiniOrbTap();
      }, 250);
    }
  });

  // 鏀惧ぇ鎸夐挳
  const expandBtn = document.getElementById('mini-expand-btn');
  if (expandBtn) {
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.electronAPI.restoreWindow();
    });
  }
}

// 鎮诞鐞冨崟鍑?鈫?寮€濮?鍋滄鑱嗗惉
async function onMiniOrbTap() {
  console.log('[鎮诞鐞僝 onMiniOrbTap, isMiniMode:', isMiniMode, 'appState:', appState, 'isProcessing:', isProcessing);
  if (!isMiniMode) return;

  // speaking 鐘舵€佷笅鍏佽鎵撴柇 鈫?鐩存帴杩涘叆鑱嗗惉
  if (appState === 'speaking') {
    interruptTTS();
    isProcessing = false;
    accumulatedTranscript = '';
    setAppState('listening');
    await startRecording();
    return;
  }

  if (isProcessing) return;

  if (appState === 'listening' || appState === 'followup') {
    // 姝ｅ湪鑱嗗惉 鈫?鍋滄
    clearTimeout(executeTimer);
    accumulatedTranscript = '';
    await stopRecording();
    setMiniOrbState('idle');
    setAppState('idle');
    return;
  }

  // 寮€濮嬭亞鍚?
  accumulatedTranscript = '';
  setAppState('listening');
  setMiniOrbState('listening');
  await startRecording();
}

// 鏇存柊鎮诞鐞冭瑙夌姸鎬?
function setMiniOrbState(state) {
  if (!isMiniMode) return;
  miniOrb.classList.remove('mini-listening', 'mini-thinking', 'mini-speaking');
  if (state === 'listening' || state === 'followup') {
    miniOrb.classList.add('mini-listening');
  } else if (state === 'thinking') {
    miniOrb.classList.add('mini-thinking');
  } else if (state === 'speaking') {
    miniOrb.classList.add('mini-speaking');
  }
  // 鍒囨崲鎮诞鐞冭棰戝尮閰嶇姸鎬?
  const videoSrc = VIDEO_SOURCES[state] || VIDEO_SOURCES.idle;
  const source = miniOrbVideo.querySelector('source');
  if (source && !source.src.endsWith(videoSrc)) {
    source.src = videoSrc;
    miniOrbVideo.load();
    miniOrbVideo.play().catch(() => {});
  }
}

function enterMiniMode() {
  console.log('[鎮诞鐞僝 杩涘叆杩蜂綘妯″紡');
  isMiniMode = true;
  widgetContainer.style.display = 'none';
  miniOrb.style.display = 'flex';
  // 鏇存柊鎮诞鐞冭棰戜负褰撳墠鐘舵€?
  setMiniOrbState(appState);
}

function exitMiniMode() {
  console.log('[鎮诞鐞僝 閫€鍑鸿糠浣犳ā寮忥紝鎭㈠瀹屾暣绐楀彛');
  isMiniMode = false;
  cancelMiniOrbDrag();
  miniOrb.style.display = 'none';
  miniOrb.classList.remove('mini-listening', 'mini-thinking', 'mini-speaking');
  widgetContainer.style.display = 'flex';

  // 濡傛灉鍦ㄨ亞鍚腑鎭㈠锛屼繚鎸佽亞鍚姸鎬?
  if (appState === 'listening' || appState === 'followup') {
    setAppState(appState);
  }
}

// ===== 浜嬩欢鐩戝惉 =====
lobsterArea.addEventListener('click', onLobsterClick);

voiceSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openVoicePanel();
});

characterSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openCharacterPanel();
});

if (skillsPanelBtn) {
  skillsPanelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSkillsPanel();
  });
}

if (cronPanelBtn) {
  cronPanelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCronPanel();
  });
}

if (languageToggleBtn) {
  languageToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLanguage();
  });
}

closeCharacterPanel.addEventListener('click', (e) => {
  e.stopPropagation();
  characterPanel.style.display = 'none';
});

closeVoicePanel.addEventListener('click', (e) => {
  e.stopPropagation();
  voicePanel.style.display = 'none';
});

if (closeSkillsPanelBtn) {
  closeSkillsPanelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    skillsPanel.style.display = 'none';
  });
}

if (refreshSkillsBtn) {
  refreshSkillsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    refreshSkillsReport();
  });
}

if (openManagedSkillsDirBtn) {
  openManagedSkillsDirBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openManagedSkillsDir();
  });
}

if (skillsInstallBtn) {
  skillsInstallBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    addSkillFromSlug();
  });
}

if (skillsSlugInput) {
  skillsSlugInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkillFromSlug();
    }
  });
}

if (closeCronPanelBtn) {
  closeCronPanelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cronPanel.style.display = 'none';
  });
}

if (refreshCronBtn) {
  refreshCronBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    refreshCronJobs();
  });
}

if (cronCreateBtn) {
  cronCreateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    createCronJob();
  });
}

if (cronResetBtn) {
  cronResetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetCronForm();
    setPanelError(cronPanelError, '');
  });
}

if (cronMessageInput) {
  cronMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      createCronJob();
    }
  });
}

minimizeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.minimizeWindow();
});

closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.closeWindow();
});

// ===== 鏂囨湰杈撳叆澶勭悊 =====
function normalizeSelectedFileEntry(file) {
  if (!file) return null;

  const rawPath = typeof file.path === 'string' ? file.path.trim() : '';
  const normalizedPath = rawPath || '';
  const fallbackName = normalizedPath ? normalizedPath.split(/[/\\]/).pop() : '';
  const name = String(file.name || fallbackName || 'file').trim();
  const size = Number(file.size);
  const lastModified = Number(file.lastModified);

  const key = `${normalizedPath}|${name}|${Number.isFinite(size) ? size : 0}|${Number.isFinite(lastModified) ? lastModified : 0}`;
  return {
    key,
    path: normalizedPath,
    name,
    size: Number.isFinite(size) ? size : null
  };
}

function renderAttachmentSummary() {
  if (!attachmentSummaryEl) return;

  if (!Array.isArray(selectedChatFiles) || selectedChatFiles.length === 0) {
    attachmentSummaryEl.style.display = 'none';
    attachmentSummaryEl.textContent = '';
    attachmentSummaryEl.removeAttribute('title');
    return;
  }

  const previewLimit = 3;
  const previewFiles = selectedChatFiles.slice(0, previewLimit);
  const namesText = previewFiles
    .map((file) => String(file?.name || file?.path || 'file').trim())
    .filter(Boolean)
    .join(', ');
  const remainCount = selectedChatFiles.length - previewFiles.length;
  const moreText = remainCount > 0 ? ` ${t('chat.attach.more', { count: remainCount })}` : '';
  const countText = t('chat.attach.selectedCount', { count: selectedChatFiles.length });

  attachmentSummaryEl.textContent = `${countText}: ${namesText}${moreText}`;
  attachmentSummaryEl.title = selectedChatFiles
    .map((file, index) => `${index + 1}. ${file.path || file.name}`)
    .join('\n');
  attachmentSummaryEl.style.display = 'block';
}

function clearSelectedFiles() {
  selectedChatFiles = [];
  if (fileInput) {
    fileInput.value = '';
  }
  renderAttachmentSummary();
}

function addFilesToSelection(fileList) {
  const incoming = Array.from(fileList || [])
    .map(normalizeSelectedFileEntry)
    .filter(Boolean);

  if (!incoming.length) return;

  const seen = new Set(selectedChatFiles.map((item) => item.key));
  for (const file of incoming) {
    if (seen.has(file.key)) continue;
    selectedChatFiles.push(file);
    seen.add(file.key);
  }
  renderAttachmentSummary();
}

function buildCommandWithSelectedFiles(text, files) {
  const normalizedText = String(text || '').trim();
  const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [];

  if (!normalizedFiles.length) return normalizedText;

  const sectionTitle = t('chat.attach.sectionTitle');
  const fileLines = normalizedFiles.map((file, index) => `${index + 1}. ${file.path || file.name}`);
  const prompt = normalizedText || t('chat.attach.defaultPrompt');

  return `${prompt}\n\n${sectionTitle}\n${fileLines.join('\n')}`;
}

async function handleTextInput() {
  const text = textInput.value.trim();
  if (isProcessing) return;

  const hasFiles = selectedChatFiles.length > 0;
  if (!text && !hasFiles) return;

  const command = buildCommandWithSelectedFiles(text, selectedChatFiles);

  // 娓呯┖杈撳叆妗?
  textInput.value = '';
  clearSelectedFiles();

  // 鏄剧ず鐢ㄦ埛杈撳叆鐨勬枃瀛?
  const bubblePreview = text || command;
  showBubble('馃挰 ' + escapeHtml(bubblePreview), true);

  // 鐩存帴澶勭悊鍛戒护锛堜笉闇€瑕佽闊宠瘑鍒級
  await handleCommand(command);
}

if (fileUploadBtn && fileInput) {
  fileUploadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
}

if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    selectedChatFiles = [];
    addFilesToSelection(e.target?.files);
    if (selectedChatFiles.length > 0 && statusHint && appState === 'idle') {
      statusHint.textContent = t('chat.attach.selectedCount', { count: selectedChatFiles.length });
    }
    fileInput.value = '';
  });
}

sendBtn.addEventListener('click', handleTextInput);

textInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleTextInput();
  }
});


