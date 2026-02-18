const { app, BrowserWindow, ipcMain, Notification, shell, screen } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const WebSocket = require('ws');
require('dotenv').config();

// 捕获 EPIPE 错误，防止后台运行时崩溃
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // 忽略 EPIPE 错误
    return;
  }
  throw err;
});

process.stderr.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // 忽略 EPIPE 错误
    return;
  }
  throw err;
});

let mainWindow;

// ===== 任务管理器 =====
class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.taskQueue = [];
    this.isProcessing = false;
  }

  // 创建异步任务
  createTask(message) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const task = {
      id: taskId,
      message: message,
      status: 'pending',
      createdAt: Date.now(),
      result: null,
      error: null
    };

    this.tasks.set(taskId, task);
    this.taskQueue.push(taskId);

    console.log(`[TaskManager] 创建任务: ${taskId} - "${message}"`);

    // 开始处理队列
    this.processQueue();

    return taskId;
  }

  // 处理任务队列
  async processQueue() {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const taskId = this.taskQueue.shift();

    await this.executeTask(taskId);

    this.isProcessing = false;

    // 继续处理下一个任务
    if (this.taskQueue.length > 0) {
      this.processQueue();
    }
  }

  // 执行任务
  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    console.log(`[TaskManager] 开始执行任务: ${taskId}`);
    task.status = 'running';
    task.startedAt = Date.now();

    try {
      // 调用 Clawdbot
      const result = await chatWithClawdbotWithFallback(task.message);

      task.status = 'completed';
      task.result = result;
      task.completedAt = Date.now();
      task.duration = task.completedAt - task.startedAt;

      console.log(`[TaskManager] 任务完成: ${taskId} (用时 ${task.duration}ms)`);

      // 通知前端
      this.notifyTaskCompleted(task);
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = Date.now();

      console.error(`[TaskManager] 任务失败: ${taskId} - ${error.message}`);

      // 通知前端失败
      this.notifyTaskFailed(task);
    }
  }

  // 通知前端任务完成
  notifyTaskCompleted(task) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task-completed', {
        taskId: task.id,
        result: task.result,
        duration: task.duration
      });

      // 显示系统通知
      if (Notification.isSupported()) {
        new Notification({
          title: '任务完成',
          body: task.result.substring(0, 100) + (task.result.length > 100 ? '...' : ''),
          silent: false
        }).show();
      }
    }
  }

  // 通知前端任务失败
  notifyTaskFailed(task) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task-failed', {
        taskId: task.id,
        error: task.error
      });
    }
  }

  // 获取任务状态
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  // 获取所有任务
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  // 取消任务
  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'pending') {
      task.status = 'cancelled';
      // 从队列中移除
      const index = this.taskQueue.indexOf(taskId);
      if (index > -1) {
        this.taskQueue.splice(index, 1);
      }
      console.log(`[TaskManager] 任务已取消: ${taskId}`);
      return true;
    }
    return false;
  }
}

const taskManager = new TaskManager();
let deepgramClient = null;
let deepgramLive = null;
let currentSender = null;

// ===== OpenClaw Gateway / Clawdbot WebSocket ?? =====
function loadOpenClawGatewayDefaults() {
  const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  try {
    if (!fs.existsSync(configPath)) {
      return { configPath, port: '', token: '' };
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const port = parsed?.gateway?.port != null ? String(parsed.gateway.port).trim() : '';
    const token = String(parsed?.gateway?.auth?.token || '').trim();
    return { configPath, port, token };
  } catch (error) {
    console.warn('[Gateway] Failed to load ~/.openclaw/openclaw.json:', error.message);
    return { configPath, port: '', token: '' };
  }
}

const OPENCLAW_GATEWAY_DEFAULTS = loadOpenClawGatewayDefaults();
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL;
const OPENCLAW_GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || OPENCLAW_GATEWAY_DEFAULTS.port;
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || OPENCLAW_GATEWAY_DEFAULTS.token;
const OPENCLAW_SESSION_KEY =
  process.env.OPENCLAW_SESSION_KEY ||
  process.env.CLAWDBOT_SESSION_KEY ||
  'agent:main:main';
const OPENCLAW_SESSION_KEYS = Array.from(
  new Set(
    String(process.env.OPENCLAW_SESSION_KEYS || '')
      .split(/[,\n;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .concat(OPENCLAW_SESSION_KEY)
  )
);

const CLAWDBOT_PORT = OPENCLAW_GATEWAY_PORT || process.env.CLAWDBOT_PORT || 18789;
const CLAWDBOT_TOKEN =
  OPENCLAW_GATEWAY_TOKEN ||
  process.env.CLAWDBOT_TOKEN ||
  '';
const CLAWDBOT_WS_URL = OPENCLAW_GATEWAY_URL || `ws://localhost:${CLAWDBOT_PORT}`;

console.log(
  `[Gateway] ws=${CLAWDBOT_WS_URL}, token=${CLAWDBOT_TOKEN ? 'configured' : 'missing'}, source=${OPENCLAW_GATEWAY_TOKEN ? 'env/openclaw.json' : (process.env.CLAWDBOT_TOKEN ? 'env(clawdbot)' : 'missing')}`
);

let clawdbotWs = null;
let clawdbotConnected = false;
let clawdbotRequestId = 0;
let clawdbotPendingRequests = new Map();


function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isRateLimitText(rawText) {
  const text = normalizeText(rawText).toLowerCase();
  if (!text) return false;
  return (
    /(^|\D)429(\D|$)/.test(text) ||
    /rate\s*limit|too\s*many\s*requests|quota|tpd/.test(text)
  );
}

function isRateLimitReplyMessage(replyText) {
  const text = normalizeText(replyText);
  if (!text) return false;
  return /^upstream model rate-limited \(429\):/i.test(text) || isRateLimitText(text);
}

function extractAssistantTextFromMessage(message) {
  if (!message || typeof message !== 'object') return '';

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      const partText = normalizeText(part?.text);
      if (partText) return partText;
    }
  }

  const directText = normalizeText(message.text);
  if (directText) return directText;

  const directMessage = normalizeText(message.message);
  if (directMessage) return directMessage;

  return '';
}

function extractAssistantErrorFromMessage(message) {
  if (!message || typeof message !== 'object') return '';

  const directError = normalizeText(message.errorMessage);
  if (directError) return directError;

  const nestedError = normalizeText(message.error?.message);
  if (nestedError) return nestedError;

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      const partError = normalizeText(part?.errorMessage) || normalizeText(part?.error?.message);
      if (partError) return partError;
    }
  }

  return '';
}

