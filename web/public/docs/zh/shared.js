/* ===== URL & Model Config ===== */
var MODEL_DISCOVERY_API_KEY = 'sk-tsZBskO2lJ91ZjOrH8igZwMgtN1P0uVTfOMFqnaQJbWDDFGM';
var modelListCache = {};
var modelLoadTimer = null;

function normalizeBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

function readServerAddressFromStatus() {
  var status = localStorage.getItem('status');
  if (!status) return '';
  try {
    var parsedStatus = JSON.parse(status);
    return normalizeBaseUrl(parsedStatus.server_address || '');
  } catch (error) {
    console.error('Failed to parse status from localStorage:', error);
    return '';
  }
}

function resolveDefaultBaseUrl() {
  var serverAddress = readServerAddressFromStatus();
  var storedAddress = normalizeBaseUrl(localStorage.getItem('api_base_url') || '');
  return serverAddress || storedAddress || normalizeBaseUrl(window.location.origin);
}

var API_BASE_URL = resolveDefaultBaseUrl();
var API_TEST_ENDPOINT = '';
var apiBaseUrlInputEl = null;
var apiRequestUrlHintEl = null;

var modelSelectorRefs = {
  apiType: 'openai',
  requestBodyEl: null,
  modelNameEl: null,
  selectEl: null,
  hintEl: null,
  refreshBtn: null,
};

