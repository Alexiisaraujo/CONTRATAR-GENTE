// ============================================================
//  BRASA — app.js
// ============================================================

// ───── DB ─────────────────────────────────────────────────
const DB = {
  getUsers:   () => JSON.parse(localStorage.getItem('brasa_users') || '[]'),
  saveUsers:  (u) => localStorage.setItem('brasa_users', JSON.stringify(u)),
  getJobs:    () => JSON.parse(localStorage.getItem('brasa_jobs') || '[]'),
  saveJobs:   (j) => localStorage.setItem('brasa_jobs', JSON.stringify(j)),
  setSession: (u) => localStorage.setItem('brasa_session', JSON.stringify(u)),
  getSession: () => JSON.parse(localStorage.getItem('brasa_session')),
  logout:     () => localStorage.removeItem('brasa_session'),
};

// ───── STATE ───────────────────────────────────────────────
let currentTab = 'home';
let urgentToggle = false;
let starRating = 0;
let activeFilter = 'todos';

// ───── UTILS ──────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: '🔔' };
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'🔔'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function showModal(html) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-box').innerHTML = html;
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-box').innerHTML = '';
  starRating = 0;
}

function avatar(name) {
  return name ? name.substring(0, 2).toUpperCase() : '??';
}

function tierInfo(pts) {
  if (pts >= 200) return { label: 'Elite 🏆', color: '#FFB820', emoji: '🏆' };
  if (pts >= 150) return { label: 'Experto ⭐', color: '#00C896', emoji: '⭐' };
  if (pts >= 100) return { label: 'Activo 🔥', color: '#FF6B2B', emoji: '🔥' };
  if (pts >= 50)  return { label: 'Nuevo 🌱', color: '#7A7F92', emoji: '🌱' };
  return { label: 'Bajo puntaje ⚠️', color: '#FF3B5C', emoji: '⚠️' };
}

