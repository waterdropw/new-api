/* ===== API Base URL ===== */
var API_BASE_URL = localStorage.getItem('api_base_url') || 'https://api.neurizon.cn';

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
        '<label class="test-label">Base URL</label>' +
        '<input type="text" class="test-input" id="apiBaseUrl" placeholder="https://api.neurizon.cn">';
      authContent.insertBefore(group, authContent.firstChild);

      var baseUrlEl = document.getElementById('apiBaseUrl');
      baseUrlEl.value = API_BASE_URL;
      baseUrlEl.addEventListener('input', function (e) {
        var val = e.target.value.trim().replace(/\/+$/, '');
        API_BASE_URL = val || 'https://api.neurizon.cn';
        localStorage.setItem('api_base_url', API_BASE_URL);
      });
    }
  }
});

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