var DOC_PAGE_META = {
  '/docs/zh/models/index.html': {
    officialLinks: [
      {
        label: '官网：模型列表（OpenAI）',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/models/list/listmodels',
      },
      {
        label: '官网：模型列表（Gemini）',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/models/list/listmodelsgemini',
      },
    ],
    relatedLinks: [
      {
        label: '本地：列出模型',
        href: '/docs/zh/models/list/listmodels/index.html',
      },
      {
        label: '本地：聊天总览',
        href: '/docs/zh/chat/index.html',
      },
    ],
  },
  '/docs/zh/models/list/listmodels/index.html': {
    officialLinks: [
      {
        label: '官网：模型列表（OpenAI）',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/models/list/listmodels',
      },
      {
        label: '官网：模型列表（Gemini）',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/models/list/listmodelsgemini',
      },
    ],
    relatedLinks: [
      { label: '本地：模型总览', href: '/docs/zh/models/index.html' },
      {
        label: '本地：聊天总览',
        href: '/docs/zh/chat/index.html',
      },
      {
        label: '本地：ChatCompletions',
        href: '/docs/zh/chat/openai/createchatcompletion/index.html',
      },
    ],
  },
  '/docs/zh/chat/index.html': {
    officialLinks: [
      {
        label: '官网：ChatCompletions',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createchatcompletion',
      },
      {
        label: '官网：Claude Messages',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/createmessage',
      },
      {
        label: '官网：Gemini GenerateContent',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/gemini/geminirelayv1beta',
      },
    ],
    relatedLinks: [
      {
        label: '本地：原生Claude格式',
        href: '/docs/zh/chat/createmessage/index.html',
      },
      {
        label: '本地：原生Gemini格式',
        href: '/docs/zh/chat/gemini/index.html',
      },
      {
        label: '本地：原生OpenAI格式',
        href: '/docs/zh/chat/openai/index.html',
      },
    ],
  },
  '/docs/zh/chat/openai/index.html': {
    officialLinks: [
      {
        label: '官网：ChatCompletions',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createchatcompletion',
      },
      {
        label: '官网：Responses',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createresponse',
      },
    ],
    relatedLinks: [
      {
        label: '本地：ChatCompletions',
        href: '/docs/zh/chat/openai/createchatcompletion/index.html',
      },
      {
        label: '本地：Responses',
        href: '/docs/zh/chat/openai/createresponses/index.html',
      },
      {
        label: '本地：原生Claude格式',
        href: '/docs/zh/chat/createmessage/index.html',
      },
    ],
  },
  '/docs/zh/chat/gemini/index.html': {
    officialLinks: [
      {
        label: '官网：Gemini GenerateContent',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/gemini/geminirelayv1beta',
      },
    ],
    relatedLinks: [
      {
        label: '本地：Gemini文本聊天',
        href: '/docs/zh/chat/gemini/geminirelayv1beta/index.html',
      },
      {
        label: '本地：Gemini媒体识别',
        href: '/docs/zh/chat/gemini/geminirelayv1beta-391536411/index.html',
      },
      {
        label: '本地：原生OpenAI格式',
        href: '/docs/zh/chat/openai/index.html',
      },
    ],
  },
  '/docs/zh/chat/openai/createchatcompletion/index.html': {
    officialLinks: [
      {
        label: '官网：ChatCompletions',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createchatcompletion',
      },
    ],
    relatedLinks: [
      {
        label: '本地：Responses',
        href: '/docs/zh/chat/openai/createresponses/index.html',
      },
      {
        label: '本地：Claude Messages',
        href: '/docs/zh/chat/createmessage/index.html',
      },
    ],
  },
  '/docs/zh/chat/openai/createresponses/index.html': {
    officialLinks: [
      {
        label: '官网：Responses',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createresponse',
      },
    ],
    relatedLinks: [
      {
        label: '本地：ChatCompletions',
        href: '/docs/zh/chat/openai/createchatcompletion/index.html',
      },
    ],
  },
  '/docs/zh/chat/createmessage/index.html': {
    officialLinks: [
      {
        label: '官网：Claude Messages',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/createmessage',
      },
    ],
    relatedLinks: [
      {
        label: '本地：ChatCompletions',
        href: '/docs/zh/chat/openai/createchatcompletion/index.html',
      },
      {
        label: '本地：Gemini 文本聊天',
        href: '/docs/zh/chat/gemini/geminirelayv1beta/index.html',
      },
    ],
  },
  '/docs/zh/chat/gemini/geminirelayv1beta/index.html': {
    officialLinks: [
      {
        label: '官网：Gemini 文本聊天',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/chat/gemini/geminirelayv1beta',
      },
    ],
    relatedLinks: [
      {
        label: '本地：Gemini 媒体识别',
        href: '/docs/zh/chat/gemini/geminirelayv1beta-391536411/index.html',
      },
    ],
  },
  '/docs/zh/completions/index.html': {
    officialLinks: [
      {
        label: '官网：Completions',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/completions/createcompletion',
      },
    ],
    relatedLinks: [
      {
        label: '本地：ChatCompletions',
        href: '/docs/zh/chat/openai/createchatcompletion/index.html',
      },
    ],
  },
  '/docs/zh/embeddings/index.html': {
    officialLinks: [
      {
        label: '官网：Embeddings',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/embeddings/createembedding',
      },
    ],
    relatedLinks: [
      { label: '本地：重排序', href: '/docs/zh/rerank/index.html' },
    ],
  },
  '/docs/zh/images/index.html': {
    officialLinks: [
      {
        label: '官网：图像生成',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/images/openai/post-v1-images-generations',
      },
      {
        label: '官网：图像编辑',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/images/openai/post-v1-images-edits',
      },
    ],
    relatedLinks: [
      {
        label: '本地：图像生成',
        href: '/docs/zh/images/openai/post-v1-images-generations/index.html',
      },
      {
        label: '本地：图像编辑',
        href: '/docs/zh/images/openai/post-v1-images-edits/index.html',
      },
    ],
  },
  '/docs/zh/images/openai/post-v1-images-generations/index.html': {
    officialLinks: [
      {
        label: '官网：图像生成',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/images/openai/post-v1-images-generations',
      },
    ],
    relatedLinks: [
      {
        label: '本地：图像编辑',
        href: '/docs/zh/images/openai/post-v1-images-edits/index.html',
      },
      {
        label: '本地：创建视频',
        href: '/docs/zh/videos/sora/createvideo/index.html',
      },
    ],
  },
  '/docs/zh/images/openai/post-v1-images-edits/index.html': {
    officialLinks: [
      {
        label: '官网：图像编辑',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/images/openai/post-v1-images-edits',
      },
    ],
    relatedLinks: [
      {
        label: '本地：图像生成',
        href: '/docs/zh/images/openai/post-v1-images-generations/index.html',
      },
      {
        label: '本地：创建视频',
        href: '/docs/zh/videos/sora/createvideo/index.html',
      },
    ],
  },
  '/docs/zh/moderations/index.html': {
    officialLinks: [
      {
        label: '官网：Moderations',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/moderations/createmoderation',
      },
    ],
    relatedLinks: [
      { label: '本地：聊天', href: '/docs/zh/chat/index.html' },
    ],
  },
  '/docs/zh/rerank/index.html': {
    officialLinks: [
      {
        label: '官网：Rerank',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/rerank/creatererank',
      },
    ],
    relatedLinks: [
      { label: '本地：嵌入', href: '/docs/zh/embeddings/index.html' },
    ],
  },
  '/docs/zh/audio/index.html': {
    officialLinks: [
      {
        label: '官网：文本转语音',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/audio/openai/createspeech',
      },
      {
        label: '官网：音频转录',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/audio/openai/createtranscription',
      },
      {
        label: '官网：音频翻译',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/audio/openai/createtranslation',
      },
    ],
    relatedLinks: [
      {
        label: '本地：文本转语音',
        href: '/docs/zh/audio/openai/createspeech/index.html',
      },
      {
        label: '本地：音频转录',
        href: '/docs/zh/audio/openai/createtranscription/index.html',
      },
      {
        label: '本地：音频翻译',
        href: '/docs/zh/audio/openai/createtranslation/index.html',
      },
    ],
  },
  '/docs/zh/audio/openai/createspeech/index.html': {
    officialLinks: [
      {
        label: '官网：文本转语音',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/audio/openai/createspeech',
      },
    ],
    relatedLinks: [
      {
        label: '本地：音频转录',
        href: '/docs/zh/audio/openai/createtranscription/index.html',
      },
      {
        label: '本地：音频翻译',
        href: '/docs/zh/audio/openai/createtranslation/index.html',
      },
    ],
  },
  '/docs/zh/audio/openai/createtranscription/index.html': {
    officialLinks: [
      {
        label: '官网：音频转录',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/audio/openai/createtranscription',
      },
    ],
    relatedLinks: [
      {
        label: '本地：文本转语音',
        href: '/docs/zh/audio/openai/createspeech/index.html',
      },
      {
        label: '本地：音频翻译',
        href: '/docs/zh/audio/openai/createtranslation/index.html',
      },
    ],
  },
  '/docs/zh/audio/openai/createtranslation/index.html': {
    officialLinks: [
      {
        label: '官网：音频翻译',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/audio/openai/createtranslation',
      },
    ],
    relatedLinks: [
      {
        label: '本地：文本转语音',
        href: '/docs/zh/audio/openai/createspeech/index.html',
      },
      {
        label: '本地：音频转录',
        href: '/docs/zh/audio/openai/createtranscription/index.html',
      },
    ],
  },
  '/docs/zh/videos/index.html': {
    officialLinks: [
      {
        label: '官网：创建视频',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/videos/sora/createvideo',
      },
      {
        label: '官网：视频状态',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/videos/sora/getvideo',
      },
      {
        label: '官网：视频内容',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/videos/sora/getvideocontent',
      },
    ],
    relatedLinks: [
      {
        label: '本地：创建视频',
        href: '/docs/zh/videos/sora/createvideo/index.html',
      },
      {
        label: '本地：查询状态',
        href: '/docs/zh/videos/sora/getvideo/index.html',
      },
      {
        label: '本地：获取内容',
        href: '/docs/zh/videos/sora/getvideocontent/index.html',
      },
    ],
  },
  '/docs/zh/videos/sora/createvideo/index.html': {
    officialLinks: [
      {
        label: '官网：创建视频',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/videos/sora/createvideo',
      },
    ],
    relatedLinks: [
      {
        label: '本地：查询状态',
        href: '/docs/zh/videos/sora/getvideo/index.html',
      },
      {
        label: '本地：获取内容',
        href: '/docs/zh/videos/sora/getvideocontent/index.html',
      },
    ],
  },
  '/docs/zh/videos/sora/getvideo/index.html': {
    officialLinks: [
      {
        label: '官网：视频状态',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/videos/sora/getvideo',
      },
    ],
    relatedLinks: [
      {
        label: '本地：创建视频',
        href: '/docs/zh/videos/sora/createvideo/index.html',
      },
      {
        label: '本地：获取内容',
        href: '/docs/zh/videos/sora/getvideocontent/index.html',
      },
    ],
  },
  '/docs/zh/videos/sora/getvideocontent/index.html': {
    officialLinks: [
      {
        label: '官网：视频内容',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/videos/sora/getvideocontent',
      },
    ],
    relatedLinks: [
      {
        label: '本地：创建视频',
        href: '/docs/zh/videos/sora/createvideo/index.html',
      },
      {
        label: '本地：查询状态',
        href: '/docs/zh/videos/sora/getvideo/index.html',
      },
    ],
  },
  '/docs/zh/realtime/index.html': {
    officialLinks: [
      {
        label: '官网：Realtime',
        url: 'https://docs.newapi.pro/zh/docs/api/ai-model/realtime/createrealtimesession',
      },
    ],
    relatedLinks: [
      { label: '本地：音频总览', href: '/docs/zh/audio/index.html' },
      {
        label: '本地：文本转语音',
        href: '/docs/zh/audio/openai/createspeech/index.html',
      },
      { label: '本地：聊天', href: '/docs/zh/chat/index.html' },
    ],
  },
};

