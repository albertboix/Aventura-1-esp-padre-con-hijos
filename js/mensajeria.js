/**
 * Sistema de Mensajería para Comunicación entre Iframes
 * Maneja la comunicación bidireccional entre iframes padre e hijo
 * @version 2.0.0
 */

// ================== ERROR HANDLING ==================

/**
 * Wraps a function with error handling
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context for error messages
 * @returns {Function} Wrapped function with error handling
 */
function withErrorHandling(fn, context) {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            console.error(`[${context}] Error:`, error);
            throw error;
        }
    };
}

/**
 * Notifica un error al sistema
 * @param {string} tipo - Tipo de error
 * @param {Error|string} error - Objeto de error o mensaje
 * @param {Object} [datosAdicionales={}] - Datos adicionales
 * @returns {Object} Información del error
 */
function notificarError(tipo, error, datosAdicionales = {}) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorInfo = {
        tipo,
        mensaje: errorObj.message,
        stack: errorObj.stack,
        ...datosAdicionales,
        timestamp: new Date().toISOString()
    };
    
    console.error(`[Mensajería] Error (${tipo}):`, errorInfo);
    return errorInfo;
}

// ================== CONSTANTES Y CONFIGURACIÓN ==================

/**
 * Tipos de mensajes soportados por el sistema
 * @namespace TIPOS_MENSAJE
 */
