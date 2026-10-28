/* RONE en internet (sesión 46).
   Servida por server.py (laptop o red RobotMapa) esta capa no hace nada: todo sigue igual.
   Publicada en GitHub Pages (o abierta con ?remoto=1):
   - Pregunta a NELO en la nube (Cloudflare Worker, rone_config.js) dónde está ahora la laptop del robot (túnel).
   - Laptop conectada  → el mapa, el video y los botones van a la laptop por el túnel ("en vivo").
   - Laptop apagada    → modo demostración: un recorrido simulado, marcado como tal.
   - NELO: si la laptop tiene a NELO encendido, se usa ese (voz y herramientas completas); si no,
     responde NELO en la nube (modelo gratis) con la voz de este equipo.
   - Mover o cambiar el robot desde internet pide la clave del operador (la muestra rone_estacion.bat).
   Funciona reescribiendo las rutas del servidor (/api, /jarvis, video_feed…) sin tocar el mapa ni ultimoDatos. */
(function () {
  "use strict";
  const CFG = window.RONE_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const publico = location.hostname.endsWith(".github.io") || params.has("remoto") || !!CFG.siempreRemoto;
  if (!publico || !CFG.nube) { window.RONE_RED = { modo: "local" }; return; }

  const NUBE = String(CFG.nube).replace(/\/$/, "");
  const fetchOriginal = window.fetch.bind(window);
  const red = window.RONE_RED = { modo: "buscando", base: null, neloModo: null, robot: false };
  let claveOp = "";
  try { claveOp = localStorage.getItem("rone.clave") || ""; } catch (e) { /* sin almacenamiento */ }

  const json = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: { "Content-Type": "application/json" } });
  const ES_SERVIDOR = /^\/(api|jarvis|video_feed|video_feed_roma|video_profundidad|fotos|informe)(\/|\?|$)/;
  function rutaServidor(u) {
    if (u instanceof URL) u = u.href;
    else if (u && typeof u === "object" && "url" in u) u = u.url;
    u = String(u || "");
    if (u.startsWith(location.origin)) u = u.slice(location.origin.length);
    const base = location.pathname.replace(/[^/]*$/, "");          // /repositorio/ en GitHub Pages
    if (base.length > 1 && u.startsWith(base)) u = "/" + u.slice(base.length);
    if (/^(video_feed|video_feed_roma|video_profundidad|informe|api|jarvis|fotos)(\/|\?|$)/.test(u)) u = "/" + u;   // rutas relativas ("informe", "video_feed?t=…")
    return ES_SERVIDOR.test(u) ? u : null;
  }

  // ---------- ¿Dónde está la laptop del robot? ----------
  let listoPrimera;
  const primera = new Promise((r) => { listoPrimera = r; });
  let tBuscar = 0, buscando = false;
  async function buscarEstacion(ahora) {
    if (buscando) return;
    buscando = true;
    clearTimeout(tBuscar);
    const antes = red.modo;
    try {
      const r = await fetchOriginal(NUBE + "/estacion" + (ahora ? "?ahora=1" : ""), { cache: "no-store", signal: AbortSignal.timeout(6000) });
      const d = await r.json();
      if (d.viva && d.url) { red.base = d.url; red.modo = "vivo"; red.robot = !!d.robot; }
      else { red.base = null; red.modo = "demo"; red.robot = false; }
    } catch (e) {
      if (red.modo === "buscando") red.modo = "demo";
    }
    buscando = false;
    if (antes !== red.modo) { red.neloModo = null; pintarModo(); }
    listoPrimera();
    tBuscar = setTimeout(buscarEstacion, red.modo === "vivo" ? 30000 : 20000);
  }
  let tPronto = 0;
  function revisarPronto() {
    if (Date.now() - tPronto < 8000) return;
    tPronto = Date.now();
    buscarEstacion(true);
  }

  function pedirClave() {
    const c = window.prompt("Para manejar el robot desde internet hace falta la clave del operador.\n" +
      "(La muestra rone_estacion.bat en la laptop del robot.)\n\nClave:", "");
    if (!c) return false;
    claveOp = c.trim();
    try { localStorage.setItem("rone.clave", claveOp); } catch (e) { /* sin almacenamiento */ }
    return true;
  }

  async function alServidor(ruta, opciones, reintento) {
    const h = new Headers((opciones && opciones.headers) || {});
    if (claveOp) h.set("X-Rone-Clave", claveOp);
    try {
      const r = await fetchOriginal(red.base + ruta, { ...(opciones || {}), headers: h });
      if (r.status === 403 && !reintento) {
        const d = await r.clone().json().catch(() => null);
        if (d && d.necesita_clave) {
          if (claveOp) { claveOp = ""; try { localStorage.removeItem("rone.clave"); } catch (e) { /* nada */ } }
          if (pedirClave()) return alServidor(ruta, opciones, true);
        }
      }
      return r;
    } catch (e) {
      if (!(e && e.name === "AbortError")) revisarPronto();
      throw e;
    }
  }

  window.fetch = async function (recurso, opciones) {
    const ruta = rutaServidor(recurso);
    if (!ruta) return fetchOriginal(recurso, opciones);
    await primera;
    if (ruta.startsWith("/jarvis/")) return nelo(ruta, opciones || {});
    if (red.modo !== "vivo") return demo(ruta, opciones || {});
    return alServidor(ruta, opciones);
  };

  // Imágenes (video de la cámara, fotos) y audios (voz de NELO local) también van a la laptop
  const IMAGEN_VACIA = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  const descSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get() { return descSrc.get.call(this); },
    set(v) {
      const ruta = rutaServidor(v);
      this.__roneRuta = ruta;
      if (ruta && red.modo === "buscando") {
        // la página todavía no sabe si la laptop está conectada (la cámara pide el video al cargar): se espera
        descSrc.set.call(this, IMAGEN_VACIA);
        primera.then(() => { if (this.__roneRuta === ruta) descSrc.set.call(this, red.base ? red.base + ruta : IMAGEN_VACIA); });
        return;
      }
      if (ruta) v = red.modo === "vivo" && red.base ? red.base + ruta : IMAGEN_VACIA;
      descSrc.set.call(this, v);
    },
  });
  const AudioOriginal = window.Audio;
  function AudioRone(src) {
    const a = new AudioOriginal();
    a.crossOrigin = "anonymous";   // si no, el medidor de volumen de NELO dejaría el audio en silencio
    if (src !== undefined) {
      const ruta = rutaServidor(src);
      a.src = ruta && red.base ? red.base + ruta : src;
    }
    return a;
  }
  AudioRone.prototype = AudioOriginal.prototype;
  window.Audio = AudioRone;
  document.addEventListener("click", (e) => {   // enlace "Informe" → el de la laptop
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    if (a.id === "enlaceAutodiag" || /:5001\//.test(a.href)) {   // el autodiagnóstico es otro programa: no pasa por el túnel
      e.preventDefault();
      window.alert("El autodiagnóstico físico se abre solo en la laptop del robot (puerto 5001).");
      return;
    }
    const ruta = rutaServidor(a.getAttribute("href"));
    if (!ruta) return;
    e.preventDefault();
    if (red.modo === "vivo" && red.base) window.open(red.base + ruta, "_blank", "noopener");
    else window.alert("El informe está en la laptop del robot y ahora no está conectada.");
  }, true);

  // ---------- Modo demostración: un recorrido simulado (el robot no está conectado) ----------
  const RUTA = (() => {
    const p = [], tramo = (x0, y0, x1, y1) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 30)); for (let i = 0; i < n; i++) p.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
    const arco = (cx, cy, r, a0, a1) => { const n = Math.round(Math.abs(a1 - a0) * r / 30); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    tramo(0, 0, 1100, 0);
    arco(1100, 350, 350, -Math.PI / 2, 0);
    tramo(1450, 350, 1450, 900);
    arco(1100, 900, 350, 0, Math.PI / 2);
    tramo(1100, 1250, 400, 1250);
    arco(400, 950, 300, Math.PI / 2, Math.PI);
    tramo(100, 950, 100, 600);
    p.push([100, 600]);
    const s = [0];
    for (let i = 1; i < p.length; i++) s.push(s[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    return { p, s, largo: s[s.length - 1] };
  })();
  const OBSTACULOS_DEMO = [{ x: 1640, y: 620, s: 1500 }, { x: 760, y: 1440, s: 2900 }, { x: -120, y: 820, s: 3900 }];
  const VEL = 140, PAUSA = 5, DT = 0.25;
  const DURACION = RUTA.largo / VEL + PAUSA;
  const T0 = performance.now(), SESION_DEMO = "demo-" + Math.random().toString(36).slice(2, 7);
  function enRuta(s) {
    s = Math.max(0, Math.min(RUTA.largo, s));
    let i = 1;
    while (i < RUTA.s.length - 1 && RUTA.s[i] < s) i++;
    const a = RUTA.p[i - 1], b = RUTA.p[i], u = (s - RUTA.s[i - 1]) / ((RUTA.s[i] - RUTA.s[i - 1]) || 1);
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, heading: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  const NODOS_DEMO = RUTA.p.filter((_, i) => i % 2 === 0).map(([x, y]) => ({ x: Math.round(x), y: Math.round(y) }));
  function datosDemo(ruta) {
    const q = new URL(ruta, "http://x").searchParams;
    const t = (performance.now() - T0) / 1000, vuelta = Math.floor(t / DURACION), tv = t - vuelta * DURACION;
    const sesion = SESION_DEMO + "-" + vuelta;
    const n = Math.floor(tv / DT) + 1;
    const reinicio = q.get("s") !== sesion || (+q.get("p") || 0) > n;
    const desde = reinicio ? 0 : (+q.get("p") || 0);
    const nuevos = [];
    for (let i = desde; i < n; i++) { const e = enRuta(i * DT * VEL); nuevos.push({ x: Math.round(e.x), y: Math.round(e.y) }); }
    const sAhora = Math.min(RUTA.largo, tv * VEL), pos = enRuta(sAhora);
    const vistos = OBSTACULOS_DEMO.filter((o) => sAhora >= o.s);
    const desdeO = reinicio ? 0 : Math.min(+q.get("o") || 0, vistos.length);
    const proximo = OBSTACULOS_DEMO.find((o) => o.s > sAhora && o.s - sAhora < 600);
    const terminado = sAhora >= RUTA.largo;
    return {
      sesion, reinicio, pos: { x: Math.round(pos.x), y: Math.round(pos.y), heading: pos.heading },
      path_base: 0, path_total: n, path_nuevos: nuevos,
      obst_total: vistos.length, obst_nuevos: vistos.slice(desdeO).map((o) => ({ x: o.x, y: o.y })),
      marcador_inicio: 0, marcador_fin: null, ruta_guardada: NODOS_DEMO,
      estado_ruta: { codigo: terminado ? "COMPLETADO" : "EJECUTANDO", progreso: Math.round(100 * sAhora / RUTA.largo), nodos: NODOS_DEMO.length,
        texto: terminado ? "Demostración terminada: vuelve a empezar" : "Demostración: recorrido simulado (el robot no está conectado)" },
      calibracion: { mm_por_pulso: 10.2, escala_giro: 1, pendiente: null, pulsos: 0, mm_estimados: 0, grados_medidos: 0, frente: -1, espejo: 0, evasion: 1 },
      encoders: null, respaldo: {}, ubicacion: { vistas: 0, estado: "", texto: "", ocupado: false },
      diagnostico: null, laser_mm: proximo ? Math.round(proximo.s - sAhora + 120) : null, bateria: null, camara: null,
      robot_edad_ms: null, clientes: 1,   // punto de estado en ámbar: no hay robot real
    };
  }
  function demo(ruta, opciones) {
    const metodo = (opciones.method || "GET").toUpperCase();
    if (ruta.startsWith("/api/data")) return json(datosDemo(ruta));
    if (ruta.startsWith("/api/info")) return json({ ssid: "RobotMapa", clave: "mapa1234", puerto: 5000, tu_ip: "", direcciones: [] });
    const error = "El robot no está conectado ahora: esto es una demostración. Para manejarlo, enciende rone_estacion.bat en la laptop del robot.";
    if (metodo === "GET") return json({ ok: false, demo: true, error }, 503);
    return json({ ok: false, demo: true, error });
  }

  // ---------- NELO: el de la laptop si está encendido; si no, NELO en la nube ----------
  async function decidirNelo() {
    red.neloModo = "nube";
    if (red.modo !== "vivo" || !red.base) return;
    try {
      const r = await fetchOriginal(red.base + "/jarvis/estado", { cache: "no-store", signal: AbortSignal.timeout(4000),
        headers: claveOp ? { "X-Rone-Clave": claveOp } : {} });
      const d = await r.json();
      if (d.ok !== false && !d.apagado) red.neloModo = "local";
    } catch (e) { /* la laptop no responde: nube */ }
  }
  async function nelo(ruta, opciones) {
    const tipo = ruta.slice(8).split("?")[0];
    if (tipo === "estado" || red.neloModo === null) await decidirNelo();
    if (red.neloModo === "local") {
      try {
        const r = await alServidor(ruta, opciones);
        if (tipo === "eventos" || tipo === "estado") {
          const d = await r.clone().json().catch(() => ({}));
          if (d.apagado) red.neloModo = null;   // se apagó: la próxima consulta pasa a la nube
        }
        return r;
      } catch (e) { red.neloModo = null; }
    }
    return neloNube(tipo, ruta, opciones);
  }

  const nube = { sesion: "nube-" + Math.random().toString(36).slice(2, 8), eventos: [], ultimo: 0, ordenes: 0, ocupado: false, historial: [] };
  try { nube.historial = JSON.parse(sessionStorage.getItem("rone.historial") || "[]"); } catch (e) { /* nada */ }
  function evento(e) {
    e.n = ++nube.ultimo;
    e.hora = new Date().toLocaleTimeString("es-PE", { hour12: false });
    nube.eventos.push(e);
    while (nube.eventos.length > 80) nube.eventos.shift();
  }
  function decir(texto) {
    if (!("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      const voces = speechSynthesis.getVoices();
      u.voice = voces.find((v) => /^es[-_](PE|MX|US|419)/i.test(v.lang)) || voces.find((v) => /^es/i.test(v.lang)) || null;
      u.lang = u.voice ? u.voice.lang : "es-PE";
      u.rate = 1.02;
      speechSynthesis.speak(u);
    } catch (e) { /* sin voz en este navegador */ }
  }
  async function preguntar(texto) {
    texto = String(texto || "").trim().slice(0, 400);
    if (!texto) return;
    if (nube.ocupado) { evento({ tipo: "aviso", texto: "Espera a que NELO termine de responder." }); return; }
    nube.ocupado = true;
    const id = "nube" + (++nube.ordenes);
    evento({ tipo: "mensaje", rol: "usuario", texto });
    evento({ tipo: "orden", fase: "inicio", id, texto, agentes: ["nelo_nube"] });
    let respuesta, ok = true;
    try {
      const r = await fetchOriginal(NUBE + "/nelo", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, historial: nube.historial.slice(-6) }), signal: AbortSignal.timeout(25000) });
      const d = await r.json();
      ok = !!d.ok;
      respuesta = d.texto || d.error || "No pude responder eso.";
    } catch (e) {
      ok = false;
      respuesta = "No me pude conectar con mi cerebro en la nube. Revisa el internet e inténtalo otra vez.";
    }
    nube.historial.push({ rol: "usuario", texto }, { rol: "nelo", texto: respuesta });
    nube.historial = nube.historial.slice(-8);
    try { sessionStorage.setItem("rone.historial", JSON.stringify(nube.historial)); } catch (e) { /* nada */ }
    evento({ tipo: "mensaje", rol: "jarvis", texto: respuesta });
    evento({ tipo: "orden", fase: "fin", id, texto, ok });
    nube.ocupado = false;
    decir(respuesta);
  }
  async function transcribir(audio) {
    try {
      const r = await fetchOriginal(NUBE + "/voz", { method: "POST", body: audio, signal: AbortSignal.timeout(25000) });
      const d = await r.json();
      if (d.ok && d.texto) return preguntar(d.texto);
      evento({ tipo: "aviso", texto: d.error || "No te entendí: escríbeme la pregunta." });
    } catch (e) {
      evento({ tipo: "aviso", texto: "No pude enviar tu voz: escríbeme la pregunta." });
    }
  }
  const AGENTES_NUBE = () => [
    { id: "nelo_nube", nombre: "NELO en la nube", de_nelo: true, estado: "listo", icono: "conexion", herramientas: 2,
      funciones: ["conversar", "recordar"],
      descripcion: "Responde preguntas sobre RONE, NELO y ROMA las 24 horas, con un modelo gratis.",
      ejemplos: ["¿Qué es RONE?", "¿Qué hace ROMA?", "Recuerda que la feria es el lunes"],
      ayuda: { que_es: "NELO funcionando en la nube: no depende de la laptop del robot y responde a cualquier hora.",
        como_usar: ["¿Qué es RONE?", "¿En qué se diferencian NELO y ROMA?", "¿Qué ODS trabaja el proyecto?"],
        notas: ["Usa un cupo gratis diario (unas 600 preguntas cortas); se renueva a las 7 p. m. de Perú.",
          "Desde la nube no puede mover el robot ni ver la cámara."] } },
    { id: "nelobot", nombre: "NELOBOT", de_nelo: true, estado: red.modo === "vivo" ? "listo" : "apagado", icono: "robot", herramientas: 0,
      funciones: ["ver_estado_robot"], descripcion: "Cuenta dónde está el robot cuando la laptop del robot está conectada.",
      falta: "El robot no está conectado ahora.", ejemplos: ["¿Dónde está el robot?"] },
  ];
  function neloNube(tipo, ruta, opciones) {
    const q = new URL(ruta, "http://x").searchParams;
    if (tipo === "estado") {
      return json({ ok: true, estado: nube.ocupado ? "pensando" : "listo", detalle: "", voz: "Voz de este equipo", internet: false,
        personaje: "", modelo: "Llama 3.1 8B · nube gratis", visor_local: false, puede_ordenar: true, puerto_https: null });
    }
    if (tipo === "eventos") {
      const reinicio = q.get("sesion") !== nube.sesion, desde = +q.get("desde") || 0;
      return json({ ok: true, sesion: nube.sesion, ultimo: nube.ultimo, reinicio,
        eventos: reinicio ? [] : nube.eventos.filter((e) => e.n > desde),
        estado: nube.ocupado ? "pensando" : "listo", detalle: nube.ocupado ? "Pensando en la nube…" : "" });
    }
    if (tipo === "agentes") return json({ ok: true, agentes: AGENTES_NUBE() });
    if (tipo === "orden") {
      let d = {};
      try { d = JSON.parse(opciones.body || "{}"); } catch (e) { /* nada */ }
      preguntar(d.texto);
      return json({ ok: true });
    }
    if (tipo === "voz") {
      const texto = q.get("texto");
      texto ? preguntar(texto) : transcribir(opciones.body);
      return json({ ok: true });
    }
    if (tipo === "silenciar") { try { speechSynthesis.cancel(); } catch (e) { /* nada */ } return json({ ok: true }); }
    return json({ ok: false, error: "No disponible en la nube." });
  }

  // ---------- Aviso visible del modo ----------
  let pastilla = null;
  function pintarModo() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", pintarModo, { once: true }); return; }
    if (!pastilla) {
      pastilla = document.createElement("div");
      pastilla.className = "rone-modo";
      pastilla.setAttribute("role", "status");
      document.body.append(pastilla);
      const estilo = document.createElement("style");
      estilo.textContent = `.rone-modo{position:fixed;left:16px;bottom:16px;z-index:9000;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);
        padding:8px 14px;border-radius:999px;font:600 12.5px/1.3 Geist,"Segoe UI",system-ui,sans-serif;color:#0b1022;background:rgba(255,255,255,.92);
        border:1px solid rgba(11,16,34,.14);box-shadow:0 8px 24px -12px rgba(11,16,34,.35);backdrop-filter:blur(8px)}
        .rone-modo i{width:8px;height:8px;border-radius:50%;background:#f59e0b;flex:none}
        .rone-modo.vivo i{background:#16a34a}
        @media (max-width:900px){.rone-modo{bottom:76px}}`;
      document.head.append(estilo);
    }
    const vivo = red.modo === "vivo";
    pastilla.classList.toggle("vivo", vivo);
    pastilla.innerHTML = vivo ? "<i></i>En vivo: conectado a la laptop del robot" : "<i></i>Demostración: el robot no está conectado ahora";
    const texto = document.getElementById("textoEstado");
    if (texto && !vivo) texto.textContent = "Demostración (sin robot)";
  }
  document.addEventListener("DOMContentLoaded", () => {
    const texto = document.getElementById("textoEstado");
    if (texto) new MutationObserver(() => {
      if (red.modo !== "vivo" && texto.textContent !== "Demostración (sin robot)") texto.textContent = "Demostración (sin robot)";
    }).observe(texto, { childList: true, characterData: true, subtree: true });
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) revisarPronto(); });

  buscarEstacion(true);
})();