function extractAssistantTextAndError(historyMessages) {
  if (!Array.isArray(historyMessages)) {
    return { text: '', error: '' };
  }

  const assistantMessages = historyMessages.filter((msg) => msg?.role === 'assistant');
  if (!assistantMessages.length) {
    return { text: '', error: '' };
  }

  const ordered = assistantMessages
    .slice()
    .sort((a, b) => (Number(a?.timestamp) || 0) - (Number(b?.timestamp) || 0));

  let text = '';
  let error = '';

  for (let i = ordered.length - 1; i >= 0; i--) {
    const msg = ordered[i];
    if (!text) text = extractAssistantTextFromMessage(msg);
    if (!error) error = extractAssistantErrorFromMessage(msg);
    if (text && error) break;
  }

  return { text, error };
}

function formatUpstreamFailureHint(rawError) {
  const error = normalizeText(rawError).replace(/\s+/g, ' ');
  if (!error) {
    return '';
  }

  const shortError = error.length > 400 ? `${error.slice(0, 400)}...` : error;
  const isRateLimited =
    /(^|\D)429(\D|$)/.test(shortError) ||
    /rate\s*limit|too\s*many\s*requests|quota|tpd/i.test(shortError);

  if (isRateLimited) {
    return `Upstream model rate-limited (429): ${shortError}`;
  }
  return `Upstream model error: ${shortError}`;
}

// ===== 句子分割器 =====
class SentenceSplitter {
  constructor(onSentence) {
    this.buffer = '';
    this.onSentence = onSentence;
    // 句子结束符：中文和英文
    this.sentenceEnders = /[。！？.!?]\s*/g;
  }

  // 添加文本流
  addText(text) {
    this.buffer += text;
    this.flush();
  }

  // 尝试提取完整句子
  flush() {
    let match;
    const regex = new RegExp(this.sentenceEnders.source, 'g');
    while ((match = regex.exec(this.buffer)) !== null) {
      const endIndex = match.index + match[0].length;
      const sentence = this.buffer.substring(0, endIndex).trim();
      this.buffer = this.buffer.substring(endIndex);

      if (sentence.length > 0) {
        this.onSentence(sentence);
      }
    }
  }

  // 强制刷新剩余缓冲区（流结束时调用）
  finish() {
    if (this.buffer.trim().length > 0) {
      this.onSentence(this.buffer.trim());
      this.buffer = '';
    }
  }

  // 重置
  reset() {
    this.buffer = '';
  }
}

// ===== TTS 音频队列管理器 =====
class TTSQueueManager {
  constructor() {
    this.audioQueue = [];
    this.isProcessing = false;
    this.currentSentenceId = 0;
    this.isStopped = false;
  }

  // 重置队列
  reset() {
    this.audioQueue = [];
    this.isProcessing = false;
    this.currentSentenceId = 0;
    this.isStopped = true;
  }

  // 开始新的会话
  startSession() {
    this.audioQueue = [];
    this.isProcessing = false;
    this.currentSentenceId = 0;
    this.isStopped = false;
  }

  // 添加句子到队列
  async enqueueSentence(sentence) {
    if (this.isStopped) return;

    const sentenceId = ++this.currentSentenceId;
    console.log(`[TTS Queue] 排队句子 #${sentenceId}: "${sentence.substring(0, 30)}..."`);

    this.audioQueue.push({ sentence, sentenceId });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // 处理队列
  async processQueue() {
    if (this.isProcessing || this.audioQueue.length === 0) return;

    const configError = getMiniMaxTTSConfigError();
    if (configError) {
      if (!ttsConfigWarned) {
        console.warn(`[TTS] ${configError}`);
        ttsConfigWarned = true;
      }
      this.audioQueue = [];
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    while (this.audioQueue.length > 0 && !this.isStopped) {
      const item = this.audioQueue.shift();

      try {
        // 调用 TTS 生成音频
        const audioData = await callMiniMaxTTS(item.sentence);

        if (audioData && mainWindow && !mainWindow.isDestroyed()) {
          // 发送音频块到前端
          mainWindow.webContents.send('tts:audioChunk', {
            sentenceId: item.sentenceId,
            audio: audioData,
            text: item.sentence,
            isLast: this.audioQueue.length === 0
          });
        }
      } catch (error) {
        console.error(`[TTS Queue] 句子 #${item.sentenceId} 生成失败:`, error);
      }
    }

    this.isProcessing = false;
  }
}

const ttsQueueManager = new TTSQueueManager();
let sentenceCounter = 0;

// ===== Clawdbot WebSocket 连接 =====
function connectClawdbot() {
  if (clawdbotWs && clawdbotWs.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log(`[Clawdbot] 正在连接 ${CLAWDBOT_WS_URL}...`);
    clawdbotWs = new WebSocket(CLAWDBOT_WS_URL);

    const timeout = setTimeout(() => {
      reject(new Error('Clawdbot 连接超时'));
    }, 10000);

    clawdbotWs.on('open', () => {
      console.log('[Clawdbot] WebSocket 已连接，等待握手...');
    });

    clawdbotWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // 处理连接挑战
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          console.log('[Clawdbot] 收到连接挑战，发送认证...');
          if (!CLAWDBOT_TOKEN) {
            clearTimeout(timeout);
            reject(new Error('OpenClaw Gateway token missing. Set OPENCLAW_GATEWAY_TOKEN or configure ~/.openclaw/openclaw.json gateway.auth.token'));
            try { clawdbotWs.close(); } catch (e) {}
            return;
          }
          clawdbotWs.send(JSON.stringify({
            type: 'req',
            id: 'connect-1',
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'gateway-client',
                version: '1.0.0',
                platform: 'electron',
                mode: 'backend'
              },
              role: 'operator',
              scopes: ['operator.read', 'operator.write'],
              auth: { token: CLAWDBOT_TOKEN }
            }
          }));
        }