export const TIPOS_MENSAJE = {
  // Mensajes del sistema
  SISTEMA: {
    /**
     * Inicialización del sistema
     * @event SISTEMA.INICIALIZACION
     */
    INICIALIZACION: 'SISTEMA.INICIALIZACION',
    
    /**
     * Cambios de configuración en tiempo real (tema, idioma, opciones)
     * @event SISTEMA.CONFIGURACION
     */
    CONFIGURACION: 'SISTEMA.CONFIGURACION',
    
    /**
     * Sincronización de estado
     * @event SISTEMA.SINCRONIZAR
     */
    SINCRONIZAR: 'SISTEMA.SINCRONIZAR',
    
    /**
     * Confirmación de operación
     * @event SISTEMA.CONFIRMACION
     */
    CONFIRMACION: 'SISTEMA.CONFIRMACION',
    
    /**
     * Notificación de error
     * @event SISTEMA.ERROR
     */
    ERROR: 'SISTEMA.ERROR',
    
    /**
     * Cambio de modo (casa/aventura)
     * @event SISTEMA.CAMBIO_MODO
     */
    CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
    
    /**
     * Confirmación de cambio de modo
     * @event SISTEMA.CAMBIO_MODO_CONFIRMACION
     */
    CAMBIO_MODO_CONFIRMACION: 'SISTEMA.CAMBIO_MODO_CONFIRMACION',
    
    /**
     * Confirmación de inicialización
     * @event SISTEMA.INICIALIZACION_COMPLETADA
     */
    INICIALIZACION_COMPLETADA: 'SISTEMA.INICIALIZACION_COMPLETADA'
  },
  
  // Navegación y control del mapa
  NAVEGACION: {
    /**
     * Estado actual de la navegación
     * @event NAVEGACION.ESTADO
     */
    ESTADO: 'NAVEGACION.ESTADO',
    
    /**
     * Cambio de parada actual
     * @event NAVEGACION.CAMBIO_PARADA
     */
    CAMBIO_PARADA: 'NAVEGACION.CAMBIO_PARADA',
    
    /**
     * Llegada a una parada detectada
     * @event NAVEGACION.LLEGADA_DETECTADA
     */
    LLEGADA_DETECTADA: 'NAVEGACION.LLEGADA_DETECTADA',
    
    /**
     * Establecer nuevo destino de navegación
     * @event NAVEGACION.ESTABLECER_DESTINO
     */
    ESTABLECER_DESTINO: 'NAVEGACION.ESTABLECER_DESTINO'
  },
  
  // Control de interfaz de usuario
  UI: {
    /**
     * Actualización de la interfaz
     * @event UI.ACTUALIZAR
     */
    ACTUALIZAR: 'UI.ACTUALIZAR',
    
    /**
     * Habilitar controles de interfaz
     * @event UI.HABILITAR_CONTROLES
     */
    HABILITAR_CONTROLES: 'UI.HABILITAR_CONTROLES',
    
    /**
     * Deshabilitar controles de interfaz
     * @event UI.DESHABILITAR_CONTROLES
     */
    DESHABILITAR_CONTROLES: 'UI.DESHABILITAR_CONTROLES'
  },
  
  // Audio y multimedia
  AUDIO: {
    /**
     * Estado actual del reproductor de audio
     * @event AUDIO.ESTADO
     */
    ESTADO: 'AUDIO.ESTADO',
    
    /**
     * Comando de control de audio
     * @event AUDIO.COMANDO
     */
    COMANDO: 'AUDIO.COMANDO',
    
    /**
     * Reproducir audio
     * @event AUDIO.REPRODUCIR
     */
    REPRODUCIR: 'AUDIO.REPRODUCIR',
    
    /**
     * Pausar reproducción
     * @event AUDIO.PAUSAR
     */
    PAUSAR: 'AUDIO.PAUSAR',
    
    /**
     * Reproducción finalizada
     * @event AUDIO.FINALIZADO
     */
    FINALIZADO: 'AUDIO.FINALIZADO'
  },
  
  // GPS y geolocalización
  GPS: {
    /**
     * Actualización de posición GPS
     * @event GPS.ACTUALIZAR
     */
    ACTUALIZAR: 'GPS.ACTUALIZAR',
    
    /**
     * Comando de control GPS
     * @event GPS.COMANDO
     */
    COMANDO: 'GPS.COMANDO',
    
    /**
     * Estado actual del GPS
     * @event GPS.ESTADO
     */
    ESTADO: 'GPS.ESTADO',
    
    /**
     * Notificación de nueva posición
     * @event GPS.POSICION_ACTUALIZADA
     */
    POSICION_ACTUALIZADA: 'GPS.POSICION_ACTUALIZADA'
  },
  
  // Retos y actividades
  RETO: {
    /**
     * Estado actual de los retos
     * @event RETO.ESTADO
     */
    ESTADO: 'RETO.ESTADO',
    
    /**
     * Nuevo reto disponible
     * @event RETO.NUEVO
     */
    NUEVO: 'RETO.NUEVO',
    
    /**
     * Mostrar un reto
     * @event RETO.MOSTRAR
     */
    MOSTRAR: 'RETO.MOSTRAR',
    
    /**
     * Ocultar un reto
     * @event RETO.OCULTAR
     */
    OCULTAR: 'RETO.OCULTAR',
    
    /**
     * Abrir un reto específico
     * @event RETO.ABRIR
     */
    ABRIR: 'RETO.ABRIR',
    
    /**
     * Reto completado
     * @event RETO.COMPLETADO
     */
    COMPLETADO: 'RETO.COMPLETADO'
  },
  
  // Control de estado de la aplicación
  CONTROL: {
    /**
     * Estado de los controles
     * @event CONTROL.ESTADO
     */
    ESTADO: 'CONTROL.ESTADO',
    
    /**
     * Abrir una URL en el navegador
     * @event UI.ABRIR_URL
     */
    ABRIR_URL: 'UI.ABRIR_URL'
  },
  
  // Datos y sincronización
  DATOS: {
    /**
     * Solicitar lista de paradas
     * @event DATOS.SOLICITAR_PARADAS
     */
    SOLICITAR_PARADAS: 'DATOS.SOLICITAR_PARADAS',
    
    /**
     * Solicitar información de una parada específica
     * @event DATOS.SOLICITAR_PARADA
     */
    SOLICITAR_PARADA: 'DATOS.SOLICITAR_PARADA',
    
    /**
     * Notificar actualización del array de paradas
     * @event DATOS.ARRAY_ACTUALIZADO
     */
    ARRAY_ACTUALIZADO: 'DATOS.ARRAY_ACTUALIZADO',
    
    /**
     * Verificar hash de datos
     * @event DATOS.VERIFICAR_HASH
     */
    VERIFICAR_HASH: 'DATOS.VERIFICAR_HASH',
    
    /**
     * Actualizar información de una parada
     * @event DATOS.ACTUALIZAR_PARADA
     */
    ACTUALIZAR_PARADA: 'DATOS.ACTUALIZAR_PARADA'
  },
  
  // Compatibilidad con mensajes anteriores (mantener por compatibilidad)
  LEGACY: {
    CONTROLES_HABILITADOS: 'sistema:controles_habilitados',
    CONTROLES_DESHABILITADOS: 'sistema:controles_deshabilitados',
    HABILITAR_CONTROLES: 'sistema:habilitar_controles',
    DESHABILITAR_CONTROLES: 'sistema:deshabilitar_controles'
  }
};

/**
 * Niveles de logging
 */
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * Configuración por defecto del sistema de mensajería
 */
const CONFIG_DEFAULT = {
  timeout: 10000,
  maxReintentos: 3,
  tiempoEsperaBase: 1000,
  factorBackoff: 2,
  logLevel: LOG_LEVELS.INFO,
  debug: false
};

// ================== VARIABLES GLOBALES ==================

let configuracion = { ...CONFIG_DEFAULT };
let iframeId = null;
let manejadores = new Map();
let mensajesPendientes = new Map();
let contadorMensajes = 0;
let sistemaInicializado = false;
let iframesRegistrados = new Set(); // Registro de iframes activos

