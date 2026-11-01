// Receptor: corre dentro del overlay (en la PC del live). Recibe por WebRTC
// las ventanas que comparte el emisor y las dibuja en los recuadros,
// aplicando recorte y quitando el fondo de color del VTuber.
window.VexlowReceptor = (function () {
  "use strict";

  var C = window.VexlowConexion;
  var params = new URLSearchParams(location.search);
  var conSonido = params.get("sonido") !== "no";

  var pc = null;
  var emisor = null;
  var ajustes = {};                         // recorte y chroma por lugar (los manda el emisor)
  var lugares = {};                         // slot -> { lienzo, ctx, video, caja }
  var audios = {};                          // slot -> <audio>

  document.querySelectorAll("[data-lienzo]").forEach(function (lienzo) {
    var video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    lugares[lienzo.dataset.lienzo] = {
      lienzo: lienzo,
      ctx: lienzo.getContext("2d", { willReadFrequently: lienzo.dataset.lienzo === "vtuber" }),
      video: video,
      caja: lienzo.closest(".caja"),
    };
  });

  function pedirImagen() {
    C.senal("emisor", "hola");
  }

  function recibirOferta(m) {
    if (pc) pc.close();
    emisor = m.de;
    pc = new RTCPeerConnection({ iceServers: [] });
    var slots = m.datos.slots || {};
    limpiar();

    pc.ontrack = function (e) {
      var s = e.streams[0];
      var slot = s && slots[s.id];
      if (!slot) return;
      if (e.track.kind === "video" && lugares[slot]) {
        lugares[slot].video.srcObject = s;
        lugares[slot].video.play().catch(function () {});
        lugares[slot].caja.classList.add("con-video");
      } else if (e.track.kind === "audio") {
        var a = audios[slot] || (audios[slot] = new Audio());
        a.srcObject = s;
        a.muted = !conSonido;
        reproducir(a);
      }
    };
    pc.onicecandidate = function (e) { if (e.candidate) C.senal(emisor, "ice", e.candidate.toJSON()); };
    pc.onconnectionstatechange = function () {
      if (pc && pc.connectionState === "failed") { limpiar(); setTimeout(pedirImagen, 2000); }
    };

    var este = pc;
    pc.setRemoteDescription(m.datos.sdp)
      .then(function () { return este.createAnswer(); })
      .then(function (r) { return este.setLocalDescription(r); })
      .then(function () { C.senal(emisor, "respuesta", este.localDescription.toJSON()); })
      .catch(function () {});
  }

  // El navegador puede bloquear el sonido hasta que alguien toque la página.
  // En ese caso mostramos un botón; con un clic en cualquier lado se destraba.
  var botonSonido = document.getElementById("activar-sonido");
  function reproducir(a) {
    a.play().then(function () { botonSonido.hidden = true; })
      .catch(function () { if (conSonido) botonSonido.hidden = false; });
  }
  function destrabar() {
    Object.keys(audios).forEach(function (slot) { reproducir(audios[slot]); });
  }
  document.addEventListener("pointerdown", destrabar);
  document.addEventListener("keydown", destrabar);

  function limpiar() {
    Object.keys(lugares).forEach(function (slot) {
      var l = lugares[slot];
      l.video.srcObject = null;
      l.caja.classList.remove("con-video");
      l.ctx.clearRect(0, 0, l.lienzo.width, l.lienzo.height);
    });
    Object.keys(audios).forEach(function (slot) { audios[slot].srcObject = null; });
  }

  C.alSenal(function (m) {
    if (m.tipo === "oferta") recibirOferta(m);
    else if (m.tipo === "ice" && pc && m.de === emisor) pc.addIceCandidate(m.datos).catch(function () {});
    else if (m.tipo === "reinicio") pedirImagen();
  });

  // ---------- Dibujo ----------
  function colorRGB(hex) {
    var n = parseInt((hex || "#00ff00").slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function dibujar(slot) {
    var l = lugares[slot];
    var v = l.video;
    if (!v.srcObject || v.readyState < 2 || !v.videoWidth) return;
    var a = ajustes[slot] || {};
    var rc = a.recorte || {};
    var vw = v.videoWidth, vh = v.videoHeight;
    var sx = vw * (rc.l || 0) / 100, sy = vh * (rc.t || 0) / 100;
    var sw = vw - sx - vw * (rc.r || 0) / 100, sh = vh - sy - vh * (rc.b || 0) / 100;
    if (sw < 2 || sh < 2) return;

    var cw = l.lienzo.width, ch = l.lienzo.height;
    var esc = Math.min(cw / sw, ch / sh);
    var dw = Math.round(sw * esc), dh = Math.round(sh * esc);
    var dx = Math.round((cw - dw) / 2);
    // El VTuber se apoya abajo; el juego va centrado
    var dy = slot === "vtuber" ? ch - dh : Math.round((ch - dh) / 2);

    l.ctx.clearRect(0, 0, cw, ch);
    l.ctx.drawImage(v, sx, sy, sw, sh, dx, dy, dw, dh);
    if (a.chroma) quitarFondo(l.ctx, dx, dy, dw, dh, colorRGB(a.color));
  }

  function quitarFondo(ctx, x, y, w, h, key) {
    var img = ctx.getImageData(x, y, w, h);
    var d = img.data;
    var kr = key[0], kg = key[1], kb = key[2];
    for (var i = 0; i < d.length; i += 4) {
      var dr = d[i] - kr, dg = d[i + 1] - kg, db = d[i + 2] - kb;
      var dist = dr * dr + dg * dg + db * db;
      if (dist < 9000) d[i + 3] = 0;                          // es fondo
      else if (dist < 20000) d[i + 3] = (dist - 9000) / 11000 * 255; // borde suave
    }
    ctx.putImageData(img, x, y);
  }

  // ?diag muestra arriba a la izquierda qué está llegando (para revisar en la PC 2)
  if (params.has("diag")) {
    var diag = document.createElement("pre");
    diag.className = "diag";
    document.getElementById("escenario").appendChild(diag);
    setInterval(function () {
      var lineas = ["Conexión con PC 1: " + (pc ? pc.connectionState : "sin emisor")];
      Object.keys(lugares).forEach(function (slot) {
        var v = lugares[slot].video;
        lineas.push("Imagen " + slot + ": " + (v.srcObject ? v.videoWidth + "x" + v.videoHeight : "no llega"));
      });
      ["sistema", "mic"].forEach(function (slot) {
        var a = audios[slot];
        lineas.push("Sonido " + slot + ": " + (!a || !a.srcObject ? "no llega" : a.muted ? "silenciado (?sonido=no)" : a.paused ? "BLOQUEADO (tocá la página)" : "sonando"));
      });
      diag.textContent = lineas.join("\n");
    }, 500);
  }

  var activo = false;
  function bucle() {
    if (activo) Object.keys(lugares).forEach(dibujar);
    requestAnimationFrame(bucle);
  }
  requestAnimationFrame(bucle);

  return {
    pedirImagen: pedirImagen,
    // Solo dibujamos cuando la escena de juego está en pantalla
    activar: function (si) { activo = si; },
    ajustes: function (f) { if (f) ajustes = f; },
  };
})();
