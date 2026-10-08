/* ==========================================================================
   Autional Service Lab · 公共 demo JS 唯一源（ui-demo/demokit）
   --------------------------------------------------------------------------
   dk 组件库（v1.1.0）：业务 demo 的交互组件全部由本文件提供，业务页零重复。

   组件（按页面元素自动启用）：
   1. 健康检查 statusbar：#conn-dot + #conn-text（header 右侧连接状态）
   2. 探针 pills：#readyPill / #dbPill / #healthPill（可选，就绪/DB/健康状态）
   3. 面板切换：.nav-btn[data-panel] ↔ #<id>-panel（侧栏导航联动 + active 高亮，
      第一个面板默认激活；面板淡入动画由 brand.css .panel.active 提供）

   用法（业务页）：
   <body class="dk-app">
     <aside>... <div class="nav-group">
       <button class="nav-btn active" data-panel="read">读取资料</button>
       <button class="nav-btn" data-panel="write">写入资料</button>
     </div> ...</aside>
     <div class="content">
       <section class="panel light active" id="read-panel">...</section>
       <section class="panel light" id="write-panel">...</section>
     </div>
   </body>
   <!-- demo.js 自动初始化，无需额外代码 -->

   零外部资源、零依赖，符合严格 CSP（script-src 'self' 'unsafe-inline' https://cdn.autional.cn）。
   ========================================================================== */