// ================== FUNCIONES DE REGISTRO DE IFRAMES ==================

/**
 * Registra un iframe en el sistema para comunicación directa
 * @param {string} id - ID del iframe
 */
export function registrarIframe(id) {
  iframesRegistrados.add(id);
  log(LOG_LEVELS.DEBUG, `Iframe registrado: ${id}`);
}

/**
 * Obtiene la lista de iframes registrados
 * @returns {Array} Lista de IDs de iframes
 */
export function obtenerIframesRegistrados() {
  return Array.from(iframesRegistrados);
}

// ================== VALIDACIÓN DE MENSAJES ==================

/**
 * Esquemas de validación para los mensajes
 * @type {Object.<string, {propiedadesRequeridas: string[], validar?: function(Object): boolean}>}
 */
const ESQUEMAS_MENSAJES = {
  'SISTEMA.CAMBIO_MODO': {
    propiedadesRequeridas: ['modo', 'timestamp'],
    validar: (datos) => ['casa', 'aventura'].includes(datos.modo)
  },
  'GPS.POSICION_ACTUALIZADA': {
    propiedadesRequeridas: ['coordenadas', 'timestamp'],
    validar: (datos) => 
      typeof datos.coordenadas?.lat === 'number' && 
      typeof datos.coordenadas?.lng === 'number' &&
      (datos.coordenadas.accuracy === undefined || typeof datos.coordenadas.accuracy === 'number')
  },
  'AUDIO.REPRODUCIR': {
    propiedadesRequeridas: ['tipo', 'nombre']
  },
  'RETO.MOSTRAR': {
    propiedadesRequeridas: ['retoId']
  },
  'NAVEGACION.ESTABLECER_DESTINO': {
    propiedadesRequeridas: ['tipo', 'parada_id', 'paradaDestinoNombre']
  }
};

// ================== FUNCIONES DE UTILIDAD ==================

// Hacer disponible globalmente para compatibilidad con código antiguo
if (typeof window !== 'undefined') {
    window.Mensajeria = {
        TIPOS_MENSAJE,
        inicializarMensajeria: withErrorHandling(inicializarMensajeria, 'mensajeria:inicializar'),
        registrarControlador,
        registrarManejador,
        enviarMensaje: withErrorHandling(enviarMensaje, 'mensajeria:enviar'),
        enviarMensajeDirecto: withErrorHandling(enviarMensajeDirecto, 'mensajeria:enviarDirecto'),
        enviarATodosLosIframes: withErrorHandling(enviarATodosLosIframes, 'mensajeria:enviarATodos'),
        enviarConfiguracion: withErrorHandling(enviarConfiguracion, 'mensajeria:configuracion'),
        // Agregar otras funciones que necesiten ser accesibles globalmente
    };
}

/**
 * Genera un ID único para mensajes
 * @returns {string} ID único
 */
