/* =====================================================================
   MIS GASTOS – lógica de la app
   Partes:
     1. Arranque: configuración de Supabase e inicio de sesión
     2. Navegación entre pestañas y meses
     3. Inicio: totales, categorías y carga por voz
     4. Movimientos: listar, crear, editar, borrar
     5. Deudas: estado y "Pagar cuota"
     6. Plan: lo que te queda cada mes
   ===================================================================== */

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);
const gs = (n) => '₲ ' + Math.round(Number(n) || 0).toLocaleString('es-PY');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fechaCorta = (s) => { const [y, m, d] = s.split('-'); return d + '/' + m + '/' + y; };
const mesLargo = (s) => { const [y, m] = s.split('-'); return MESES[+m - 1] + ' ' + y; };
const leerMonto = (t) => parseInt(String(t).replace(/[^\d]/g, ''), 10) || 0;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function aviso(texto) {
  const a = $('aviso');
  a.textContent = texto;
  a.classList.remove('oculto');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => a.classList.add('oculto'), 3000);
}

function mostrarPantalla(id) {
  ['pantalla-config', 'pantalla-login', 'pantalla-app'].forEach((p) => $(p).classList.add('oculto'));
  $(id).classList.remove('oculto');
}

// ---------- Estado ----------
let sb = null;                       // cliente de Supabase
let categorias = [];
let movimientos = [];
const hoy = new Date();
let mes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
let editandoId = null;

/* =====================================================================
   1. ARRANQUE
   ===================================================================== */
function conectar() {
  const url = localStorage.getItem('sb_url');
  const key = localStorage.getItem('sb_key');
  if (!url || !key) { mostrarPantalla('pantalla-config'); return; }
  sb = supabase.createClient(url, key, { db: { schema: 'finanzas' } });
  sb.auth.getSession().then(({ data }) => {
    if (data.session) iniciarApp(); else mostrarPantalla('pantalla-login');
  });
}

$('cfg-guardar').onclick = () => {
  const url = $('cfg-url').value.trim().replace(/\/$/, '');
  const key = $('cfg-key').value.trim();
  if (!url.startsWith('https://') || key.length < 20) { aviso('Revisá la URL y la clave'); return; }
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  conectar();
};

$('login-entrar').onclick = async () => {
  $('login-error').textContent = '';
  const { error } = await sb.auth.signInWithPassword({
    email: $('login-email').value.trim(),
    password: $('login-pass').value
  });
  if (error) { $('login-error').textContent = 'No se pudo entrar: ' + error.message; return; }
  iniciarApp();
};

$('login-reconfig').onclick = () => {
  $('cfg-url').value = localStorage.getItem('sb_url') || '';
  $('cfg-key').value = localStorage.getItem('sb_key') || '';
  mostrarPantalla('pantalla-config');
};

async function iniciarApp() {
  mostrarPantalla('pantalla-app');
  const { data, error } = await sb.from('categorias').select('*').order('id');
  if (error) { aviso('Error al leer categorías: ' + error.message); return; }
  categorias = data;
  $('m-categoria').innerHTML = categorias.map((c) => `<option>${esc(c.nombre)}</option>`).join('');
  cargarMes();
}

/* =====================================================================
   2. NAVEGACIÓN
   ===================================================================== */
let vistaActual = 'inicio';
document.querySelectorAll('.pestanas button').forEach((b) => {
  b.onclick = () => {
    vistaActual = b.dataset.vista;
    document.querySelectorAll('.pestanas button').forEach((x) => x.classList.toggle('activa', x === b));
    document.querySelectorAll('.vista').forEach((v) => v.classList.add('oculto'));
    $('vista-' + vistaActual).classList.remove('oculto');
    if (vistaActual === 'deudas') cargarDeudas();
    if (vistaActual === 'plan') cargarPlan();
  };
});

$('mes-ant').onclick = () => { mes = new Date(mes.getFullYear(), mes.getMonth() - 1, 1); cargarMes(); };
$('mes-sig').onclick = () => { mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1); cargarMes(); };

async function cargarMes() {
  $('mes-titulo').textContent = MESES[mes.getMonth()] + ' ' + mes.getFullYear();
  const ini = iso(mes);
  const fin = iso(new Date(mes.getFullYear(), mes.getMonth() + 1, 1));
  const { data, error } = await sb.from('movimientos').select('*')
    .gte('fecha', ini).lt('fecha', fin)
    .order('fecha', { ascending: false }).order('id', { ascending: false });
  if (error) { aviso('Error: ' + error.message); return; }
  movimientos = data;
  pintarInicio();
  pintarMovimientos();
}

/* =====================================================================
   3. INICIO
   ===================================================================== */
