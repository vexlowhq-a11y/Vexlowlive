# Vexlow Live

Overlay para los lives de TikTok: logo, juegos, cuenta regresiva y mensajes.
Es una página web estática (HTML + CSS + JS, sin instalar nada) en formato vertical **1080×1920**.

> Proyecto **separado** de vexlowhq.com: otro repo, otro dominio y marcado como `noindex`
> (no aparece en Google y no afecta a la web principal ni a su monetización).

## Escenas

| Tecla | Escena  | Para qué |
|-------|---------|----------|
| `1`   | Inicio  | Logo + "Empezamos en" con cuenta regresiva |
| `2`   | Juego   | Marco con barra "EN VIVO", tarjeta del juego y cinta. El centro queda libre para el juego |
| `3`   | Pausa   | "Ya volvemos..." |
| `4`   | Cierre  | "¡Gracias por ver!" + vitrina de juegos |

Otros atajos: `←` `→` cambiar juego · `R` reiniciar cuenta · `+` `-` sumar/restar 1 minuto ·
`T` mostrar/ocultar cinta · `H` ayuda (no la dejes abierta en vivo).

La página recuerda la última escena, así que si se recarga no se pierde.

## Editar textos y juegos

Todo está en **`config.js`**: nombre, usuario de TikTok, minutos de la cuenta, lista de juegos
y mensajes de la cinta. Para agregar un juego, poné su ícono en `img/` y sumá una entrada a `juegos`.

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

## Uso con dos PCs

- **PC 1:** corre `iniciar-live.bat` y la deja prendida durante el live.
- **PC 2 (la del live):** usa el link del *Overlay*.
- **Celular** (en el mismo Wi-Fi): abre el link del *Panel*.

**En la PC 2:**

- **OBS:** Fuente → Navegador → URL del overlay, ancho 1080, alto 1920.
  El fondo queda transparente; poné la captura del juego *debajo* del overlay.
- **TikTok LIVE Studio u otro programa sin fondo transparente:** abrir el overlay con
  `?fondo=verde`, capturarlo y aplicarle filtro de chroma key verde.

**Publicado en Vercel** (proyecto aparte, sin build) el overlay funciona con teclas,
pero el panel de control necesita `server.js`, que Vercel no corre.