function generarIdMensaje() {
  return `msg_${Date.now()}_${++contadorMensajes}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Función de logging con niveles
 * @param {number} nivel - Nivel de log
 * @param {string} mensaje - Mensaje a loggear
 * @param {*} datos - Datos adicionales
 */
function log(nivel, mensaje, datos = null) {
  if (nivel <= configuracion.logLevel) {
    const prefijo = `[Mensajería-${iframeId || 'Sin ID'}]`;
    const timestamp = new Date().toISOString();
    const nivelTexto = Object.keys(LOG_LEVELS)[nivel] || 'UNKNOWN';
    
    const mensajeCompleto = `${timestamp} ${prefijo} [${nivelTexto}] ${mensaje}`;
    
    switch (nivel) {
      case LOG_LEVELS.ERROR:
        console.error(mensajeCompleto, datos);
        break;
      case LOG_LEVELS.WARN:
        console.warn(mensajeCompleto, datos);
        break;
      case LOG_LEVELS.INFO:
        console.info(mensajeCompleto, datos);
        break;
      case LOG_LEVELS.DEBUG:
        if (configuracion.debug) {
          console.debug(mensajeCompleto, datos);
        }
        break;
    }
  }
}

/**
 * Valida la estructura de un mensaje
 * @param {Object} mensaje - Mensaje a validar
 * @returns {boolean} true si es válido
 */
function validarMensaje(mensaje) {
  // Validación básica de la estructura del mensaje
  if (!mensaje || typeof mensaje !== 'object') {
    console.error('Mensaje no es un objeto:', mensaje);
    return false;
  }
  
  // Validar campos obligatorios
  const camposRequeridos = ['tipo', 'destino', 'origen', 'datos'];
  for (const campo of camposRequeridos) {
    if (!(campo in mensaje)) {
      console.error(`Falta campo requerido '${campo}' en mensaje:`, mensaje);
      return false;
    }
  }
  
  // Validar estructura de datos según el tipo de mensaje
  const esquema = ESQUEMAS_MENSAJES[mensaje.tipo];
  if (esquema) {
    // Validar propiedades requeridas
    for (const prop of esquema.propiedadesRequeridas || []) {
      if (!(prop in mensaje.datos) && mensaje.datos[prop] !== 0) {
        console.error(`Falta propiedad requerida '${prop}' en mensaje ${mensaje.tipo}:`, mensaje);
        return false;
      }
    }
    
    // Ejecutar validación personalizada si existe
    if (esquema.validar && !esquema.validar(mensaje.datos)) {
      console.error(`Validación fallida para mensaje ${mensaje.tipo}:`, mensaje);
      return false;
    }
  }
  
  return true;
}

/**
 * Inicializa el sistema de mensajería
 * @param {Object} config - Configuración del sistema
 * @returns {Promise<void>}
 */
export async function inicializarMensajeria(config = {}) {
  try {
    log(LOG_LEVELS.INFO, 'Inicializando sistema de mensajería...', config);
    
    // Validar configuración
    if (!config.iframeId) {
      throw new Error('Se requiere un iframeId para inicializar la mensajería');
    }
    
    // Aplicar configuración
    configuracion = { ...CONFIG_DEFAULT, ...config };
    iframeId = configuracion.iframeId;
    
    // Configurar listener de mensajes
    if (typeof window !== 'undefined') {
      window.addEventListener('message', manejarMensajeRecibido, false);
      log(LOG_LEVELS.DEBUG, 'Event listener de mensajes configurado');
    }
    
    sistemaInicializado = true;
    
    log(LOG_LEVELS.INFO, 'Sistema de mensajería inicializado correctamente', {
      iframeId,
      configuracion
    });
    
    return Promise.resolve();
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Error al inicializar la mensajería', error);
    throw error;
  }
}

/**
 * Registra un manejador para un tipo de mensaje específico
 * @param {string} tipo - Tipo de mensaje
 * @param {Function} manejador - Función manejadora
 */
export function registrarControlador(tipo, manejador) {
  if (!sistemaInicializado) {
    throw new Error('El sistema de mensajería no está inicializado');
  }
  
  if (typeof manejador !== 'function') {
    throw new Error('El manejador debe ser una función');
  }
  
  manejadores.set(tipo, manejador);
  log(LOG_LEVELS.DEBUG, `Manejador registrado para tipo: ${tipo}`);
}

/**
 * Alias para registrarControlador (para compatibilidad)
 */
export const registrarManejador = registrarControlador;

/**
 * Envía un mensaje a otro iframe o al padre
 * @param {string} destino - ID del iframe destino o 'padre'
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @param {Object} opciones - Opciones adicionales
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarMensaje(destino, tipo, datos = {}, opciones = {}) {
  if (!sistemaInicializado) {
    throw new Error('El sistema de mensajería no está inicializado');
  }
  
  const opcionesCompletas = {
    timeout: configuracion.timeout,
    esperarRespuesta: true,
    ...opciones
  };
  
  // Si se pasa un objeto como primer parámetro (formato alternativo)
  if (typeof destino === 'object' && destino.tipo) {
    return enviarMensajeDirecto(destino, opcionesCompletas);
  }
  
  // Construir el mensaje
  const mensaje = {
    tipo,
    destino,
    origen: iframeId,
    timestamp: new Date().toISOString(),
    idMensaje: generarIdMensaje(),
    datos: datos || {},
    version: '1.0.0'
  };
  
  return enviarMensajeDirecto(mensaje, opcionesCompletas);
}

/**
 * Envía un mensaje construido directamente
 * @param {Object} mensaje - Mensaje a enviar
 * @param {Object} opciones - Opciones de envío
 * @returns {Promise<Object>} Respuesta del mensaje
 */
async function enviarMensajeDirecto(mensaje, opciones = {}) {
  const {
    timeout = configuracion.timeout,
    esperarRespuesta = true
  } = opciones;
  
  // Validar mensaje
  if (!validarMensaje(mensaje)) {
    throw new Error('Estructura de mensaje inválida');
  }
  
  log(LOG_LEVELS.DEBUG, `Enviando mensaje tipo: ${mensaje.tipo}`, mensaje);
  
  try {
    // Determinar la ventana destino
    let ventanaDestino = null;
    
    if (mensaje.destino === 'padre' || !mensaje.destino) {
      // Enviar al padre
      if (window.parent && window.parent !== window) {
        ventanaDestino = window.parent;
      } else {
        throw new Error('No se puede acceder a la ventana padre');
      }
    } else if (mensaje.destino === 'todos') {
      // Enviar a todos los iframes registrados
      return enviarATodosLosIframes(mensaje, opciones);
    } else {
      // Enviar a un iframe específico
      const iframe = document.getElementById(mensaje.destino);
      if (iframe && iframe.contentWindow) {
        ventanaDestino = iframe.contentWindow;
      } else {
        throw new Error(`No se encontró el iframe con ID: ${mensaje.destino}`);
      }
    }
    
    // Enviar el mensaje
    ventanaDestino.postMessage(mensaje, '*');
    
    // Si no se espera respuesta, resolver inmediatamente
    if (!esperarRespuesta) {
      log(LOG_LEVELS.DEBUG, `Mensaje enviado sin esperar respuesta: ${mensaje.idMensaje}`);
      return { exito: true, mensaje: 'Mensaje enviado correctamente' };
    }
    
    // Esperar respuesta con timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        mensajesPendientes.delete(mensaje.idMensaje);
        reject(new Error(`Timeout al esperar respuesta del mensaje ${mensaje.idMensaje}`));
      }, timeout);
      
      mensajesPendientes.set(mensaje.idMensaje, {
        resolve,
        reject,
        timeoutId,
        timestamp: Date.now()
      });
      
      log(LOG_LEVELS.DEBUG, `Esperando respuesta para mensaje: ${mensaje.idMensaje}`);
    });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Error al enviar mensaje', { mensaje, error: error.message });
    throw error;
  }
}

/**
 * Envía un mensaje a todos los iframes registrados
 * @param {Object} mensaje - Mensaje a enviar
 * @param {Object} opciones - Opciones de envío
 * @returns {Promise<Array>} Array de respuestas
 */
async function enviarATodosLosIframes(mensaje, opciones = {}) {
  const iframes = ['hijo1-hamburguesa', 'hijo1-opciones', 'hijo2', 'hijo3', 'hijo4', 'hijo5-casa'];
  const promesas = [];
  
  for (const iframeId of iframes) {
    const iframe = document.getElementById(iframeId);
    if (iframe && iframe.contentWindow) {
      const mensajeIndividual = {
        ...mensaje,
        destino: iframeId,
        idMensaje: generarIdMensaje()
      };
      
      try {
        iframe.contentWindow.postMessage(mensajeIndividual, '*');
        log(LOG_LEVELS.DEBUG, `Mensaje enviado a ${iframeId}: ${mensajeIndividual.tipo}`);
        
        if (opciones.esperarRespuesta !== false) {
          const promesa = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              mensajesPendientes.delete(mensajeIndividual.idMensaje);
              resolve({ destino: iframeId, error: 'Timeout' });
            }, opciones.timeout || configuracion.timeout);
            
            mensajesPendientes.set(mensajeIndividual.idMensaje, {
              resolve: (datos) => resolve({ destino: iframeId, datos }),
              reject: (error) => resolve({ destino: iframeId, error }),
              timeoutId,
              timestamp: Date.now()
            });
          });
          promesas.push(promesa);
        }
      } catch (error) {
        log(LOG_LEVELS.ERROR, `Error enviando a ${iframeId}`, error);
        promesas.push(Promise.resolve({ destino: iframeId, error: error.message }));
      }
    }
  }
  
  if (promesas.length === 0) {
    return { exito: true, mensaje: 'Mensaje broadcast enviado' };
  }
  
  return Promise.all(promesas);
}

/**
 * Maneja los mensajes recibidos
 * @param {MessageEvent} event - Evento de mensaje
 */
async function manejarMensajeRecibido(event) {
  try {
    const mensaje = event.data;
    
    // Validar que sea un mensaje válido
    if (!validarMensaje(mensaje)) {
      log(LOG_LEVELS.DEBUG, 'Mensaje recibido no válido, ignorando', mensaje);
      return;
    }
    
    log(LOG_LEVELS.DEBUG, `Mensaje recibido tipo: ${mensaje.tipo}`, mensaje);
    
    // Verificar si es una respuesta a un mensaje pendiente
    if (mensaje.esRespuesta && mensaje.idMensajeOriginal) {
      const mensajePendiente = mensajesPendientes.get(mensaje.idMensajeOriginal);
      if (mensajePendiente) {
        clearTimeout(mensajePendiente.timeoutId);
        mensajesPendientes.delete(mensaje.idMensajeOriginal);
        
        if (mensaje.error) {
          mensajePendiente.reject(new Error(mensaje.error));
        } else {
          mensajePendiente.resolve(mensaje.datos || mensaje);
        }
        
        log(LOG_LEVELS.DEBUG, `Respuesta procesada para mensaje: ${mensaje.idMensajeOriginal}`);
        return;
      }
    }
    
    // Buscar manejador para el tipo de mensaje
    const manejador = manejadores.get(mensaje.tipo);
    if (!manejador) {
      log(LOG_LEVELS.WARN, `No hay manejador para el tipo de mensaje: ${mensaje.tipo}`);
      
      // Enviar respuesta de error si se espera una respuesta
      if (!mensaje.esRespuesta) {
        enviarRespuesta(mensaje, null, `No hay manejador para el tipo: ${mensaje.tipo}`);
      }
      return;
    }
    
    // Ejecutar el manejador
    try {
      const resultado = await manejador(mensaje);
      
      // Enviar respuesta si no es una respuesta y se espera una
      if (!mensaje.esRespuesta) {
        enviarRespuesta(mensaje, resultado);
      }
      
    } catch (error) {
      log(LOG_LEVELS.ERROR, `Error en el manejador para ${mensaje.tipo}`, error);
      
      // Enviar respuesta de error
      if (!mensaje.esRespuesta) {
        enviarRespuesta(mensaje, null, error.message);
      }
    }
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Error al procesar mensaje recibido', error);
  }
}

/**
 * Envía una respuesta a un mensaje recibido
 * @param {Object} mensajeOriginal - Mensaje original
 * @param {*} datos - Datos de respuesta
 * @param {string} error - Mensaje de error (opcional)
 */
function enviarRespuesta(mensajeOriginal, datos = null, error = null) {
  const respuesta = {
    tipo: `${mensajeOriginal.tipo}_respuesta`,
    destino: mensajeOriginal.origen,
    origen: iframeId,
    timestamp: new Date().toISOString(),
    idMensaje: generarIdMensaje(),
    idMensajeOriginal: mensajeOriginal.idMensaje,
    esRespuesta: true,
    datos,
    error,
    version: '1.0.0'
  };
  
  // Enviar respuesta sin esperar confirmación
  enviarMensajeDirecto(respuesta, { esperarRespuesta: false }).catch(err => {
    log(LOG_LEVELS.ERROR, 'Error al enviar respuesta', err);
  });
}

/**
 * Limpia mensajes pendientes que han expirado
 */
function limpiarMensajesExpirados() {
  const ahora = Date.now();
  for (const [id, pendiente] of mensajesPendientes.entries()) {
    if (ahora - pendiente.timestamp > configuracion.timeout) {
      clearTimeout(pendiente.timeoutId);
      pendiente.reject(new Error(`Mensaje expirado: ${id}`));
      mensajesPendientes.delete(id);
      log(LOG_LEVELS.DEBUG, `Mensaje expirado eliminado: ${id}`);
    }
  }
}

/**
 * Obtiene estadísticas del sistema de mensajería
 * @returns {Object} Estadísticas del sistema
 */
export function obtenerEstadisticas() {
  return {
    sistemaInicializado,
    iframeId,
    mensajesPendientes: mensajesPendientes.size,
    manejadoresRegistrados: manejadores.size,
    tiposManejadores: Array.from(manejadores.keys()),
    iframesRegistrados: Array.from(iframesRegistrados),
    configuracion: { ...configuracion }
  };
}

// ================== FUNCIONES ESPECIALIZADAS PARA EL MAPA ==================

/**
 * Envía un comando de navegación
 * @param {string} destino - Iframe destino o 'todos'
 * @param {string} accion - Acción de navegación
 * @param {Object} datos - Datos adicionales
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarComandoNavegacion(destino, accion, datos = {}) {
  return enviarMensaje(destino, TIPOS_MENSAJE.NAVEGACION.ESTADO, {
    accion,
    ...datos,
    timestamp: Date.now()
  });
}

/**
 * Envía un comando GPS
 * @param {string} destino - Iframe destino o 'todos'
 * @param {string} accion - Acción GPS
 * @param {Object} datos - Datos adicionales
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarComandoGPS(destino, accion, datos = {}) {
  return enviarMensaje(destino, TIPOS_MENSAJE.GPS.COMANDO, {
    accion,
    ...datos,
    timestamp: Date.now()
  });
}

/**
 * Actualiza coordenadas GPS
 * @param {string} destino - Iframe destino o 'todos'
 * @param {number} lat - Latitud
 * @param {number} lng - Longitud
 * @param {number} accuracy - Precisión
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function actualizarCoordenadasGPS(destino, lat, lng, accuracy = 0) {
  return enviarMensaje(destino, TIPOS_MENSAJE.GPS.ACTUALIZAR, {
    lat,
    lng,
    accuracy,
    timestamp: Date.now()
  }, { esperarRespuesta: false });
}

/**
 * Envía un comando de audio
 * @param {string} destino - Iframe destino
 * @param {string} comando - Comando de audio
 * @param {Object} datos - Datos adicionales
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarComandoAudio(destino, comando, datos = {}) {
  return enviarMensaje(destino, TIPOS_MENSAJE.AUDIO.COMANDO, {
    comando,
    ...datos,
    timestamp: Date.now()
  });
}

/**
 * Envía un mensaje de reto
 * @param {string} destino - Iframe destino
 * @param {Object} retoData - Datos del reto
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarReto(destino, retoData) {
  return enviarMensaje(destino, TIPOS_MENSAJE.RETO.NUEVO, {
    ...retoData,
    timestamp: Date.now()
  });
}

/**
 * Sincroniza estado del sistema
 * @param {Object} estado - Estado a sincronizar
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function sincronizarEstado(estado) {
  return enviarMensaje('todos', TIPOS_MENSAJE.SISTEMA.SINCRONIZAR, {
    ...estado,
    timestamp: Date.now()
  }, { esperarRespuesta: false });
}

/**
 * Habilita controles en iframes
 * @param {string} modo - Modo de controles
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function habilitarControles(modo = 'casa') {
  return enviarMensaje('todos', TIPOS_MENSAJE.UI.HABILITAR_CONTROLES, {
    modo,
    timestamp: Date.now()
  }, { esperarRespuesta: false });
}

/**
 * Deshabilita controles en iframes
 * @param {string} motivo - Motivo de deshabilitación
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function deshabilitarControles(motivo = 'desconocido') {
  return enviarMensaje('todos', TIPOS_MENSAJE.UI.DESHABILITAR_CONTROLES, {
    motivo,
    timestamp: Date.now()
  }, { esperarRespuesta: false });
}

/**
 * Envía un mensaje de cambio de modo
 * @returns {Promise<Object>} Respuesta del mensaje
 * @throws {Error} Si el modo no es válido o hay un error en el envío
 */
export async function enviarCambioModo(destino, nuevoModo, datosExtra = {}, timeout = 5000) {
  // Tipos de modos válidos
  const MODOS_VALIDOS = new Set(['casa', 'aventura']);

  // Validar el modo
  if (!MODOS_VALIDOS.has(nuevoModo)) {
    throw new Error(`Modo no válido: ${nuevoModo}. Debe ser 'casa' o 'aventura'`);
  }

  // Crear mensaje con metadatos
  const mensaje = {
    modo: nuevoModo,
    timestamp: Date.now(),
    origen: window.iframeId || 'sistema',
    ...datosExtra
  };

  // Configurar timeout
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout al cambiar a modo ${nuevoModo} después de ${timeout}ms`));
    }, timeout);
  });

  try {
    // Enviar mensaje con timeout
    const envio = enviarMensaje(destino, TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, mensaje);
    const resultado = await Promise.race([envio, timeoutPromise]);
    
    // Limpiar timeout
    clearTimeout(timeoutId);
    
    // Verificar respuesta
    if (resultado?.error) {
      throw new Error(`Error en la respuesta: ${resultado.error}`);
    }
    
    return resultado;
  } catch (error) {
    // Limpiar timeout en caso de error
    if (timeoutId) clearTimeout(timeoutId);
    
    // Registrar error y relanzar
    console.error(`[Mensajería] Error al cambiar a modo ${nuevoModo}:`, error);
    throw error;
  }
}