function pintarInicio() {
  const ing = movimientos.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const gas = movimientos.filter((m) => m.tipo === 'Gasto').reduce((s, m) => s + Number(m.monto), 0);
  $('tot-ingresos').textContent = gs(ing);
  $('tot-gastos').textContent = gs(gas);
  $('tot-saldo').textContent = gs(ing - gas);
  $('tot-saldo').classList.toggle('negativo', ing - gas < 0);

  const filas = categorias.filter((c) => c.tipo === 'Gasto').map((c) => {
    const gastado = movimientos.filter((m) => m.categoria === c.nombre && m.tipo === 'Gasto')
      .reduce((s, m) => s + Number(m.monto), 0);
    return { c, gastado };
  }).filter((f) => f.gastado > 0 || f.c.limite_mensual);

  $('lista-categorias').innerHTML = filas.length ? filas.map(({ c, gastado }) => {
    const lim = Number(c.limite_mensual) || 0;
    const pct = lim ? Math.min(100, (gastado / lim) * 100) : 0;
    const detalle = lim
      ? `<small class="${gastado > lim ? 'negativo' : ''}">${gastado > lim ? 'Te pasaste ' + gs(gastado - lim) : 'Disponible ' + gs(lim - gastado)} · tope ${gs(lim)}</small>
         <div class="barra-progreso"><div class="${gastado > lim ? 'pasado' : ''}" style="width:${pct}%"></div></div>`
      : '';
    return `<li class="item" style="display:block"><div style="display:flex;justify-content:space-between">
              <b>${esc(c.nombre)}</b><span class="monto-gasto">${gs(gastado)}</span></div>${detalle}</li>`;
  }).join('') : '<li class="ayuda">Todavía no hay gastos este mes.</li>';
}

// ---- Carga por voz (reconocimiento de voz del celular, gratis) ----
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;

$('btn-microfono').onclick = () => {
  if (!Reconocimiento) {
    aviso('Tu navegador no tiene reconocimiento de voz. Usá Chrome, o el micrófono del teclado.');
    $('entrada-texto').focus();
    return;
  }
  if (rec) { rec.stop(); return; }
  rec = new Reconocimiento();
  rec.lang = 'es-PY';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  const boton = $('btn-microfono');
  boton.classList.add('escuchando');
  $('texto-voz').textContent = 'Te escucho…';
  let final = '';
  rec.onresult = (e) => {
    let parcial = '';
    for (const r of e.results) { if (r.isFinal) final = r[0].transcript; else parcial += r[0].transcript; }
    $('texto-voz').textContent = '"' + (final || parcial) + '"';
  };
  rec.onerror = (e) => { aviso(e.error === 'not-allowed' ? 'Permití el micrófono para esta app' : 'No te entendí, probá de nuevo'); };
  rec.onend = () => {
    boton.classList.remove('escuchando');
    rec = null;
    if (final) procesarFrase(final);
  };
  rec.start();
};

$('btn-texto').onclick = () => {
  const t = $('entrada-texto').value.trim();
  if (t) { procesarFrase(t); $('entrada-texto').value = ''; }
};
$('entrada-texto').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-texto').click(); });

function procesarFrase(frase) {
  const r = interpretar(frase, categorias, new Date());
  $('texto-voz').textContent = '"' + frase + '"';
  abrirModal({
    monto: r.monto || '', descripcion: r.descripcion, tipo: r.tipo,
    categoria: r.categoria, fecha: r.fecha, pagado: true
  }, 'Revisá y guardá');
  if (!r.monto) aviso('No encontré el monto, escribilo vos');
}

/* =====================================================================
   4. MOVIMIENTOS
   ===================================================================== */
function pintarMovimientos() {
  if (!movimientos.length) { $('lista-movimientos').innerHTML = '<li class="ayuda">No hay movimientos este mes.</li>'; return; }
  let html = '', ultimaFecha = '';
  for (const m of movimientos) {
    if (m.fecha !== ultimaFecha) { html += `<li class="fecha-grupo">${fechaCorta(m.fecha)}</li>`; ultimaFecha = m.fecha; }
    const signo = m.tipo === 'Ingreso' ? '+' : '−';
    html += `<li class="item" data-id="${m.id}">
      <div class="izq"><b>${esc(m.descripcion)}</b><small>${esc(m.categoria)}${m.pagado ? ' · ✔' : ' · pendiente'}</small></div>
      <div class="der ${m.tipo === 'Ingreso' ? 'monto-ingreso' : 'monto-gasto'}">${signo} ${gs(m.monto)}</div></li>`;
  }
  $('lista-movimientos').innerHTML = html;
  $('lista-movimientos').querySelectorAll('.item').forEach((li) => {
    li.onclick = () => {
      const m = movimientos.find((x) => String(x.id) === li.dataset.id);
      abrirModal(m, 'Editar movimiento', m.id);
    };
  });
}

$('btn-nuevo').onclick = () => abrirModal({ fecha: iso(new Date()), tipo: 'Gasto', categoria: 'Otros', pagado: true }, 'Nuevo movimiento');