var DOC_PAGE_FLOW = {
  '/docs/zh/models/index.html': {
    prev: { label: 'API参考首页', href: '/docs/zh/index.html' },
    next: { label: '列出模型', href: '/docs/zh/models/list/listmodels/index.html' },
  },
  '/docs/zh/models/list/listmodels/index.html': {
    prev: { label: '模型总览', href: '/docs/zh/models/index.html' },
    next: { label: '聊天总览', href: '/docs/zh/chat/index.html' },
  },
  '/docs/zh/chat/index.html': {
    prev: { label: '列出模型', href: '/docs/zh/models/list/listmodels/index.html' },
    next: { label: '原生Claude格式', href: '/docs/zh/chat/createmessage/index.html' },
  },
  '/docs/zh/chat/createmessage/index.html': {
    prev: { label: '聊天总览', href: '/docs/zh/chat/index.html' },
    next: { label: '原生Gemini格式', href: '/docs/zh/chat/gemini/index.html' },
  },
  '/docs/zh/chat/gemini/index.html': {
    prev: { label: '原生Claude格式', href: '/docs/zh/chat/createmessage/index.html' },
    next: { label: 'Gemini文本聊天', href: '/docs/zh/chat/gemini/geminirelayv1beta/index.html' },
  },
  '/docs/zh/chat/gemini/geminirelayv1beta/index.html': {
    prev: { label: '原生Gemini格式', href: '/docs/zh/chat/gemini/index.html' },
    next: { label: 'Gemini媒体识别', href: '/docs/zh/chat/gemini/geminirelayv1beta-391536411/index.html' },
  },
  '/docs/zh/chat/gemini/geminirelayv1beta-391536411/index.html': {
    prev: { label: 'Gemini文本聊天', href: '/docs/zh/chat/gemini/geminirelayv1beta/index.html' },
    next: { label: '原生OpenAI格式', href: '/docs/zh/chat/openai/index.html' },
  },
  '/docs/zh/chat/openai/index.html': {
    prev: { label: 'Gemini媒体识别', href: '/docs/zh/chat/gemini/geminirelayv1beta-391536411/index.html' },
    next: { label: 'ChatCompletions', href: '/docs/zh/chat/openai/createchatcompletion/index.html' },
  },
  '/docs/zh/chat/openai/createchatcompletion/index.html': {
    prev: { label: '原生OpenAI格式', href: '/docs/zh/chat/openai/index.html' },
    next: { label: 'Responses', href: '/docs/zh/chat/openai/createresponses/index.html' },
  },
  '/docs/zh/chat/openai/createresponses/index.html': {
    prev: { label: 'ChatCompletions', href: '/docs/zh/chat/openai/createchatcompletion/index.html' },
    next: { label: 'Completions', href: '/docs/zh/completions/index.html' },
  },
  '/docs/zh/completions/index.html': {
    prev: { label: 'Responses', href: '/docs/zh/chat/openai/createresponses/index.html' },
    next: { label: 'Embeddings', href: '/docs/zh/embeddings/index.html' },
  },
  '/docs/zh/embeddings/index.html': {
    prev: { label: 'Completions', href: '/docs/zh/completions/index.html' },
    next: { label: 'Rerank', href: '/docs/zh/rerank/index.html' },
  },
  '/docs/zh/rerank/index.html': {
    prev: { label: 'Embeddings', href: '/docs/zh/embeddings/index.html' },
    next: { label: 'Moderations', href: '/docs/zh/moderations/index.html' },
  },
  '/docs/zh/moderations/index.html': {
    prev: { label: 'Rerank', href: '/docs/zh/rerank/index.html' },
    next: { label: 'Audio', href: '/docs/zh/audio/index.html' },
  },
  '/docs/zh/audio/index.html': {
    prev: { label: 'Moderations', href: '/docs/zh/moderations/index.html' },
    next: { label: '文本转语音', href: '/docs/zh/audio/openai/createspeech/index.html' },
  },
  '/docs/zh/audio/openai/createspeech/index.html': {
    prev: { label: 'Audio 总览', href: '/docs/zh/audio/index.html' },
    next: {
      label: '音频转录',
      href: '/docs/zh/audio/openai/createtranscription/index.html',
    },
  },
  '/docs/zh/audio/openai/createtranscription/index.html': {
    prev: {
      label: '文本转语音',
      href: '/docs/zh/audio/openai/createspeech/index.html',
    },
    next: {
      label: '音频翻译',
      href: '/docs/zh/audio/openai/createtranslation/index.html',
    },
  },
  '/docs/zh/audio/openai/createtranslation/index.html': {
    prev: {
      label: '音频转录',
      href: '/docs/zh/audio/openai/createtranscription/index.html',
    },
    next: { label: 'Realtime', href: '/docs/zh/realtime/index.html' },
  },
  '/docs/zh/realtime/index.html': {
    prev: {
      label: '音频翻译',
      href: '/docs/zh/audio/openai/createtranslation/index.html',
    },
    next: { label: 'Images 总览', href: '/docs/zh/images/index.html' },
  },
  '/docs/zh/images/index.html': {
    prev: { label: 'Realtime', href: '/docs/zh/realtime/index.html' },
    next: {
      label: '图像生成',
      href: '/docs/zh/images/openai/post-v1-images-generations/index.html',
    },
  },
  '/docs/zh/images/openai/post-v1-images-generations/index.html': {
    prev: { label: 'Images 总览', href: '/docs/zh/images/index.html' },
    next: {
      label: '图像编辑',
      href: '/docs/zh/images/openai/post-v1-images-edits/index.html',
    },
  },
  '/docs/zh/images/openai/post-v1-images-edits/index.html': {
    prev: {
      label: '图像生成',
      href: '/docs/zh/images/openai/post-v1-images-generations/index.html',
    },
    next: { label: 'Videos 总览', href: '/docs/zh/videos/index.html' },
  },
  '/docs/zh/videos/index.html': {
    prev: {
      label: '图像编辑',
      href: '/docs/zh/images/openai/post-v1-images-edits/index.html',
    },
    next: {
      label: '创建视频任务',
      href: '/docs/zh/videos/sora/createvideo/index.html',
    },
  },
  '/docs/zh/videos/sora/createvideo/index.html': {
    prev: { label: 'Videos 总览', href: '/docs/zh/videos/index.html' },
    next: { label: '查询视频状态', href: '/docs/zh/videos/sora/getvideo/index.html' },
  },
  '/docs/zh/videos/sora/getvideo/index.html': {
    prev: { label: '创建视频任务', href: '/docs/zh/videos/sora/createvideo/index.html' },
    next: {
      label: '获取视频内容',
      href: '/docs/zh/videos/sora/getvideocontent/index.html',
    },
  },
  '/docs/zh/videos/sora/getvideocontent/index.html': {
    prev: { label: '查询视频状态', href: '/docs/zh/videos/sora/getvideo/index.html' },
    next: { label: 'API参考首页', href: '/docs/zh/index.html' },
  },
};