/**
 * Limpia todos los recursos del sistema de mensajería
 */
export function limpiar() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', manejarMensajeRecibido, false);
  }
  
  // Limpiar mensajes pendientes
  for (const [id, pendiente] of mensajesPendientes.entries()) {
    clearTimeout(pendiente.timeoutId);
    pendiente.reject(new Error('Sistema de mensajería limpiado'));
  }
  
  mensajesPendientes.clear();
  manejadores.clear();
  sistemaInicializado = false;
  iframeId = null;
  
  log(LOG_LEVELS.INFO, 'Sistema de mensajería limpiado');
}

// ================== CONFIGURACIÓN DE LIMPIEZA AUTOMÁTICA ==================

// Limpiar mensajes expirados cada 30 segundos
if (typeof window !== 'undefined') {
  setInterval(limpiarMensajesExpirados, 30000);
}

// ================== EXPORTACIÓN POR DEFECTO ==================

/**
 * Objeto principal del sistema de mensajería
 */
const Mensajeria = {
  // Funciones principales
  inicializarMensajeria,
  enviarMensaje,
  enviarMensajeConReintenos: enviarMensaje, // ✅ ALIAS para compatibilidad
  registrarControlador,
  registrarManejador,
  
  // Funciones especializadas para mapa
  enviarComandoNavegacion,
  enviarComandoGPS,
  actualizarCoordenadasGPS,
  enviarComandoAudio,
  enviarReto,
  sincronizarEstado,
  habilitarControles,
  deshabilitarControles,
  
  // Gestión de iframes
  registrarIframe,
  obtenerIframesRegistrados,
  
  // Constantes
  TIPOS_MENSAJE,
  LOG_LEVELS,
  
  // Utilidades
  obtenerEstadisticas,
  limpiar,
  
  // Configuración
  configuracion: () => ({ ...configuracion }),
  enviarConfiguracion
};