        // 处理响应
        if (msg.type === 'res') {
          if (msg.id === 'connect-1') {
            if (msg.ok) {
              clearTimeout(timeout);
              clawdbotConnected = true;
              console.log('[Clawdbot] 认证成功 ✓');
              resolve();
            } else {
              clearTimeout(timeout);
              reject(new Error(msg.error?.message || '认证失败'));
            }
          } else {
            // 处理其他请求的响应
            const pending = clawdbotPendingRequests.get(msg.id);
            if (pending) {
              clawdbotPendingRequests.delete(msg.id);
              if (msg.ok) {
                pending.resolve(msg.payload);
              } else {
                pending.reject(new Error(msg.error?.message || '请求失败'));
              }
            }
          }
        }

        // 处理聊天事件（流式响应）
        if (msg.type === 'event' && msg.event === 'chat') {
          const pending = clawdbotPendingRequests.get('chat-stream');
          if (pending && msg.payload) {
            if (msg.payload.done) {
              clawdbotPendingRequests.delete('chat-stream');
              pending.resolve(pending.fullText || '');
            } else if (msg.payload.text) {
              pending.fullText = (pending.fullText || '') + msg.payload.text;
            }
          }
        }
      } catch (e) {
        console.error('[Clawdbot] 消息解析错误:', e);
      }
    });

    clawdbotWs.on('error', (err) => {
      console.error('[Clawdbot] WebSocket 错误:', err.message);
      clawdbotConnected = false;
    });

    clawdbotWs.on('close', () => {
      console.log('[Clawdbot] WebSocket 已断开');
      clawdbotConnected = false;
      clawdbotWs = null;
    });
  });
}

// 发送 Clawdbot 请求
function clawdbotRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!clawdbotWs || clawdbotWs.readyState !== WebSocket.OPEN) {
      reject(new Error('Clawdbot 未连接'));
      return;
    }

    const id = `req-${++clawdbotRequestId}`;
    clawdbotPendingRequests.set(id, { resolve, reject });

    clawdbotWs.send(JSON.stringify({
      type: 'req',
      id,
      method,
      params
    }));

    // 超时处理
    setTimeout(() => {
      if (clawdbotPendingRequests.has(id)) {
        clawdbotPendingRequests.delete(id);
        reject(new Error('请求超时'));
      }
    }, 30000);
  });
}

