// Conexión con server.js: recibe el estado en tiempo real y lo envía.
// Si la página se sirve sin server.js (por ejemplo en Vercel), no hace nada.
window.VexlowConexion = (function () {
  "use strict";

  var desfase = 0; // diferencia entre el reloj del servidor y el de este equipo

  function ahora() { return Date.now() + desfase; }

  function escuchar(alRecibir, alCambiarConexion) {
    fetch("api/estado", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function () {
        var es = new EventSource("api/eventos");
        es.onopen = function () { alCambiarConexion(true); };
        es.onerror = function () { alCambiarConexion(false); };
        es.onmessage = function (e) {
          var m = JSON.parse(e.data);
          desfase = m.ahora - Date.now();
          alRecibir(m.estado);
        };
      })
      .catch(function () { alCambiarConexion(null); });
  }

  function enviar(estado) {
    return fetch("api/estado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(estado),
    });
  }

  return { escuchar: escuchar, enviar: enviar, ahora: ahora };
})();