// ================== MANEJADORES DE CONFIGURACIÓN ==================

/**
 * Envía una actualización de configuración a todos los iframes hijos
 * @param {Object} config - Configuración a enviar
 * @param {string} [config.tema] - Tema de la interfaz (claro/oscuro)
 * @param {string} [config.idioma] - Código de idioma (es, en, etc.)
 * @param {Object} [config.opciones] - Opciones adicionales de configuración
 * @returns {Promise<Array>} Respuestas de los iframes
 */
async function enviarConfiguracion(config) {
  const { tema, idioma, opciones } = config;
  
  // Validar que al menos un campo de configuración esté presente
  if (!tema && !idioma && !opciones) {
    throw new Error('Se debe proporcionar al menos un campo de configuración');
  }
  
  const mensaje = {
    tipo: TIPOS_MENSAJE.SISTEMA.CONFIGURACION,
    datos: { tema, idioma, opciones },
    timestamp: Date.now()
  };
  
  try {
    const respuestas = await enviarATodosLosIframes(mensaje, {
      esperarRespuesta: true,
      timeout: 5000
    });
    
    // Verificar si hubo errores en las respuestas
    const errores = respuestas.filter(r => r.error);
    if (errores.length > 0) {
      console.warn('Algunos iframes no aplicaron la configuración correctamente:', errores);
    }
    
    return respuestas;
    
  } catch (error) {
    console.error('Error al enviar configuración:', error);
    throw error;
  }
}