function normalizeDocPath(pathname) {
  var normalizedPath = pathname || '';
  if (normalizedPath && normalizedPath.slice(-1) === '/') {
    normalizedPath += 'index.html';
  } else if (normalizedPath && normalizedPath.indexOf('.html') === -1) {
    normalizedPath += '/index.html';
  }
  return normalizedPath;
}

function createDocMetaCard(title, links) {
  var card = document.createElement('div');
  card.className = 'doc-meta-card';

  var titleEl = document.createElement('div');
  titleEl.className = 'doc-meta-title';
  titleEl.textContent = title;
  card.appendChild(titleEl);

  var linksWrap = document.createElement('div');
  linksWrap.className = 'doc-meta-links';

  for (var i = 0; i < links.length; i++) {
    var item = links[i] || {};
    var linkEl = document.createElement('a');
    linkEl.className = 'doc-meta-link';
    linkEl.textContent = item.label || '查看详情';

    if (item.url) {
      linkEl.href = item.url;
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
    } else {
      linkEl.href = item.href || '#';
    }

    linksWrap.appendChild(linkEl);
  }

  card.appendChild(linksWrap);
  return card;
}

function injectDocMetaSection() {
  var pathname = window.location.pathname || '';
  var normalizedPath = normalizeDocPath(pathname);

  var meta = DOC_PAGE_META[pathname] || DOC_PAGE_META[normalizedPath];
  if (!meta || document.getElementById('docMetaSection')) return;

  var mainEl = document.querySelector('main.page');
  if (!mainEl) return;

  var sectionEl = document.createElement('section');
  sectionEl.className = 'section doc-meta-section';
  sectionEl.id = 'docMetaSection';

  var titleEl = document.createElement('h2');
  titleEl.className = 'section-title';
  titleEl.textContent = '文档对照';
  sectionEl.appendChild(titleEl);

  var descEl = document.createElement('p');
  descEl.className = 'section-desc';
  descEl.textContent =
    '以下链接可帮助你在本地文档与 New API 官网文档之间快速对照。';
  sectionEl.appendChild(descEl);

  var gridEl = document.createElement('div');
  gridEl.className = 'doc-meta-grid';

  if (meta.officialLinks && meta.officialLinks.length) {
    gridEl.appendChild(createDocMetaCard('官网对应页面', meta.officialLinks));
  }

  if (meta.relatedLinks && meta.relatedLinks.length) {
    gridEl.appendChild(createDocMetaCard('本地相关页面', meta.relatedLinks));
  }

  sectionEl.appendChild(gridEl);

  var testSection = mainEl.querySelector('.test-section');
  if (testSection) {
    mainEl.insertBefore(sectionEl, testSection);
  } else {
    mainEl.appendChild(sectionEl);
  }
}