function abrirModal(m, titulo, id = null) {
  editandoId = id;
  $('modal-titulo').textContent = titulo;
  $('m-monto').value = m.monto ? Math.round(m.monto).toLocaleString('es-PY') : '';
  $('m-desc').value = m.descripcion || '';
  $('m-tipo').value = m.tipo || 'Gasto';
  $('m-fecha').value = m.fecha || iso(new Date());
  $('m-categoria').value = m.categoria || 'Otros';
  $('m-pagado').checked = !!m.pagado;
  $('m-borrar').classList.toggle('oculto', !id);
  $('modal').classList.remove('oculto');
}
const cerrarModal = () => $('modal').classList.add('oculto');
$('m-cancelar').onclick = cerrarModal;
$('m-monto').addEventListener('input', (e) => {
  const n = leerMonto(e.target.value);
  e.target.value = n ? n.toLocaleString('es-PY') : '';
});
// al elegir una categoría de ingreso, el tipo cambia solo
$('m-categoria').onchange = () => {
  const c = categorias.find((x) => x.nombre === $('m-categoria').value);
  if (c) $('m-tipo').value = c.tipo;
};

$('m-guardar').onclick = async () => {
  const fila = {
    monto: leerMonto($('m-monto').value),
    descripcion: $('m-desc').value.trim() || $('m-categoria').value,
    tipo: $('m-tipo').value,
    fecha: $('m-fecha').value,
    categoria: $('m-categoria').value,
    pagado: $('m-pagado').checked
  };
  if (!fila.monto) { aviso('Falta el monto'); return; }
  const q = editandoId
    ? sb.from('movimientos').update(fila).eq('id', editandoId)
    : sb.from('movimientos').insert(fila);
  const { error } = await q;
  if (error) { aviso('No se guardó: ' + error.message); return; }
  cerrarModal();
  aviso((editandoId ? 'Actualizado ' : 'Cargado ✅ ') + fila.descripcion + ' ' + gs(fila.monto));
  // si se cargó en otro mes, ir a ese mes
  const [y, mm] = fila.fecha.split('-');
  mes = new Date(+y, +mm - 1, 1);
  cargarMes();
};

$('m-borrar').onclick = async () => {
  if (!confirm('¿Borrar este movimiento?')) return;
  const { error } = await sb.from('movimientos').delete().eq('id', editandoId);
  if (error) { aviso('No se borró: ' + error.message); return; }
  cerrarModal(); aviso('Borrado'); cargarMes();
};

/* =====================================================================
   5. DEUDAS
   ===================================================================== */
async function cargarDeudas() {
  const { data, error } = await sb.from('v_deudas').select('*');
  if (error) { aviso('Error: ' + error.message); return; }
  $('tot-deudas').textContent = gs(data.reduce((s, d) => s + Number(d.saldo_pendiente), 0));
  $('lista-deudas').innerHTML = data.map((d) => `
    <li class="item deuda">
      <b>${esc(d.entidad)}</b>
      <div class="fila"><span>Próxima cuota (${d.proxima_cuota_numero ?? '—'}/${d.total_cuotas})</span><b>${d.proxima_cuota ? gs(d.proxima_cuota) : 'Pagada ✔'}</b></div>
      <div class="fila"><span>Vence</span><span>${d.proximo_vencimiento ? fechaCorta(d.proximo_vencimiento) : '—'}</span></div>
      <div class="fila"><span>Faltan</span><span>${d.cuotas_pendientes} cuotas · ${gs(d.saldo_pendiente)}</span></div>
      <div class="fila"><span>Termina</span><span>${mesLargo(d.ultima_cuota)}</span></div>
      ${d.notas ? `<small>${esc(d.notas)}</small>` : ''}
      ${d.proxima_cuota_id ? `<button class="btn-secundario" data-cuota="${d.proxima_cuota_id}"
          data-texto="${esc(d.entidad)} cuota ${d.proxima_cuota_numero} por ${gs(d.proxima_cuota)}">Pagar cuota ${d.proxima_cuota_numero}</button>` : ''}
    </li>`).join('');
  $('lista-deudas').querySelectorAll('button[data-cuota]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('¿Marcar como pagada ' + b.dataset.texto + '?\nSe anota como gasto de hoy.')) return;
      const { error: e } = await sb.rpc('pagar_cuota', { p_cuota_id: Number(b.dataset.cuota) });
      if (e) { aviso('No se pudo: ' + e.message); return; }
      aviso('Cuota pagada ✅');
      cargarDeudas(); cargarMes();
    };
  });
}

/* =====================================================================
   6. PLAN
   ===================================================================== */
async function cargarPlan() {
  const { data, error } = await sb.from('v_plan_mensual').select('*');
  if (error) { aviso('Error: ' + error.message); return; }
  $('lista-plan').innerHTML = data.map((p) => {
    const q = Number(p.queda);
    const clase = q < 150000 ? 'plan-bajo' : q < 500000 ? 'plan-medio' : '';
    return `<li class="item ${clase}">
      <div class="izq"><b style="text-transform:capitalize">${mesLargo(p.mes)}</b>
        <small>Cuotas ${gs(p.cuotas)}${Number(p.extras) ? ' · extras ' + gs(p.extras) : ''}</small></div>
      <div class="der"><b class="${q < 0 ? 'negativo' : ''}">${gs(q)}</b></div></li>`;
  }).join('');
}

// ---------- Modo sin conexión (service worker) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

conectar();
