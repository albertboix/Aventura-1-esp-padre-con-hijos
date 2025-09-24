# Flujo de Comunicación entre Componentes

## Comunicación hijo5-casa → padre

El flujo de comunicación cuando un usuario selecciona una parada o tramo en el modo casa es el siguiente:

1. **Evento de usuario en hijo5-casa**:
   - El usuario hace clic en una parada o tramo en el componente hijo5-casa
   - hijo5-casa identifica qué parada o tramo se ha seleccionado

2. **Envío de mensaje desde hijo5-casa al padre**:
   ```javascript
   // Ejemplo de código en hijo5-casa
   enviarMensaje('padre', TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA, {
     punto: {
       parada_id: 'P-1', // o tramo_id: 'TR-1'
       tipo: 'parada' // o 'tramo'
     },
     origen: 'hijo5-casa',
     timestamp: Date.now()
   });
   ```

3. **Recepción y procesamiento por parte del padre**:
   - El padre recibe el mensaje a través de la función `manejarSeleccionPuntoCasa`
   - Busca la información completa de la parada/tramo en su base de datos (`buscarParada`)
   - Coordina con los demás componentes:
     - Actualiza la posición del mapa
     - Reproduce el audio correspondiente
     - Muestra el reto/puzzle si existe
     - Muestra medios (imágenes/videos) si existen

## Orquestación completa del padre

El padre actúa como orquestador central, coordinando todos los componentes:

1. **Con el mapa**:
   ```javascript
   enviarMensaje('mapa', TIPOS_MENSAJE.NAVEGACION.ESTABLECER_DESTINO, {
     punto: puntoNormalizado
   });
   ```

2. **Con el componente de audio**:
   ```javascript
   reproducirAudio(audioId, puntoNormalizado.tipo);
   ```

3. **Con el componente de retos**:
   ```javascript
   if (retoId) {
     manejarMostrarReto({ datos: { retoId } });
   } else {
     manejarOcultarReto();
   }
   ```

4. **Obtención y muestra de medios**:
   ```javascript
   const medios = await obtenerMediosParaPunto(puntoNormalizado);
   if (medios) {
     mostrarMedios(medios);
   }
   ```

## Solución de problemas

Si la comunicación entre hijo5-casa y el padre falla:

1. Verifica que el sistema de mensajería esté inicializado
2. Asegúrate de que los eventos de clic en hijo5-casa envíen correctamente los mensajes
3. Comprueba que el padre tenga registrado el controlador para `NAVEGACION.CAMBIO_PARADA`
4. Verifica que las funciones `manejarSeleccionPuntoCasa`, `buscarParada` y otras funciones relacionadas estén funcionando correctamente
5. Examina la consola para errores específicos

## Funciones de diagnóstico

Para diagnosticar problemas, puedes usar:

```javascript
// Para diagnosticar la comunicación con hijo5-casa
diagnosticarComunicacionCasa(true);

// Para probar la orquestación con una parada específica
probarOrquestacionParada('P-1');
```