// 发送聊天消息到 Clawdbot（支持流式句子分发）
async function chatWithClawdbot(message, options = {}) {
  try {
    await connectClawdbot();
    const sessionKey = options.sessionKey || OPENCLAW_SESSION_KEY;

    console.log(`[Clawdbot] 发送消息: "${message}" (session: ${sessionKey})`);

    // 生成唯一的 idempotencyKey
    const idempotencyKey = `openclaw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 发送消息并等待完成
    const chatReqId = `chat-${++clawdbotRequestId}`;
    let accumulatedText = '';

    // 重置句子计数器和 TTS 队列
    sentenceCounter = 0;
    ttsQueueManager.startSession();

    // 创建句子分割器
    const splitter = new SentenceSplitter((sentence) => {
      const currentSentenceId = ++sentenceCounter;
      console.log(`[Clawdbot] 句子 #${currentSentenceId}: "${sentence}"`);

      // 第一个句子立即发送到前端显示
      if (currentSentenceId === 1 && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clawdbot:firstSentence', { text: sentence });
      }

      // 将句子加入 TTS 队列
      ttsQueueManager.enqueueSentence(sentence);
    });

    return new Promise((resolve, reject) => {
      // 复杂任务（搜索、工具调用等）可能需要较长时间，超时设为 180 秒
      const timeout = setTimeout(() => {
        if (clawdbotWs) {
          clawdbotWs.removeListener('message', chatHandler);
        }
        // 超时但有累积文本时，返回已收到的部分
        if (accumulatedText.length > 0) {
          console.log('[Clawdbot] 响应超时，返回已累积文本:', accumulatedText.substring(0, 200));
          splitter.finish(); // 刷新剩余文本
          resolve(accumulatedText);
        } else {
          reject(new Error('Clawdbot 响应超时'));
        }
      }, 180000);

      // 监听消息
      const chatHandler = (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // 详细日志：记录所有 Clawdbot 消息（调试）
          if (msg.type === 'event') {
            console.log(`[Clawdbot] 事件: ${msg.event}, payload keys: ${Object.keys(msg.payload || {}).join(',')}, state: ${msg.payload?.state || '-'}`);
          } else if (msg.type === 'res' && msg.id !== 'connect-1') {
            console.log(`[Clawdbot] 响应: id=${msg.id}, ok=${msg.ok}`);
          }

          // 1. 处理 chat.send 请求的直接响应（错误检测）
          if (msg.type === 'res' && msg.id === chatReqId) {
            if (!msg.ok) {
              console.error('[Clawdbot] chat.send 请求被拒绝:', msg.error?.message || JSON.stringify(msg.error));
              clawdbotWs.removeListener('message', chatHandler);
              clearTimeout(timeout);
              reject(new Error(msg.error?.message || 'chat.send 请求失败'));
              return;
            }
            console.log('[Clawdbot] chat.send 请求已接受');
          }

          // 2. 监听 chat 流式事件（累积文本 + 分句处理）
          if (msg.type === 'event' && msg.event === 'chat') {
            const payload = msg.payload || {};

            // 累积流式文本
            if (payload.text) {
              accumulatedText += payload.text;
              // 将新文本喂给分割器
              splitter.addText(payload.text);
            }

            // 检查完成状态
            if (payload.state === 'final' || payload.done === true) {
              console.log('[Clawdbot] 收到 chat final 事件');
              clawdbotWs.removeListener('message', chatHandler);

              // 刷新分割器剩余文本
              splitter.finish();

              // 如果流式已累积文本，直接使用
              if (accumulatedText.length > 0) {
                clearTimeout(timeout);
                console.log('[Clawdbot] AI 回复 (流式):', accumulatedText.substring(0, 200));
                resolve(accumulatedText);
                return;
              }

              // 否则从历史记录获取
              clawdbotRequest('chat.history', {
                sessionKey,
                limit: 8
              }).then(history => {
                clearTimeout(timeout);

                const extracted = extractAssistantTextAndError(history?.messages);
                if (extracted.text) {
                  console.log('[Clawdbot] AI reply (history):', extracted.text.substring(0, 200));
                  resolve(extracted.text);
                  return;
                }

                const upstreamHint = formatUpstreamFailureHint(extracted.error);
                if (upstreamHint) {
                  console.warn('[Clawdbot] Empty reply with upstream error:', extracted.error);
                  resolve(upstreamHint);
                  return;
                }

                resolve('Received final event, but no assistant text was found.');
              }).catch(err => {
                clearTimeout(timeout);
                reject(err);
              });
            }
          }

          // 3. 监听所有其他事件（Clawdbot 可能通过不同事件名返回结果）
          if (msg.type === 'event' && msg.event !== 'chat' && msg.event !== 'connect.challenge') {
            const payload = msg.payload || {};
            // 尝试从任意事件中提取文本
            if (payload.text && typeof payload.text === 'string') {
              console.log(`[Clawdbot] 从事件 "${msg.event}" 收到文本: ${payload.text.substring(0, 100)}`);
              accumulatedText += payload.text;
              splitter.addText(payload.text);
            }
            if (payload.message && typeof payload.message === 'string') {
              console.log(`[Clawdbot] 从事件 "${msg.event}" 收到 message: ${payload.message.substring(0, 100)}`);
              if (!accumulatedText) accumulatedText = payload.message;
            }
            if (payload.result && typeof payload.result === 'string') {
              console.log(`[Clawdbot] 从事件 "${msg.event}" 收到 result: ${payload.result.substring(0, 100)}`);
              if (!accumulatedText) accumulatedText = payload.result;
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      };

      clawdbotWs.on('message', chatHandler);

      // 发送消息
      clawdbotWs.send(JSON.stringify({
        type: 'req',
        id: chatReqId,
        method: 'chat.send',
        params: {
          sessionKey,
          idempotencyKey: idempotencyKey,
          message: message
        }
      }));
    });
  } catch (error) {
    console.error('[Clawdbot] 聊天失败:', error.message);
    throw error;
  }
}

async function chatWithClawdbotWithFallback(message) {
  const sessionKeys = OPENCLAW_SESSION_KEYS.length > 0
    ? OPENCLAW_SESSION_KEYS
    : [OPENCLAW_SESSION_KEY];

  let lastRateLimitError = null;

  for (let i = 0; i < sessionKeys.length; i++) {
    const sessionKey = sessionKeys[i];

    try {
      const reply = await chatWithClawdbot(message, { sessionKey });

      if (isRateLimitReplyMessage(reply)) {
        lastRateLimitError = new Error(reply);
        if (i < sessionKeys.length - 1) {
          console.warn(`[Clawdbot] session ${sessionKey} 触发 429，切换下一个 session 重试`);
          continue;
        }
      }

      return reply;
    } catch (error) {
      if (isRateLimitText(error?.message)) {
        lastRateLimitError = error;
        if (i < sessionKeys.length - 1) {
          console.warn(`[Clawdbot] session ${sessionKey} 请求被限流，切换下一个 session`);
          continue;
        }
      }
      throw error;
    }
  }

  if (lastRateLimitError) {
    throw new Error(`All OpenClaw sessions are rate-limited (429): ${lastRateLimitError.message}`);
  }

  throw new Error('No available OpenClaw session key.');
}

// ===== Gateway RPC helpers for Skills/Cron =====
async function callGatewayRpc(method, params = {}) {
  await connectClawdbot();
  return clawdbotRequest(method, params);
}

function normalizeSkillSlug(rawValue) {
  const slug = String(rawValue || '').trim();
  if (!slug) return '';
  if (!/^[A-Za-z0-9._/-]+$/.test(slug)) return '';
  return slug;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: process.env,
      windowsHide: true,
      shell: false
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
        return;
      }

      const message = (stderr || stdout || `${command} exited with code ${code}`).trim();
      const error = new Error(message);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function installSkillFromClawHub(slug, workspaceDir) {
  const installArgs = ['install', slug];
  if (workspaceDir) {
    installArgs.push('--workdir', workspaceDir);
  }

  const primaryCommand = process.platform === 'win32' ? 'clawhub.cmd' : 'clawhub';
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  try {
    return await runProcess(primaryCommand, installArgs, { cwd: workspaceDir || process.cwd() });
  } catch (primaryError) {
    const fallbackArgs = ['-y', 'clawhub', ...installArgs];
    const fallbackResult = await runProcess(npxCommand, fallbackArgs, {
      cwd: workspaceDir || process.cwd()
    });
    return {
      ...fallbackResult,
      usedFallback: true,
      primaryError: primaryError?.message || String(primaryError)
    };
  }
}

