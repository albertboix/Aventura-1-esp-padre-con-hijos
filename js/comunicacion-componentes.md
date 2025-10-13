# Comunicación entre componentes

## Cambios recientes

- **Centralización de la lógica del mapa:** Toda la lógica de inicialización y verificación del contenedor del mapa se ha centralizado en `funciones-mapa.js`.
- **Centralización de confirmaciones (ACK/NACK):** Toda la lógica de confirmaciones se ha centralizado en `mensajeria.js`.

## Nuevos flujos

- **Validación de mensajes:** Antes de procesar cualquier mensaje, se valida su estructura y contenido.
- **Notificación de errores:** Todos los errores críticos son registrados y notificados al sistema de monitoreo.
- **Confirmaciones (ACK/NACK):** Los mensajes enviados incluyen un identificador único (`mensajeId`). El receptor responde con un ACK o NACK, que es manejado automáticamente en `mensajeria.js`.

---

Este documento describe el flujo de mensajes y la arquitectura de comunicación entre los distintos componentes (padre e iframes hijos) de la aplicación Valencia VGuides.

---

## 1. Principios generales

- **Mensajería centralizada:** Todos los mensajes entre componentes se envían usando el sistema de mensajería basado en `window.postMessage` y los tipos definidos en `TIPOS_MENSAJE`.
- **Async/Await:** Toda función que use `await` debe ser `async`. Los manejadores de eventos y mensajes suelen ser funciones asíncronas.
- **Identificación:** Cada iframe hijo tiene un `iframeId` único y el padre usa `padre` como identificador.
- **Estado sincronizado:** El padre mantiene el estado global y orquesta la actualización de los hijos.

---

## 2. Listado detallado de flujos de comunicación

### 2.1 Inicialización de componentes
- **Emisor:** Cada hijo (por ejemplo, `hijo5-casa`, `hijo3`, etc.).
- **Mensaje enviado:** `SISTEMA.COMPONENTE_LISTO`.
- **Receptor:** Padre (`app.js`).
- **Flujo:**
  1. El hijo llama a `enviarMensaje` desde `mensajeria.js` con el tipo `SISTEMA.COMPONENTE_LISTO`.
  2. El mensaje es recibido por el padre, que registra al hijo como inicializado en `estado.hijosInicializados`.
  3. El padre puede responder con `SISTEMA.ESTADO` para sincronizar el estado global.

---

### 2.2 Sincronización del estado global
- **Emisor:** Padre (`app.js`).
- **Mensaje enviado:** `SISTEMA.ESTADO`.
- **Receptor:** Todos los hijos inicializados.
- **Flujo:**
  1. El padre llama a `enviarEstadoGlobal` en `app.js`, que utiliza `enviarMensaje` para enviar el estado global a cada hijo en `estado.hijosInicializados`.
  2. Cada hijo recibe el mensaje y actualiza su estado local en `mensajeria.js`.

---

### 2.3 Cambio de modo (Casa/Aventura)
- **Emisor:** Un hijo (normalmente `hijo5-casa`).
- **Mensaje enviado:** `SISTEMA.CAMBIO_MODO`.
- **Receptor:** Padre (`app.js`).
- **Flujo:**
  1. El hijo llama a `enviarMensaje` desde `mensajeria.js` con el tipo `SISTEMA.CAMBIO_MODO`.
  2. El padre recibe el mensaje, actualiza su estado global (`estado.modo`) y llama a `enviarEstadoGlobal` para notificar a todos los hijos del cambio de modo.

---

### 2.4 Cambio de parada o tramo
- **Emisor:** `hijo5-casa`.
- **Mensaje enviado:** `NAVEGACION.CAMBIO_PARADA`.
- **Receptor:** Padre (`app.js`).
- **Flujo:**
  1. El hijo llama a `enviarMensaje` desde `mensajeria.js` con el tipo `NAVEGACION.CAMBIO_PARADA` y los datos del punto (parada o tramo).
  2. El padre recibe el mensaje y:
     - Actualiza el mapa (`hijo1`) con `NAVEGACION.ESTABLECER_DESTINO`.
     - Actualiza las coordenadas (`hijo2`) with `NAVEGACION.ACTUALIZAR_POSICION`.
     - Reproduce el audio correspondiente (`hijo3`) con `AUDIO.REPRODUCIR`.
     - Muestra el reto asociado (`hijo4`) with `RETO.MOSTRAR`.

---