function injectDocTocSection() {
  var mainEl = document.querySelector('main.page');
  if (!mainEl || document.getElementById('docTocSection')) return;

  var sectionTitleEls = mainEl.querySelectorAll('.section .section-title');
  if (!sectionTitleEls || sectionTitleEls.length < 3) return;

  var tocItems = [];
  for (var i = 0; i < sectionTitleEls.length; i++) {
    var titleEl = sectionTitleEls[i];
    var sectionEl = titleEl.closest('.section');
    if (!sectionEl) continue;

    if (
      sectionEl.id === 'docTocSection' ||
      sectionEl.id === 'docMetaSection' ||
      sectionEl.id === 'docPagerSection'
    ) {
      continue;
    }

    var sectionTitle = (titleEl.textContent || '').trim();
    if (!sectionTitle) continue;

    if (!sectionEl.id) {
      sectionEl.id = 'doc-section-' + (tocItems.length + 1);
    }

    tocItems.push({
      id: sectionEl.id,
      title: sectionTitle,
    });
  }

  if (!tocItems.length) return;

  var sectionWrap = document.createElement('section');
  sectionWrap.className = 'section doc-toc-section';
  sectionWrap.id = 'docTocSection';

  var tocTitle = document.createElement('h2');
  tocTitle.className = 'section-title';
  tocTitle.textContent = '页面目录';
  sectionWrap.appendChild(tocTitle);

  var tocList = document.createElement('div');
  tocList.className = 'doc-toc-list';

  for (var j = 0; j < tocItems.length; j++) {
    var item = tocItems[j];
    var link = document.createElement('a');
    link.className = 'doc-toc-link';
    link.href = '#' + item.id;
    link.textContent = item.title;
    tocList.appendChild(link);
  }

  sectionWrap.appendChild(tocList);

  var firstSection = mainEl.querySelector('.section');
  if (firstSection) {
    mainEl.insertBefore(sectionWrap, firstSection);
  } else {
    mainEl.appendChild(sectionWrap);
  }
}

function createDocPagerLink(item, direction) {
  var link = document.createElement('a');
  link.className = 'doc-pager-link' + (direction === 'next' ? ' is-next' : '');
  link.href = item.href;

  var kicker = document.createElement('span');
  kicker.className = 'doc-pager-kicker';
  kicker.textContent = direction === 'next' ? '下一页' : '上一页';
  link.appendChild(kicker);

  var title = document.createElement('span');
  title.className = 'doc-pager-title';
  title.textContent = item.label || item.href;
  link.appendChild(title);

  return link;
}

function injectDocPagerSection() {
  var pathname = window.location.pathname || '';
  var normalizedPath = normalizeDocPath(pathname);
  var flow = DOC_PAGE_FLOW[pathname] || DOC_PAGE_FLOW[normalizedPath];
  if (!flow || document.getElementById('docPagerSection')) return;

  var mainEl = document.querySelector('main.page');
  if (!mainEl) return;

  var sectionWrap = document.createElement('section');
  sectionWrap.className = 'section doc-pager-section';
  sectionWrap.id = 'docPagerSection';

  var titleEl = document.createElement('h2');
  titleEl.className = 'section-title';
  titleEl.textContent = '页面导航';
  sectionWrap.appendChild(titleEl);

  var pagerGrid = document.createElement('div');
  pagerGrid.className = 'doc-pager-grid';

  if (flow.prev && flow.prev.href) {
    pagerGrid.appendChild(createDocPagerLink(flow.prev, 'prev'));
  }

  if (flow.next && flow.next.href) {
    pagerGrid.appendChild(createDocPagerLink(flow.next, 'next'));
  }

  if (!pagerGrid.children.length) return;

  sectionWrap.appendChild(pagerGrid);
  mainEl.appendChild(sectionWrap);
}

function resolveTestEndpointTemplate() {
  var pathname = window.location.pathname || '';
  if (API_TEST_ENDPOINT) return API_TEST_ENDPOINT;

  if (pathname.indexOf('/docs/zh/chat/gemini/geminirelayv1beta/') !== -1) {
    return '/v1beta/models/{model}:generateContent';
  }
  if (pathname.indexOf('/docs/zh/audio/') !== -1) {
    return '/v1/audio/speech';
  }
  if (pathname.indexOf('/docs/zh/models/list/listmodels/') !== -1) {
    return '/v1/models';
  }

  return '';
}