function formatCronScheduleLabel(schedule) {
  if (!schedule || typeof schedule !== 'object') return 'unknown';

  const kind = String(schedule.kind || '').trim();
  if (kind === 'cron') {
    const expr = String(schedule.expr || '').trim();
    const tz = String(schedule.tz || '').trim();
    return tz ? `${expr} (${tz})` : expr || 'cron';
  }
  if (kind === 'every') {
    const everyMs = Number(schedule.everyMs || 0);
    if (!Number.isFinite(everyMs) || everyMs <= 0) return 'every';
    if (everyMs % 86400000 === 0) return `every ${everyMs / 86400000} day(s)`;
    if (everyMs % 3600000 === 0) return `every ${everyMs / 3600000} hour(s)`;
    if (everyMs % 60000 === 0) return `every ${everyMs / 60000} minute(s)`;
    return `every ${everyMs} ms`;
  }
  if (kind === 'at') {
    const at = String(schedule.at || '').trim();
    return at || 'at';
  }
  return kind || 'schedule';
}

function extractCronMessage(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (payload.kind === 'agentTurn') return String(payload.message || '').trim();
  if (payload.kind === 'systemEvent') return String(payload.text || '').trim();
  return String(payload.message || payload.text || '').trim();
}

// ===== 窗口创建 =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: FULL_WIDTH,
    height: FULL_HEIGHT,
    minWidth: MIN_FULL_WIDTH,
    minHeight: MIN_FULL_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== 命令处理（通过 Clawdbot） =====
