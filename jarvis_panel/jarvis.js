// Menú lateral de secciones y sección "04 — Asistente" (NELO) de la página de NELOBOT.
// NELO es el nombre del asistente en esta página; por dentro es JARVIS, que corre en la laptop del servidor
// y con el que esta página habla por /jarvis/* de server.py.
// El menú se arma a partir de los enlaces de .nav, así siempre coincide con las secciones de la página.
// La sección tiene dos pestañas: Asistente (reactor y voz) y Agentes (como la vista Agentes del HUD de JARVIS:
// lista de agentes, grafo en vivo orden → herramientas → respuesta y registro de actividad).
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const NOMBRES = { abriendo: "Abriendo micrófono", iniciando: "Iniciando", listo: "En espera", escuchando: "Escuchando", pensando: "Pensando", hablando: "Hablando", error: "Error" };
  const FRASES = ["¿Dónde está el robot?", "¿Hay obstáculos cerca del robot?", "Ejecuta el recorrido grabado"];
  const ICONO_CERRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  // ======================= Menú lateral =======================
  const menu = (() => {
    const boton = $("botonMenu");
    const enlaces = [...document.querySelectorAll(".nav a[data-seccion]")];
    if (!boton || !enlaces.length) return null;

    const velo = document.createElement("div");
    velo.className = "menu-velo";
    velo.hidden = true;
    const panel = document.createElement("aside");
    panel.className = "menu-lateral";
    panel.id = "menuLateral";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Secciones de la página");
    panel.innerHTML = `<div class="menu-lateral-cab"><b>NELOBOT</b><button type="button" class="menu-cerrar" aria-label="Cerrar el menú">${ICONO_CERRAR}</button></div>
      <ul class="menu-lista"></ul>
      <div class="menu-lateral-pie"><i></i><span>Sin conexión</span></div>`;
    const lista = panel.querySelector(".menu-lista");

    const items = [{ seccion: "inicio", nombre: "Inicio", href: "#inicio" },
      ...enlaces.map((a) => ({ seccion: a.dataset.seccion, nombre: a.textContent.trim(), href: a.getAttribute("href") }))];
    const elementos = new Map();
    for (const it of items) {
      const destino = document.getElementById(it.seccion);
      const num = (destino?.querySelector(".indice, .jv-indice")?.textContent || "").trim().slice(0, 2);
      const a = document.createElement("a");
      a.className = "menu-item" + (it.seccion === "nelo" ? " jarvis" : "");
      a.href = it.href;
      a.innerHTML = `<span class="num"></span><span class="nombre"></span>`;
      a.querySelector(".num").textContent = /^\d\d$/.test(num) ? num : "";
      a.querySelector(".nombre").textContent = it.nombre;
      if (it.seccion === "nelo") {
        a.querySelector(".nombre").prepend(document.createElement("i"));
        const sub = document.createElement("span");
        sub.className = "sub";
        sub.textContent = "Asistente de voz";
        a.append(sub);
      }
      a.addEventListener("click", () => cerrar(false));
      const li = document.createElement("li");
      li.append(a);
      lista.append(li);
      elementos.set(it.seccion, a);
    }
    document.body.append(velo, panel);

    let origen = null;
    function abrir() {
      origen = document.activeElement;
      velo.hidden = false;
      requestAnimationFrame(() => velo.classList.add("visible"));
      panel.classList.add("abierto");
      boton.setAttribute("aria-expanded", "true");
      copiarEstadoRobot();
      (panel.querySelector(".menu-item.activo") || panel.querySelector(".menu-item")).focus();
    }
    function cerrar(devolverFoco = true) {
      velo.classList.remove("visible");
      panel.classList.remove("abierto");
      boton.setAttribute("aria-expanded", "false");
      setTimeout(() => { velo.hidden = true; }, 200);
      if (devolverFoco) (origen && document.contains(origen) ? origen : boton).focus();
    }
    function copiarEstadoRobot() {  // el pie repite el estado del robot que muestra la barra
      const punto = $("puntoEstado"), texto = $("textoEstado");
      const i = panel.querySelector(".menu-lateral-pie i");
      i.className = punto ? punto.className.replace("punto-estado", "").trim() : "";
      panel.querySelector(".menu-lateral-pie span").textContent = texto ? texto.textContent : "";
    }
    boton.addEventListener("click", () => (panel.classList.contains("abierto") ? cerrar() : abrir()));
    panel.querySelector(".menu-cerrar").addEventListener("click", () => cerrar());
    velo.addEventListener("click", () => cerrar());
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); cerrar(); return; }
      if (e.key === "Tab") {  // el foco no sale del menú mientras está abierto
        const f = [...panel.querySelectorAll("a, button")];
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    // Sección activa: la misma que marca la barra superior
    const sincronizar = () => {
      const activa = enlaces.find((a) => a.classList.contains("activo"))?.dataset.seccion || (window.scrollY < 300 ? "inicio" : "");
      elementos.forEach((a, s) => a.classList.toggle("activo", s === activa));
    };
    new MutationObserver(sincronizar).observe(document.querySelector(".nav"), { subtree: true, attributes: true, attributeFilter: ["class"] });
    sincronizar();
    // El pie sigue en vivo el estado del robot de la barra superior
    for (const id of ["puntoEstado", "textoEstado"]) {
      if ($(id)) new MutationObserver(copiarEstadoRobot).observe($(id), { attributes: true, childList: true, characterData: true, subtree: true });
    }
    copiarEstadoRobot();
    if (location.hash === "#menu") abrir();  // enlace directo al menú
    return { itemJarvis: elementos.get("nelo") };
  })();

  // ======================= Sección NELO =======================
  const sec = $("nelo");
  if (!sec) return;

  const s = {
    apagado: null, sinServidor: false, arrancando: false, local: false, puedeOrdenar: false, puertoHttps: null,
    estado: "", detalle: "", sesion: "", ultimo: 0, visible: false, nivel: 0, nivelSuave: 0,
    hablando: false, grabando: false, tCerrarMic: null, flujo: null, grabadora: null, trozos: [], inicioGrabacion: 0, reproduciendo: null, ctx: null,
    acciones: new Map(), tCiclo: null, avisoHasta: 0, agentes: [], corriendo: new Map(), tAgentes: 0,
  };
  // Pestaña Agentes: agente elegido, orden en curso y las herramientas que usó
  const ag = { elegido: "nelobot", verAgente: true, orden: null, pasos: new Map(), foco: new Set(), trazar: false };

  // --- Reactor: escala, barras de voz y bobinas ---
  (() => {
    const escala = $("jvEscala");
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2, larga = i % 10 === 0, r1 = larga ? 186 : 190;
      const l = document.createElementNS(SVG_NS, "line");
      l.setAttribute("x1", 200 + Math.cos(a) * r1); l.setAttribute("y1", 200 + Math.sin(a) * r1);
      l.setAttribute("x2", 200 + Math.cos(a) * 196); l.setAttribute("y2", 200 + Math.sin(a) * 196);
      if (larga) l.setAttribute("class", "larga");
      escala.append(l);
    }
    const bobinas = $("jvBobinas");
    const p = (r, a) => `${(200 + Math.cos(a) * r).toFixed(2)} ${(200 + Math.sin(a) * r).toFixed(2)}`;
    for (let i = 0; i < 8; i++) {
      const a0 = ((i * 45 + 5) * Math.PI) / 180, a1 = (((i + 1) * 45 - 5) * Math.PI) / 180;
      const trazo = document.createElementNS(SVG_NS, "path");
      trazo.setAttribute("class", "jv-bobina");
      trazo.setAttribute("d", `M${p(52, a0)} A52 52 0 0 1 ${p(52, a1)} L${p(30, a1 - 0.04)} A30 30 0 0 0 ${p(30, a0 + 0.04)}Z`);
      bobinas.append(trazo);
    }
  })();
  (() => {  // núcleo del grafo de la pestaña Agentes (viewBox 200)
    const escala = $("jvEscalaG");
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, larga = i % 6 === 0, r1 = larga ? 101 : 104;
      const l = document.createElementNS(SVG_NS, "line");
      l.setAttribute("x1", 100 + Math.cos(a) * r1); l.setAttribute("y1", 100 + Math.sin(a) * r1);
      l.setAttribute("x2", 100 + Math.cos(a) * 108); l.setAttribute("y2", 100 + Math.sin(a) * 108);
      if (larga) l.setAttribute("class", "larga");
      escala.append(l);
    }
    const bobinas = $("jvBobinasG");
    const p = (r, a) => `${(100 + Math.cos(a) * r).toFixed(2)} ${(100 + Math.sin(a) * r).toFixed(2)}`;
    for (let i = 0; i < 8; i++) {
      const a0 = ((i * 45 + 5) * Math.PI) / 180, a1 = (((i + 1) * 45 - 5) * Math.PI) / 180;
      const trazo = document.createElementNS(SVG_NS, "path");
      trazo.setAttribute("class", "jv-bobina");
      trazo.setAttribute("d", `M${p(46, a0)} A46 46 0 0 1 ${p(46, a1)} L${p(26, a1 - 0.04)} A26 26 0 0 0 ${p(26, a0 + 0.04)}Z`);
      bobinas.append(trazo);
    }
  })();
  const barras = [];
  for (let i = 0; i < 64; i++) {
    const l = document.createElementNS(SVG_NS, "line");
    $("jvBarras").append(l);
    barras.push({ el: l, ang: (i / 64) * Math.PI * 2, fase: Math.random() * 10 });
  }
  function animar(t) {
    if (s.visible) {
      s.nivelSuave += (s.nivel - s.nivelSuave) * 0.25;
      const reposo = 0.05 + 0.03 * Math.sin(t / 900);
      for (const b of barras) {
        const ruido = 0.55 + 0.45 * Math.sin(t / 140 + b.fase * 3 + b.ang * 5);
        const largo = 4 + Math.max(reposo, s.nivelSuave) * 34 * ruido;
        const c = Math.cos(b.ang), n = Math.sin(b.ang);
        b.el.setAttribute("x1", 200 + c * 92); b.el.setAttribute("y1", 200 + n * 92);
        b.el.setAttribute("x2", 200 + c * (92 + largo)); b.el.setAttribute("y2", 200 + n * (92 + largo));
      }
      const latido = 1 - 0.035 * (1 + Math.sin(t / 510));
      $("jvCentro").style.transform = `scale(${(latido + s.nivelSuave * 0.18).toFixed(3)})`;
      $("jvMiniCentro").style.transform = `scale(${(latido + s.nivelSuave * 0.22).toFixed(3)})`;
    }
    requestAnimationFrame(animar);
  }

  // --- Red ---
  async function pedir(ruta, cuerpo) {
    try {
      const r = await fetch("/jarvis/" + ruta, cuerpo === undefined ? { cache: "no-store" } : {
        method: "POST", headers: { "Content-Type": "application/json", "X-Nelobot": "1" }, body: JSON.stringify(cuerpo),
      });
      return await r.json();
    } catch {
      // Página abierta con doble clic o desde otro servidor: no hay server.py que la conecte con NELO
      return { ok: false, apagado: true, sinServidor: true };
    }
  }

  // --- Pintar ---
  const BOTONES_HABLAR = [$("jvHablar"), $("jvAgHablar")];
  const MIC_DISPONIBLE = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && "MediaRecorder" in window;
  function urlSegura() {
    return s.puertoHttps ? `https://${location.hostname}:${s.puertoHttps}${location.pathname}#nelo` : "";
  }
  function aviso(texto, segundos = 6) {
    $("jvDetalle").textContent = texto;
    $("jvMiniDetalle").textContent = texto;
    s.avisoHasta = Date.now() + segundos * 1000;
  }
  function pintar() {
    const clave = s.apagado ? (s.arrancando ? "iniciando" : "apagado")
      : s.hablando ? (s.grabando ? "escuchando" : "abriendo") : s.reproduciendo ? "hablando" : s.estado || "listo";
    sec.dataset.estado = clave;
    const nombre = s.sinServidor ? "Sin servidor" : s.arrancando && s.apagado ? "Despertando" : s.apagado ? "Apagado" : NOMBRES[clave] || "Conectando";
    if (menu?.itemJarvis) {
      menu.itemJarvis.dataset.estado = clave;
      menu.itemJarvis.querySelector(".sub").textContent = "Asistente de voz · " + nombre.toLowerCase();
    }
    $("jvEstado").textContent = nombre;
    $("jvMiniEstado").textContent = nombre;
    if (Date.now() > s.avisoHasta) $("jvDetalle").textContent = $("jvMiniDetalle").textContent = s.apagado ? "" : s.detalle;
    for (const hablar of BOTONES_HABLAR) {
      hablar.disabled = s.apagado || !s.puedeOrdenar || (!MIC_DISPONIBLE && !urlSegura());
      hablar.classList.toggle("activo", s.grabando);
    }
    $("jvSilenciar").disabled = !s.reproduciendo && (!!s.apagado || !s.local);
    sec.querySelectorAll(".jv-frase").forEach((b) => { b.disabled = s.apagado || !s.puedeOrdenar; });
    sec.querySelectorAll(".jv-escribir input, .jv-escribir button").forEach((c) => { c.disabled = s.apagado || !s.puedeOrdenar; });
    $("jvHablarTexto").textContent = $("jvAgHablarTexto").textContent = s.hablando && !s.grabando ? "Abriendo micrófono… espera"
      : s.hablando ? "Te escucho… suelta para enviar"
      : MIC_DISPONIBLE ? "Mantén pulsado para hablar" : "Abrir la versión segura para hablar";
    $("jvHablarAyuda").textContent = MIC_DISPONIBLE ? "Usa el micrófono de este equipo · NELO te responde aquí"
      : "El navegador solo da el micrófono en https (se acepta un aviso una vez)";
    const caja = $("jvAviso");
    caja.hidden = !(s.apagado || !MIC_DISPONIBLE);
    caja.textContent = s.sinServidor
      ? "Esta página se abrió sin el servidor del robot. Para hablar con NELO ejecuta iniciar_servidor.bat y abre la página que indica."
      : s.apagado && s.arrancando
      ? "NELO se está encendiendo en la laptop del servidor. Tarda unos 30 a 60 segundos; esta sección se conecta sola."
      : s.apagado
      ? "NELO no está disponible: falta el programa JARVIS en la laptop del servidor."
      : "Para hablarle por voz desde este equipo, abre la versión segura de la página. El navegador mostrará un aviso del certificado la primera vez: elige “Continuar”.";
    pintarGrafo();
  }
  function subtitulo(id, texto) {
    const p = $(id);
    p.hidden = false;
    p.querySelector("span").textContent = texto;
  }
  const legible = (nombre) => String(nombre).split("__").pop().replace(/_/g, " ");
  function accion(e) {
    let li = s.acciones.get(e.id);
    if (!li) {
      li = document.createElement("li");
      const quien = s.agentes.find((a) => a.id === e.agente)?.nombre || (e.agente === "nelobot" ? "NELOBOT" : "NELO");
      li.textContent = `${quien} · ${legible(e.nombre)}`;
      s.acciones.set(e.id, li);
      $("jvAcciones").prepend(li);
      while ($("jvAcciones").children.length > 4) {
        const ultimo = $("jvAcciones").lastElementChild;
        s.acciones.forEach((v, k) => { if (v === ultimo) s.acciones.delete(k); });
        ultimo.remove();
      }
      $("jvBloqueAcciones").hidden = false;
    }
    if (e.fase === "inicio") li.className = "en-curso";
    else {
      li.className = e.ok ? "ok" : "mal";
      const seg = document.createElement("span");
      seg.textContent = e.ok ? `${e.segundos} s` : "falló";
      li.append(seg);
    }
  }
  function procesar(eventos, primeraVez) {
    for (const e of eventos) {
      if (e.tipo === "mensaje" && e.rol === "usuario") {
        subtitulo("jvDijoUsuario", e.texto);
        $("jvDijoJarvis").hidden = true;
      } else if (e.tipo === "mensaje" && e.rol === "jarvis") {
        subtitulo("jvDijoJarvis", e.texto);
        actividad(e.hora, "nelo", [["", (e.narracion ? "NELO (en vivo): " : "NELO: ") + e.texto]]);
      } else if (e.tipo === "orden") {
        if (e.fase === "inicio") {
          ag.orden = { ...e };
          ag.verAgente = false;
          ag.foco = new Set(e.agentes || []);
          actividad(e.hora, "orden", [["q", "› " + e.texto]]);
        } else {
          if (ag.orden?.id === e.id) Object.assign(ag.orden, e);
          ag.trazar = !!e.ok && !ag.verAgente && !primeraVez;
          ag.foco.clear();
          s.corriendo.clear();
          if (!e.ok) actividad(e.hora, "fallo", [["", "La orden falló."]]);
          if (!primeraVez) pedir("estado").then((r) => { if (r.ok) aplicarEstado(r); });   // personaje y voz pueden haber cambiado
        }
        marcarAgentes();
      } else if (e.tipo === "herramienta") {
        accion(e);
        ag.pasos.set(e.id, { ...(ag.pasos.get(e.id) || {}), ...e });
        while (ag.pasos.size > 60) ag.pasos.delete(ag.pasos.keys().next().value);
        const quien = agente(e.agente)?.nombre || "NELO";
        if (e.fase === "inicio") {
          s.corriendo.set(e.agente, (s.corriendo.get(e.agente) || 0) + 1);
          actividad(e.hora, "", [["", quien + " · "], ["h", legible(e.nombre)], ["", e.detalle ? " — " + e.detalle : ""]]);
        } else {
          if (s.corriendo.has(e.agente)) {
            const n = s.corriendo.get(e.agente) - 1;
            n > 0 ? s.corriendo.set(e.agente, n) : s.corriendo.delete(e.agente);
          }
          actividad(e.hora, e.ok ? "" : "fallo", [["h", legible(e.nombre)], [e.ok ? "ok" : "mal", ` ${e.ok ? "listo" : "falló"} en ${e.segundos} s`],
            ["", e.detalle ? " — " + e.detalle : ""]]);
        }
        marcarAgentes();
      } else if (e.tipo === "aviso" && (!e.para || e.para === EQUIPO)) {
        aviso(e.texto);
      } else if (e.tipo === "audio" && e.para === EQUIPO && !primeraVez) {
        reproducir(e.id);   // la respuesta hablada de NELO a lo que se dijo desde este equipo
      }
    }
  }

  // --- Agentes: los de NELO (el robot y su memoria) se eligen y se ven en el grafo; los de JARVIS solo se nombran ---
  const TRAZOS = {
    navegador: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
    codigo: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    computadora: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>',
    archivos: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z"/>',
    musica: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    vision: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    rutinas: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    memoria: '<ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5"/>',
    robot: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V5M9 13v.5M15 13v.5M9.5 16.5h5M3 12v3M21 12v3"/><circle cx="12" cy="4" r="1"/>',
    gmail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3.5 6 8.5 7 8.5-7"/>',
    google_drive: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18Z"/>',
    google_calendar: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    mensajeria: '<path d="M4 5h16v11H9l-5 4Z"/>',
    conexion: '<path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0Z"/><path d="M12 17v4"/>',
    grafico: '<path d="M4 20V11M10 20V5M16 20v-8M21 20H3"/>',
    personaje: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M8.5 9.5h1M14.5 9.5h1"/>',
    orden: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    respuesta: '<path d="M4 9v6h4l5 4V5L8 9Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  };
  const icono = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[id] || TRAZOS.conexion}</svg>`;
  const agente = (id) => s.agentes.find((a) => a.id === id);
  const iconoDe = (id) => agente(id)?.icono || (id === "nelo" ? "rutinas" : id);   // "nelo": la hora, que es suya
  const crear = (etiqueta, clase, texto) => {
    const n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  };
  async function cargarAgentes() {
    s.tAgentes = Date.now();
    const r = await pedir("agentes");
    if (!r.ok || !Array.isArray(r.agentes)) return;
    s.agentes = r.agentes;
    pintarAgentes();
  }
  function pintarAgentes() {
    const ul = $("jvAgentes"), chips = $("jvAgAjenos");
    ul.innerHTML = ""; chips.innerHTML = "";
    const propios = s.agentes.filter((a) => a.de_nelo), ajenos = s.agentes.filter((a) => !a.de_nelo);
    if (!propios.some((a) => a.id === ag.elegido)) ag.elegido = propios[0]?.id;
    for (const a of propios) {
      const li = crear("li", "jv-ag-agente");
      li.dataset.id = a.id;
      const b = crear("button");
      b.type = "button";
      b.innerHTML = `<span class="jv-ag-ico">${icono(a.icono)}</span>`;
      b.append(crear("span", "jv-ag-nombre", a.nombre), crear("span", "jv-ag-pill"),
        crear("span", "jv-ag-desc", a.estado === "listo" ? a.descripcion : a.falta || "Sin conectar"),
        crear("span", "jv-ag-mas", "Ver qué hace y cómo usarlo ›"));
      b.title = "Ver qué hace y cómo usarlo";
      b.addEventListener("click", () => { elegirAgente(a.id); abrirFicha(a); });
      li.append(b);
      if (a.ejemplos?.length) {
        const ejemplos = crear("ul");
        for (const texto of a.ejemplos.slice(0, 2)) ejemplos.append(crear("li", "", `“${texto}”`));
        li.append(ejemplos);
      }
      ul.append(li);
    }
    if (!propios.length) ul.append(crear("li", "jv-ag-vacio", "Los agentes aparecen cuando NELO está encendido."));
    for (const a of ajenos) {
      const c = crear("span", "jv-ag-chip");
      c.dataset.id = a.id;
      c.title = a.estado === "listo" ? a.descripcion : a.falta || "Sin conectar";
      c.innerHTML = icono(a.icono);
      c.append(a.nombre);
      chips.append(c);
    }
    $("jvAgAjenosBloque").hidden = !ajenos.length;
    $("jvAgCuenta").textContent = propios.length ? `${propios.filter((a) => a.estado === "listo").length} / ${propios.length}` : "";
    marcarAgentes();
  }
  function marcarAgentes() {
    for (const li of $("jvAgentes").querySelectorAll(".jv-ag-agente")) {
      const a = agente(li.dataset.id);
      if (!a) continue;
      const [clase, pill, texto] = s.corriendo.has(a.id) ? ["activo", "trabajando", "Activo"]
        : a.estado !== "listo" ? ["apagado", "apagada", "Sin conectar"]
        : ag.foco.has(a.id) ? ["foco", "foco", "Foco"] : ["", "", "Listo"];
      li.className = "jv-ag-agente" + (clase ? " " + clase : "") + (a.id === ag.elegido ? " elegido" : "");
      li.querySelector("button").setAttribute("aria-expanded", a.id === ag.elegido);
      const p = li.querySelector(".jv-ag-pill");
      p.className = "jv-ag-pill" + (pill ? " " + pill : "");
      p.textContent = texto;
    }
    pintarGrafo();
  }
  // --- Ficha de un agente: qué es, qué puede hacer, cómo usarlo, notas ---
  const TILDES = { obstaculos: "obstáculos", grabacion: "grabación", exploracion: "exploración", estadisticas: "estadísticas",
    narracion: "narración", nelo: "NELO", informe: "informe" };
  const conTildes = (texto) => texto.replace(/[a-záéíóúñ]+/gi, (p) => TILDES[p.toLowerCase()] || p);
  const ficha = $("jvFicha");
  function abrirFicha(a) {
    if (!ficha?.showModal) return;
    const ayuda = a.ayuda || {};
    $("jvFichaIco").innerHTML = icono(a.icono);
    $("jvFichaTitulo").textContent = a.nombre;
    $("jvFichaQue").textContent = ayuda.que_es || a.descripcion || "";
    const funciones = $("jvFichaFunciones");
    funciones.innerHTML = "";
    for (const f of a.funciones_detalle || (a.funciones || []).map((n) => ({ nombre: n }))) {
      const li = crear("li");
      li.append(crear("b", "", conTildes(legible(f.nombre)).replace(/^./, (c) => c.toUpperCase())));
      li.append(crear("em", f.confirma ? "confirma" : "", f.confirma ? "pide un «sí»" : "directo"));
      if (f.descripcion) li.append(crear("span", "", f.descripcion));
      funciones.append(li);
    }
    const frases = $("jvFichaFrases");
    frases.innerHTML = "";
    for (const texto of ayuda.como_usar || a.ejemplos || []) {
      const b = crear("button", "", `“${texto}”`);
      b.type = "button";
      b.disabled = s.apagado || !s.puedeOrdenar;
      b.title = "Decírselo a NELO ahora";
      b.addEventListener("click", async () => {
        contexto();   // un gesto del usuario: permite reproducir la respuesta hablada después
        ficha.close();
        subtitulo("jvDijoUsuario", texto);
        const r = await pedir("orden", { texto, equipo: EQUIPO });
        if (!r.ok) aviso(r.error || "No se pudo enviar.");
        ciclo();
      });
      frases.append(b);
    }
    const notas = $("jvFichaNotas");
    notas.innerHTML = "";
    for (const n of ayuda.notas || []) notas.append(crear("li", "", n));
    $("jvFichaNotasTitulo").hidden = !(ayuda.notas || []).length;
    ficha.showModal();
    $("jvFichaCerrar").focus();
  }
  $("jvFichaCerrar")?.addEventListener("click", () => ficha.close());
  ficha?.addEventListener("click", (e) => { if (e.target === ficha) ficha.close(); });   // tocar fuera la cierra

  function elegirAgente(id) {
    ag.elegido = id;
    ag.verAgente = true;
    marcarAgentes();
  }

  // --- Grafo: orden → herramientas → respuesta (igual que en el HUD de JARVIS) ---
  // Los huecos alternan arriba y abajo del núcleo: con dos herramientas ya se forma un abanico completo
  const POS = { orden: [13, 50], respuesta: [87, 50], huecos: [[30, 20], [70, 80], [70, 20], [30, 80]] };
  function nodo(tipo, clase, titulo, sub, [x, y], iconoId) {
    const n = crear("div", `jv-nodo ${tipo} ${clase}`);
    n.style.left = x + "%"; n.style.top = y + "%";
    n.innerHTML = `<div class="jv-nodo-ico">${icono(iconoId)}</div>`;
    n.append(crear("div", "jv-nodo-t", titulo), crear("div", "jv-nodo-s", sub));
    return n;
  }
  function pintarGrafo() {
    if ($("jvVistaAgentes").hidden) return;   // se pinta al abrir la pestaña
    const nodos = $("jvNodos"), cables = $("jvCables");
    nodos.innerHTML = ""; cables.innerHTML = "";
    const cable = ([x, y], clase) => {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", `M${x} ${y} L50 50`);
      p.setAttribute("pathLength", "100");
      p.setAttribute("class", "jv-cable " + clase + (ag.trazar && clase === "hecho" ? " traza" : ""));
      cables.append(p);
    };
    const o = ag.orden;
    let nombre = "NELO", sub = "", tarea = "sin orden", estado = "EN ESPERA", detalle = "", progreso = 0, clasePill = "", textoPill = "En espera";

    if (!o || ag.verAgente) {
      const a = agente(ag.elegido);
      if (a) {
        nombre = a.nombre;
        sub = a.estado === "listo" ? `${a.herramientas} ${a.herramientas === 1 ? "herramienta lista" : "herramientas listas"}` : "sin conectar";
        nodos.append(nodo("orden", "espera", "Orden", a.ejemplos?.[0] ? `“${a.ejemplos[0]}”` : "—", POS.orden, "orden"));
        cable(POS.orden, "");
        (a.funciones || []).slice(0, 4).forEach((h, i) => {
          nodos.append(nodo("herramienta", "espera" + (POS.huecos[i][1] < 50 ? " arriba" : ""), legible(h), a.estado === "listo" ? "lista" : "—", POS.huecos[i], a.icono));
          cable(POS.huecos[i], "");
        });
        if ((a.funciones || []).length > 4) nodos.append(crear("div", "jv-mas", `+${a.funciones.length - 4} herramientas`));
        nodos.append(nodo("respuesta", "espera", "Respuesta", "voz de NELO", POS.respuesta, "respuesta"));
        cable(POS.respuesta, "");
        if (a.estado !== "listo") { clasePill = "apagada"; textoPill = "Sin conectar"; estado = "SIN CONECTAR"; }
        detalle = a.estado === "listo" ? a.descripcion : a.falta;
      } else {
        sub = "sin agentes";
        detalle = "Los agentes aparecen cuando NELO está encendido.";
      }
      if (o && o.fase === "inicio") { clasePill = "trabajando"; textoPill = "Trabajando"; }
    } else {
      const pasos = [...ag.pasos.values()].filter((p) => p.orden === o.id);
      const ultimo = pasos[pasos.length - 1];
      nombre = ultimo ? agente(ultimo.agente)?.nombre || "NELO" : "NELO";
      tarea = `orden ${o.id}`;
      nodos.append(nodo("orden", "", "Orden", o.texto, POS.orden, "orden"));
      cable(POS.orden, "hecho");
      pasos.slice(-4).forEach((p, i) => {
        const clase = p.fase === "inicio" ? "corriendo" : p.ok ? "" : "fallo";
        const texto = p.fase === "inicio" ? p.detalle || "en curso…" : p.detalle || (p.ok ? "listo" : "falló");
        nodos.append(nodo("herramienta", clase + (POS.huecos[i][1] < 50 ? " arriba" : ""), legible(p.nombre), texto, POS.huecos[i], iconoDe(p.agente)));
        cable(POS.huecos[i], p.fase === "inicio" ? "vivo" : p.ok ? "hecho" : "fallo");
      });
      if (pasos.length > 4) nodos.append(crear("div", "jv-mas", `+${pasos.length - 4} herramientas`));
      const fin = o.fase === "fin";
      nodos.append(nodo("respuesta", fin ? (o.ok ? "" : "fallo") : "espera", "Respuesta",
        fin ? o.respuesta || "sin respuesta hablada" : "esperando…", POS.respuesta, "respuesta"));
      cable(POS.respuesta, fin ? (o.ok ? "hecho" : "fallo") : "");
      const enCurso = pasos.find((p) => p.fase === "inicio");
      if (!fin) {
        estado = "TRABAJANDO"; clasePill = "trabajando"; textoPill = "Trabajando";
        sub = enCurso ? legible(enCurso.nombre) : "analizando la orden";
        detalle = enCurso ? `${nombre} · ${legible(enCurso.nombre)}` : "NELO decide qué herramientas usar";
        progreso = -1;
      } else {
        estado = o.ok ? "LISTO" : "ERROR";
        clasePill = o.ok ? "" : "error"; textoPill = o.ok ? "Listo" : "Error";
        sub = o.ok ? "" : "falló";
        const n = pasos.length;
        detalle = `Respondió en ${o.segundos} s · ${n ? n + (n === 1 ? " herramienta" : " herramientas") : "sin herramientas"}`;
        progreso = 1;
      }
    }
    if (s.apagado) {
      clasePill = "apagada";
      textoPill = s.sinServidor ? "Sin servidor" : s.arrancando ? "Despertando" : "Apagado";
    }
    ag.trazar = false;  // el trazo de cierre se dibuja una sola vez

    $("jvAgTitulo").textContent = `Agente · ${nombre}`;
    $("jvAgTarea").textContent = tarea;
    $("jvNucleoNombre").textContent = nombre;
    $("jvNucleoSub").textContent = sub;
    const pill = $("jvAgPill");
    pill.className = "jv-ag-pill" + (clasePill ? " " + clasePill : "");
    pill.textContent = textoPill;
    $("jvResultado").className = "jv-resultado" + (estado === "TRABAJANDO" ? " trabajando" : estado === "ERROR" ? " fallo" : "");
    $("jvResEstado").textContent = estado;
    $("jvResDetalle").textContent = detalle || "";
    const barra = $("jvProgreso");
    barra.classList.toggle("indeterminado", progreso === -1);
    barra.firstElementChild.style.transform = progreso === -1 ? "" : `scaleX(${progreso})`;
  }

  // --- Actividad: cada orden, cada herramienta y lo que respondió NELO ---
  const VACIO_ACTIVIDAD = "Aquí verás cada orden, cada herramienta que usa NELO y su resultado.";
  function actividad(hora, clase, partes) {
    const ol = $("jvActividad");
    ol.querySelector(".jv-ag-vacio")?.remove();
    const abajo = ol.scrollHeight - ol.scrollTop - ol.clientHeight < 40;
    const li = crear("li", clase);
    li.append(crear("time", "", hora || new Date().toLocaleTimeString("es-PE", { hour12: false })));
    const p = crear("p");
    for (const [c, t] of partes) p.append(c ? crear("span", c, t) : document.createTextNode(t));
    li.append(p);
    ol.append(li);
    while (ol.children.length > 150) ol.firstElementChild.remove();
    if (abajo) ol.scrollTop = ol.scrollHeight;
  }
  function vaciarActividad() {
    $("jvActividad").innerHTML = "";
    $("jvActividad").append(crear("li", "jv-ag-vacio", VACIO_ACTIVIDAD));
  }
  $("jvActividadLimpiar").addEventListener("click", vaciarActividad);

  // --- Pestañas: Asistente | Agentes ---
  const PESTANAS = [$("jvPestanaAsistente"), $("jvPestanaAgentes")];
  function elegirPestana(boton, enfocar = false) {
    for (const b of PESTANAS) {
      const elegida = b === boton;
      b.setAttribute("aria-selected", elegida);
      b.tabIndex = elegida ? 0 : -1;
      $(b.getAttribute("aria-controls")).hidden = !elegida;
    }
    if (enfocar) boton.focus();
    pintarGrafo();
    try { localStorage.setItem("nelo.pestana", boton.id); } catch { /* sin almacenamiento */ }
  }
  PESTANAS.forEach((b, i) => {
    b.addEventListener("click", () => elegirPestana(b));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      elegirPestana(PESTANAS[(i + (e.key === "ArrowRight" ? 1 : PESTANAS.length - 1)) % PESTANAS.length], true);
    });
  });

  // --- Voz: grabar con el micrófono de este equipo y escuchar aquí la respuesta ---
  const EQUIPO = (() => {
    const nuevo = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      let id = sessionStorage.getItem("nelo-equipo");
      if (!id) { id = nuevo(); sessionStorage.setItem("nelo-equipo", id); }
      return id;
    } catch {
      return nuevo();
    }
  })();
  function contexto() {
    if (!s.ctx) s.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (s.ctx.state === "suspended") s.ctx.resume();
    return s.ctx;
  }
  function medir(fuente) {  // el reactor se mueve con la voz que se está grabando o reproduciendo
    const analizador = contexto().createAnalyser();
    analizador.fftSize = 512;
    fuente.connect(analizador);
    const datos = new Float32Array(analizador.fftSize);
    const paso = () => {
      if (!s.hablando && !s.reproduciendo) { s.nivel = 0; return; }
      analizador.getFloatTimeDomainData(datos);
      let suma = 0;
      for (const v of datos) suma += v * v;
      s.nivel = Math.min(1, Math.sqrt(suma / datos.length) * 5);
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    return analizador;
  }
  // El micrófono tarda en abrirse (a veces más de medio segundo): si se graba desde que se abre, se pierde el
  // principio de lo que se dice y Whisper entiende otra cosa. Por eso el botón dice "Abriendo micrófono…" hasta
  // que de verdad graba, el micrófono queda abierto un rato después de soltar (la siguiente pregunta empieza al
  // instante) y al soltar se graba un poco más para no cortar la última palabra.
  const MIC_ABIERTO_MS = 90000, COLA_MS = 400;
  // Si el navegador sabe reconocer voz (Chrome, Edge, Safari) y tiene internet, también reconoce lo que se dice:
  // se ve en vivo mientras se habla y se envía junto con el audio (en español es más exacto que Whisper). Sin
  // internet, o si se habla en inglés (lo detecta la laptop), se usa Whisper con el audio.
  const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition;
  function empezarReconocimiento() {
    s.textoNavegador = "";
    s.reconocedor = null;
    s.finReconocimiento = null;
    if (!Reconocedor || navigator.onLine === false) return;
    try {
      const r = new Reconocedor();
      r.lang = "es-PE";
      r.continuous = true;
      r.interimResults = true;
      let finales = "";
      r.onresult = (ev) => {
        let provisional = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) finales += ev.results[i][0].transcript + " ";
          else provisional += ev.results[i][0].transcript;
        }
        s.textoNavegador = finales.trim();
        const vista = (finales + provisional).trim();
        if (vista) { subtitulo("jvDijoUsuario", vista); $("jvDijoJarvis").hidden = true; }
      };
      r.onerror = () => {};   // sin red, sin permiso…: se usa Whisper
      s.finReconocimiento = new Promise((listo) => { r.onend = listo; });
      s.reconocedor = r;
      r.start();
    } catch {
      s.reconocedor = null;
    }
  }
  async function empezarHablar(e) {
    e?.preventDefault();
    if (s.hablando || $("jvHablar").disabled) return;
    if (!MIC_DISPONIBLE) { location.href = urlSegura(); return; }
    detenerReproduccion();
    clearTimeout(s.tCerrarMic);
    s.hablando = true;
    s.grabando = false;
    pintar();
    if (!s.flujo?.active) {
      try {
        contexto();
        s.flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        s.hablando = false;
        pintar();
        aviso("No se pudo usar el micrófono: permite el acceso en el candado de la barra de direcciones.", 8);
        return;
      }
    }
    if (!s.hablando) { cerrarMicrofonoLuego(); return; }   // se soltó antes de que el micrófono abriera
    medir(contexto().createMediaStreamSource(s.flujo));
    const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    s.trozos = [];
    s.grabadora = new MediaRecorder(s.flujo, tipo ? { mimeType: tipo } : undefined);
    s.grabadora.ondataavailable = (ev) => { if (ev.data.size) s.trozos.push(ev.data); };
    s.grabadora.onstop = enviarGrabacion;
    s.grabadora.onstart = () => { s.grabando = true; s.inicioGrabacion = Date.now(); pintar(); empezarReconocimiento(); };
    s.inicioGrabacion = Date.now();
    s.grabadora.start();
  }
  function terminarHablar() {
    if (!s.hablando) return;
    s.hablando = false;
    s.grabando = false;
    pintar();
    const grabadora = s.grabadora;
    if (grabadora?.state === "recording") {
      setTimeout(() => {
        if (grabadora.state === "recording") grabadora.stop();
        try { s.reconocedor?.stop(); } catch { /* ya terminó */ }
      }, COLA_MS);
    }
    else cerrarMicrofonoLuego();
  }
  function cerrarMicrofonoLuego() {
    clearTimeout(s.tCerrarMic);
    s.tCerrarMic = setTimeout(soltarMicrofono, MIC_ABIERTO_MS);
  }
  function soltarMicrofono() {
    if (s.hablando) return;
    s.flujo?.getTracks().forEach((t) => t.stop());
    s.flujo = null;
  }
  async function enviarGrabacion() {
    cerrarMicrofonoLuego();
    const audio = new Blob(s.trozos, { type: s.grabadora?.mimeType || "audio/webm" });
    if (Date.now() - s.inicioGrabacion < 500 || audio.size < 1500) {
      aviso("Fue muy corto: mantén pulsado mientras hablas.");
      return;
    }
    aviso("Enviando tu voz a NELO…", 4);
    // espera (como mucho 1,5 s) a que el navegador termine de reconocer lo último que se dijo
    if (s.finReconocimiento) await Promise.race([s.finReconocimiento, new Promise((listo) => setTimeout(listo, 1500))]);
    const texto = (s.textoNavegador || "").slice(0, 500);
    try {
      const r = await fetch(`/jarvis/voz?equipo=${EQUIPO}${texto ? "&texto=" + encodeURIComponent(texto) : ""}`, {
        method: "POST", headers: { "Content-Type": audio.type, "X-Nelobot": "1" }, body: audio,
      });
      const d = await r.json();
      if (!d.ok) aviso(d.error || "No se pudo enviar la grabación.");
    } catch {
      aviso("No se pudo enviar la grabación.");
    }
    ciclo();
  }
  async function reproducir(id) {
    detenerReproduccion();
    const audio = new Audio(`/jarvis/audio?id=${encodeURIComponent(id)}`);
    s.reproduciendo = audio;
    try { medir(contexto().createMediaElementSource(audio)).connect(contexto().destination); } catch { /* sin medidor */ }
    audio.addEventListener("ended", () => { if (s.reproduciendo === audio) { s.reproduciendo = null; pintar(); } });
    pintar();
    try {
      await audio.play();
    } catch {
      s.reproduciendo = null;
      pintar();
      aviso("Toca la página para poder escuchar a NELO.");
    }
  }
  function detenerReproduccion() {
    if (!s.reproduciendo) return;
    s.reproduciendo.pause();
    s.reproduciendo = null;
    pintar();
  }

  // --- Ciclo: estado y lo que dice y hace NELO ---
  function aplicarEstado(r) {
    s.apagado = !!r.apagado || r.ok === false;
    s.sinServidor = !!r.sinServidor;
    s.arrancando = !!r.arrancando;
    if (!s.apagado) {
      s.local = !!r.visor_local;
      s.puedeOrdenar = !!r.puede_ordenar;
      s.puertoHttps = r.puerto_https || null;
      s.estado = r.estado || s.estado;
      s.detalle = r.detalle ?? s.detalle;
      if (r.voz) $("jvVoz").textContent = r.voz;
      if (typeof r.internet === "boolean") {
        $("jvInternet").textContent = r.internet ? "sí" : "no";
        $("jvInternetChip").title = r.internet ? "NELO puede buscar en internet y usar la voz de Edge"
          : "La laptop solo está en la red del robot: conéctale internet a la vez (celular por USB) para buscar y para la voz de Edge";
      }
      if (r.personaje !== undefined) {
        $("jvPersonaje").textContent = r.personaje || "NELO";
        $("jvPersonaje").title = r.personaje ? "Di “vuelve a ser NELO” para quitarlo" : "";
      }
      if (r.modelo) $("jvModelo").textContent = r.modelo;
    }
    pintar();
  }
  async function ciclo() {
    clearTimeout(s.tCiclo);
    if (s.apagado !== false) aplicarEstado(await pedir("estado"));
    if (!s.apagado) {
      const r = await pedir(`eventos?desde=${s.ultimo}&sesion=${encodeURIComponent(s.sesion)}`);
      if (r.ok) {
        const primeraVez = !!r.reinicio;
        if (r.reinicio) {
          s.acciones.clear(); $("jvAcciones").innerHTML = ""; s.corriendo.clear();
          ag.orden = null; ag.pasos.clear(); ag.foco.clear(); ag.verAgente = true; vaciarActividad();
        }
        if (Date.now() - (s.tEstado || 0) > 20000) {   // voz, personaje e internet pueden cambiar en cualquier momento
          s.tEstado = Date.now();
          pedir("estado").then((e) => { if (e.ok) aplicarEstado(e); });
        }
        if (Date.now() - s.tAgentes > 15000) {
          const carga = cargarAgentes();
          if (!s.agentes.length) await carga;   // la primera vez, para que las acciones salgan con el nombre de su agente
        }
        s.sesion = r.sesion;
        s.ultimo = r.ultimo;
        s.estado = r.estado || s.estado;
        s.detalle = r.detalle ?? s.detalle;
        procesar(r.eventos || [], primeraVez);
        pintar();
      } else {
        aplicarEstado(r);
      }
    }
    s.tCiclo = setTimeout(ciclo, s.apagado ? (s.arrancando ? 2000 : 5000) : s.visible ? 700 : 4000);
  }

  // --- Controles ---
  for (const hablar of BOTONES_HABLAR) {
    hablar.addEventListener("pointerdown", empezarHablar);
    for (const tipo of ["pointerup", "pointerleave", "pointercancel"]) hablar.addEventListener(tipo, terminarHablar);
    hablar.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) empezarHablar(e); });
    hablar.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") terminarHablar(); });
    hablar.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  $("jvSilenciar").addEventListener("click", () => {
    if (s.reproduciendo) detenerReproduccion();
    else pedir("silenciar", {});
  });
  // Escribirle a NELO: lo mismo que hablarle (responde en los subtítulos y con su voz en este equipo)
  for (const id of ["jvEscribir", "jvAgEscribir"]) {
    const formulario = $(id), caja = $(id + "Texto");
    // lo que se escribe aquí no dispara los atajos de la página (la tecla F abre la presentación de la feria)
    caja.addEventListener("keydown", (e) => e.stopPropagation());
    formulario.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = caja.value.trim();
      if (!texto || caja.disabled) return;
      contexto();   // un gesto del usuario: permite reproducir la respuesta hablada después
      caja.value = "";
      subtitulo("jvDijoUsuario", texto);
      $("jvDijoJarvis").hidden = true;
      const r = await pedir("orden", { texto, equipo: EQUIPO });
      if (!r.ok) { aviso(r.error || "No se pudo enviar."); caja.value = texto; }
      ciclo();
      caja.focus();
    });
  }

  for (const frase of FRASES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "jv-frase";
    b.textContent = `“${frase}”`;
    b.title = "Preguntarle esto a NELO";
    b.disabled = true;
    b.addEventListener("click", async () => {
      contexto();   // un toque del usuario: permite reproducir la respuesta después
      const r = await pedir("orden", { texto: frase, equipo: EQUIPO });
      if (!r.ok) aviso(r.error || "No se pudo enviar.");
      ciclo();
    });
    $("jvFrases").append(b);
  }

  // Más rápido mientras la sección está a la vista
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting;
      if (s.visible) ciclo();
    }, { threshold: 0.15 }).observe(sec);
  } else {
    s.visible = true;
  }
  (() => {
    let id = "";
    try { id = localStorage.getItem("nelo.pestana") || ""; } catch { /* sin almacenamiento */ }
    if (location.hash === "#nelo-agentes") {
      id = "jvPestanaAgentes";
      requestAnimationFrame(() => sec.scrollIntoView());
    }
    if (id === "jvPestanaAgentes") elegirPestana($(id));
  })();
  pintar();
  ciclo();
  requestAnimationFrame(animar);
})();
