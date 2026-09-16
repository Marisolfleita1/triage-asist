// ── CONFIG ──────────────────────────────────────────────────────────────────
// esto solo por si en futuro separamos el frontend del backend 
const API_BASE = '';

// ── UTILIDADES ────────────────────────────────────────────────────────────────

function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0, 0);
}

// Mapea el tipo de antecedente a la clase de color del tag
function tagClassFor(tipo) {
  switch (tipo) {
    case 'alergia': return 'tag tag--red';
    case 'medicacion': return 'tag tag--gray';
    case 'condicion':
    default: return 'tag tag--blue';
  }
}

// ── LOGIN 

let currentUser = '';

function setTopbarUser(name) {
  document.getElementById('topbar-user-ingreso').textContent = name;
  document.getElementById('topbar-user-clasificacion').textContent = name;
}

function logout() {
  currentUser = '';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  hide('login-error');
  goTo('screen-login');
}

document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (user === 'admin' && pass === '1234') {
    hide('login-error');
    currentUser = user;
    setTopbarUser(user);
    resetIngreso();
    goTo('screen-ingreso');
  } else {
    show('login-error');
  }
});

document.getElementById('btn-logout-ingreso').addEventListener('click', logout);
document.getElementById('btn-logout-clasificacion').addEventListener('click', logout);

document.getElementById('toggle-pass').addEventListener('click', function() {
  const input = document.getElementById('login-pass');
  const show_ = document.getElementById('eye-show');
  const hide_ = document.getElementById('eye-hide');
  if (input.type === 'password') {
    input.type = 'text';
    show_.style.display = 'none';
    hide_.style.display = '';
  } else {
    input.type = 'password';
    show_.style.display = '';
    hide_.style.display = 'none';
  }
});

// ── INGRESO ──────

// Guardamos el último paciente encontrado para usarlo después en la clasificación
let pacienteActual = null;

function resetIngreso() {
  document.getElementById('dni-input').value = '';
  document.getElementById('sintomas').value = '';
  document.getElementById('state-found').style.display = 'none';
  document.getElementById('state-not-found').style.display = 'none';
  document.getElementById('state-idle').style.display = '';
  pacienteActual = null;

  // Reseteamos toggles
  setActiveToggle('intensity-group', 'severa');
  setActiveToggle('time-group', 'minutos');
}

// Pintamos los datos del paciente encontrado en el DOM
function renderPacienteEncontrado(paciente) {
  const card = document.getElementById('state-found');
  const nombreEl = card.querySelector('.patient-name');
  const tagList = card.querySelector('.tag-list');

  nombreEl.innerHTML = `${paciente.nombre} <span class="patient-age">— ${paciente.edad} años</span>`;

  tagList.innerHTML = '';
  paciente.antecedentes.forEach(a => {
    const span = document.createElement('span');
    span.className = tagClassFor(a.tipo);
    span.textContent = a.texto;
    tagList.appendChild(span);
  });
}