function resolveTestEndpoint() {
  var endpointTemplate = resolveTestEndpointTemplate();
  if (endpointTemplate.indexOf('{model}') === -1) {
    return endpointTemplate;
  }

  var modelInput = modelSelectorRefs.modelNameEl || document.getElementById('modelName');
  var modelName = modelInput ? modelInput.value.trim() : '';
  return endpointTemplate.replace('{model}', modelName || 'gemini-2.5-pro');
}

function buildTestUrl(baseUrl) {
  var normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  var endpoint = resolveTestEndpoint();
  if (!endpoint) return normalizedBaseUrl;
  return normalizedBaseUrl + endpoint;
}

function extractBaseUrlFromInput(inputValue) {
  var normalizedInput = normalizeBaseUrl(inputValue);
  if (!normalizedInput) return '';

  var endpoint = resolveTestEndpoint();
  if (
    endpoint &&
    normalizedInput.length > endpoint.length &&
    normalizedInput.slice(-endpoint.length) === endpoint
  ) {
    return normalizeBaseUrl(
      normalizedInput.slice(0, normalizedInput.length - endpoint.length)
    );
  }

  return normalizedInput;
}

function updateBaseUrlDisplay() {
  if (!apiBaseUrlInputEl) return;

  var endpoint = resolveTestEndpoint();
  var requestUrl = buildTestUrl(API_BASE_URL);
  apiBaseUrlInputEl.value = requestUrl;
  apiBaseUrlInputEl.placeholder = buildTestUrl('https://yourdomain.com');

  if (!apiRequestUrlHintEl) return;
  if (endpoint) {
    apiRequestUrlHintEl.textContent =
      '提示：可填写完整地址或仅服务器地址，当前请求将发送到 ' + requestUrl;
  } else {
    apiRequestUrlHintEl.textContent = '提示：可填写完整地址或仅服务器地址';
  }
}

/* ===== Token & Base URL Persistence ===== */
document.addEventListener('DOMContentLoaded', function () {
  /* Inject Base URL field into auth section if authToken exists */
  var tokenEl = document.getElementById('authToken');
  if (tokenEl) {
    var saved = localStorage.getItem('api_test_token');
    if (saved) tokenEl.value = saved;
    tokenEl.addEventListener('input', function (e) {
      localStorage.setItem('api_test_token', e.target.value);
    });

    /* Add Base URL input before Token */
    var authContent = document.getElementById('authContent');
    if (authContent && !document.getElementById('apiBaseUrl')) {
      var group = document.createElement('div');
      group.className = 'test-form-group';
      group.innerHTML =
        '<label class="test-label">请求地址</label>' +
        '<input type="text" class="test-input" id="apiBaseUrl">' +
        '<div class="test-model-hint" id="apiRequestUrlHint"></div>';
      authContent.insertBefore(group, authContent.firstChild);

      apiBaseUrlInputEl = document.getElementById('apiBaseUrl');
      apiRequestUrlHintEl = document.getElementById('apiRequestUrlHint');

      var commitBaseUrlInput = function () {
        var parsedBaseUrl = extractBaseUrlFromInput(apiBaseUrlInputEl.value);
        API_BASE_URL = parsedBaseUrl || resolveDefaultBaseUrl();
        localStorage.setItem('api_base_url', API_BASE_URL);
        updateBaseUrlDisplay();
        scheduleModelReload();
      };

      apiBaseUrlInputEl.addEventListener('change', commitBaseUrlInput);
      apiBaseUrlInputEl.addEventListener('blur', commitBaseUrlInput);
    }

    if (!apiBaseUrlInputEl) {
      apiBaseUrlInputEl = document.getElementById('apiBaseUrl');
    }
    if (!apiRequestUrlHintEl) {
      apiRequestUrlHintEl = document.getElementById('apiRequestUrlHint');
    }
    updateBaseUrlDisplay();
  }

  initModelSelector();
  injectDocTocSection();
  injectDocMetaSection();
  injectDocPagerSection();
});

function scheduleModelReload() {
  if (!modelSelectorRefs.selectEl) return;
  if (modelLoadTimer) clearTimeout(modelLoadTimer);
  modelLoadTimer = setTimeout(function () {
    loadAvailableModels(true);
  }, 300);
}

function detectModelApiType() {
  var pathname = window.location.pathname || '';
  if (pathname.indexOf('/docs/zh/chat/gemini/') !== -1) {
    return 'gemini';
  }
  if (pathname.indexOf('/docs/zh/chat/createmessage/') !== -1) {
    return 'anthropic';
  }
  return 'openai';
}

function getModelStorageKey() {
  return 'api_test_model_' + (window.location.pathname || modelSelectorRefs.apiType);
}

function getCurrentModelFromPage() {
  if (modelSelectorRefs.modelNameEl) {
    var modelName = modelSelectorRefs.modelNameEl.value.trim();
    if (modelName) return modelName;
  }

  if (!modelSelectorRefs.requestBodyEl) return '';
  try {
    var body = JSON.parse(modelSelectorRefs.requestBodyEl.value);
    if (body && typeof body === 'object' && typeof body.model === 'string') {
      return body.model.trim();
    }
  } catch (error) {
    return '';
  }
  return '';
}

function updateModelSelectorHint(message, isError) {
  if (!modelSelectorRefs.hintEl) return;
  modelSelectorRefs.hintEl.className =
    'test-model-hint' + (isError ? ' is-error' : '');
  modelSelectorRefs.hintEl.textContent = message;
}