// Hacer la función disponible en la API
export { enviarConfiguracion };

// ================== MANEJADORES DE CONFIGURACIÓN ==================

/**
 * Maneja los mensajes de configuración del sistema
 * @param {Object} mensaje - Mensaje recibido
 * @returns {Promise<void>}
 */
async function manejarConfiguracionSistema(mensaje) {
  const { tema, idioma, opciones } = mensaje.datos || {};
  
  try {
    // Aplicar tema si se especificó
    if (tema) {
      document.documentElement.setAttribute('data-tema', tema);
      localStorage.setItem('tema', tema);
    }
    
    // Aplicar idioma si se especificó
    if (idioma) {
      document.documentElement.lang = idioma;
      localStorage.setItem('idioma', idioma);
    }
    
    // Aplicar opciones adicionales
    if (opciones) {
      // Ejemplo: Actualizar configuración de notificaciones
      if (opciones.notificaciones !== undefined) {
        // Lógica para manejar notificaciones
      }
      
      // Ejemplo: Actualizar configuración de accesibilidad
      if (opciones.accesibilidad) {
        // Aplicar ajustes de accesibilidad
      }
    }
    
    // Notificar que la configuración se aplicó correctamente
    await enviarRespuesta(mensaje, { 
      exito: true, 
      configuracion: { tema, idioma }
    });
    
  } catch (error) {
    console.error('Error al aplicar configuración:', error);
    await enviarRespuesta(mensaje, null, 'Error al aplicar configuración');
  }
}

