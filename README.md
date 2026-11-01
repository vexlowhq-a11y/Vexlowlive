# Vexlow Live

Estudio web para los lives de TikTok, pensado para **dos PCs**:

- **PC 1 (la del juego, la vieja):** solo juega y comparte las ventanas (emulador, veadotube)
  y el sonido desde una pestaña del navegador. No corre TikTok LIVE Studio.
- **PC 2 (la del live):** TikTok LIVE Studio con **una sola fuente "Enlace"** que ya muestra todo
  armado: juego, VTuber, reto, muertes, meta de regalos y alertas.

Formato vertical **1080×1920**, fondo negro.

> Proyecto **separado** de vexlowhq.com: otro repo, otro dominio y marcado como `noindex`
> (no aparece en Google y no afecta a la web principal ni a su monetización).

## Escenas

| Tecla | Escena  | Para qué |
|-------|---------|----------|
| `1`   | Inicio  | Logo + "Empezamos en" con cuenta regresiva |
| `2`   | Juego   | Frase gancho, ventana del juego, VTuber, reto, muertes, meta de regalos y últimos regalos |
| `3`   | Pausa   | "Ya volvemos..." |
| `4`   | Cierre  | "¡Gracias por ver!" + vitrina de juegos |

Otros atajos: `←` `→` cambiar juego · `R` reiniciar cuenta · `+` `-` sumar/restar 1 minuto ·
`T` mostrar/ocultar cinta · `H` ayuda (no la dejes abierta en vivo).

La página recuerda la última escena, así que si se recarga no se pierde.

## Editar textos y juegos

Todo está en **`config.js`**: nombre, usuario de TikTok, minutos de la cuenta, lista de juegos,
mensajes de la cinta, frases gancho, reto y meta de regalos. Para agregar un juego, poné su ícono en `img/` y sumá una entrada a `juegos`.

## Opciones por URL

```
?escena=juego          escena inicial (inicio | juego | pausa | cierre)
?juego=aqua            juego inicial (busca por nombre)
?cuenta=10             reinicia la cuenta a 10 minutos
?fondo=transparente    fondo transparente (en OBS se pone solo)
?fondo=verde           fondo verde para usar filtro de chroma key
?cinta=no              arranca con la cinta oculta
?ayuda                 abre la ayuda
```

## Panel de control (desde el celular)

`control.html` maneja el overlay en tiempo real: escena, juego, cuenta regresiva,
cinta y **anuncios grandes** (texto que aparece 8 segundos en el live, con botones rápidos
que se editan en `anunciosRapidos` de `config.js`).

Para que funcione hay que abrir todo con el servidor incluido (necesita Node, sin instalar nada más):

```
node server.js
```

o doble clic en **`iniciar-live.bat`**. La consola muestra los links, por ejemplo:

```
Overlay:  http://192.168.1.69:4800/
Panel:    http://192.168.1.69:4800/control.html
```

Las teclas del overlay siguen funcionando y también se ven reflejadas en el panel.
Si alguna vez no conecta: permitir Node en el firewall de Windows para redes privadas.

## Uso con dos PCs (paso a paso)

**1. PC 1 (la del juego)**

1. Doble clic en `iniciar-live.bat` (dejá la ventana negra abierta).
2. En **Chrome o Edge** abrí `http://localhost:4800/emisor.html`
   (tiene que ser *localhost*: el navegador solo deja compartir ventanas así).
3. **Juego → Elegir ventana** → elegí la ventana del emulador.
4. **VTuber → Elegir ventana** → elegí veadotube. Poné en veadotube un fondo verde liso:
   el overlay lo borra ("Quitar fondo de color").
5. **Sonido del juego** → elegí *Pantalla completa* y marcá *Compartir audio del sistema*.
   (Opcional: **Micrófono**, si el micro está enchufado en esta PC.)
6. Si hay bordes de más (barra de título), usá *Recortar bordes*.
7. Si la PC se traba, bajá la calidad a 480p.

**2. PC 2 (la del live)**

- TikTok LIVE Studio → agregar fuente **Enlace** con `http://<IP-de-la-PC-1>:4800/`
  a pantalla completa (1080×1920). Esa sola fuente ya trae todo.
- Si en el live no se escucha el juego: agregá en LIVE Studio el audio del escritorio
  o abrí el mismo link en Chrome en la PC 2. Para no escucharlo doble: `?sonido=no`.
- **Regalos y seguidores reales:** abrí la app de escritorio de **TikFinity** en la PC 2.
  El overlay la detecta solo (`ws://localhost:21213`).

**3. Celular** (mismo Wi-Fi): `http://<IP-de-la-PC-1>:4800/control.html`
para cambiar escena, muertes, reto, título, frase gancho, meta de regalos y anuncios.

La zona de abajo (desde ~1550 px) queda libre a propósito: ahí TikTok muestra los comentarios.

### Cómo viaja la imagen

Las ventanas viajan de la PC 1 a la PC 2 por **WebRTC dentro de la red de casa** (no sale a
internet). `server.js` solo hace de intermediario para conectarlas y guardar el estado.
Conviene usar cable de red en al menos una de las dos PCs.

**Publicado en Vercel** (proyecto aparte, sin build) solo funcionan las escenas con teclado:
el panel, el emisor y los regalos necesitan `server.js`.