(function () {
  'use strict';

  var HEALTH_INTERVAL = 30000;
  var HEALTH_TIMEOUT = 3000;
  var PROBE_INTERVAL = 15000;

  function $(id) { return document.getElementById(id); }

  // AbortSignal.timeout 兼容：旧 WebView 缺失时回退 AbortController（任一异常
  // 都不得中断 start()，否则健康检查/探针的 setInterval 不会被注册）。
  function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return c.signal;
  }

  /* ---------- 1. 健康检查 statusbar ---------- */
  function checkHealth() {
    var dot = $('conn-dot');
    var txt = $('conn-text');
    if (!dot || !txt) return;
    var signal;
    try { signal = timeoutSignal(HEALTH_TIMEOUT); } catch (e) { signal = undefined; }
    // 相对路径（无前导 /）：前缀挂载下自动指向本服务，根挂载语义不变
    fetch('health', { signal: signal })
      .then(function (r) {
        dot.className = 'status-dot' + (r.ok ? ' ok' : ' dead');
        txt.textContent = r.ok ? 'SYSTEM ACTIVE' : 'API ERROR';
      })
      .catch(function () {
        dot.className = 'status-dot dead';
        txt.textContent = 'OFFLINE';
      });
  }

  /* ---------- 2. 探针 pills（就绪 / DB / 健康） ---------- */
  function setPill(id, cls, label) {
    var el = $(id);
    if (!el) return;
    el.className = 'pill ' + cls;
    el.innerHTML = '<span class="dot"></span>' + label;
  }

  function probeStatus() {
    if (!$('readyPill')) return;
    fetch('ready')
      .then(function (r) { return r.text().then(function (t) {
        var parsed;
        try { parsed = JSON.parse(t); } catch (e) { parsed = t; }
        var status = (parsed && typeof parsed === 'object') ? (parsed.status || 'ok') : (r.ok ? 'ready' : 'bad');
        setPill('readyPill', r.ok && status !== 'unhealthy' ? 'ok' : 'bad', '就绪 ' + status);
        var db = (parsed && parsed.checks && parsed.checks.db) || '—';
        setPill('dbPill', String(db).toLowerCase().indexOf('ok') >= 0 || String(db).toLowerCase() === 'healthy' ? 'ok' : 'bad', 'DB ' + db);
      }); })
      .catch(function () { setPill('readyPill', 'bad', '就绪 不可达'); });

    fetch('health')
      .then(function (r) { return r.json().then(function (j) {
        var status = j.status || 'unknown';
        setPill('healthPill', status === 'healthy' ? 'ok' : 'bad', '健康 ' + status);
      }); })
      .catch(function () { setPill('healthPill', 'bad', '健康 不可达'); });
  }

  /* ---------- 3. 面板切换 + 导航 active ---------- */
  function showPanel(pid) {
    var panels = document.querySelectorAll('.content > .panel');
    for (var i = 0; i < panels.length; i++) {
      var show = panels[i].id === pid + '-panel';
      panels[i].style.display = show ? 'block' : 'none';
      panels[i].classList.toggle('active', show);
    }
  }

  function syncNavA11y(navBtns) {
    for (var j = 0; j < navBtns.length; j++) {
      var pid = navBtns[j].getAttribute('data-panel');
      if (pid) navBtns[j].setAttribute('aria-controls', pid + '-panel');
      navBtns[j].setAttribute('aria-current', navBtns[j].classList.contains('active') ? 'true' : 'false');
    }
  }

  function bindApp() {
    var navBtns = document.querySelectorAll('.nav-btn[data-panel]');
    if (!navBtns.length) return;
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].addEventListener('click', (function (btn) {
        return function () {
          showPanel(btn.getAttribute('data-panel'));
          for (var j = 0; j < navBtns.length; j++) {
            navBtns[j].classList.toggle('active', navBtns[j] === btn);
          }
          syncNavA11y(navBtns);
        };
      })(navBtns[i]));
    }
    // 默认激活第一个（HTML 上 active 类由页面控制，这里兜底显示对应面板）
    showPanel(navBtns[0].getAttribute('data-panel'));
    syncNavA11y(navBtns);
  }

  /* ---------- 4. 折叠区（data-toggle="target-id"，点击展开/收起） ---------- */
  function bindToggles() {
    var btns = document.querySelectorAll('[data-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var t0 = $(btns[i].getAttribute('data-toggle'));
      btns[i].setAttribute('aria-expanded', t0 && t0.classList.contains('open') ? 'true' : 'false');
      btns[i].addEventListener('click', (function (btn) {
        return function () {
          var target = $(btn.getAttribute('data-toggle'));
          if (!target) return;
          target.classList.toggle('open');
          btn.classList.toggle('active', target.classList.contains('open'));
          btn.setAttribute('aria-expanded', target.classList.contains('open') ? 'true' : 'false');
        };
      })(btns[i]));
    }
  }

  /* ---------- 初始化 ---------- */
  function start() {
    bindApp();
    bindToggles();
    checkHealth();
    probeStatus();
    setInterval(checkHealth, HEALTH_INTERVAL);
    setInterval(probeStatus, PROBE_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

/* ==========================================================================
   dk 运行时（v1.7.0）：window.dk
   --------------------------------------------------------------------------
   业务页共享的 HTTP 客户端 / 配置下发 / token 装载 / 结果盒渲染 /
   破坏性操作两步确认 / 假 ULID / 演示身份层（dk.identity）/ 面命名字典
   （dk.faces）/ nav-foot 标准件（data-dk-navfoot）/ 无障碍增强。
   这些能力此前在 12~21 个服务业务页各自内联重复（reloadConfig/call/jwtCall/
   show/showRes/pretty/esc/loadTokens），现收归唯一源。

   纯增量：不改变上方既有 IIFE 的任何行为；未调用 dk.* 的页面零影响。
   零外部资源、零依赖，符合严格 CSP（script-src 'self'）。

   约定：
   - token 仅存内存（dk.state），永不写 localStorage/sessionStorage；
   - 只支持同源相对路径（CSP default-src 'self' 必拦绝对 URL）；
   - dk.showRes 首行格式冻结为 e2e 锚点：`✅/❌ <status> · <marker>`。
   ========================================================================== */
(function () {
  'use strict';

  // AbortSignal.timeout 兼容回退（与上方 IIFE 同语义；两处独立以免互相依赖）。
  function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return c.signal;
  }

  function $(elOrId) {
    if (!elOrId) return null;
    return typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function pretty(text) {
    if (text == null) return '';
    if (text === '') return '';
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch (e) { return String(text); }
  }

  var state = { config: null, apiKey: '', tokens: null };

  function isAbsoluteUrl(p) { return /^[a-z][a-z0-9+.-]*:\/\//i.test(p) || /^\/\//.test(p); }

  // request：统一信封 { ok, status, text, body, headers, error }。
  // text 只读取一次（先 r.text() 再尝试 JSON.parse）→ 204/空体安全，不会出现
  // “body stream already read”。网络异常/超时 → status 0，error 为中文提示。
  // 支持的 opts：method/headers/body（对象自动 JSON）/signal/timeout/cache ——
  // cache（如 'no-store'）显式透传：invariant 是「opts 里给出的 fetch 语义不得被静默吞掉」，
  // 页面以 no-store 声明跨视角（带头/不带头）读同一 URL 时必须真正绕开浏览器缓存
  // （曾致 compliance F12.9 读到 max-age=300 旧视角缓存、请求未达服务端）。
  function request(path, opts) {
    opts = opts || {};
    if (isAbsoluteUrl(path)) {
      return Promise.resolve({ ok: false, status: 0, text: '', body: null, headers: null, error: 'CSP: 仅允许同源相对路径' });
    }
    // 一律以页面为基解析（剥前导 /）：根挂载（base=/）与绝对路径等价；
    // 前缀挂载（入口域 demo.autional.cn/<slug>/）自动带前缀，调用点无需感知。
    path = path.replace(/^\/+/, '');
    var headers = Object.assign({}, opts.headers || {});
    var body = opts.body;
    var isForm = (typeof FormData !== 'undefined' && body instanceof FormData) ||
                 (typeof Blob !== 'undefined' && body instanceof Blob);
    if (body != null && typeof body === 'object' && !isForm) {
      // 普通对象自动序列化；FormData/Blob 原样（不设 Content-Type，保留 multipart boundary）
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    } else if (typeof body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    var init = { method: opts.method || 'GET', headers: headers };
    if (body != null) init.body = body;
    if (opts.signal) init.signal = opts.signal;
    else if (opts.timeout) init.signal = timeoutSignal(opts.timeout);
    if (opts.cache) init.cache = opts.cache;

    return fetch(path, init).then(function (r) {
      return r.text().then(function (t) {
        var parsed = null;
        if (t) { try { parsed = JSON.parse(t); } catch (e) { parsed = null; } }
        return { ok: r.ok, status: r.status, text: t, body: parsed, headers: r.headers, error: '' };
      });
    }).catch(function (e) {
      var name = e && e.name;
      var msg = name === 'TimeoutError' || name === 'AbortError' ? '请求超时' : '网络不可达（服务未启动或端口错误）';
      return { ok: false, status: 0, text: '', body: null, headers: null, error: e && e.message ? (msg + '：' + e.message) : msg };
    });
  }

  function tenantValue() {
    var el = document.getElementById('tenant');
    return el ? String(el.value || '').trim() : '';
  }

  // internal 面：X-API-Key + X-Tenant-ID。
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    if (state.apiKey && !headers['X-API-Key']) headers['X-API-Key'] = state.apiKey;
    var t = (opts.tenant === false) ? '' : (typeof opts.tenant === 'string' ? opts.tenant : tenantValue());
    if (t && !headers['X-Tenant-ID']) headers['X-Tenant-ID'] = t;
    return request(path, Object.assign({}, opts, { headers: headers }));
  }

  // JWT 面：Bearer。token 可传原始串，或 'admin'/'member'/'app'（查 dk.tokens 缓存）。
  // 默认不带 X-Tenant-ID（租户以令牌声明为权威）；需要时 opts.tenant=true。
  function jwt(path, token, opts) {
    opts = opts || {};
    var tk = (token === 'admin' || token === 'member' || token === 'app') ? tokenValue(token) : token;
    if (!tk && (token === 'admin' || token === 'member' || token === 'app')) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[dk] jwt: 角色 "' + token + '" 无可用 token，请先 await dk.tokens()');
      }
    }
    var headers = Object.assign({}, opts.headers || {});
    if (tk) headers['Authorization'] = 'Bearer ' + tk;
    if (opts.tenant && !headers['X-Tenant-ID']) headers['X-Tenant-ID'] = tenantValue();
    var o = Object.assign({}, opts, { headers: headers });
    return request(path, o);
  }

  // /demo/api/config（内存缓存；失败返回 null 不抛）
  function fetchConfig(force) {
    if (state.config && !force) return Promise.resolve(state.config);
    return request('/demo/api/config', { timeout: 3000 }).then(function (res) {
      if (res.ok && res.body && typeof res.body === 'object') {
        state.config = res.body;
        if (res.body.internal_api_key) state.apiKey = res.body.internal_api_key;
        return state.config;
      }
      return null;
    });
  }

  var DEFAULT_CONFIG_MAP = [
    { from: 'tenant_id', to: ['tenant'] },
    { from: 'user_id', to: ['user'] },
    { from: 'admin_user_id', to: ['adminUser'] }
  ];

  // loadConfig：取 config 并按映射填入输入框。mapping 可覆盖默认 3 键；
  // 条目形如 'id' | ['id1','id2'] | { from, to, onlyIfEmpty }。缺元素静默跳过。
  function loadConfig(mapping) {
    return fetchConfig(true).then(function (cfg) {
      if (!cfg) return { ok: false, config: null, filled: [], skipped: [] };
      var entries = mapping || DEFAULT_CONFIG_MAP;
      var filled = [], skipped = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i], from, to, onlyIfEmpty = false;
        if (typeof e === 'string') { from = e; to = [e]; }
        else { from = e.from; to = e.to || []; onlyIfEmpty = !!e.onlyIfEmpty; }
        if (typeof to === 'string') to = [to];
        var v = cfg[from];
        if (v == null || v === '') { skipped.push(from); continue; }
        var any = false;
        for (var j = 0; j < to.length; j++) {
          var el = document.getElementById(to[j]);
          if (!el) { skipped.push(to[j]); continue; }
          if (onlyIfEmpty && el.value) continue;
          el.value = v; any = true; filled.push(to[j]);
        }
        if (!any) skipped.push(from);
      }
      return { ok: true, config: cfg, filled: filled, skipped: skipped };
    });
  }

  var TOKEN_PATHS = ['/demo/api/demo-tokens', '/demo/api/token'];

  function normalizeRole(role) {
    var r = String(role || '').toLowerCase();
    if (r === 'super_admin' || r === 'admin' || r === 'owner') return 'admin';
    if (r === 'member' || r === 'user') return 'member';
    if (r === 'app' || r === 'workload' || r === 'service') return 'app';
    return r;
  }

  function extractAccounts(body) {
    if (!body || typeof body !== 'object') return [];
    var src = body.accounts || (body.data && body.data.accounts) || null;
    if (Array.isArray(src)) return src;
    if (body.access_token) return [{ role: body.role || 'member', user_id: body.user_id, access_token: body.access_token }];
    if (body.data && body.data.access_token) return [{ role: body.data.role || 'member', user_id: body.data.user_id, access_token: body.data.access_token }];
    return [];
  }

  // tokens：依次探测 paths（默认 demo-tokens 多账号优先，单 token 兜底）。
  // 不做业务路径猜测；专用端点（如 *-token）由调用页显式传 { paths: [...] }。
  function loadTokens(opts) {
    opts = opts || {};
    if (state.tokens && !opts.force) return Promise.resolve(state.tokens);
    var paths = opts.paths || TOKEN_PATHS;
    var i = 0;
    function next() {
      if (i >= paths.length) return Promise.resolve({ ok: false, accounts: {}, list: [], raw: null, source: null });
      var p = paths[i++];
      return request(p, { timeout: 4000 }).then(function (res) {
        var list = (res.ok ? extractAccounts(res.body) : []).filter(function (a) { return a && a.access_token; });
        if (!list.length) return next();
        var accounts = {};
        for (var k = 0; k < list.length; k++) {
          var role = normalizeRole(list[k].role);
          if (role && !accounts[role]) accounts[role] = list[k];
        }
        state.tokens = { ok: true, accounts: accounts, list: list, raw: res.body, source: p };
        return state.tokens;
      });
    }
    return next();
  }

  function tokenValue(role) {
    if (!state.tokens || !role) return '';
    var a = state.tokens.accounts[role];
    return a && a.access_token ? a.access_token : '';
  }

  // ── 结果盒渲染（.result）──
  function show(el, ok, text) {
    var n = $(el);
    if (!n) return;
    n.removeAttribute('aria-busy');
    n.className = 'result ' + (ok ? 'ok' : 'err');
    n.textContent = text == null ? '' : String(text);
    try { n.scrollTop = 0; } catch (e) { /* no-op */ }
  }

  function waiting(el, text) {
    var n = $(el);
    if (!n) return;
    n.className = 'result waiting';
    n.textContent = text || '请求中…';
    n.setAttribute('aria-busy', 'true');
  }

  // showRes：首行冻结为 e2e 锚点 `✅/❌ <status> · <marker>`；次行为响应体。
  function showRes(el, res, marker) {
    res = res || {};
    var head = (res.ok ? '✅ ' : '❌ ') + res.status + ' · ' + marker;
    var bodyText = res.text == null ? '' : String(res.text);
    if (!bodyText && res.status === 0) bodyText = res.error || '网络不可达';
    show(el, res.ok, bodyText ? head + '\n' + bodyText : head);
  }

  // ── 破坏性操作两步确认（防连点）──
  // handler 首条同步语句调用：if (!dk.confirm2(btn, '确认删除？再点一次执行')) return;
  // 首点武装（按钮文案切换 + data-armed，默认 3s 自动还原）；窗口内再点返回 true
  // 并即时还原。元素缺失 fail-closed（返回 false，绝不无确认执行）。
  // 不弹原生 dialog：e2e 以「同按钮点两次」为锚点。
  function confirm2(el, armedLabel, opts) {
    var btn = $(el);
    if (!btn) return false;
    if (btn.getAttribute('data-armed') === '1') {
      clearTimeout(btn.__dkConfirmTimer);
      btn.removeAttribute('data-armed');
      if (btn.__dkConfirmHtml != null) { btn.innerHTML = btn.__dkConfirmHtml; btn.__dkConfirmHtml = null; }
      return true;
    }
    var win = (opts && opts.window) || 3000;
    btn.__dkConfirmHtml = btn.innerHTML;
    btn.setAttribute('data-armed', '1');
    btn.textContent = armedLabel || '再点一次确认执行';
    btn.__dkConfirmTimer = setTimeout(function () {
      btn.removeAttribute('data-armed');
      if (btn.__dkConfirmHtml != null) { btn.innerHTML = btn.__dkConfirmHtml; btn.__dkConfirmHtml = null; }
    }, win);
    return false;
  }

  // ── 假 ULID（GDPR / 擦除类演示目标）──
  // 运行时生成 26 位 Crockford Base32 ULID（10 字符 48-bit 毫秒时间戳 + 16 字符
  // 80-bit 随机）；用于擦除/导出类面板预填合成受试用户，杜绝默认指向真实 demo
  // 账号。严禁在页面写死 26 位 ULID 字面量（check-demo-ids R2 门禁）。
  var ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  function fakeUlid(ts) {
    var time = typeof ts === 'number' ? ts : Date.now();
    var out = '';
    for (var i = 0; i < 10; i++) {
      out = ULID_ALPHABET.charAt(time % 32) + out;
      time = Math.floor(time / 32);
    }
    var bytes = new Uint8Array(10);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (var b = 0; b < 10; b++) bytes[b] = Math.floor(Math.random() * 256);
    for (var j = 0; j < 16; j++) {
      var v = 0;
      for (var k = 0; k < 5; k++) {
        var p = j * 5 + k;
        v = (v << 1) | ((bytes[p >> 3] >> (7 - (p & 7))) & 1);
      }
      out += ULID_ALPHABET.charAt(v);
    }
    return out;
  }

  /* ── 演示身份层（dk.identity，v1.4.0）──
     四档身份 guest < member < admin < super_admin（guest = 未登录）。身份层是
     「演示编排」而非安全边界：它只影响 (a) data-dk-requires 标注元素的可用性
     （不足 → disabled + .dk-gate-note 提示条，绝不隐藏）与 (b) identity.token()
     返回的当前档 token；服务端鉴权仍由各服务实时解析。
     页面声明默认档：<body data-dk-identity="admin">；缺省 = 'admin'。
     未声明且无 data-dk-requires 标注的页面零影响（不挂身份条、不扫描）。
     持久化 = 纯会话内存（不落 localStorage/sessionStorage）。 */
  var TIER_ORDER = ['guest', 'member', 'admin', 'super_admin'];
  var TIER_RANK = { guest: 0, member: 1, admin: 2, super_admin: 3 };
  var TIER_LABEL = { guest: '未登录', member: '普通用户', admin: '管理员', super_admin: '超级管理员' };

  state.identity = { tier: 'admin', token: '', declared: '', bar: null, listeners: [], touched: false };

  function identityWarn(msg) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[dk] identity: ' + msg);
  }

  // byRawRole：原始角色名 → 档位（别名折叠与 normalizeRole 一致：owner→admin、
  // user→member 等；super_admin 独立成档）。未知角色返回 ''（不构成档位）。
  function byRawRole(raw) {
    var r = String(raw == null ? '' : raw).toLowerCase().trim();
    if (r === '') return 'guest';
    if (r === 'super_admin' || r === 'superadmin' || r === 'root') return 'super_admin';
    if (r === 'admin' || r === 'owner' || r === 'operator') return 'admin';
    if (r === 'member' || r === 'user') return 'member';
    if (r === 'guest' || r === 'anonymous') return 'guest';
    return '';
  }

  function accountsByTier(tk) {
    var out = {};
    var list = (tk && tk.list) || [];
    for (var i = 0; i < list.length; i++) {
      var t = byRawRole(list[i].role);
      if (t && t !== 'guest' && !out[t]) out[t] = list[i];
    }
    return out;
  }

  function tierToken(tier, tk) {
    if (!tier || tier === 'guest') return '';
    var acct = accountsByTier(tk)[tier];
    return acct && acct.access_token ? acct.access_token : '';
  }

  function renderIdentityBar() {
    var bar = state.identity.bar;
    if (!bar) return;
    var btns = bar.querySelectorAll('.dk-identity-btn');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-dk-tier') === state.identity.tier;
      btns[i].classList.toggle('active', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    var badge = bar.querySelector('.dk-identity-badge');
    if (badge) {
      var txt = '当前：' + (TIER_LABEL[state.identity.tier] || state.identity.tier);
      if (state.tokens && state.identity.tier !== 'guest' && !state.identity.token) txt += '（无对应 token）';
      badge.textContent = txt;
    }
  }

  // gate：按档位启用/禁用单个元素（不足 → disabled + 提示条；足够 → 还原并移除提示条）。
  function gateElement(el, required) {
    var node = $(el);
    if (!node) return false;
    var raw = required == null ? node.getAttribute('data-dk-requires') : required;
    var need = byRawRole(raw);
    var pass = !!need && TIER_RANK[state.identity.tier] >= TIER_RANK[need];
    node.disabled = !pass;
    node.classList.toggle('dk-gated', !pass);
    var note = node.__dkGateNote;
    if (!pass) {
      if (!note) {
        note = document.createElement('span');
        note.className = 'dk-gate-note';
        note.setAttribute('data-dk-gate-for', node.id || '');
        note.setAttribute('role', 'status');
        node.__dkGateNote = note;
        if (node.parentNode) node.parentNode.insertBefore(note, node.nextSibling);
      }
      note.textContent = '需「' + (TIER_LABEL[need] || '更高') + '」身份 · 当前：' +
        (TIER_LABEL[state.identity.tier] || state.identity.tier);
    } else if (note) {
      if (note.parentNode) note.parentNode.removeChild(note);
      node.__dkGateNote = null;
    }
    return pass;
  }

  function scanIdentityGates() {
    var els = document.querySelectorAll('[data-dk-requires]');
    for (var i = 0; i < els.length; i++) gateElement(els[i]);
  }

  function fireIdentityChange(tier) {
    var ls = state.identity.listeners.slice();
    for (var i = 0; i < ls.length; i++) {
      try { ls[i](tier, state.identity.token); } catch (e) { /* 单监听器异常不影响切换 */ }
    }
  }

  // set：切档。同步路径立即更新档位 + 重扫 gate（提示即时），随后复用
  // dk.tokens() 解析该档 token（缓存命中即同步可用），再触发 onChange。
  function setIdentity(tier) {
    var t = byRawRole(tier);
    if (!t) {
      identityWarn('set: 未知档位 "' + tier + '"（已忽略）');
      return Promise.resolve(state.identity.tier);
    }
    state.identity.touched = true;
    state.identity.tier = t;
    state.identity.token = tierToken(t, state.tokens);
    renderIdentityBar();
    scanIdentityGates();
    return loadTokens().then(function (tk) {
      state.identity.token = tierToken(t, tk);
      renderIdentityBar();
      fireIdentityChange(t);
      return t;
    });
  }

  function onIdentityChange(fn) {
    if (typeof fn !== 'function') return function () {};
    state.identity.listeners.push(fn);
    return function () {
      var i = state.identity.listeners.indexOf(fn);
      if (i >= 0) state.identity.listeners.splice(i, 1);
    };
  }

  // mount：渲染身份条（.dk-identity，独立类名不触碰保留选择器）。target 缺省 →
  // .dk-app .content 顶部，回退 body。重复调用迁移而不重复建条。
  function mountIdentity(target) {
    var host = target ? $(target) : null;
    if (!host) host = document.querySelector('.dk-app .content') || document.body;
    if (!host) return null;
    state.identity.touched = true;
    if (state.identity.bar && state.identity.bar.parentNode) {
      state.identity.bar.parentNode.removeChild(state.identity.bar);
    }
    var bar = document.createElement('div');
    bar.className = 'dk-identity';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', '演示身份切换');
    var lab = document.createElement('span');
    lab.className = 'dk-identity-label';
    lab.textContent = '演示身份';
    bar.appendChild(lab);
    for (var i = 0; i < TIER_ORDER.length; i++) {
      (function (t) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dk-identity-btn';
        btn.setAttribute('data-dk-tier', t);
        btn.textContent = TIER_LABEL[t];
        btn.addEventListener('click', function () { setIdentity(t); });
        bar.appendChild(btn);
      })(TIER_ORDER[i]);
    }
    var badge = document.createElement('span');
    badge.className = 'dk-identity-badge';
    bar.appendChild(badge);
    host.insertBefore(bar, host.firstChild);
    state.identity.bar = bar;
    renderIdentityBar();
    scanIdentityGates();
    return bar;
  }

  // autoInit：页面声明了 data-dk-identity 或存在 data-dk-requires 标注时自动挂条 + 定档。
  // 页面已显式 mount/set（touched）则让位给页面代码。
  function autoInitIdentity() {
    if (state.identity.touched) return;
    var declaredRaw = document.body ? String(document.body.getAttribute('data-dk-identity') || '').trim() : '';
    var gates = document.querySelectorAll('[data-dk-requires]');
    if (!declaredRaw && !gates.length) return;
    var declared = declaredRaw ? byRawRole(declaredRaw) : 'admin';
    if (!declared) {
      identityWarn('未知的 data-dk-identity="' + declaredRaw + '"，回落 "admin"');
      declared = 'admin';
    }
    state.identity.declared = declared;
    mountIdentity();
    setIdentity(declared);
  }

  /* ── 面命名字典（v1.6.0，规范 §1 单一来源）──
     六面统一叫法；nav 分组 <section> 标 data-dk-face="<key>" 即由本字典归一
     h2 文本，业务分组（账户/资金等）不标注不触碰。HTML 静态一致由
     check-demo-nav.py 门禁强制；此处运行时归一 + warn 是显示层兜底
     （HTML 漂移时用户仍见字典名，同时控制台留痕）。 */
  var FACES = {
    public: '公开面（无鉴权）',
    user: '用户面（JWT）',
    admin: '管理面（admin）',
    internal: '服务间（X-API-Key）',
    contract: '契约 / 开发者面',
    ops: '运行时 / 调度器'
  };

  function warn(scope, msg) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[dk] ' + scope + ': ' + msg);
  }

  function normalizeFaces() {
    var secs = document.querySelectorAll('section[data-dk-face]');
    for (var i = 0; i < secs.length; i++) {
      var key = secs[i].getAttribute('data-dk-face');
      var h2 = secs[i].querySelector('h2');
      if (!h2) { warn('faces', 'data-dk-face="' + key + '" 的 section 缺 h2（归一目标不存在）'); continue; }
      var want = FACES[key];
      if (!want) { warn('faces', '未知面 "' + key + '"，保持原文（check-demo-nav.py 会拦截）'); continue; }
      if (h2.textContent !== want) {
        warn('faces', '"' + h2.textContent + '" → "' + want + '"（请对齐 HTML）');
        h2.textContent = want;
      }
    }
  }

  /* ── nav-foot 标准件（v1.6.0，D9）──
     <div class="nav-foot" data-dk-navfoot="<svc>-service"> → 运行时追加
     主入口（/，门户）+ 文档站链接（DOC_SITES）。
     值空串 = 无文档站（仅主入口；captcha3d / config / hash-sm / hash-standard）。
     data-dk-navfoot-label 覆盖门户链接文案（gateway = 全服务总入口）。
     页面其余 nav-foot 内容（参数折叠等）保持静态；本组件只做追加（幂等）。 */
  var DOC_SITES = [
    { label: 'API 文档', base: 'https://reference.autional.cn/' },
    { label: 'API 知识库', base: 'https://wiki.autional.cn/' }
  ];

  function buildNavFoot() {
    var hosts = document.querySelectorAll('[data-dk-navfoot]');
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (host.getAttribute('data-dk-navfoot-built') === '1') continue;
      host.setAttribute('data-dk-navfoot-built', '1');
      var svc = String(host.getAttribute('data-dk-navfoot') || '').trim();
      var portal = document.createElement('a');
      portal.className = 'mini-btn';
      portal.href = '/';
      portal.textContent = host.getAttribute('data-dk-navfoot-label') || '主入口';
      host.appendChild(portal);
      if (!svc) continue;
      for (var j = 0; j < DOC_SITES.length; j++) {
        var a = document.createElement('a');
        a.className = 'mini-btn';
        a.href = DOC_SITES[j].base + svc + '/';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = DOC_SITES[j].label;
        host.appendChild(a);
      }
    }
  }

  // enhance：零 HTML 改动的无障碍增强（焦点环由 brand.css 提供）。
  function enhance() {
    var fields = document.querySelectorAll('.field');
    for (var i = 0; i < fields.length; i++) {
      var lab = fields[i].querySelector('label');
      if (!lab || lab.htmlFor) continue;
      var ctrl = fields[i].querySelector('input[id],select[id],textarea[id]');
      if (ctrl) lab.htmlFor = ctrl.id;
    }
    var results = document.querySelectorAll('.result');
    for (var m = 0; m < results.length; m++) {
      if (!results[m].getAttribute('role')) {
        results[m].setAttribute('role', 'status');
        results[m].setAttribute('aria-live', 'polite');
        results[m].setAttribute('aria-atomic', 'true');
      }
    }
    var connText = document.getElementById('conn-text');
    if (connText && !connText.getAttribute('role')) { connText.setAttribute('role', 'status'); connText.setAttribute('aria-live', 'polite'); }
    var connDot = document.getElementById('conn-dot');
    if (connDot) connDot.setAttribute('aria-hidden', 'true');
    var sb = document.querySelector('.statusbar');
    if (sb && !sb.getAttribute('role')) { sb.setAttribute('role', 'status'); sb.setAttribute('aria-live', 'polite'); }
    var links = document.querySelectorAll('a[target="_blank"]');
    for (var n = 0; n < links.length; n++) {
      var rel = links[n].getAttribute('rel') || '';
      if (rel.indexOf('noopener') < 0) links[n].setAttribute('rel', (rel ? rel + ' ' : '') + 'noopener noreferrer');
    }
  }

  window.dk = {
    version: '1.8.0',
    state: state,
    $: $,
    esc: esc,
    pretty: pretty,
    request: request,
    api: api,
    jwt: jwt,
    config: fetchConfig,
    loadConfig: loadConfig,
    tenant: tenantValue,
    tokens: loadTokens,
    token: tokenValue,
    show: show,
    waiting: waiting,
    showRes: showRes,
    confirm2: confirm2,
    fakeUlid: fakeUlid,
    identity: {
      TIERS: TIER_ORDER.slice(),
      current: function () { return state.identity.tier; },
      token: function () { return state.identity.token; },
      set: setIdentity,
      onChange: onIdentityChange,
      can: function (required) {
        var need = byRawRole(required);
        if (!need) { identityWarn('can: 未知档位 "' + required + '"'); return false; }
        return TIER_RANK[state.identity.tier] >= TIER_RANK[need];
      },
      gate: gateElement,
      scan: scanIdentityGates,
      mount: mountIdentity
    },
    faces: {
      dict: (function () { var o = {}; for (var k in FACES) if (FACES.hasOwnProperty(k)) o[k] = FACES[k]; return o; })(),
      label: function (key) { var v = FACES[key]; if (!v) warn('faces', '未知面 "' + key + '"'); return v || ''; }
    },
    enhance: enhance
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance);
    document.addEventListener('DOMContentLoaded', autoInitIdentity);
    document.addEventListener('DOMContentLoaded', normalizeFaces);
    document.addEventListener('DOMContentLoaded', buildNavFoot);
  } else {
    enhance();
    autoInitIdentity();
    normalizeFaces();
    buildNavFoot();
  }
})();
