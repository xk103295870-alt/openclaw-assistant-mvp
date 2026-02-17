const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // OpenClaw chat helpers
  getEmails: () => ipcRenderer.invoke('openclaw:getEmails'),
  getDailyBriefing: () => ipcRenderer.invoke('openclaw:getDailyBriefing'),
  executeCommand: (command) => ipcRenderer.invoke('openclaw:executeCommand', command),
  gatewayRpc: (method, params = {}) => ipcRenderer.invoke('gateway:rpc', method, params),

  // Deepgram
  deepgram: {
    startListening: () => ipcRenderer.invoke('deepgram:startListening'),
    stopListening: () => ipcRenderer.invoke('deepgram:stopListening'),
    sendAudio: (audioData) => ipcRenderer.invoke('deepgram:sendAudio', audioData),
    textToSpeech: (text) => ipcRenderer.invoke('deepgram:textToSpeech', text),

    onConnected: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('deepgram:connected', handler);
      return () => ipcRenderer.removeListener('deepgram:connected', handler);
    },
    onTranscript: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('deepgram:transcript', handler);
      return () => ipcRenderer.removeListener('deepgram:transcript', handler);
    },
    onError: (callback) => {
      const handler = (event, error) => callback(error);
      ipcRenderer.on('deepgram:error', handler);
      return () => ipcRenderer.removeListener('deepgram:error', handler);
    },
    onClosed: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('deepgram:closed', handler);
      return () => ipcRenderer.removeListener('deepgram:closed', handler);
    },
    onUtteranceEnd: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('deepgram:utteranceEnd', handler);
      return () => ipcRenderer.removeListener('deepgram:utteranceEnd', handler);
    },
    onAudioChunk: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('tts:audioChunk', handler);
      return () => ipcRenderer.removeListener('tts:audioChunk', handler);
    },
    onFirstSentence: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('clawdbot:firstSentence', handler);
      return () => ipcRenderer.removeListener('clawdbot:firstSentence', handler);
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('deepgram:connected');
      ipcRenderer.removeAllListeners('deepgram:transcript');
      ipcRenderer.removeAllListeners('deepgram:error');
      ipcRenderer.removeAllListeners('deepgram:closed');
      ipcRenderer.removeAllListeners('deepgram:utteranceEnd');
      ipcRenderer.removeAllListeners('tts:audioChunk');
      ipcRenderer.removeAllListeners('clawdbot:firstSentence');
    }
  },

  // TTS voice control
  tts: {
    setVoice: (voiceId) => ipcRenderer.invoke('tts:setVoice', voiceId),
    getVoice: () => ipcRenderer.invoke('tts:getVoice'),
    stop: () => ipcRenderer.invoke('tts:stop')
  },

  // Async task manager
  task: {
    create: (message) => ipcRenderer.invoke('task:create', message),
    get: (taskId) => ipcRenderer.invoke('task:get', taskId),
    getAll: () => ipcRenderer.invoke('task:getAll'),
    cancel: (taskId) => ipcRenderer.invoke('task:cancel', taskId),

    onCompleted: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('task-completed', handler);
      return () => ipcRenderer.removeListener('task-completed', handler);
    },
    onFailed: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('task-failed', handler);
      return () => ipcRenderer.removeListener('task-failed', handler);
    }
  },

  // Skills manager
  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    setEnabled: (skillKey, enabled) => ipcRenderer.invoke('skills:setEnabled', skillKey, enabled),
    setApiKey: (skillKey, apiKey) => ipcRenderer.invoke('skills:setApiKey', skillKey, apiKey),
    setEnv: (skillKey, env) => ipcRenderer.invoke('skills:setEnv', skillKey, env),
    install: (params) => ipcRenderer.invoke('skills:install', params),
    installFromClawHub: (params) => ipcRenderer.invoke('skills:installFromClawHub', params),
    openManagedDir: () => ipcRenderer.invoke('skills:openManagedDir')
  },

  // Cron manager
  cron: {
    list: () => ipcRenderer.invoke('cron:list'),
    add: (input) => ipcRenderer.invoke('cron:add', input),
    toggle: (id, enabled) => ipcRenderer.invoke('cron:toggle', id, enabled),
    runNow: (id) => ipcRenderer.invoke('cron:runNow', id),
    remove: (id) => ipcRenderer.invoke('cron:remove', id)
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  restoreWindow: () => ipcRenderer.send('window:restore'),
  closeWindow: () => ipcRenderer.send('window:close'),
  getWindowBounds: () => ipcRenderer.invoke('window:getBounds'),
  moveMiniWindow: (position) => ipcRenderer.invoke('window:moveMiniWindow', position),
  onMiniMode: (callback) => {
    const handler = (event, isMini) => callback(isMini);
    ipcRenderer.on('window:miniMode', handler);
    return () => ipcRenderer.removeListener('window:miniMode', handler);
  },

  // File helpers
  file: {
    showInFolder: (filePath) => ipcRenderer.invoke('file:showInFolder', filePath)
  },

  shell: {
    openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath)
  }
});
