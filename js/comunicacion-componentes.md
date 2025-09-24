# Comunicación entre componentes

## Patrón Async/Await para envío de mensajes

Cuando utilizamos el sistema de mensajería entre componentes, debemos seguir estas pautas:

1. Toda función que use `await` debe declararse como `async`
2. El patrón correcto para funciones de evento es:

   ```javascript
   // ❌ INCORRECTO - No se puede usar await en función no async
   button.addEventListener('click', () => {
       await enviarMensaje('padre', TIPO_MENSAJE, datos);
   });

   // ✅ CORRECTO - Función anónima declarada como async
   button.addEventListener('click', async () => {
       await enviarMensaje('padre', TIPO_MENSAJE, datos);
   });
   ```

3. Lo mismo aplica para funciones nombradas:

   ```javascript
   // ❌ INCORRECTO
   function enviarDatos() {
       await enviarMensaje('padre', TIPO_MENSAJE, datos);
   }

   // ✅ CORRECTO
   async function enviarDatos() {
       await enviarMensaje('padre', TIPO_MENSAJE, datos);
   }
   ```

## Flujo de comunicación entre componentes

### Inicialización
1. Cada componente hijo inicia con `inicializarMensajeria()`
2. El componente notifica que está listo con `SISTEMA.COMPONENTE_LISTO`
3. El padre recibe la notificación y actualiza su registro de componentes

### Cambio de modo
1. Un componente solicita cambio de modo con `SISTEMA.CAMBIO_MODO`
2. El padre procesa la solicitud y notifica a todos los hijos
3. Cada hijo actualiza su interfaz según el nuevo modo

### Navegación entre paradas
1. El usuario selecciona una parada/tramo en hijo5-casa
2. Se envía mensaje `NAVEGACION.CAMBIO_PARADA` al padre
3. El padre orquesta todos los componentes:
   - Actualiza mapa (posición)
   - Actualiza componente de coordenadas (botones)
   - Reproduce audio relevante
   - Muestra retos si corresponde

### Retos y preguntas
1. El padre envía mensaje `RETO.MOSTRAR` al hijo4
2. hijo4 muestra la interfaz de reto
3. Al completar, envía `RETO.COMPLETADO` al padre
4. El padre registra el progreso y coordina el avance