// Registrar el manejador de configuración
registrarControlador(TIPOS_MENSAJE.SISTEMA.CONFIGURACION, manejarConfiguracionSistema);

// ================== COMPATIBILIDAD HACIA ATRÁS ==================
// Hacer las funciones disponibles globalmente con alias
if (typeof window !== 'undefined') {
  window.enviarMensaje = enviarMensaje;
  window.enviarMensajeConReintenos = enviarMensaje;
  window.registrarManejador = registrarManejador;
  window.registrarControlador = registrarControlador;
  window.inicializarMensajeria = inicializarMensajeria;
  window.TIPOS_MENSAJE = TIPOS_MENSAJE;
  
  // Funciones especializadas para el mapa
  window.enviarComandoNavegacion = enviarComandoNavegacion;
  window.enviarComandoGPS = enviarComandoGPS;
  window.actualizarCoordenadasGPS = actualizarCoordenadasGPS;
  window.enviarComandoAudio = enviarComandoAudio;
  window.enviarReto = enviarReto;
  window.sincronizarEstado = sincronizarEstado;
  window.habilitarControles = habilitarControles;
  window.deshabilitarControles = deshabilitarControles;
  
  // Registro de iframes
  window.registrarIframe = registrarIframe;
  window.obtenerIframesRegistrados = obtenerIframesRegistrados;
  
  // Compatibilidad con alias legacy
  window.mensajeria = Mensajeria;
  window.Mensajeria = Mensajeria;
}

export default Mensajeria;