function applyModelToTestRequest(modelName, showBodyParseError) {
  if (!modelName) return;

  if (modelSelectorRefs.modelNameEl) {
    modelSelectorRefs.modelNameEl.value = modelName;
    updateBaseUrlDisplay();
  }

  if (!modelSelectorRefs.requestBodyEl) return;

  var requestBody;
  try {
    requestBody = JSON.parse(modelSelectorRefs.requestBodyEl.value);
  } catch (error) {
    if (showBodyParseError) {
      updateModelSelectorHint('Body JSON 解析失败，请修正后再选择模型', true);
    }
    return;
  }

  if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
    return;
  }

  var hasModelField = Object.prototype.hasOwnProperty.call(requestBody, 'model');
  if (hasModelField || !modelSelectorRefs.modelNameEl) {
    requestBody.model = modelName;
    modelSelectorRefs.requestBodyEl.value = JSON.stringify(requestBody, null, 2);
  }
}

function buildModelApiRequest(apiType) {
  if (apiType === 'gemini') {
    return {
      endpoint: '/v1beta/models',
      headers: {
        'x-goog-api-key': MODEL_DISCOVERY_API_KEY,
      },
    };
  }

  if (apiType === 'anthropic') {
    return {
      endpoint: '/v1/models',
      headers: {
        'x-api-key': MODEL_DISCOVERY_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    };
  }

  return {
    endpoint: '/v1/models',
    headers: {
      Authorization: 'Bearer ' + MODEL_DISCOVERY_API_KEY,
    },
  };
}

function extractModelsFromResponse(apiType, payload) {
  var modelItems = [];
  if (Array.isArray(payload)) {
    modelItems = payload;
  } else if (payload && Array.isArray(payload.data)) {
    modelItems = payload.data;
  } else if (payload && Array.isArray(payload.models)) {
    modelItems = payload.models;
  } else if (payload && Array.isArray(payload.items)) {
    modelItems = payload.items;
  }

  var models = [];
  for (var i = 0; i < modelItems.length; i++) {
    var item = modelItems[i];
    var modelName = '';

    if (typeof item === 'string') {
      modelName = item;
    } else if (item && typeof item === 'object') {
      modelName = item.id || item.model || item.name || item.displayName || '';
    }

    if (!modelName) continue;

    if (apiType === 'gemini') {
      if (modelName.indexOf('models/') === 0) {
        modelName = modelName.slice(7);
      }

      if (item && Array.isArray(item.supportedGenerationMethods)) {
        var methods = item.supportedGenerationMethods;
        var supportsGenerate =
          methods.indexOf('generateContent') !== -1 ||
          methods.indexOf('streamGenerateContent') !== -1;
        if (!supportsGenerate) continue;
      }
    }

    if (models.indexOf(modelName) === -1) {
      models.push(modelName);
    }
  }

  models.sort();
  return models;
}

function parseModelApiError(response, payload) {
  var message = 'HTTP ' + response.status + ' ' + response.statusText;
  if (payload && payload.error) {
    if (typeof payload.error === 'string') {
      message += ' - ' + payload.error;
    } else if (payload.error.message) {
      message += ' - ' + payload.error.message;
    }
  } else if (payload && payload.message) {
    message += ' - ' + payload.message;
  }
  return message;
}

function populateModelSelector(models) {
  if (!modelSelectorRefs.selectEl) return;

  var selectEl = modelSelectorRefs.selectEl;
  var currentModel = getCurrentModelFromPage();
  var cachedModel = localStorage.getItem(getModelStorageKey()) || '';
  var selectedModel = currentModel || cachedModel || (models[0] || '');

  var options = models.slice();
  if (selectedModel && options.indexOf(selectedModel) === -1) {
    options.unshift(selectedModel);
  }

  var html = '';
  for (var i = 0; i < options.length; i++) {
    html +=
      '<option value="' +
      options[i].replace(/"/g, '&quot;') +
      '">' +
      options[i] +
      '</option>';
  }

  selectEl.innerHTML = html || '<option value="">暂无可用模型</option>';
  selectEl.disabled = options.length === 0;

  if (selectedModel) {
    selectEl.value = selectedModel;
    localStorage.setItem(getModelStorageKey(), selectedModel);
    applyModelToTestRequest(selectedModel, false);
  }

  updateModelSelectorHint('已加载 ' + models.length + ' 个模型', false);
}

function loadAvailableModels(forceReload) {
  if (!modelSelectorRefs.selectEl) return;

  var requestConfig = buildModelApiRequest(modelSelectorRefs.apiType);
  var cacheKey = modelSelectorRefs.apiType + '@' + API_BASE_URL;

  if (!forceReload && modelListCache[cacheKey]) {
    populateModelSelector(modelListCache[cacheKey]);
    return;
  }

  modelSelectorRefs.selectEl.disabled = true;
  if (modelSelectorRefs.refreshBtn) {
    modelSelectorRefs.refreshBtn.disabled = true;
  }
  updateModelSelectorHint('正在根据服务器地址拉取可用模型...', false);

  fetch(API_BASE_URL + requestConfig.endpoint, {
    method: 'GET',
    headers: requestConfig.headers,
  })
    .then(function (response) {
      return response.text().then(function (text) {
        var payload = {};
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch (error) {
            throw new Error('模型接口返回了非 JSON 响应');
          }
        }

        if (!response.ok) {
          throw new Error(parseModelApiError(response, payload));
        }

        var models = extractModelsFromResponse(modelSelectorRefs.apiType, payload);
        if (!models.length) {
          throw new Error('未获取到可用模型');
        }

        modelListCache[cacheKey] = models;
        populateModelSelector(models);
      });
    })
    .catch(function (error) {
      if (!modelSelectorRefs.selectEl) return;
      modelSelectorRefs.selectEl.innerHTML = '<option value="">模型加载失败</option>';
      modelSelectorRefs.selectEl.disabled = true;
      updateModelSelectorHint('模型加载失败：' + error.message, true);
    })
    .finally(function () {
      if (modelSelectorRefs.refreshBtn) {
        modelSelectorRefs.refreshBtn.disabled = false;
      }
    });
}

function initModelSelector() {
  var bodyContent = document.getElementById('bodyContent');
  if (!bodyContent) return;

  var requestBodyEl = document.getElementById('requestBody');
  var modelNameEl = document.getElementById('modelName');
  if (!requestBodyEl && !modelNameEl) return;

  if (!document.getElementById('modelSelector')) {
    var modelGroup = document.createElement('div');
    modelGroup.className = 'test-form-group';
    modelGroup.innerHTML =
      '<label class="test-label">可用模型</label>' +
      '<div class="test-model-selector-row">' +
      '<select id="modelSelector" class="test-input test-model-select"></select>' +
      '<button type="button" id="refreshModelBtn" class="test-model-refresh">刷新</button>' +
      '</div>' +
      '<div id="modelSelectorHint" class="test-model-hint">加载模型中...</div>';

    var firstGroup = bodyContent.querySelector('.test-form-group');
    if (firstGroup) {
      bodyContent.insertBefore(modelGroup, firstGroup);
    } else {
      bodyContent.appendChild(modelGroup);
    }
  }

  modelSelectorRefs.apiType = detectModelApiType();
  modelSelectorRefs.requestBodyEl = requestBodyEl;
  modelSelectorRefs.modelNameEl = modelNameEl;
  modelSelectorRefs.selectEl = document.getElementById('modelSelector');
  modelSelectorRefs.hintEl = document.getElementById('modelSelectorHint');
  modelSelectorRefs.refreshBtn = document.getElementById('refreshModelBtn');

  if (!modelSelectorRefs.selectEl) return;

  modelSelectorRefs.selectEl.addEventListener('change', function (e) {
    var selectedModel = e.target.value;
    localStorage.setItem(getModelStorageKey(), selectedModel);
    applyModelToTestRequest(selectedModel, true);
    updateModelSelectorHint('已选择模型：' + selectedModel, false);
  });

  if (modelSelectorRefs.refreshBtn) {
    modelSelectorRefs.refreshBtn.addEventListener('click', function () {
      loadAvailableModels(true);
    });
  }

  if (modelSelectorRefs.modelNameEl) {
    modelSelectorRefs.modelNameEl.addEventListener('input', function () {
      updateBaseUrlDisplay();
    });
  }

  updateBaseUrlDisplay();
  loadAvailableModels(false);
}

/* ===== Toggle Helpers ===== */
function toggleTestSection() {
  var content = document.getElementById('testContent');
  var toggle = document.getElementById('testToggle');
  if (content) content.classList.toggle('expanded');
  if (toggle) toggle.classList.toggle('expanded');
}

function toggleSubsection(name) {
  var content = document.getElementById(name + 'Content');
  var toggle = document.getElementById(name + 'Toggle');
  if (content) content.classList.toggle('expanded');
  if (toggle) toggle.classList.toggle('expanded');
}

/* ===== Generic API Request Sender ===== */
function sendApiRequest(endpoint, extraHeaders) {
  API_TEST_ENDPOINT = endpoint;
  updateBaseUrlDisplay();

  return function (event) {
    if (event) event.stopPropagation();

    var btn = document.getElementById('sendBtn');
    var responseArea = document.getElementById('responseArea');
    var responseStatus = document.getElementById('responseStatus');
    var responseBody = document.getElementById('responseBody');

    var token = document.getElementById('authToken')
      ? document.getElementById('authToken').value.trim()
      : '';
    var bodyEl = document.getElementById('requestBody');
    var body = bodyEl ? bodyEl.value : '{}';

    if (!token) {
      alert('请输入 Token');
      return;
    }

    btn.disabled = true;
    btn.innerHTML =
      '<div class="test-button-spinner"></div><span>发送中...</span>';
    responseArea.style.display = 'none';

    var headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    };
    if (extraHeaders) {
      for (var key in extraHeaders) {
        headers[key] = extraHeaders[key];
      }
    }

    fetch(API_BASE_URL + endpoint, {
      method: 'POST',
      headers: headers,
      body: body,
    })
      .then(function (response) {
        var contentType = response.headers.get('content-type') || '';
        if (contentType.indexOf('application/json') === -1) {
          throw new Error(
            response.status + ' - 响应不是 JSON 格式。请检查 Base URL 是否指向正确的 API 服务地址（当前: ' + API_BASE_URL + '）'
          );
        }
        return response.json().then(function (data) {
          responseStatus.innerHTML =
            '<span class="' +
            (response.ok ? 'status-success' : 'status-error') +
            '">' +
            response.status +
            ' ' +
            response.statusText +
            '</span>' +
            '<span style="color: var(--text-muted);">&middot;</span>' +
            '<span style="color: var(--text-muted);">' +
            new Date().toLocaleTimeString() +
            '</span>';
          responseBody.textContent = JSON.stringify(data, null, 2);
          responseArea.style.display = 'block';
        });
      })
      .catch(function (error) {
        responseStatus.innerHTML =
          '<span class="status-error">Error</span>';
        responseBody.textContent = error.message;
        responseArea.style.display = 'block';
      })
      .finally(function () {
        btn.disabled = false;
        btn.innerHTML =
          '<span>发送请求</span><span class="method-badge-header">POST</span>';
      });
  };
}