async function buscarPaciente(dni) {
  const btn = document.getElementById('btn-buscar');
  btn.disabled = true;
  btn.textContent = 'Buscando...';

  document.getElementById('state-found').style.display = 'none';
  document.getElementById('state-not-found').style.display = 'none';
  document.getElementById('state-idle').style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/pacientes/${dni}`);
    const data = await res.json();

    if (res.ok && data.encontrado) {
      pacienteActual = data.paciente;
      renderPacienteEncontrado(data.paciente);
      document.getElementById('state-found').style.display = '';
    } else {
      pacienteActual = null;
      document.getElementById('state-not-found').style.display = '';
    }
  } catch (err) {
    console.error('Error buscando paciente:', err);
    pacienteActual = null;
    document.getElementById('state-not-found').style.display = '';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buscar';
  }
}

document.getElementById('btn-buscar').addEventListener('click', function() {
  const dni = document.getElementById('dni-input').value.replace(/\s/g, '');
  if (!dni) return;
  buscarPaciente(dni);
});

// Para premitir buscar con Enter
document.getElementById('dni-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('btn-buscar').click();
});

const COLOR_INFO = {
  ROJO:     { clase: 'rojo',     label: 'Crítico',      esperaTexto: 'Ingreso inmediato — área de emergencias' },
  NARANJA:  { clase: 'naranja',  label: 'Muy urgente',   esperaTexto: 'Atención prioritaria, monitoreo continuo' },
  AMARILLO: { clase: 'amarillo', label: 'Urgente',       esperaTexto: 'Espera en sala con reevaluación periódica' },
  VERDE:    { clase: 'verde',    label: 'Poco urgente',  esperaTexto: 'Espera en sala' },
  AZUL:     { clase: 'azul',     label: 'No urgente',    esperaTexto: 'Puede derivarse a consultorio externo' },
};

function renderClasificacion(data) {
  const info = COLOR_INFO[data.color] || COLOR_INFO.AMARILLO;

  const card = document.getElementById('clasificacion-card');
  card.className = 'card card--' + info.clase;

  const titulo = document.getElementById('clasificacion-titulo');
  titulo.textContent = `${data.color} — ${info.label}`;
  titulo.className = 'rojo-title clasif-title--' + info.clase;

  document.getElementById('clasificacion-sub').textContent = data.clasificacion;
  document.getElementById('espera-num').textContent = `${data.tiempoEsperaMin} min`;
  document.getElementById('espera-sub').textContent = info.esperaTexto;

  const sintomasList = document.getElementById('sintomas-detectados-list');
  sintomasList.innerHTML = '';
  (data.sintomasDetectados || []).forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    sintomasList.appendChild(li);
  });

  const factoresList = document.getElementById('factores-agravantes-list');
  factoresList.innerHTML = '';
  (data.factoresAgravantes || []).forEach(f => {
    const span = document.createElement('span');
    span.className = 'tag tag--orange-outline';
    span.textContent = f;
    factoresList.appendChild(span);
  });

  document.getElementById('justificacion-text').textContent = data.justificacion || '';
}

document.getElementById('btn-clasificar').addEventListener('click', async function() {
  const btn = this;
  const original = btn.textContent;
  const sintomas = document.getElementById('sintomas').value.trim();
  if (!sintomas) { alert('Ingresá los síntomas del paciente.'); return; }

  const intensidad = document.querySelector('#intensity-group .toggle-btn.active').dataset.val;
  const tiempoInicio = document.querySelector('#time-group .toggle-btn.active').dataset.val;

  btn.disabled = true;
  btn.textContent = 'Clasificando...';

  try {
    const res = await fetch(`${API_BASE}/api/clasificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sintomas, intensidad, tiempoInicio, paciente: pacienteActual }),
    });
    const clasificacion = await res.json();
    if (!res.ok) throw new Error(clasificacion.error || 'Error del servidor');
    renderClasificacion(clasificacion);
    goTo('screen-clasificacion');
  } catch (err) {
    console.error('Error clasificando:', err);
    alert('No se pudo clasificar al paciente. Verificá que Ollama esté corriendo y el modelo "triage-assistant" exista.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

// ── Activar el botón que se selcciona y desactivar los demás ─
//recordatorio para nosotras: toggle() es un método de JavaScript, y sirve para cambiar el estado de una clase
function setActiveToggle(groupId, val) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === val);
  });
}

document.getElementById('intensity-group').addEventListener('click', function(e) {
  const btn = e.target.closest('.toggle-btn');
  if (btn) setActiveToggle('intensity-group', btn.dataset.val);
});

document.getElementById('time-group').addEventListener('click', function(e) {
  const btn = e.target.closest('.toggle-btn');
  if (btn) setActiveToggle('time-group', btn.dataset.val);
});

// ── CLASIFICACIÓN ─────

document.getElementById('btn-editar').addEventListener('click', function() {
  goTo('screen-ingreso');
});

document.getElementById('btn-enviar').addEventListener('click', function() {
  const btn = document.getElementById('btn-enviar');
  const banner = document.getElementById('sent-banner');

  btn.textContent = '✓ Enviado a Triage';
  btn.classList.add('sent');
  btn.disabled = true;
  document.getElementById('btn-editar').disabled = true;
  banner.style.display = 'flex';

  setTimeout(function() {
    btn.textContent = 'Enviar a Triage';
    btn.classList.remove('sent');
    btn.disabled = false;
    document.getElementById('btn-editar').disabled = false;
    banner.style.display = 'none';
    resetIngreso();
    goTo('screen-ingreso');
  }, 2000);
});