ipcMain.handle('openclaw:executeCommand', async (event, command) => {
  console.log('[CMD] Received command:', command);

  try {
    const reply = await chatWithClawdbotWithFallback(command);
    console.log('[CMD] Clawdbot reply:', reply);
    return { type: 'chat', data: null, message: reply };
  } catch (error) {
    console.error('[CMD] Clawdbot call failed:', error.message);

    if (isRateLimitText(error?.message)) {
      return {
        type: 'chat',
        data: null,
        message: `Upstream model rate-limited (429). Tried rotating configured sessions but still failed: ${error.message}`
      };
    }

    return {
      type: 'chat',
      data: null,
      message: 'Clawdbot is temporarily unavailable. Please check whether the service is running.'
    };
  }
});
// ===== 异步任务管理 =====
// ===== Skills / Cron manager (official gateway skills.* / cron.*) =====
ipcMain.handle('gateway:rpc', async (_, method, params = {}) => {
  try {
    const payload = await callGatewayRpc(method, params);
    return { success: true, payload };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('skills:list', async () => {
  try {
    const report = await callGatewayRpc('skills.status', {});
    return { success: true, report };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('skills:setEnabled', async (_, skillKey, enabled) => {
  try {
    await callGatewayRpc('skills.update', {
      skillKey: String(skillKey || '').trim(),
      enabled: !!enabled
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('skills:setApiKey', async (_, skillKey, apiKey) => {
  try {
    await callGatewayRpc('skills.update', {
      skillKey: String(skillKey || '').trim(),
      apiKey: String(apiKey || '')
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('skills:setEnv', async (_, skillKey, env) => {
  try {
    await callGatewayRpc('skills.update', {
      skillKey: String(skillKey || '').trim(),
      env: env && typeof env === 'object' ? env : {}
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('skills:install', async (_, params) => {
  try {
    const name = String(params?.name || '').trim();
    const installId = String(params?.installId || '').trim();
    if (!name || !installId) {
      return { success: false, error: 'name and installId are required' };
    }

    const payload = await callGatewayRpc('skills.install', {
      name,
      installId,
      timeoutMs: 120000
    });
    return { success: true, payload };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('skills:installFromClawHub', async (_, params) => {
  try {
    const slug = normalizeSkillSlug(params?.slug);
    if (!slug) {
      return {
        success: false,
        error: 'Invalid skill slug. Allowed characters: letters, numbers, dot, underscore, slash, hyphen.'
      };
    }

    let workspaceDir = String(params?.workspaceDir || '').trim();
    if (!workspaceDir) {
      try {
        const report = await callGatewayRpc('skills.status', {});
        workspaceDir = String(report?.workspaceDir || '').trim();
      } catch (error) {
        workspaceDir = '';
      }
    }
    if (!workspaceDir) {
      workspaceDir = process.cwd();
    }

    const runResult = await installSkillFromClawHub(slug, workspaceDir);
    const output = String(runResult?.stdout || runResult?.stderr || '').trim();

    return {
      success: true,
      slug,
      workspaceDir,
      output,
      usedFallback: !!runResult?.usedFallback
    };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('skills:openManagedDir', async () => {
  try {
    const report = await callGatewayRpc('skills.status', {});
    const fs = require('fs');

    const workspaceDir = String(report?.workspaceDir || '').trim();
    const workspaceSkillsDir = workspaceDir ? path.join(workspaceDir, 'skills') : '';
    const managedDir = String(report?.managedSkillsDir || '').trim();
    const candidates = [workspaceSkillsDir, managedDir].filter(Boolean);

    if (candidates.length === 0) {
      return { success: false, error: 'workspaceDir/managedSkillsDir not available' };
    }

    if (workspaceSkillsDir) {
      try {
        fs.mkdirSync(workspaceSkillsDir, { recursive: true });
      } catch (error) {}
    }

    const openErrors = [];
    for (const dir of candidates) {
      const openResult = await shell.openPath(dir);
      if (!openResult) {
        return { success: true, path: dir };
      }
      openErrors.push(`${dir}: ${openResult}`);
    }

    return {
      success: false,
      error: openErrors.join(' | ') || 'open skills directory failed'
    };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('cron:list', async () => {
  try {
    const result = await callGatewayRpc('cron.list', { includeDisabled: true });
    const jobs = Array.isArray(result?.jobs) ? result.jobs : [];
    const mapped = jobs.map((job) => ({
      id: String(job?.id || job?.jobId || '').trim(),
      name: String(job?.name || '(unnamed)'),
      description: String(job?.description || ''),
      enabled: job?.enabled !== false,
      schedule: job?.schedule || null,
      scheduleLabel: formatCronScheduleLabel(job?.schedule),
      payload: job?.payload || null,
      message: extractCronMessage(job?.payload),
      delivery: job?.delivery || null,
      nextRunAtMs: Number.isFinite(job?.state?.nextRunAtMs) ? job.state.nextRunAtMs : null,
      lastRunAtMs: Number.isFinite(job?.state?.lastRunAtMs) ? job.state.lastRunAtMs : null,
      lastStatus: job?.state?.lastStatus || null,
      lastError: job?.state?.lastError || null
    }));
    return { success: true, jobs: mapped };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('cron:add', async (_, input) => {
  try {
    const name = String(input?.name || '').trim();
    const message = String(input?.message || '').trim();
    const scheduleExpr = String(input?.scheduleExpr || '').trim();
    const scheduleTz = String(input?.scheduleTz || '').trim();
    const description = String(input?.description || '').trim();
    const enabled = input?.enabled !== false;
    const deliveryChannel = String(input?.deliveryChannel || '').trim();
    const deliveryTo = String(input?.deliveryTo || '').trim();

    if (!name || !message || !scheduleExpr) {
      return { success: false, error: 'name, message, and scheduleExpr are required' };
    }

    const params = {
      name,
      description: description || undefined,
      enabled,
      // Official cron.add shape in docs: schedule + sessionTarget + wakeMode + payload
      schedule: {
        kind: 'cron',
        expr: scheduleExpr,
        ...(scheduleTz ? { tz: scheduleTz } : {})
      },
      sessionTarget: 'isolated',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message
      },
      ...(deliveryChannel || deliveryTo
        ? {
            delivery: {
              mode: 'announce',
              channel: deliveryChannel || 'last',
              ...(deliveryTo ? { to: deliveryTo } : {})
            }
          }
        : {})
    };

    const job = await callGatewayRpc('cron.add', params);
    return { success: true, job };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('cron:toggle', async (_, id, enabled) => {
  try {
    await callGatewayRpc('cron.update', { id: String(id || ''), patch: { enabled: !!enabled } });
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('cron:runNow', async (_, id) => {
  try {
    const result = await callGatewayRpc('cron.run', { id: String(id || ''), mode: 'force' });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('cron:remove', async (_, id) => {
  try {
    const result = await callGatewayRpc('cron.remove', { id: String(id || '') });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('shell:openPath', async (_, pathValue) => {
  try {
    const output = await shell.openPath(String(pathValue || ''));
    return { success: !output, error: output || null };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('task:create', async (event, message) => {
  const taskId = taskManager.createTask(message);
  return { success: true, taskId };
});

ipcMain.handle('task:get', async (event, taskId) => {
  const task = taskManager.getTask(taskId);
  return task || null;
});

ipcMain.handle('task:getAll', async (event) => {
  return taskManager.getAllTasks();
});

ipcMain.handle('task:cancel', async (event, taskId) => {
  const success = taskManager.cancelTask(taskId);
  return { success };
});

// ===== Deepgram STT =====
let deepgramKeepAlive = null;
let isListeningActive = false; // 是否处于活动听写状态（用于长连接优化）

ipcMain.handle('deepgram:startListening', async (event) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
      return { success: false, error: '请先在 .env 文件中配置 DEEPGRAM_API_KEY' };
    }

    currentSender = event.sender;

    // 复用已有连接（如果仍然活跃）
    if (deepgramLive) {
      try {
        const readyState = deepgramLive.getReadyState();
        if (readyState === 1) { // WebSocket.OPEN
          console.log('[STT] 复用现有 Deepgram 连接 ✓');
          isListeningActive = true; // 激活听写状态
          return { success: true };
        }
      } catch (e) { /* 连接异常，重新创建 */ }
      // 连接已关闭或异常，清理后重建
      if (deepgramKeepAlive) { clearInterval(deepgramKeepAlive); deepgramKeepAlive = null; }
      try { deepgramLive.finish(); } catch (e) {}
      deepgramLive = null;
    }

    console.log(`[STT] Deepgram API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);

    // 创建新连接
    deepgramClient = createClient(apiKey);

    console.log('[STT] 正在建立 Deepgram WebSocket 连接...');

    deepgramLive = deepgramClient.listen.live({
      model: 'nova-2',
      language: 'zh-CN',
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1200,
      vad_events: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
      endpointing: 300
    });

    // 连接超时检测（10秒内没建立则报错）
    const connectTimeout = setTimeout(() => {
      if (deepgramLive) {
        const rs = deepgramLive.getReadyState();
        if (rs !== 1) {
          console.error(`[STT] Deepgram 连接超时 (readyState=${rs})，可能 API Key 无效`);
          if (currentSender && !currentSender.isDestroyed()) {
            currentSender.send('deepgram:error', 'Deepgram 连接超时，请检查 API Key 是否有效');
          }
          try { deepgramLive.finish(); } catch (e) {}
          deepgramLive = null;
        }
      }
    }, 10000);

    deepgramLive.on(LiveTranscriptionEvents.Open, () => {
      clearTimeout(connectTimeout);
      console.log('[STT] Deepgram 连接已建立 ✓');
      // KeepAlive: 每 8 秒发送心跳，防止空闲断开
      deepgramKeepAlive = setInterval(() => {
        if (deepgramLive) {
          try { deepgramLive.keepAlive(); } catch (e) {}
        }
      }, 8000);
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('deepgram:connected');
      }
    });

    deepgramLive.on(LiveTranscriptionEvents.Transcript, (data) => {
      // 关键：只有在活动状态下才处理转写结果（长连接优化）
      if (!isListeningActive) {
        return;
      }

      if (!data.channel || !data.channel.alternatives || data.channel.alternatives.length === 0) return;

      const transcript = data.channel.alternatives[0].transcript;
      const isFinal = data.is_final;

      if (transcript && transcript.trim().length > 0) {
        console.log(`[STT] ${isFinal ? '✓ 最终' : '... 临时'}: "${transcript}"`);
        if (currentSender && !currentSender.isDestroyed()) {
          currentSender.send('deepgram:transcript', { transcript, isFinal });
        }
      }
    });

    deepgramLive.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      // 只有活动状态下才通知前端（长连接优化）
      if (!isListeningActive) return;

      console.log('[STT] UtteranceEnd - 用户停止说话');
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('deepgram:utteranceEnd');
      }
    });

    deepgramLive.on(LiveTranscriptionEvents.Error, (error) => {
      clearTimeout(connectTimeout);
      console.error('[STT] Deepgram 错误:', error);
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('deepgram:error', error.message || String(error));
      }
    });

    deepgramLive.on(LiveTranscriptionEvents.Close, () => {
      clearTimeout(connectTimeout);
      if (deepgramKeepAlive) { clearInterval(deepgramKeepAlive); deepgramKeepAlive = null; }
      console.log('[STT] Deepgram 连接已关闭');
      isListeningActive = false; // 重置状态
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('deepgram:closed');
      }
    });

    isListeningActive = true; // 激活听写状态
    return { success: true };
  } catch (error) {
    console.error('[STT] 启动失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deepgram:stopListening', async () => {
  // 长连接优化：不再断开连接，只是暂停听写状态
  isListeningActive = false;
  console.log('[STT] 停止听写（暂停状态，连接保持）');
  return { success: true };
});

ipcMain.handle('deepgram:sendAudio', async (event, audioData) => {
  try {
    // 只有在活动状态下才发送音频数据
    if (deepgramLive && audioData && isListeningActive) {
      const readyState = deepgramLive.getReadyState();
      if (readyState === 1) {
        const buffer = Buffer.from(audioData);
        deepgramLive.send(buffer);
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ===== MiniMax TTS =====
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || '';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'speech-02-turbo';
const MINIMAX_API_BASE_URL = (process.env.MINIMAX_API_BASE_URL || 'https://api.minimaxi.com').replace(/\/+$/, '');
const MINIMAX_INCLUDE_GROUP_ID =
  String(process.env.MINIMAX_INCLUDE_GROUP_ID || 'true').toLowerCase() !== 'false';

// 当前选择的音色（可被前端动态修改）
let currentVoiceId = process.env.MINIMAX_VOICE_ID || 'Lovely_Girl';
let ttsConfigWarned = false;

function getMiniMaxTTSConfigError() {
  if (!MINIMAX_API_KEY) {
    return 'TTS config missing: set MINIMAX_API_KEY';
  }
  if (MINIMAX_INCLUDE_GROUP_ID && !MINIMAX_GROUP_ID) {
    return 'TTS config missing: set MINIMAX_GROUP_ID or set MINIMAX_INCLUDE_GROUP_ID=false';
  }
  return '';
}

// 核心 TTS 函数（提取为独立函数，供 TTSQueueManager 调用）
async function callMiniMaxTTS(text) {
  const configError = getMiniMaxTTSConfigError();
  if (configError) {
    throw new Error(configError);
  }

  console.log(`[TTS] MiniMax 生成语音 (音色: ${currentVoiceId}): "${text.substring(0, 50)}..."`);

  const minimaxEndpoint = MINIMAX_INCLUDE_GROUP_ID
    ? `${MINIMAX_API_BASE_URL}/v1/t2a_v2?GroupId=${encodeURIComponent(MINIMAX_GROUP_ID)}`
    : `${MINIMAX_API_BASE_URL}/v1/t2a_v2`;
  console.log(`[TTS] MiniMax endpoint: ${minimaxEndpoint}`);

  const response = await fetch(
    minimaxEndpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        text: text,
        stream: false,
        voice_setting: {
          voice_id: currentVoiceId,
          speed: 1.0,
          vol: 1.0,
          pitch: 0
        },
        audio_setting: {
          sample_rate: 32000,
          format: 'mp3',
          bitrate: 128000
        },
        language_boost: 'Chinese'
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(data.base_resp.status_msg || 'MiniMax 返回错误');
  }

  if (!data.data || !data.data.audio) {
    throw new Error('无音频数据');
  }

  // MiniMax 返回 hex 编码的音频，转为 base64
  const audioBuffer = Buffer.from(data.data.audio, 'hex');
  console.log(`[TTS] MiniMax 生成音频: ${audioBuffer.length} 字节`);

  if (audioBuffer.length < 100) {
    throw new Error('TTS 音频数据太小');
  }

  return audioBuffer.toString('base64');
}

// 前端设置音色
ipcMain.handle('tts:setVoice', async (event, voiceId) => {
  console.log(`[TTS] 音色已切换: ${currentVoiceId} → ${voiceId}`);
  currentVoiceId = voiceId;
  return { success: true };
});

// 前端获取当前音色
ipcMain.handle('tts:getVoice', async () => {
  return { voiceId: currentVoiceId };
});

// 停止 TTS 播放
ipcMain.handle('tts:stop', async () => {
  console.log('[TTS] 停止播放');
  ttsQueueManager.reset();
  return { success: true };
});

// 非流式 TTS（兼容旧接口）
ipcMain.handle('deepgram:textToSpeech', async (event, text) => {
  try {
    const audioBase64 = await callMiniMaxTTS(text);
    return { success: true, audio: audioBase64 };
  } catch (error) {
    console.error('[TTS] MiniMax 失败:', error);
    return { success: false, error: error.message };
  }
});

// ===== 窗口控制 =====
const FULL_WIDTH = 1180;
const FULL_HEIGHT = 760;
const MIN_FULL_WIDTH = 920;
const MIN_FULL_HEIGHT = 620;
const MINI_SIZE = 64;
const MINI_MARGIN_X = 20;
const MINI_MARGIN_BOTTOM = 120;
let isMiniMode = false;

function getDefaultMiniPosition() {
  const activeDisplay = mainWindow ? screen.getDisplayMatching(mainWindow.getBounds()) : screen.getPrimaryDisplay();
  const workArea = activeDisplay.workArea;
  return {
    x: workArea.x + workArea.width - MINI_SIZE - MINI_MARGIN_X,
    y: workArea.y + workArea.height - MINI_SIZE - MINI_MARGIN_BOTTOM
  };
}

function clampMiniPosition(x, y) {
  const nextX = Math.round(Number(x));
  const nextY = Math.round(Number(y));
  const display = screen.getDisplayNearestPoint({
    x: nextX + Math.floor(MINI_SIZE / 2),
    y: nextY + Math.floor(MINI_SIZE / 2)
  });
  const workArea = display.workArea;
  const maxX = workArea.x + workArea.width - MINI_SIZE;
  const maxY = workArea.y + workArea.height - MINI_SIZE;
  return {
    x: Math.min(Math.max(nextX, workArea.x), maxX),
    y: Math.min(Math.max(nextY, workArea.y), maxY)
  };
}

ipcMain.on('window:minimize', () => {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(false);
  // 切换到悬浮球模式
  isMiniMode = true;
  const bounds = mainWindow.getBounds();
  // 记住展开位置
  mainWindow._restoreX = bounds.x;
  mainWindow._restoreY = bounds.y;
  // 缩小到悬浮球
  mainWindow.setMinimumSize(MINI_SIZE, MINI_SIZE);
  mainWindow.setSize(MINI_SIZE, MINI_SIZE);
  // 移动到屏幕右下区域
  const hasSavedMiniPosition = Number.isFinite(mainWindow._miniX) && Number.isFinite(mainWindow._miniY);
  const miniPos = hasSavedMiniPosition
    ? clampMiniPosition(mainWindow._miniX, mainWindow._miniY)
    : getDefaultMiniPosition();
  mainWindow._miniX = miniPos.x;
  mainWindow._miniY = miniPos.y;
  mainWindow.setPosition(miniPos.x, miniPos.y);
  mainWindow.webContents.send('window:miniMode', true);
});

ipcMain.on('window:restore', () => {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(false);
  isMiniMode = false;
  mainWindow.setMinimumSize(MIN_FULL_WIDTH, MIN_FULL_HEIGHT);
  mainWindow.setSize(FULL_WIDTH, FULL_HEIGHT);
  // 恢复到之前的位置
  if (mainWindow._restoreX !== undefined) {
    mainWindow.setPosition(mainWindow._restoreX, mainWindow._restoreY);
  } else {
    mainWindow.center();
  }
  mainWindow.webContents.send('window:miniMode', false);
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:getBounds', () => {
  if (!mainWindow) {
    return { success: false, error: 'main window not available' };
  }
  return { success: true, bounds: mainWindow.getBounds() };
});

ipcMain.handle('window:moveMiniWindow', (_, position) => {
  if (!mainWindow) {
    return { success: false, error: 'main window not available' };
  }
  if (!isMiniMode) {
    return { success: false, error: 'window is not in mini mode' };
  }

  const x = Number(position?.x);
  const y = Number(position?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { success: false, error: 'invalid mini window position' };
  }

  const next = clampMiniPosition(x, y);
  mainWindow.setPosition(next.x, next.y);
  mainWindow._miniX = next.x;
  mainWindow._miniY = next.y;
  return { success: true, bounds: mainWindow.getBounds() };
});

// ===== 文件操作 =====
// 在 Finder 中显示文件
ipcMain.handle('file:showInFolder', async (event, filePath) => {
  try {
    const fs = require('fs');
    const os = require('os');

    // 展开 ~ 为用户目录
    let expandedPath = filePath;
    if (filePath.startsWith('~/')) {
      expandedPath = filePath.replace('~', os.homedir());
    }

    // 验证路径是否存在
    if (!fs.existsSync(expandedPath)) {
      console.warn('[File] 文件不存在:', expandedPath);
      return { success: false, error: '文件不存在' };
    }

    // 在 Finder 中显示文件
    shell.showItemInFolder(expandedPath);
    console.log('[File] 在 Finder 中显示:', expandedPath);
    return { success: true };
  } catch (error) {
    console.error('[File] 打开失败:', error.message);
    return { success: false, error: error.message };
  }
});

// ===== 应用生命周期 =====
app.whenReady().then(() => {
  createWindow();
  // 预连接 Clawdbot（不等待，后台连接）
  connectClawdbot().then(() => {
    console.log('[启动] Clawdbot 预连接成功');
  }).catch(err => {
    console.warn('[启动] Clawdbot 预连接失败（首次对话时会重试）:', err.message);
  });
  // 注意：Deepgram 不在此处预连接，而是在首次 startListening 时创建
  // 因为 Deepgram 连接需要前端准备好音频流
});

app.on('window-all-closed', () => {
  // 清理 Deepgram 连接
  isListeningActive = false;
  if (deepgramKeepAlive) { clearInterval(deepgramKeepAlive); deepgramKeepAlive = null; }
  if (deepgramLive) { try { deepgramLive.finish(); } catch (e) {} deepgramLive = null; }
  // 清理 TTS 队列
  ttsQueueManager.reset();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