### 2.5 Reproducción de audio
- **Emisor:** Padre (`app.js`).
- **Mensaje enviado:** `AUDIO.REPRODUCIR`.
- **Receptor:** `hijo3`.
- **Flujo:**
  1. El padre llama a `enviarMensaje` desde `mensajeria.js` con el tipo `AUDIO.REPRODUCIR` y los datos del audio.
  2. `hijo3` recibe el mensaje y reproduce el audio correspondiente.

---

### 2.6 Mostrar reto
- **Emisor:** Padre (`app.js`).
- **Mensaje enviado:** `RETO.MOSTRAR`.
- **Receptor:** `hijo4`.
- **Flujo:**
  1. El padre llama a `enviarMensaje` desde `mensajeria.js` con el tipo `RETO.MOSTRAR` y los datos del reto.
  2. `hijo4` recibe el mensaje y muestra la interfaz del reto.

---

### 2.7 Solicitud de datos de paradas
- **Emisor:** Un hijo (por ejemplo, `hijo2`).
- **Mensaje enviado:** `DATOS.SOLICITAR_PARADAS`.
- **Receptor:** Padre (`app.js`).
- **Flujo:**
  1. El hijo llama a `enviarMensaje` desde `mensajeria.js` with el tipo `DATOS.SOLICITAR_PARADAS`.
  2. El padre recibe el mensaje, obtiene los datos de las paradas y responde con `DATOS.RESPUESTA_PARADAS`.

---

### 2.8 Confirmaciones (ACK)
- **Emisor:** Cualquier hijo o el padre.
- **Mensaje enviado:** `SISTEMA.ACK`.
- **Receptor:** El origen del mensaje inicial.
- **Flujo:**
  1. Al recibir un mensaje, el receptor llama a `enviarMensaje` desde `mensajeria.js` con el tipo `SISTEMA.ACK` y el `mensajeId` del mensaje original.
  2. El emisor original recibe el `ACK` y resuelve la promesa asociada a los mensajes pendientes.

---

### 2.9 Errores no capturados
- **Emisor:** Navegador (eventos `error` y `unhandledrejection`).
- **Mensaje enviado:** `SISTEMA.ERROR`.
- **Receptor:** Padre (`app.js`).
- **Flujo:**
  1. Los eventos `error` y `unhandledrejection` son capturados en `app.js`.
  2. Se llama a `notificarError` para enviar un mensaje `SISTEMA.ERROR` al padre con los detalles del error.

---

### 2.10 Diagnóstico del mapa
- **Emisor:** Padre (`app.js`).
- **Mensaje enviado:** `NAVEGACION.SOLICITAR_ESTADO_MAPA`.
- **Receptor:** `hijo1`.
- **Flujo:**
  1. El padre llama a `enviarMensaje` desde `mensajeria.js` con el tipo `NAVEGACION.SOLICITAR_ESTADO_MAPA`.
  2. `hijo1` recibe el mensaje, realiza el diagnóstico y responde con `NAVEGACION.ESTADO_MAPA`.

---

### 2.11 Eventos personalizados
- **Emisor:** Cualquier componente.
- **Mensaje enviado:** `UI.NOTIFICACION` (u otro tipo definido en `TIPOS_MENSAJE`).
- **Receptor:** Cualquier componente interesado.
- **Flujo:**
  1. El emisor llama a `enviarMensaje` desde `mensajeria.js` con el tipo de evento y los datos.
  2. Los receptores registrados para ese tipo de mensaje procesan el evento.

---

## Eliminación de `fix-mapas-duplicados.js`

- La lógica de inicialización y corrección de mapas duplicados ha sido centralizada en `funciones-mapa.js`.
- El archivo `fix-mapas-duplicados.js` ha sido eliminado para evitar duplicación de lógica.

---

## 3. Resumen de tipos de mensajes principales

- `SISTEMA.COMPONENTE_LISTO`: Un hijo notifica que está listo.
- `SISTEMA.CAMBIO_MODO`: Solicitud o notificación de cambio de modo.
- `SISTEMA.ESTADO`: Estado global enviado por el padre.
- `NAVEGACION.CAMBIO_PARADA`: Cambio de parada/tramo.
- `DATOS.SOLICITAR_PARADAS` / `DATOS.RESPUESTA_PARADAS`: Solicitud/respuesta de lista de paradas.
- `DATOS.SOLICITAR_PARADA` / `DATOS.RESPUESTA_PARADA`: Solicitud/respuesta de datos de una parada/tramo.
- `AUDIO.REPRODUCIR`: Reproducir audio en hijo3.
- `RETO.MOSTRAR` / `RETO.COMPLETADO`: Mostrar/completar reto en hijo4.

---

Este listado actualizado asegura que todos los flujos de comunicación están documentados y centralizados.