function stars(pts) {
  const n = Math.min(5, Math.max(1, Math.round(pts / 50)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function getUser(name) {
  return DB.getUsers().find(u => u.name === name);
}

function updateUser(user) {
  const users = DB.getUsers();
  const i = users.findIndex(u => u.name === user.name);
  if (i > -1) users[i] = user;
  else users.push(user);
  DB.saveUsers(users);
  DB.setSession(user);
}

function canRaisePrices(user) {
  return user.points >= 180;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
}

// ───── INIT ───────────────────────────────────────────────
function init() {
  const user = DB.getSession();
  currentTab = 'home';
  if (!user) return renderAuth();
  if (user.type === 'empresa') return renderEmpresaDash(user);
  if (user.type === 'empleado') return renderEmpleadoDash(user);
}

// ───── AUTH ───────────────────────────────────────────────
let authMode = 'login'; // 'login' | 'register'
let selectedType = 'empleado';

function renderAuth() {
  document.getElementById('app').innerHTML = `
  <div class="auth-screen fade-in">
    <div class="auth-bg-glow one"></div>
    <div class="auth-bg-glow two"></div>

    <div class="auth-logo-section">
      <div class="auth-logo">brasa.</div>
      <div class="auth-tagline">Trabajos de cocina, al instante.</div>
    </div>

    <div class="auth-tabs">
      <button class="auth-tab ${authMode==='login'?'active':''}" onclick="setAuthMode('login')">Ingresar</button>
      <button class="auth-tab ${authMode==='register'?'active':''}" onclick="setAuthMode('register')">Registro</button>
    </div>

    ${authMode === 'register' ? `
      <div class="form-group">
        <label class="form-label">Soy un…</label>
        <div class="user-type-grid">
          <div class="type-card ${selectedType==='empleado'?'selected-worker':''}" onclick="selectType('empleado')">
            <div class="type-card-icon">👨‍🍳</div>
            <div class="type-card-label" style="color:${selectedType==='empleado'?'var(--worker)':'var(--text)'}">Empleado</div>
          </div>
          <div class="type-card ${selectedType==='empresa'?'selected-emp':''}" onclick="selectType('empresa')">
            <div class="type-card-icon">🏢</div>
            <div class="type-card-label" style="color:${selectedType==='empresa'?'var(--emp)':'var(--text)'}">Empresa</div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Nombre / Razón social</label>
        <input id="reg-name" class="form-input" placeholder="Ej: Juan García / Restaurante El Sol" />
      </div>

      <div class="form-group">
        <label class="form-label">Ciudad</label>
        <input id="reg-city" class="form-input" placeholder="Ej: Buenos Aires" />
      </div>

      <button class="btn btn-primary" onclick="doRegister()">Crear cuenta</button>
    ` : `
      <div class="form-group">
        <label class="form-label">Nombre de usuario</label>
        <input id="login-name" class="form-input" placeholder="Tu nombre registrado" />
      </div>

      <button class="btn btn-primary" onclick="doLogin()">Ingresar</button>
    `}
  </div>`;
}

function setAuthMode(m) { authMode = m; renderAuth(); }
function selectType(t) { selectedType = t; renderAuth(); }

function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const city = (document.getElementById('reg-city').value.trim()) || 'Sin ciudad';
  if (!name) return toast('Ingresá tu nombre', 'error');

  let users = DB.getUsers();
  if (users.find(u => u.name === name)) return toast('Ya existe ese usuario', 'error');

  const user = {
    name, city,
    type: selectedType,
    points: 100,
    history: [],
    jobs_done: 0,
    since: Date.now()
  };
  users.push(user);
  DB.saveUsers(users);
  DB.setSession(user);
  toast(`¡Bienvenido, ${name}! 🎉`, 'success');
  init();
}

function doLogin() {
  const name = document.getElementById('login-name').value.trim();
  const user = getUser(name);
  if (!user) return toast('Usuario no encontrado', 'error');
  DB.setSession(user);
  toast(`Hola de nuevo, ${name} 👋`, 'success');
  init();
}

function logout() { DB.logout(); authMode = 'login'; init(); }

// ───── EMPRESA DASHBOARD ──────────────────────────────────
function renderEmpresaDash(user) {
  const tabs = [
    { id: 'home',    icon: '🏠', label: 'Inicio' },
    { id: 'publish', icon: '➕', label: 'Publicar' },
    { id: 'jobs',    icon: '📋', label: 'Mis Ofertas' },
    { id: 'profile', icon: '⚙️', label: 'Perfil' },
  ];

  const content = () => {
    if (currentTab === 'home')    return renderEmpresaHome(user);
    if (currentTab === 'publish') return renderPublishForm(user);
    if (currentTab === 'jobs')    return renderMyJobs(user);
    if (currentTab === 'profile') return renderProfile(user);
    return '';
  };

  document.getElementById('app').innerHTML = `
  <div class="screen">
    <div class="topbar">
      <div class="topbar-logo">brasa.</div>
      <div class="topbar-user">
        <div class="topbar-avatar emp-color">${avatar(user.name)}</div>
        <button class="btn-icon" onclick="logout()">🚪</button>
      </div>
    </div>

    <div class="page-content fade-in" id="page-content">
      ${content()}
    </div>

    <nav class="bottom-nav">
      ${tabs.map(t => `
        <button class="nav-item ${currentTab===t.id?'active':''}" onclick="switchTab('${t.id}','empresa')">
          <span class="nav-icon">${t.icon}</span>
          <span class="nav-label">${t.label}</span>
        </button>
      `).join('')}
    </nav>
  </div>`;
}

function renderEmpresaHome(user) {
  const jobs = DB.getJobs().filter(j => j.owner === user.name);
  const open = jobs.filter(j => !j.taken).length;
  const done = jobs.filter(j => j.taken).length;
  const tier = tierInfo(user.points);
  const barW = Math.min(100, user.points / 2.5);

  return `
  <div class="welcome-banner">
    <div class="welcome-hi">Bienvenida,</div>
    <div class="welcome-name">${user.name}</div>
    <div class="welcome-sub">📍 ${user.city || 'Sin ubicación'}</div>
  </div>

  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value emp-color">${open}</div>
      <div class="stat-label">Abiertas</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--text)">${done}</div>
      <div class="stat-label">Cerradas</div>
    </div>
    <div class="stat-card">
      <div class="stat-value gold-color">${user.points}</div>
      <div class="stat-label">Puntaje</div>
    </div>
  </div>

  <div class="rep-section">
    <div class="rep-header">
      <span class="rep-label">Reputación</span>
      <span class="rep-pts" style="color:${tier.color}">${user.points} pts</span>
    </div>
    <div class="rep-bar-bg">
      <div class="rep-bar-fill" style="width:${barW}%;background:${tier.color}"></div>
    </div>
    <div class="rep-tier" style="color:${tier.color}">${tier.label}</div>
  </div>

  <div class="section-header">
    <span class="section-title">Actividad reciente</span>
  </div>
  ${renderHistoryList(user)}
  `;
}

function renderPublishForm(user) {
  return `
  <div class="publish-card">
    <div class="publish-title">Nueva oferta 📢</div>

    <div class="form-group">
      <label class="form-label">Puesto</label>
      <select id="pub-type" class="form-select">
        <option>Cocinero/a</option>
        <option>Ayudante de cocina</option>
        <option>Pastelero/a</option>
        <option>Pizzero/a</option>
        <option>Parrillero/a</option>
        <option>Bartender</option>
        <option>Mozo/a</option>
        <option>Otro</option>
      </select>
    </div>

    <div class="input-row">
      <div class="form-group">
        <label class="form-label">Horas</label>
        <input id="pub-hours" class="form-input" type="number" placeholder="Ej: 6" />
      </div>
      <div class="form-group">
        <label class="form-label">Pago (R$)</label>
        <input id="pub-pay" class="form-input" type="number" placeholder="Ej: 150" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Ubicación</label>
      <input id="pub-loc" class="form-input" placeholder="Ej: Villa Crespo, CABA" />
    </div>

    <div class="form-group">
      <label class="form-label">Descripción (opcional)</label>
      <input id="pub-desc" class="form-input" placeholder="Detalles del trabajo..." />
    </div>

    <div id="urgent-toggle" class="toggle-row" onclick="toggleUrgent()">
      <div>
        <div class="toggle-label">${urgentToggle ? '🚨 Modo emergencia activado' : '🔔 Modo emergencia'}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
          ${urgentToggle ? 'La oferta se marcará como URGENTE' : 'Prioridad alta para el puesto'}
        </div>
      </div>
      <div class="toggle-switch ${urgentToggle ? 'on' : ''}">
        <div class="toggle-knob"></div>
      </div>
    </div>

    <button class="btn btn-primary" onclick="createJob('${user.name}')">Publicar oferta</button>
  </div>`;
}

function toggleUrgent() {
  urgentToggle = !urgentToggle;
  const row = document.getElementById('urgent-toggle');
  if (!row) return;
  row.className = `toggle-row ${urgentToggle ? 'urgent-on' : ''}`;
  row.innerHTML = `
    <div>
      <div class="toggle-label">${urgentToggle ? '🚨 Modo emergencia activado' : '🔔 Modo emergencia'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
        ${urgentToggle ? 'La oferta se marcará como URGENTE' : 'Prioridad alta para el puesto'}
      </div>
    </div>
    <div class="toggle-switch ${urgentToggle ? 'on' : ''}">
      <div class="toggle-knob"></div>
    </div>`;
}

function createJob(ownerName) {
  const type  = document.getElementById('pub-type').value;
  const hours = document.getElementById('pub-hours').value;
  const pay   = document.getElementById('pub-pay').value;
  const loc   = document.getElementById('pub-loc').value.trim();
  const desc  = document.getElementById('pub-desc').value.trim();

  if (!hours || !pay || !loc) return toast('Completá todos los campos', 'error');

  const job = {
    id: Date.now(),
    type, hours, pay, loc, desc,
    urgent: urgentToggle,
    owner: ownerName,
    taken: false,
    takenBy: null,
    createdAt: Date.now(),
  };

  const jobs = DB.getJobs();
  jobs.push(job);
  DB.saveJobs(jobs);
  urgentToggle = false;
  toast('¡Oferta publicada! 🎉', 'success');
  currentTab = 'jobs';
  init();
}

function renderMyJobs(user) {
  const jobs = DB.getJobs().filter(j => j.owner === user.name);
  if (!jobs.length) return `<div class="empty-state">
    <div class="empty-icon">📭</div>
    <div class="empty-title">Sin ofertas publicadas</div>
    <div class="empty-sub">Publicá tu primera oferta desde "Publicar"</div>
  </div>`;

  const open = jobs.filter(j => !j.taken);
  const closed = jobs.filter(j => j.taken);

  return `
  <div class="tab-row">
    <button class="tab-btn ${activeFilter!=='cerradas'?'active':''}" onclick="setFilter('abiertas','empresa')">
      Abiertas (${open.length})
    </button>
    <button class="tab-btn ${activeFilter==='cerradas'?'active':''}" onclick="setFilter('cerradas','empresa')">
      Cerradas (${closed.length})
    </button>
  </div>
  ${(activeFilter==='cerradas'?closed:open).map(j => renderJobCard(j, false, true)).join('')}
  ${(activeFilter==='cerradas'?closed:open).length === 0 ? `<div class="empty-state"><div class="empty-icon">✨</div><div class="empty-title">No hay en esta categoría</div></div>` : ''}
  `;
}

// ───── EMPLEADO DASHBOARD ─────────────────────────────────
function renderEmpleadoDash(user) {
  const tabs = [
    { id: 'home',    icon: '🏠', label: 'Inicio' },
    { id: 'jobs',    icon: '🔍', label: 'Ofertas' },
    { id: 'my',      icon: '📋', label: 'Mis trabajos' },
    { id: 'profile', icon: '👤', label: 'Perfil' },
  ];

  const content = () => {
    if (currentTab === 'home')    return renderEmpleadoHome(user);
    if (currentTab === 'jobs')    return renderJobsBoard(user);
    if (currentTab === 'my')      return renderMyWork(user);
    if (currentTab === 'profile') return renderProfile(user);
    return '';
  };

  document.getElementById('app').innerHTML = `
  <div class="screen">
    <div class="topbar">
      <div class="topbar-logo">brasa.</div>
      <div class="topbar-user">
        <div class="topbar-avatar worker-color">${avatar(user.name)}</div>
        <button class="btn-icon" onclick="logout()">🚪</button>
      </div>
    </div>

    <div class="page-content fade-in" id="page-content">
      ${content()}
    </div>

    <nav class="bottom-nav">
      ${tabs.map(t => `
        <button class="nav-item ${currentTab===t.id?'active worker-nav':''}" onclick="switchTab('${t.id}','empleado')">
          <span class="nav-icon">${t.icon}</span>
          <span class="nav-label">${t.label}</span>
        </button>
      `).join('')}
    </nav>
  </div>`;
}

function renderEmpleadoHome(user) {
  const myJobs = DB.getJobs().filter(j => j.takenBy === user.name);
  const tier = tierInfo(user.points);
  const barW = Math.min(100, user.points / 2.5);

  return `
  <div class="welcome-banner worker-theme">
    <div class="welcome-hi">Hola de nuevo,</div>
    <div class="welcome-name">${user.name} ${canRaisePrices(user)?'💎':''}</div>
    <div class="welcome-sub">📍 ${user.city || 'Sin ciudad'} · ${myJobs.length} trabajos tomados</div>
  </div>

  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value worker-color">${user.jobs_done || 0}</div>
      <div class="stat-label">Completados</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--text)">${myJobs.filter(j => !j.taken).length}</div>
      <div class="stat-label">Activos</div>
    </div>
    <div class="stat-card">
      <div class="stat-value gold-color">${user.points}</div>
      <div class="stat-label">Puntaje</div>
    </div>
  </div>

  <div class="rep-section">
    <div class="rep-header">
      <span class="rep-label">Tu reputación</span>
      <span class="rep-pts" style="color:${tier.color}">${user.points} pts</span>
    </div>
    <div class="rep-bar-bg">
      <div class="rep-bar-fill" style="width:${barW}%;background:${tier.color}"></div>
    </div>
    <div class="rep-tier" style="color:${tier.color}">${tier.label}</div>
  </div>

  ${canRaisePrices(user) ? `
  <div style="background:var(--gold-dim);border:1px solid var(--gold);border-radius:var(--radius);padding:14px 16px;margin-bottom:20px;">
    <div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--gold)">💎 Podés subir tu precio</div>
    <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Tu puntaje de élite te permite negociar mejores tarifas.</div>
  </div>` : ''}

  <div class="section-header">
    <span class="section-title">Actividad reciente</span>
  </div>
  ${renderHistoryList(user)}
  `;
}

function renderJobsBoard(user) {
  const allJobs = DB.getJobs().filter(j => !j.taken && j.takenBy !== user.name);
  const filters = ['todos','urgente','cocinero','pastelero','mozo'];

  const filtered = activeFilter === 'todos'
    ? allJobs
    : allJobs.filter(j => {
        if (activeFilter === 'urgente') return j.urgent;
        return j.type.toLowerCase().includes(activeFilter);
      });

  const sorted = [...filtered].sort((a, b) => {
    if (a.urgent && !b.urgent) return -1;
    if (!a.urgent && b.urgent) return 1;
    return Number(b.pay) - Number(a.pay);
  });

  return `
  <div class="section-header" style="margin-top:0">
    <span class="section-title">Ofertas disponibles</span>
    <span style="font-size:13px;color:var(--text-muted)">${sorted.length} encontradas</span>
  </div>

  <div class="filter-row">
    ${filters.map(f => `
      <div class="filter-chip ${activeFilter===f?'active worker-theme':''}" onclick="setFilter('${f}','empleado')">
        ${f === 'todos' ? '🌐 Todos' :
          f === 'urgente' ? '🚨 Urgente' :
          f === 'cocinero' ? '👨‍🍳 Cocinero' :
          f === 'pastelero' ? '🎂 Pastelero' : '🍽️ Mozo'}
      </div>
    `).join('')}
  </div>

  ${sorted.length ? sorted.map(j => renderJobCard(j, true)).join('') : `
  <div class="empty-state">
    <div class="empty-icon">🔍</div>
    <div class="empty-title">Sin ofertas por aquí</div>
    <div class="empty-sub">Probá otro filtro o volvé más tarde</div>
  </div>`}
  `;
}

function renderMyWork(user) {
  const myJobs = DB.getJobs().filter(j => j.takenBy === user.name);
  if (!myJobs.length) return `
  <div class="empty-state">
    <div class="empty-icon">📋</div>
    <div class="empty-title">Sin trabajos todavía</div>
    <div class="empty-sub">Explorá las ofertas disponibles</div>
  </div>`;

  return `
  <div class="section-title" style="margin-bottom:16px">Mis trabajos tomados</div>
  ${myJobs.map(j => renderJobCard(j, false, false, true, user)).join('')}
  `;
}

// ───── JOB CARD ───────────────────────────────────────────
function renderJobCard(j, canTake = false, isOwner = false, isWorker = false, workerUser = null) {
  const isUrgent = j.urgent;
  const isTaken  = j.taken;

  return `
  <div class="job-card ${isUrgent ? 'urgent' : ''} fade-in">
    <div class="job-card-top">
      <div>
        <div class="job-title">
          ${j.type}
          ${isUrgent ? '' : ''}
        </div>
        <div class="job-company">🏢 ${j.owner} · ${timeAgo(j.createdAt)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        ${isUrgent ? `<span class="badge badge-urgent">🚨 Urgente</span>` : ''}
        ${isTaken  ? `<span class="badge badge-taken">✅ Cubierto</span>` : (!isUrgent ? `<span class="badge badge-open">● Disponible</span>` : '')}
      </div>
    </div>

    <div class="job-pay">R$ ${j.pay} <span>por ${j.hours}h</span></div>

    <div class="job-meta">
      <span class="job-pill">🕒 ${j.hours} horas</span>
      <span class="job-pill">📍 ${j.loc}</span>
      ${j.desc ? `<span class="job-pill">📝 ${j.desc}</span>` : ''}
    </div>

    <div class="job-actions">
      ${canTake && !isTaken ? `
        <button class="btn btn-worker btn-sm" style="flex:1" onclick="takeJob(${j.id})">Aceptar trabajo</button>
      ` : ''}
      ${isOwner && isTaken ? `
        <button class="btn btn-ghost btn-sm" onclick="openRateWorker(${j.id},'${j.takenBy}')">⭐ Calificar empleado</button>
      ` : ''}
      ${isOwner && !isTaken ? `
        <button class="btn btn-danger btn-sm" onclick="cancelJob(${j.id})">Cancelar oferta</button>
      ` : ''}
      ${isWorker && !isTaken ? `
        <button class="btn btn-danger btn-sm" onclick="openCancelWork(${j.id},'${workerUser ? workerUser.name : ''}')">Cancelar</button>
        <button class="btn btn-worker btn-sm" onclick="completeWork(${j.id},'${workerUser ? workerUser.name : ''}','${j.owner}')">Completar ✓</button>
      ` : ''}
      ${isWorker && isTaken ? `
        <span style="color:var(--worker);font-size:13px;font-weight:600">✅ Completado</span>
        ${!j.ratedByWorker ? `<button class="btn btn-ghost btn-sm" onclick="openRateCompany(${j.id},'${j.owner}','${workerUser ? workerUser.name : ''}')">⭐ Calificar empresa</button>` : ''}
      ` : ''}
    </div>
  </div>`;
}

// ───── JOB ACTIONS ────────────────────────────────────────
function takeJob(id) {
  const user = DB.getSession();
  if (user.type !== 'empleado') return;

  let jobs = DB.getJobs();
  const job = jobs.find(j => j.id === id);
  if (!job || job.taken) return toast('Este trabajo ya no está disponible', 'error');

  job.takenBy = user.name;
  // not marking as taken yet — becomes taken when completed
  DB.saveJobs(jobs);
  toast('¡Trabajo aceptado! 🎉', 'success');
  init();
}

function cancelJob(id) {
  let jobs = DB.getJobs();
  const idx = jobs.findIndex(j => j.id === id);
  if (idx < 0) return;
  jobs.splice(idx, 1);
  DB.saveJobs(jobs);
  toast('Oferta eliminada', 'info');
  init();
}

function completeWork(jobId, workerName, ownerName) {
  let jobs = DB.getJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  job.taken = true;
  DB.saveJobs(jobs);

  // Points to worker
  let users = DB.getUsers();
  let worker = users.find(u => u.name === workerName);
  if (worker) {
    worker.points += 15;
    worker.jobs_done = (worker.jobs_done || 0) + 1;
    worker.history = worker.history || [];
    worker.history.unshift({ type: 'complete', label: job.type, pts: +15, ts: Date.now() });
    const i = users.findIndex(u => u.name === workerName);
    users[i] = worker;
  }
  DB.saveUsers(users);
  if (DB.getSession().name === workerName) DB.setSession(worker);
  toast('¡Trabajo completado! +15 puntos 🎉', 'success');
  init();
}

function openCancelWork(jobId, workerName) {
  showModal(`
  <div class="modal-title">¿Cancelar trabajo?</div>
  <div class="modal-sub">¿Tenés una justificación?</div>

  <div class="justify-card">
    <div class="justify-title">Seleccioná un motivo</div>
    <div class="justify-options">
      <button class="justify-btn" onclick="cancelWork(${jobId},'${workerName}',true,'Perdí el colectivo')">🚌 Perdí el colectivo</button>
      <button class="justify-btn" onclick="cancelWork(${jobId},'${workerName}',true,'Emergencia personal')">🏥 Emergencia personal</button>
      <button class="justify-btn" onclick="cancelWork(${jobId},'${workerName}',true,'Problema de salud')">😷 Problema de salud</button>
      <button class="justify-btn" onclick="cancelWork(${jobId},'${workerName}',false,'Sin motivo')">❌ Sin justificación (−20 pts)</button>
    </div>
  </div>

  <button class="btn btn-ghost" onclick="closeModal()">Volver</button>
  `);
}

function cancelWork(jobId, workerName, justified, reason) {
  let jobs = DB.getJobs();
  const job = jobs.find(j => j.id === jobId);
  if (job) { job.takenBy = null; }
  DB.saveJobs(jobs);

  const ptsLost = justified ? 8 : 20;

  let users = DB.getUsers();
  let worker = users.find(u => u.name === workerName);
  if (worker) {
    worker.points = Math.max(0, worker.points - ptsLost);
    worker.history = worker.history || [];
    worker.history.unshift({ type: 'cancel', label: reason, pts: -ptsLost, ts: Date.now() });
    const i = users.findIndex(u => u.name === workerName);
    users[i] = worker;
  }
  DB.saveUsers(users);
  if (DB.getSession().name === workerName) DB.setSession(worker);

  closeModal();
  toast(`Cancelado. ${justified ? `−${ptsLost} pts (justificado)` : `−${ptsLost} pts (sin justificación)`}`, justified ? 'info' : 'error');
  init();
}

// ───── RATINGS ────────────────────────────────────────────
function openRateWorker(jobId, workerName) {
  starRating = 0;
  showModal(`
  <div class="modal-title">Calificá al empleado</div>
  <div class="modal-sub">${workerName}</div>

  <div class="star-selector" id="star-sel">
    ${[1,2,3,4,5].map(n => `<button class="star-btn" data-v="${n}" onclick="setStar(${n})">⭐</button>`).join('')}
  </div>

  <div class="modal-actions">
    <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" style="flex:1" onclick="submitRateWorker(${jobId},'${workerName}')">Calificar</button>
  </div>
  `);
}

function openRateCompany(jobId, ownerName, workerName) {
  starRating = 0;
  showModal(`
  <div class="modal-title">Calificá la empresa</div>
  <div class="modal-sub">${ownerName}</div>

  <div class="star-selector" id="star-sel">
    ${[1,2,3,4,5].map(n => `<button class="star-btn" data-v="${n}" onclick="setStar(${n})">⭐</button>`).join('')}
  </div>

  <div class="modal-actions">
    <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-worker" style="flex:1" onclick="submitRateCompany(${jobId},'${ownerName}','${workerName}')">Calificar</button>
  </div>
  `);
}

function setStar(n) {
  starRating = n;
  document.querySelectorAll('.star-btn').forEach(b => {
    b.classList.toggle('lit', Number(b.dataset.v) <= n);
  });
}

function submitRateWorker(jobId, workerName) {
  if (!starRating) return toast('Elegí una calificación', 'error');

  let users = DB.getUsers();
  let worker = users.find(u => u.name === workerName);
  if (worker) {
    const delta = (starRating - 3) * 5;
    worker.points = Math.max(0, worker.points + delta);
    worker.history = worker.history || [];
    worker.history.unshift({ type: 'rated', label: `Calificado por empresa (${starRating}★)`, pts: delta, ts: Date.now() });
    const i = users.findIndex(u => u.name === workerName);
    users[i] = worker;
  }

  let jobs = DB.getJobs();
  const job = jobs.find(j => j.id === jobId);
  if (job) job.ratedByEmp = true;
  DB.saveJobs(jobs);
  DB.saveUsers(users);

  closeModal();
  toast(`Calificación enviada: ${starRating}★`, 'success');
  init();
}

function submitRateCompany(jobId, ownerName, workerName) {
  if (!starRating) return toast('Elegí una calificación', 'error');

  let users = DB.getUsers();
  let company = users.find(u => u.name === ownerName);
  if (company) {
    const delta = (starRating - 3) * 5;
    company.points = Math.max(0, company.points + delta);
    company.history = company.history || [];
    company.history.unshift({ type: 'rated', label: `Calificado por empleado (${starRating}★)`, pts: delta, ts: Date.now() });
    const i = users.findIndex(u => u.name === ownerName);
    users[i] = company;
  }

  let jobs = DB.getJobs();
  const job = jobs.find(j => j.id === jobId);
  if (job) job.ratedByWorker = true;
  DB.saveJobs(jobs);
  DB.saveUsers(users);

  // Refresh worker session
  const session = DB.getSession();
  if (session.name === workerName) DB.setSession(session);

  closeModal();
  toast(`Gracias por tu calificación ⭐`, 'success');
  init();
}

// ───── PROFILE ────────────────────────────────────────────
function renderProfile(user) {
  const isEmp = user.type === 'empresa';
  const tier = tierInfo(user.points);
  const barW = Math.min(100, user.points / 2.5);
  const starsStr = stars(user.points);

  return `
  <div class="profile-hero">
    <div class="profile-avatar-lg" style="background:${isEmp?'var(--emp-dim)':'var(--worker-dim)'};color:${isEmp?'var(--emp)':'var(--worker)'};border:2px solid ${isEmp?'var(--emp)':'var(--worker)'}">
      ${avatar(user.name)}
    </div>
    <div class="profile-name">${user.name}</div>
    <div class="profile-type">${isEmp ? '🏢 Empresa' : '👨‍🍳 Empleado'} · 📍 ${user.city || 'Sin ciudad'}</div>
    <div class="star-row">
      ${starsStr.split('').map(s => `<span class="star" style="color:${s==='★'?'var(--gold)':'var(--text-dim)'}">${s}</span>`).join('')}
    </div>
  </div>

  <div class="rep-section">
    <div class="rep-header">
      <span class="rep-label">Reputación</span>
      <span class="rep-pts" style="color:${tier.color}">${user.points} pts</span>
    </div>
    <div class="rep-bar-bg">
      <div class="rep-bar-fill" style="width:${barW}%;background:${tier.color}"></div>
    </div>
    <div class="rep-tier" style="color:${tier.color}">${tier.label}</div>
  </div>

  <div class="section-header">
    <span class="section-title">Niveles de reputación</span>
  </div>
  <div class="justify-card">
    <div class="justify-options">
      ${[
        ['🌱', 'Nuevo', '0–50 pts'],
        ['🔥', 'Activo', '50–150 pts'],
        ['⭐', 'Experto', '150–200 pts'],
        ['🏆', 'Elite', '200+ pts (subí tu precio)'],
      ].map(([ic,n,r]) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:20px">${ic}</span>
          <div>
            <div style="font-weight:600;font-size:14px">${n}</div>
            <div style="font-size:12px;color:var(--text-muted)">${r}</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div style="margin-top:20px">
    <button class="btn btn-danger" onclick="logout()">Cerrar sesión 🚪</button>
  </div>`;
}

function renderHistoryList(user) {
  const h = user.history || [];
  if (!h.length) return `<div style="color:var(--text-muted);font-size:14px;padding:12px 0">Sin actividad reciente.</div>`;
  return h.slice(0, 8).map(item => {
    const plus = item.pts > 0;
    const icons = { complete: '✅', cancel: '❌', rated: '⭐', default: '🔔' };
    return `
    <div class="history-item">
      <div class="history-icon" style="background:${plus?'var(--worker-dim)':'var(--danger-dim)'}">
        ${icons[item.type] || icons.default}
      </div>
      <div class="history-info">
        <div class="history-name">${item.label}</div>
        <div class="history-date">${timeAgo(item.ts)}</div>
      </div>
      <div class="history-pts ${plus?'pts-plus':'pts-minus'}">${plus?'+':''}${item.pts}</div>
    </div>`;
  }).join('');
}

// ───── NAVIGATION ─────────────────────────────────────────
function switchTab(tab, userType) {
  currentTab = tab;
  activeFilter = 'todos';
  const user = DB.getSession();
  if (userType === 'empresa') renderEmpresaDash(user);
  else renderEmpleadoDash(user);
}

function setFilter(f, userType) {
  activeFilter = f;
  const user = DB.getSession();
  if (userType === 'empresa') renderEmpresaDash(user);
  else renderEmpleadoDash(user);
}

// ───── MODAL CLOSE ON OVERLAY ─────────────────────────────
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ───── START ──────────────────────────────────────────────
init();
