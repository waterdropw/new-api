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
