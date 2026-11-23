/* =====================================================================
   INTERPRETAR – convierte lo que decís en un movimiento
   Ej.: "cargá 50 mil de combustible"  →  { monto: 50000, categoria: "Combustible", ... }
   No usa ninguna IA paga: son reglas simples.
   ===================================================================== */

(function (global) {
  // Quita acentos y pasa a minúsculas, para comparar sin errores
  function normalizar(t) {
    return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Números escritos en palabras
  const UNIDADES = {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
    siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14,
    quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
    veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
    veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
    treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
    noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200,
    trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
    quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
    setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
    novecientos: 900, novecientas: 900
  };

  // Lee un token con dígitos: "50.000" → 50000, "1,5" → 1.5 (si después viene mil/millón)
  function leerDigitos(tok, siguienteEsMultiplicador) {
    let t = tok.replace(/[₲$]|gs\.?/g, '');
    let k = false;
    if (/k$/.test(t)) { k = true; t = t.slice(0, -1); }
    if (siguienteEsMultiplicador && /^\d{1,3}[.,]\d{1,2}$/.test(t)) {
      return parseFloat(t.replace(',', '.'));
    }
    const n = parseInt(t.replace(/[.,]/g, ''), 10);
    if (isNaN(n)) return null;
    return k ? n * 1000 : n;
  }

  const ES_MIL = (t) => t === 'mil';
  const ES_MILLON = (t) => /^millon(es)?$/.test(t);

  // Busca todos los montos dentro del texto y devuelve el mayor
  function extraerMonto(textoNorm) {
    const tokens = textoNorm.replace(/[¿?¡!:;]/g, ' ').split(/\s+/).filter(Boolean);
    const montos = [];
    let total = 0, actual = 0, enNumero = false, usados = [];

    function cerrar() {
      if (enNumero) {
        const v = Math.round(total + actual);
        if (v > 0) montos.push({ valor: v, tokens: usados.slice() });
      }
      total = 0; actual = 0; enNumero = false; usados = [];
    }

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const sig = tokens[i + 1] || '';
      const sigMult = ES_MIL(sig) || ES_MILLON(sig);

      if (/^[₲$]?\d[\d.,]*k?$/.test(t) || /^gs\.?\d/.test(t)) {
        const v = leerDigitos(t, sigMult);
        if (v === null) { cerrar(); continue; }
        if (enNumero && actual > 0 && !sigMult) { cerrar(); }
        actual += v; enNumero = true; usados.push(t);
      } else if (UNIDADES[t] !== undefined) {
        actual += UNIDADES[t]; enNumero = true; usados.push(t);
      } else if (ES_MIL(t)) {
        actual = (actual || 1) * 1000; enNumero = true; usados.push(t);
      } else if (ES_MILLON(t)) {
        total += (actual || 1) * 1000000; actual = 0; enNumero = true; usados.push(t);
      } else if (t === 'medio' && enNumero) {
        // "un millón y medio" / "medio millón"
        if (ES_MILLON(sig)) { actual += 0.5; usados.push(t); }
        else if (total >= 1000000) { total += 500000; usados.push(t); }
        else if (actual >= 1000) { actual += 500; usados.push(t); }
      } else if (t === 'medio' && ES_MILLON(sig)) {
        actual = 0.5; enNumero = true; usados.push(t);
      } else if (t === 'y' && enNumero) {
        usados.push(t); // "treinta y cinco mil"
      } else if (/^(gs|guaranies|guarani|mil)$/.test(t) && enNumero) {
        usados.push(t);
      } else {
        cerrar();
      }
    }
    cerrar();
    if (!montos.length) return { valor: null, tokens: [] };
    montos.sort((a, b) => b.valor - a.valor);
    return montos[0];
  }

  // Elige la categoría según las palabras clave de cada una
  function elegirCategoria(textoNorm, categorias) {
    let mejor = null, largo = 0;
    for (const c of categorias) {
      for (const p of c.palabras_clave || []) {
        const pn = normalizar(p);
        const re = new RegExp('(^|[^a-z0-9])' + pn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
        if (re.test(textoNorm) && pn.length > largo) { mejor = c; largo = pn.length; }
      }
    }
    return mejor;
  }

  function fechaISO(d) {
    const z = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }

  const VERBOS = /^(carga|cargar|cargue|anota|anotar|anote|agrega|agregar|agregue|gaste|pague|compre|cobre|registra|registrar|pon|pone|poner|suma|sumar)\b\s*/;

  function interpretar(texto, categorias, hoy) {
    hoy = hoy || new Date();
    const norm = normalizar(texto.trim());

    // 1) Monto
    const m = extraerMonto(norm);

    // 2) Fecha
    const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    if (/\b(anteayer|antes de ayer)\b/.test(norm)) f.setDate(f.getDate() - 2);
    else if (/\bayer\b/.test(norm)) f.setDate(f.getDate() - 1);

    // 3) Categoría y tipo
    let cat = elegirCategoria(norm, categorias);
    let tipo = cat ? cat.tipo : 'Gasto';
    if (/\b(cobre|me pagaron|me depositaron|ingreso|entro|entraron)\b/.test(norm)) {
      tipo = 'Ingreso';
      if (!cat || cat.tipo !== 'Ingreso') cat = categorias.find((c) => c.nombre === 'Proyectos') || cat;
    }
    if (!cat) cat = categorias.find((c) => c.nombre === 'Otros') || { nombre: 'Otros', tipo: 'Gasto' };

    // 4) Descripción: el texto sin el verbo, el monto ni la fecha
    let desc = norm;
    for (const t of m.tokens) desc = desc.replace(new RegExp('(^|\\s)' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)'), ' ');
    desc = desc
      .replace(/\b(anteayer|antes de ayer|ayer|hoy)\b/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .replace(VERBOS, '')
      .trim();
    while (/^(de|en|por|para|del|al|la|el|los|las|un|una)\s+/.test(desc)) {
      desc = desc.replace(/^(de|en|por|para|del|al|la|el|los|las|un|una)\s+/, '');
    }
    if (!desc) desc = cat.nombre;
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    return {
      monto: m.valor,
      tipo: tipo,
      categoria: cat.nombre,
      descripcion: desc,
      fecha: fechaISO(f)
    };
  }

  global.interpretar = interpretar;
  global.extraerMonto = extraerMonto;
  if (typeof module !== 'undefined') module.exports = { interpretar, extraerMonto, normalizar };
})(typeof window !== 'undefined' ? window : globalThis);
