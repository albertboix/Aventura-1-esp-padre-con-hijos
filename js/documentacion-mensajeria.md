# Sistema de Mensajería Valencia Tour - Documentación Centralizada

Esta documentación comprensiva reúne toda la información sobre el sistema de mensajería estandarizado desarrollado para la aplicación Valencia Tour.

**Versión:** 3.0.0  
**Fecha:** 14 de octubre de 2025  
**Estado:** Producción

## Contenido

1. [Sistema de Mensajería Estandarizado](#1-sistema-de-mensajería-estandarizado)
2. [Formato de Mensajes](#2-formato-de-mensajes)
3. [Sistema de Confirmación ACK/NACK](#3-sistema-de-confirmación-acknack)
4. [Tipos de Mensajes](#4-tipos-de-mensajes)
5. [Validación de Mensajes](#5-validación-de-mensajes)
6. [Ejemplos de Implementación](#6-ejemplos-de-implementación)
7. [Pruebas de Integración](#7-pruebas-de-integración)
8. [Preguntas Frecuentes](#8-preguntas-frecuentes)

---

## 1. Sistema de Mensajería Estandarizado

El sistema de mensajería es la columna vertebral de la comunicación entre los diferentes componentes de Valencia Tour. Permite a los iframes comunicarse de manera efectiva, segura y estructurada.

### Principios de Diseño

- **Estandarización:** Formato único CATEGORIA.ACCION para todos los tipos de mensajes
- **Confiabilidad:** Sistema de confirmaciones (ACK/NACK) para mensajes críticos
- **Trazabilidad:** Cada mensaje incluye timestamp, ID único y origen/destino
- **Integridad:** Validación de estructura y hash de verificación
- **Extensibilidad:** Diseñado para agregar fácilmente nuevos tipos de mensaje

### Arquitectura

El sistema se compone de los siguientes módulos clave:

- **mensajeria.js:** Implementa la funcionalidad principal de comunicación
- **constants.js:** Define todos los tipos de mensaje y mensajes críticos
- **utils.js:** Proporciona funciones de apoyo como generación de hash
- **logger.js:** Facilita el registro y depuración de la comunicación

### Flujo de Comunicación

1. Un componente crea un mensaje utilizando el formato estándar
2. El mensaje se valida para asegurar su estructura correcta
3. El mensaje se envía al componente destino
4. Si es un mensaje crítico, se espera confirmación (ACK)
5. El receptor procesa el mensaje y envía confirmación si es necesario

---

## 2. Formato de Mensajes

### Estructura Estándar

Todos los mensajes en el sistema siguen esta estructura:

```javascript
{
    origen: 'ID_DEL_IFRAME_ORIGEN',    // Identificador del componente emisor
    destino: 'ID_DEL_IFRAME_DESTINO',  // Identificador del componente receptor ('padre', 'todos', o ID específico)
    tipo: 'CATEGORIA.ACCION',          // Formato estandarizado: MAYUSCULAS con punto
    datos: {                           // Objeto con los datos específicos del mensaje
        // Datos específicos según el tipo de mensaje
        // ...
    },
    timestamp: Date.now(),             // Marca de tiempo en milisegundos
    version: '3.0',                    // Versión del formato de mensaje
    id: 'uuid-generado',               // Identificador único del mensaje
    hash: 'hash-calculado'             // Hash para verificar integridad
}
```

### Campos Obligatorios

- **origen:** Identificador del componente que envía el mensaje
- **destino:** Identificador del componente al que va dirigido el mensaje
- **tipo:** Tipo de mensaje en formato CATEGORIA.ACCION
- **datos:** Objeto con la información específica del mensaje

### Campos Automáticos

Estos campos se generan automáticamente al crear un mensaje con `crearMensaje()`:

- **timestamp:** Fecha y hora de creación del mensaje
- **version:** Versión del formato de mensaje (actualmente 3.0)
- **id:** Identificador único generado para el mensaje
- **hash:** Verificación de integridad calculada a partir del tipo y datos

---

## 3. Sistema de Confirmación ACK/NACK

El sistema de confirmación ACK/NACK (Acknowledgment/Negative Acknowledgment) es un mecanismo que garantiza la comunicación confiable entre componentes.

### Características Principales

- **Confirmación de mensajes críticos:** Asegura que los mensajes importantes sean procesados
- **Reintentos automáticos:** Reenvía mensajes cuando no se recibe confirmación
- **Backoff exponencial:** Aumenta gradualmente el tiempo entre reintentos
- **Notificación de errores:** Permite al emisor saber si un mensaje fue rechazado o falló
- **Timeouts configurables:** Permite ajustar el tiempo de espera para diferentes tipos de mensajes

### Flujo de Confirmación

1. Se envía un mensaje crítico mediante `enviarMensajeConACK()`
2. Se inicia un temporizador para esperar la confirmación
3. El receptor procesa el mensaje y envía un ACK o NACK según corresponda
4. Si se recibe ACK, la promesa se resuelve con éxito
5. Si se recibe NACK o timeout, se realizan reintentos según la configuración
6. Si se agotan los reintentos, se rechaza la promesa con un error

### Configuración de ACK/NACK

```javascript
// Tiempo de espera base para confirmación (ms)
const TIEMPO_ESPERA_ACK = 2000;

// Máximo número de reintentos
const MAX_INTENTOS = 3;

// Factor de incremento para backoff exponencial
const FACTOR_BACKOFF = 1.5;

// Tipos de mensaje que requieren confirmación
const MENSAJES_CRITICOS = [
    TIPOS_MENSAJE.SISTEMA.INICIALIZACION,
    TIPOS_MENSAJE.CONTROL.CAMBIO_SECCION,
    // ...otros mensajes críticos
];
```

---

## 4. Tipos de Mensajes

Los tipos de mensaje siguen el formato estandarizado CATEGORIA.ACCION y están definidos en `constants.js`.

### Categorías Principales

- **SISTEMA:** Mensajes relacionados con la inicialización y estado del sistema
- **CONTROL:** Mensajes para control de flujo y navegación de la aplicación
- **DATOS:** Mensajes para intercambio de información y estado
- **NAVEGACION:** Mensajes específicos para el control del mapa y navegación
- **AUDIO:** Mensajes para control de reproducción de audio
- **RETO:** Mensajes relacionados con los retos y preguntas
- **USUARIO:** Mensajes relacionados con acciones del usuario

### Ejemplos de Tipos

```javascript
// Ejemplos de SISTEMA
SISTEMA.INICIALIZACION
SISTEMA.COMPONENTE_LISTO
SISTEMA.ERROR
SISTEMA.ACK
SISTEMA.NACK

// Ejemplos de NAVEGACION
NAVEGACION.CAMBIO_PARADA
NAVEGACION.ACTUALIZAR_POSICION
NAVEGACION.CAMBIO_ZOOM

// Ejemplos de AUDIO
AUDIO.REPRODUCIR
AUDIO.PAUSAR
AUDIO.DETENER
```

### Mensajes Críticos

Los mensajes críticos requieren confirmación explícita:

```javascript
const MENSAJES_CRITICOS = [
    TIPOS_MENSAJE.SISTEMA.INICIALIZACION,
    TIPOS_MENSAJE.CONTROL.CAMBIO_SECCION,
    TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA,
    TIPOS_MENSAJE.RETO.INICIAR,
    TIPOS_MENSAJE.RETO.FINALIZAR,
    // ...otros mensajes críticos
];
```

---

## 5. Validación de Mensajes

El sistema implementa validación estricta para asegurar la integridad y formato de los mensajes.

### Proceso de Validación

La función `validarMensaje()` verifica:

1. **Campos requeridos:** origen, destino, tipo, datos
2. **Formato de tipo:** Debe seguir el patrón CATEGORIA.ACCION
3. **Tipo válido:** Debe estar definido en TIPOS_MENSAJE
4. **Integridad:** El hash debe coincidir con el calculado a partir del contenido

### Código de Validación

```javascript
function validarMensaje(mensaje) {
    // Verificar que existan los campos requeridos
    if (!mensaje.origen || !mensaje.destino || !mensaje.tipo || !mensaje.datos) {
        throw new Error('Mensaje inválido: faltan campos requeridos');
    }
    
    // Verificar que el tipo siga el formato correcto
    const formatoValido = /^[A-Z_]+\.[A-Z_]+$/.test(mensaje.tipo);
    if (!formatoValido) {
        throw new Error(`Formato de tipo inválido: ${mensaje.tipo}`);
    }
    
    // Verificar que el tipo esté en la lista de tipos válidos
    if (!TIPOS_MENSAJE_VALIDOS.includes(mensaje.tipo)) {
        throw new Error(`Tipo de mensaje no reconocido: ${mensaje.tipo}`);
    }
    
    // Si el mensaje tiene hash, verificar integridad
    if (mensaje.hash) {
        const hashCalculado = generarHashContenido(mensaje.tipo, mensaje.datos);
        if (hashCalculado !== mensaje.hash) {
            throw new Error('Hash del mensaje no coincide');
        }
    }
    
    return true;
}
```

---

## 6. Ejemplos de Implementación

### Envío de Mensaje Simple

```javascript
import { TIPOS_MENSAJE } from './constants.js';
import * as mensajeria from './mensajeria.js';

// Crear y enviar un mensaje simple
const mensaje = mensajeria.crearMensaje({
    origen: 'mi-componente',
    destino: 'app',
    tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
    datos: { 
        estado: 'listo',
        timestamp: Date.now()
    }
});

mensajeria.enviarMensaje(mensaje);
```

### Envío de Mensaje Crítico con Confirmación

```javascript
import { TIPOS_MENSAJE } from './constants.js';
import * as mensajeria from './mensajeria.js';

// Función asíncrona para enviar mensaje crítico
async function enviarMensajeCritico() {
    try {
        // Crear mensaje crítico
        const mensajeCritico = {
            origen: 'mi-componente',
            destino: 'componente-mapa',
            tipo: TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA,
            datos: {
                parada: 'parada-2',
                coordenadas: {
                    lat: 39.4697065,
                    lng: -0.3763353
                }
            }
        };
        
        // Enviar y esperar confirmación
        const resultado = await mensajeria.enviarMensajeConACK(mensajeCritico);
        console.log('Mensaje confirmado:', resultado);
        
    } catch (error) {
        console.error('Error en envío de mensaje:', error);
    }
}
```

### Recepción y Procesamiento de Mensajes

```javascript
import { TIPOS_MENSAJE } from './constants.js';
import * as mensajeria from './mensajeria.js';

// Registrar manejador para procesar mensajes entrantes
function inicializarReceptor() {
    // Función que procesará los mensajes recibidos
    const procesarMensajes = (mensaje) => {
        // Verificar tipo de mensaje
        switch (mensaje.tipo) {
            case TIPOS_MENSAJE.AUDIO.REPRODUCIR:
                reproducirAudio(mensaje.datos.audioId, mensaje.datos.volumen);
                // Enviar confirmación
                enviarConfirmacion(mensaje);
                break;
                
            case TIPOS_MENSAJE.SISTEMA.INICIALIZACION:
                inicializarComponente(mensaje.datos.config);
                // Enviar confirmación
                enviarConfirmacion(mensaje);
                break;
                
            // Otros tipos de mensaje...
            default:
                console.log('Mensaje no procesado:', mensaje);
        }
    };
    
    // Registrar el manejador
    mensajeria.registrarManejadorMensajes(procesarMensajes);
}

// Función para enviar confirmación
function enviarConfirmacion(mensajeOriginal) {
    const confirmacion = mensajeria.crearMensaje({
        origen: 'mi-componente',
        destino: mensajeOriginal.origen,
        tipo: TIPOS_MENSAJE.SISTEMA.ACK,
        datos: {
            idMensajeOriginal: mensajeOriginal.id,
            estado: 'procesado'
        }
    });
    
    mensajeria.enviarMensaje(confirmacion);
}
```

---

## 7. Pruebas de Integración

### Objetivo de las Pruebas

El sistema de pruebas verifica que el sistema de mensajería funciona correctamente, validando:

1. El formato estandarizado de los mensajes
2. La validación correcta de la estructura de mensajes
3. El envío y recepción de mensajes entre componentes
4. El sistema de confirmación ACK/NACK
5. La gestión de reintentos para mensajes críticos

### Casos de Prueba Implementados

| ID | Prueba | Descripción |
|----|--------|-------------|
| 1 | Validación de Mensajes | Verifica que los mensajes con formato correcto sean aceptados y los inválidos rechazados |
| 2 | Creación de Mensajes | Comprueba que los mensajes se crean con todos los campos necesarios, incluyendo hash |
| 3 | Formato Estandarizado | Valida que todos los tipos de mensaje definidos sigan el formato CATEGORIA.ACCION |
| 4 | Envío/Recepción | Prueba el envío y recepción correctos de mensajes entre componentes |
| 5 | Sistema ACK/NACK | Verifica el funcionamiento del sistema de confirmación para mensajes críticos |
| 6 | Reintentos | Comprueba la configuración y lógica del sistema de reintentos |

### Ejecutar las Pruebas

Para ejecutar las pruebas de integración:

1. Abrir el archivo `test-mensajeria.html` en el navegador
2. Hacer clic en el botón "Ejecutar Tests"
3. Revisar los resultados detallados que se muestran en la interfaz

### Resultados de las Pruebas

Los resultados se muestran visualmente con un código de colores:

- **Verde (✅)**: Prueba exitosa
- **Rojo (❌)**: Prueba fallida

Cada prueba incluye detalles expandibles que muestran información adicional sobre los casos específicos probados.

---

## 8. Preguntas Frecuentes

### ¿Por qué usar el formato CATEGORIA.ACCION?

Este formato proporciona una estructura clara y jerárquica que facilita la organización, comprensión y mantenimiento de los tipos de mensaje. Permite agrupar mensajes relacionados y entender rápidamente su propósito.

### ¿Cuándo usar el sistema ACK/NACK?

El sistema ACK/NACK debe utilizarse para mensajes críticos donde es importante garantizar que fueron procesados correctamente. Por ejemplo:
- Inicialización de componentes
- Cambios de sección o parada
- Inicio o finalización de retos
- Actualizaciones de datos importantes

### ¿Cómo añadir un nuevo tipo de mensaje?

Para añadir un nuevo tipo de mensaje:
1. Identificar la categoría apropiada (SISTEMA, NAVEGACION, etc.)
2. Añadir la nueva constante en `constants.js` siguiendo el formato CATEGORIA.ACCION
3. Si es un mensaje crítico, añadirlo también a `MENSAJES_CRITICOS`

### ¿Cómo funciona el hash de verificación?

El hash se genera a partir del tipo de mensaje y sus datos utilizando la función `generarHashContenido()`. Esto permite verificar que el mensaje no ha sido alterado durante la transmisión y que mantiene su integridad.

### ¿Qué hacer si un mensaje crítico nunca recibe confirmación?

El sistema automáticamente reintentará enviar el mensaje hasta alcanzar el número máximo de intentos (configurable en `mensajeria.js`). Si después de todos los reintentos no se recibe confirmación, la promesa se rechazará con un error que debe ser capturado y manejado apropiadamente.

---

## Apéndice: Historia de Versiones

### Versión 3.0.0 (Actual)
- Estandarización completa de todos los tipos de mensaje al formato CATEGORIA.ACCION
- Eliminación de formatos antiguos y compatibilidad
- Implementación de sistema robusto de ACK/NACK con reintentos exponenciales
- Validación estricta de la estructura de mensajes
- Añadido hash de verificación para integridad de mensajes

### Versión 2.0.0
- Introducción inicial del formato CATEGORIA.ACCION
- Mantenimiento de compatibilidad con formatos antiguos
- Sistema básico de confirmaciones

### Versión 1.0.0
- Sistema original con formatos variados para los tipos de mensaje
- Sin validación estricta de estructura
- Sin sistema de confirmaciones consistente
