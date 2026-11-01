// Emisor: corre en la PC del juego. Comparte ventanas y sonido con los
// overlays (PC 2) por WebRTC, dentro de la red de casa. No compone nada:
// el armado del live lo hace el overlay en la otra PC, para no cargar esta.
(function () {
  "use strict";

  var C = window.VexlowConexion;
  var SLOTS = ["juego", "vtuber"];
  var BITRATE = { juego: 3500000, vtuber: 1200000, sistema: 128000, mic: 64000 };

  var streams = {};        // slot -> MediaStream (juego, vtuber, sistema, mic)
  var conexiones = {};     // id del overlay -> RTCPeerConnection
  var fuentes = {};        // ajustes que lee el overlay (recorte, chroma)
  var estadoEl = document.getElementById("estado-conexion");
  var receptoresEl = document.getElementById("receptores");
  var calidadEl = document.getElementById("calidad");

  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    document.getElementById("aviso-localhost").hidden = false;
  }

  try { calidadEl.value = localStorage.getItem("vexlow-emisor-calidad") || "720"; } catch (e) {}

  // ---------- Captura ----------
  function medidas() {
    var alto = +calidadEl.value;
    return { height: { max: alto }, width: { max: Math.round(alto * 16 / 9) }, frameRate: { max: 30 } };
  }

  function elegirVentana(slot) {
    var v = medidas();
    v.displaySurface = "window";
    // Con el juego pedimos también el sonido: en el selector hay que encender
    // «Compartir con audio del sistema». Si no se enciende, va solo la imagen.
    navigator.mediaDevices.getDisplayMedia({
      video: v,
      audio: slot === "juego" ? { suppressLocalAudioPlayback: false } : false,
      systemAudio: slot === "juego" ? "include" : "exclude",
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
    }).then(function (s) {
      if (slot === "juego") {
        mensajeError = s.getAudioTracks().length ? ""
          : "El juego se ve pero no se oye: volvé a «Elegir ventana» y encendé «Compartir con audio del sistema».";
      }
      var pista = s.getVideoTracks()[0];
      pista.contentHint = slot === "juego" ? "motion" : "detail";
      pista.addEventListener("ended", function () { quitar(slot); });
      ponerStream(slot, s);
    }).catch(function () {});
  }

  function elegirAudio(tipo) {
    var pedido = tipo === "mic"
      ? navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } })
      : navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor", frameRate: { max: 1 }, width: { max: 64 } },
        audio: { suppressLocalAudioPlayback: false },
        systemAudio: "include",
        monitorTypeSurfaces: "include",
      });
    pedido.then(function (s) {
      var audio = s.getAudioTracks();
      if (!audio.length) {
        s.getTracks().forEach(function (t) { t.stop(); });
        errorAudio("No llegó sonido: elegí la pestaña «Pantalla completa», tocá tu pantalla y activá «Compartir también el audio del sistema».");
        return;
      }
      // Del "Sonido del juego" solo mandamos el audio. La imagen NO se corta
      // (en Chrome eso corta también el sonido): queda pausada y diminuta.
      var captura = s;
      captura.getVideoTracks().forEach(function (t) { t.enabled = false; });
      var soloAudio = new MediaStream(audio);
      soloAudio.captura = captura;
      audio[0].addEventListener("ended", function () { quitar(tipo); });
      ponerStream(tipo, soloAudio);
    }).catch(function (e) {
      if (e && e.name !== "NotAllowedError") errorAudio("No se pudo tomar el sonido (" + e.name + ").");
    });
  }

  function detener(s) {
    s.getTracks().forEach(function (t) { t.stop(); });
    if (s.captura) s.captura.getTracks().forEach(function (t) { t.stop(); });
  }

  function ponerStream(slot, s) {
    if (streams[slot]) detener(streams[slot]);
    streams[slot] = s;
    if (slot !== "juego") mensajeError = "";
    pintarFuentes();
    renegociarTodos();
  }

  function quitar(slot) {
    if (!streams[slot]) return;
    detener(streams[slot]);
    delete streams[slot];
    pintarFuentes();
    renegociarTodos();
  }

  // ---------- WebRTC ----------
  function crearConexion(id) {
    if (conexiones[id]) conexiones[id].close();
    var pc = new RTCPeerConnection({ iceServers: [] });
    conexiones[id] = pc;
    var slots = {};

    var senders = [];
    Object.keys(streams).forEach(function (slot) {
      var s = streams[slot];
      slots[s.id] = slot;
      s.getTracks().forEach(function (t) {
        senders.push({ sender: pc.addTrack(t, s), slot: slot, kind: t.kind });
      });
    });
    preferirH264(pc);

    pc.onicecandidate = function (e) { if (e.candidate) C.senal(id, "ice", e.candidate.toJSON()); };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") cerrar(id, pc);
      contarReceptores();
    };

    pc.createOffer()
      .then(function (o) { return pc.setLocalDescription(o); })
      .then(function () {
        C.senal(id, "oferta", { sdp: pc.localDescription.toJSON(), slots: slots });
        senders.forEach(limitarBitrate);
      })
      .catch(function () {});
    contarReceptores();
  }

  function limitarBitrate(x) {
    var p = x.sender.getParameters();
    if (!p.encodings || !p.encodings.length) return;
    p.encodings[0].maxBitrate = x.kind === "audio" ? BITRATE.sistema : BITRATE[x.slot];
    if (x.kind === "video") p.degradationPreference = x.slot === "juego" ? "maintain-framerate" : "balanced";
    x.sender.setParameters(p).catch(function () {});
  }

  // H.264 suele tener codificación por hardware: menos trabajo para esta PC
  function preferirH264(pc) {
    if (!window.RTCRtpSender || !RTCRtpSender.getCapabilities) return;
    var caps = RTCRtpSender.getCapabilities("video");
    if (!caps) return;
    var h264 = caps.codecs.filter(function (c) { return /h264/i.test(c.mimeType); });
    var resto = caps.codecs.filter(function (c) { return !/h264/i.test(c.mimeType); });
    pc.getTransceivers().forEach(function (tr) {
      if (tr.sender.track && tr.sender.track.kind === "video" && tr.setCodecPreferences) {
        try { tr.setCodecPreferences(h264.concat(resto)); } catch (e) {}
      }
    });
  }

  function cerrar(id, pc) {
    if (conexiones[id] !== pc) return;
    pc.close();
    delete conexiones[id];
    contarReceptores();
  }

  function renegociarTodos() {
    Object.keys(conexiones).forEach(crearConexion);
  }

  function contarReceptores() {
    var n = Object.keys(conexiones).filter(function (id) {
      var s = conexiones[id].connectionState;
      return s === "connected" || s === "connecting" || s === "new";
    }).length;
    receptoresEl.textContent = n;
  }

  C.alSenal(function (m) {
    if (m.tipo === "hola") crearConexion(m.de);
    else if (m.tipo === "respuesta" && conexiones[m.de]) conexiones[m.de].setRemoteDescription(m.datos).catch(function () {});
    else if (m.tipo === "ice" && conexiones[m.de]) conexiones[m.de].addIceCandidate(m.datos).catch(function () {});
    else if (m.tipo === "adios" && conexiones[m.de]) cerrar(m.de, conexiones[m.de]);
  });

  // ---------- Interfaz ----------
  function conAudio(s) { return !!(s && s.getAudioTracks().length); }

  function pintarFuentes() {
    document.querySelectorAll(".fuente").forEach(function (card) {
      var slot = card.dataset.slot;
      var video = card.querySelector("video");
      var s = streams[slot] || null;
      if (video.srcObject !== s) {
        video.srcObject = s;
        if (s) video.play().catch(function () {});
      }
      card.querySelector(".vista").classList.toggle("activa", !!s);
    });
    var partes = [];
    if (conAudio(streams.juego)) partes.push("sonido de la ventana del juego");
    if (streams.sistema) partes.push("sonido de la pantalla");
    if (streams.mic) partes.push("micrófono");
    avisoAudio(mensajeError || (partes.length ? "Enviando: " + partes.join(" + ") + "." : "Sin sonido."));
    document.querySelector('[data-audio="sistema"]').classList.toggle("activo", !!streams.sistema);
    document.querySelector('[data-audio="mic"]').classList.toggle("activo", !!streams.mic);
  }

  function avisoAudio(t) {
    var el = document.getElementById("estado-audio");
    el.textContent = t;
    el.classList.toggle("error", !!mensajeError);
  }

  // Los errores quedan a la vista hasta que el sonido se active bien
  var mensajeError = "";
  function errorAudio(t) {
    mensajeError = t;
    avisoAudio(t);
  }

  // Medidores de volumen: si la barra no se mueve, no está entrando sonido
  var ctxAudio = null;
  var analizadores = {};
  function medir() {
    ["sistema", "mic"].forEach(function (tipo) {
      var barra = document.querySelector('[data-medidor="' + tipo + '"]');
      var s = tipo === "sistema" && !streams.sistema && conAudio(streams.juego) ? streams.juego : streams[tipo];
      if (!s) { delete analizadores[tipo]; barra.style.width = "0"; return; }
      var an = analizadores[tipo];
      if (!an || an.stream !== s) {
        ctxAudio = ctxAudio || new AudioContext();
        var nodo = ctxAudio.createAnalyser();
        nodo.fftSize = 256;
        ctxAudio.createMediaStreamSource(s).connect(nodo);
        an = analizadores[tipo] = { stream: s, nodo: nodo, datos: new Uint8Array(nodo.fftSize) };
      }
      an.nodo.getByteTimeDomainData(an.datos);
      var pico = 0;
      for (var i = 0; i < an.datos.length; i++) pico = Math.max(pico, Math.abs(an.datos[i] - 128));
      barra.style.width = Math.min(100, pico / 128 * 250) + "%";
    });
  }
  setInterval(medir, 100);

  function leerAjustes() {
    document.querySelectorAll(".fuente").forEach(function (card) {
      var f = { recorte: {} };
      card.querySelectorAll("[data-recorte]").forEach(function (r) { f.recorte[r.dataset.recorte] = +r.value; });
      var chroma = card.querySelector("[data-chroma]");
      if (chroma) {
        f.chroma = chroma.checked;
        f.color = card.querySelector("[data-color]").value;
      }
      fuentes[card.dataset.slot] = f;
    });
    C.enviar({ fuentes: fuentes });
  }

  function cargarAjustes(f) {
    if (!f) return;
    document.querySelectorAll(".fuente").forEach(function (card) {
      var a = f[card.dataset.slot];
      if (!a) return;
      card.querySelectorAll("[data-recorte]").forEach(function (r) {
        if (a.recorte && a.recorte[r.dataset.recorte] != null) r.value = a.recorte[r.dataset.recorte];
      });
      var chroma = card.querySelector("[data-chroma]");
      if (chroma && a.chroma != null) {
        chroma.checked = a.chroma;
        card.querySelector("[data-color]").value = a.color || "#00ff00";
      }
    });
  }

  document.querySelectorAll(".fuente").forEach(function (card) {
    var slot = card.dataset.slot;
    card.querySelector('[data-accion="elegir"]').addEventListener("click", function () { elegirVentana(slot); });
    card.querySelector('[data-accion="quitar"]').addEventListener("click", function () { quitar(slot); });
    card.querySelectorAll("input").forEach(function (i) { i.addEventListener("input", leerAjustes); });
  });
  document.querySelectorAll("[data-audio]").forEach(function (b) {
    b.addEventListener("click", function () {
      var tipo = b.dataset.audio;
      if (streams[tipo]) quitar(tipo);
      else elegirAudio(tipo);
    });
  });
  calidadEl.addEventListener("change", function () {
    try { localStorage.setItem("vexlow-emisor-calidad", calidadEl.value); } catch (e) {}
    SLOTS.forEach(function (slot) {
      var s = streams[slot];
      if (s) s.getVideoTracks()[0].applyConstraints(medidas()).catch(function () {});
    });
  });

  // ---------- Arranque ----------
  var primera = true;
  C.escuchar(function (estado) {
    window.VexlowVolumen.pintar(estado && estado.volumen);
    if (!primera) return;
    primera = false;
    cargarAjustes(estado && estado.fuentes);
    leerAjustes();
  }, function (ok) {
    estadoEl.className = "estado " + (ok ? "ok" : "error");
    estadoEl.textContent = ok ? "Conectado" : ok === null ? "Abrí con iniciar-live.bat" : "Sin conexión";
    // Avisamos a los overlays ya abiertos que vuelvan a pedir la imagen
    if (ok) C.senal("receptores", "reinicio");
  }, "emisor");

  window.addEventListener("beforeunload", function (e) {
    if (Object.keys(streams).length) { e.preventDefault(); e.returnValue = ""; }
  });
})();
