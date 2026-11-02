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

  // Limpiamos signos vitales y datos manuales
  document.querySelectorAll('[id^="sv-"], [id^="manual-"]').forEach(el => {
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
  });

  // Reseteamos toggles
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

// Nivel KTAS (1 = más grave) -> color y tiempo máximo de espera
const NIVEL_INFO = {
  1: { clase: 'rojo',     color: 'ROJO',     label: 'Reanimación',   espera: '0 min',   esperaTexto: 'Ingreso inmediato — área de emergencias' },
  2: { clase: 'naranja',  color: 'NARANJA',  label: 'Emergencia',    espera: '10 min',  esperaTexto: 'Atención prioritaria, monitoreo continuo' },
  3: { clase: 'amarillo', color: 'AMARILLO', label: 'Urgente',       espera: '30 min',  esperaTexto: 'Espera en sala con reevaluación periódica' },
  4: { clase: 'verde',    color: 'VERDE',    label: 'Menos urgente', espera: '60 min',  esperaTexto: 'Espera en sala' },
  5: { clase: 'azul',     color: 'AZUL',     label: 'No urgente',    espera: '120 min', esperaTexto: 'Puede derivarse a consultorio externo' },
};

// En CTAS (menores de 16) cambian algunos nombres y la espera del nivel 2
const NIVEL_INFO_CTAS = {
  1: { label: 'Resucitación' },
  2: { espera: '15 min' },
  3: { label: 'Urgencia' },
};

function renderClasificacion(data) {
  const esCtas = data.fuente === 'ctas';
  const info = { ...(NIVEL_INFO[data.nivel] || NIVEL_INFO[3]), ...(esCtas ? NIVEL_INFO_CTAS[data.nivel] : {}) };

  const card = document.getElementById('clasificacion-card');
  card.className = 'card card--' + info.clase;

  const titulo = document.getElementById('clasificacion-titulo');
  titulo.textContent = `${info.color} — ${info.label}`;
  titulo.className = 'rojo-title clasif-title--' + info.clase;

  document.getElementById('clasificacion-sub').textContent = `Nivel ${esCtas ? 'CTAS' : 'KTAS'} ${data.nivel}`;
  document.getElementById('espera-num').textContent = info.espera;
  document.getElementById('espera-sub').textContent = info.esperaTexto;

  const signosList = document.getElementById('signos-alarma-list');
  signosList.innerHTML = '';
  const signos = data.signos_de_alarma || [];
  (signos.length ? signos : ['No se detectaron signos de alarma']).forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    signosList.appendChild(li);
  });

  document.getElementById('justificacion-text').textContent = data.justificacion || '';
  document.getElementById('fuente-text').style.display = esCtas ? '' : 'none';
}

// Lee un input numérico; vacío -> null (el dato no se midió)
function leerNumero(id) {
  const valor = document.getElementById(id).value;
  return valor === '' ? null : Number(valor);
}

function leerTexto(id) {
  return document.getElementById(id).value.trim();
}

document.getElementById('btn-clasificar').addEventListener('click', async function() {
  const btn = this;
  const original = btn.textContent;
  const sintomas = document.getElementById('sintomas').value.trim();
  if (!sintomas) { alert('Ingresá los síntomas del paciente.'); return; }

  const tiempoInicio = document.querySelector('#time-group .toggle-btn.active').dataset.val;

  const signos = {
    tas: leerNumero('sv-tas'),
    tad: leerNumero('sv-tad'),
    fc: leerNumero('sv-fc'),
    fr: leerNumero('sv-fr'),
    temperatura: leerNumero('sv-temperatura'),
    saturacion: leerNumero('sv-saturacion'),
    dolor: leerNumero('sv-dolor'),
    estadoMental: leerTexto('sv-estado-mental') || null,
    trauma: document.getElementById('sv-trauma').checked,
  };

  // Si el paciente no se encontró por DNI, se usan los datos cargados a mano
  const manual = pacienteActual ? null : {
    edad: leerNumero('manual-edad'),
    sexo: leerTexto('manual-sexo') || null,
    alergias: leerTexto('manual-alergias'),
    medicacion: leerTexto('manual-medicacion'),
    enfermedades: leerTexto('manual-enfermedades'),
  };

  btn.disabled = true;
  btn.textContent = 'Clasificando... (puede tardar hasta 1 minuto)';

  try {
    const res = await fetch(`${API_BASE}/api/clasificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sintomas, tiempoInicio, paciente: pacienteActual, manual, signos }),
    });
    const clasificacion = await res.json();
    if (!res.ok) throw new Error(clasificacion.error || 'Error del servidor');
    renderClasificacion(clasificacion);
    goTo('screen-clasificacion');
  } catch (err) {
    console.error('Error clasificando:', err);
    alert('No se pudo clasificar al paciente.\n\n' + err.message);
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
