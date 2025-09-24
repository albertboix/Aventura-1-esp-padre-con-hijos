/**
 * Módulo de mensajería para comunicación entre iframes.
 * @module Mensajeria
 * @version 2.4.0
 */

// Importar dependencias
import { TIPOS_MENSAJE } from './constants.js';
import { configurarUtils, crearObjetoError } from './utils.js';
import logger from './logger.js';

// Estado interno de la mensajería
const estado = {
  iframeId: null,
  logLevel: 1,
  debug: false,
  manejadores: new Map(),
  iframes: [],
  inicializado: false,
  inicializando: false,
  reintentos: { 
    maximos: 3, 
    tiempoEspera: 1000, 
    factor: 2 
  },
  // Cache de instancias para evitar duplicados
  instancias: new Map()
};

// Configuración por defecto
const CONFIG_DEFAULT = {
  iframeId: 'unknown',
  logLevel: 1,  // INFO por defecto
  debug: false,
  reintentos: {
    maximos: 3,
    tiempoEspera: 1000,
    factor: 2
  }
};

// Estado de inicialización
let isLoggerInitialized = true; // Set to true since we're importing logger directly

/**
 * Obtiene o crea una instancia de mensajería
 * @param {Object} config - Configuración de la instancia
 * @returns {Object} Instancia de mensajería
 */
function obtenerInstancia(config = {}) {
  const id = config.iframeId || 'default';
  
  // Si ya existe una instancia para este ID, devolverla
  if (estado.instancias.has(id)) {
    return estado.instancias.get(id);
  }
  
  // Crear nueva instancia
  const instancia = {
    id,
    config: { ...CONFIG_DEFAULT, ...config },
    manejadores: new Map(),
    inicializado: false,
    inicializando: false
  };
  
  estado.instancias.set(id, instancia);
  return instancia;
}

/**
 * Inicializa el sistema de mensajería.
 * @param {Object} config - Configuración de mensajería
 * @returns {Promise<Object>} Instancia de mensajería inicializada
 */
// Función interna de inicialización
async function _inicializarMensajeria(config = {}) {
  // Inicializar logger si es necesario
  if (!isLoggerInitialized && typeof window !== 'undefined') {
    try {
      const loggerModule = await import('./logger.js');
      logger = loggerModule.default || loggerModule;
      isLoggerInitialized = true;
      logger.debug('[Mensajeria] Logger inicializado');
    } catch (error) {
      console.warn('No se pudo inicializar el logger:', error);
    }
  }
  
  const instancia = obtenerInstancia(config);
  
  // Si ya está inicializado o en proceso de inicialización
  if (instancia.inicializado) {
    logger.info(`[Mensajeria] Ya inicializado para iframe: ${instancia.id}`);
    return instancia;
  }
  
  if (instancia.inicializando) {
    logger.warn(`[Mensajeria] Inicialización ya en curso para iframe: ${instancia.id}`);
    return new Promise(resolve => {
      const checkInitialized = setInterval(() => {
        if (instancia.inicializado) {
          clearInterval(checkInitialized);
          resolve(instancia);
        }
      }, 100);
    });
  }
  
  // Marcar como inicializando
  instancia.inicializando = true;
  
  try {
    // Configurar estado global
    estado.iframeId = instancia.id;
    estado.logLevel = instancia.config.logLevel;
    estado.debug = instancia.config.debug;
    estado.iframes = instancia.config.iframes || [];
    estado.reintentos = { ...estado.reintentos, ...(instancia.config.reintentos || {}) };
    
    // Configurar utilidades
    configurarUtils({ 
      iframeId: instancia.id, 
      logLevel: instancia.config.logLevel, 
      debug: instancia.config.debug 
    });
    
    // Configurar logger
    if (logger.configure) {
      logger.configure({
        iframeId: instancia.id,
        logLevel: instancia.config.logLevel,
        debug: instancia.config.debug
      });
    }
    
    // Registrar manejador de mensajes una sola vez
    if (!estado.inicializado) {
      window.addEventListener('message', recibirMensaje, false);
      estado.inicializado = true;
    }
    
    // Marcar como inicializado
    instancia.inicializado = true;
    logger.info(`[Mensajeria] Inicializado para iframe: ${instancia.id}`);
    
    return instancia;
  } catch (error) {
    instancia.inicializando = false;
    logger.error(`[Mensajeria] Error al inicializar:`, error);
    throw error;
  }
}

/**
 * Registra un controlador para un tipo de mensaje.
 * @param {string} tipo - Tipo de mensaje.
 * @param {Function} manejador - Función manejadora.
 */
// Función interna para registrar controladores
function _registrarControlador(tipo, manejador) {
  estado.manejadores.set(tipo, manejador);
  logger.debug(`[Mensajeria] Controlador registrado para tipo: ${tipo}`);
}

/**
 * Envía un mensaje a un destino (iframe o 'padre').
 * @param {string} destino - ID del iframe destino o 'padre'/'todos'.
 * @param {string} tipo - Tipo de mensaje.
 * @param {Object} datos - Datos del mensaje.
 * @returns {Promise<Object>|undefined}
 */
// Función interna para enviar mensajes
async function _enviarMensaje(destino, tipo, datos = {}) {
  if (!destino || !tipo) {
    logger.error('[Mensajeria] Falta destino o tipo en enviarMensaje', { destino, tipo });
    return;
  }
  
  // Validar si estamos inicializados
  if (!estado.inicializado) {
    logger.warn('[Mensajeria] Intentando enviar mensaje sin inicializar');
    await inicializarMensajeria();
  }
  
  const mensaje = {
    origen: estado.iframeId,
    destino,
    tipo,
    datos,
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
  
  try {
    // Validar mensaje
    if (!validarMensaje(mensaje)) {
      throw new Error('Mensaje no válido');
    }
    
    // Enviar mensaje
    if (destino === 'padre') {
      // Enviar al padre
      window.parent.postMessage(mensaje, '*');
    } else if (destino === 'todos') {
      // Enviar a todos los iframes
      estado.iframes.forEach(iframe => {
        const frame = document.getElementById(iframe.id);
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage(mensaje, '*');
        }
      });
    } else {
      // Enviar a un iframe específico
      const frame = document.getElementById(destino);
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage(mensaje, '*');
      } else {
        throw new Error(`Destino no encontrado: ${destino}`);
      }
    }
    
    logger.debug(`[Mensajeria] Mensaje enviado:`, mensaje);
    return mensaje;
  } catch (error) {
    logger.error(`[Mensajeria] Error al enviar mensaje:`, error);
    throw error;
  }
}

// Función para filtrar mensajes externos (como Grammarly) que no siguen nuestro formato
function esMensajeExterno(msg) {
  // Detectar mensajes de Grammarly que contienen esta propiedad
  if (msg && msg.__grammarly) {
    console.debug('[Mensajería] Ignorando mensaje de Grammarly');
    return true;
  }
  
  // Otras extensiones o herramientas externas que pueden enviar mensajes
  if (msg && (
    msg.hasOwnProperty('_grammarly') || 
    msg.hasOwnProperty('grammarly_report') ||
    msg.hasOwnProperty('ext_id') ||
    msg.hasOwnProperty('extension_id')
  )) {
    console.debug('[Mensajería] Ignorando mensaje de extensión externa');
    return true;
  }
  
  return false;
}

// Función para validar el formato del mensaje
function validarMensaje(msg, source) {
  // Filtrar mensajes de extensiones externas como Grammarly
  if (esMensajeExterno(msg)) {
    return false;
  }
  
  // Verificar que sea un objeto
  if (!msg || typeof msg !== 'object') {
    logger.warn(`[${source || 'desconocido'}] [Mensajeria] Mensaje inválido: no es un objeto`, msg);
    return false;
  }
  
  // Verificar campos requeridos
  const requiredFields = ['tipo', 'datos'];
  const missingFields = requiredFields.filter(field => !msg.hasOwnProperty(field));
  
  if (missingFields.length > 0) {
    logger.warn(`[${source || 'desconocido'}] [Mensajeria] Mensaje inválido: faltan campos requeridos`, msg);
    return false;
  }
  
  return true;
}

/**
 * Recibe y procesa mensajes entrantes.
 * @param {MessageEvent} event - Evento de mensaje.
 */
function recibirMensaje(event) {
  const mensaje = event.data;
  
  try {
    // Validar mensaje
    if (!validarMensaje(mensaje)) {
      return;
    }
    
    // Verificar si el mensaje es para este iframe
    if (mensaje.destino !== 'todos' && 
        mensaje.destino !== estado.iframeId && 
        mensaje.destino !== 'padre') {
      return;
    }
    
    logger.debug(`[Mensajeria] Mensaje recibido:`, mensaje);
    
    // Buscar manejador para este tipo de mensaje
    const manejador = estado.manejadores.get(mensaje.tipo);
    if (manejador) {
      // Ejecutar manejador
      try {
        manejador(mensaje);
      } catch (error) {
        logger.error(`[Mensajeria] Error en manejador para ${mensaje.tipo}:`, error);
      }
    } else {
      logger.warn(`[Mensajeria] No hay manejador para el tipo: ${mensaje.tipo}`);
    }
  } catch (error) {
    logger.error('[Mensajeria] Error al procesar mensaje:', error);
  }
}

/**
 * Limpia los recursos de mensajería.
 */
function limpiarMensajeria() {
  if (estado.inicializado) {
    window.removeEventListener('message', recibirMensaje);
    estado.manejadores.clear();
    estado.iframes = [];
    estado.inicializado = false;
    estado.instancias.clear();
    logger.debug(`[Mensajeria] Recursos liberados para ${estado.iframeId}`);
  }
}

/**
 * Envía un mensaje y espera confirmación de recepción
 * @param {string} destino - ID del iframe destino o 'padre'/'todos'
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @param {Object} opciones - Opciones adicionales
 * @param {number} opciones.timeout - Timeout en ms para la confirmación (default: 5000)
 * @param {boolean} opciones.silencioso - No lanzar error si no hay confirmación (default: false)
 * @returns {Promise<Object>} - Confirmación recibida
 */
async function enviarMensajeConConfirmacion(destino, tipo, datos = {}, opciones = {}) {
  const timeout = opciones.timeout || 5000;
  const silencioso = opciones.silencioso || false;
  
  try {
    // Generar un ID único para este mensaje
    const mensajeId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Crear una promesa para esperar la confirmación
    const confirmacionPromise = new Promise((resolve, reject) => {
      // Manejador temporal para la confirmación
      const manejadorConfirmacion = (mensaje) => {
        if (mensaje.datos && mensaje.datos.mensajeOriginalId === mensajeId) {
          // Quitar el manejador temporal
          estado.manejadores.delete(`${TIPOS_MENSAJE.SISTEMA.CONFIRMACION}_${mensajeId}`);
          resolve(mensaje);
        }
      };
      
      // Registrar el manejador temporal
      estado.manejadores.set(`${TIPOS_MENSAJE.SISTEMA.CONFIRMACION}_${mensajeId}`, manejadorConfirmacion);
      
      // Configurar timeout
      setTimeout(() => {
        // Quitar el manejador temporal
        estado.manejadores.delete(`${TIPOS_MENSAJE.SISTEMA.CONFIRMACION}_${mensajeId}`);
        
        if (silencioso) {
          resolve(null); // Resolver con null si es silencioso
        } else {
          reject(new Error(`Timeout esperando confirmación para mensaje ${tipo} a ${destino}`));
        }
      }, timeout);
    });
    
    // Enviar el mensaje con el ID único
    await _enviarMensaje(destino, tipo, {
      ...datos,
      mensajeId
    });
    
    // Esperar confirmación
    return await confirmacionPromise;
  } catch (error) {
    logger.error(`Error en enviarMensajeConConfirmacion (${tipo} a ${destino}):`, error);
    
    if (silencioso) {
      return null;
    }
    
    throw error;
  }
}

/**
 * Envía una confirmación de recepción de mensaje
 * @param {Object} mensajeOriginal - Mensaje original recibido
 * @param {Object} datos - Datos adicionales para la confirmación
 * @returns {Promise<Object>} - Resultado del envío
 */
async function enviarConfirmacion(mensajeOriginal, datos = {}) {
  try {
    if (!mensajeOriginal || !mensajeOriginal.origen) {
      throw new Error('Mensaje original inválido');
    }
    
    // Usar TIPOS_MENSAJE importado
    return await _enviarMensaje(
      mensajeOriginal.origen,
      TIPOS_MENSAJE.SISTEMA.CONFIRMACION, // Corregido para usar la constante importada
      {
        ...datos,
        mensajeOriginalId: mensajeOriginal.datos?.mensajeId,
        tipoOriginal: mensajeOriginal.tipo,
        timestampOriginal: mensajeOriginal.timestamp,
        timestampConfirmacion: Date.now()
      }
    );
  } catch (error) {
    logger.error('Error al enviar confirmación:', error);
    throw error;
  }
}

/**
 * Envía una notificación de error como respuesta a un mensaje
 * @param {Object} mensajeOriginal - Mensaje original recibido
 * @param {Object} error - Información del error
 * @returns {Promise<Object>} - Resultado del envío
 */
async function enviarError(mensajeOriginal, error = {}) {
  try {
    if (!mensajeOriginal || !mensajeOriginal.origen) {
      throw new Error('Mensaje original inválido');
    }
    
    return await _enviarMensaje(
      mensajeOriginal.origen,
      TIPOS_MENSAJE.SISTEMA.ERROR,
      {
        mensajeOriginalId: mensajeOriginal.datos?.mensajeId,
        tipoOriginal: mensajeOriginal.tipo,
        timestampOriginal: mensajeOriginal.timestamp,
        timestampError: Date.now(),
        error: {
          mensaje: error.mensaje || error.message || 'Error desconocido',
          codigo: error.codigo || 'ERROR_DESCONOCIDO',
          detalles: error.detalles || error.stack || null
        }
      }
    );
  } catch (err) {
    logger.error('Error al enviar notificación de error:', err);
    throw err;
  }
}

// Asumiendo que este es el archivo de mensajería original
// Añadimos un sistema de monitoreo para rastrear todos los mensajes

// Configuración global del monitor de mensajes
const MSG_MONITOR = {
    enabled: true,              // Activar/desactivar monitorización
    toConsole: true,            // Mostrar mensajes en consola
    toDebugOverlay: true,       // Mostrar en overlay de debug si está disponible
    logLevel: 'debug',          // 'debug', 'info', 'warn', 'error'
    filterByType: null,         // Filtrar por tipo de mensaje (ej: 'AUDIO.REPRODUCIR')
    filterByOrigin: null,       // Filtrar por origen (ej: 'hijo5-casa')
    filterByDestination: null,  // Filtrar por destino (ej: 'hijo3')
    maxLogLength: 100,          // Máximo número de mensajes a mantener en memoria
    logMessages: []             // Historial de mensajes
};

// Función para registrar mensajes en el monitor
function logMessage(direction, destination, type, data, error = null) {
    if (!MSG_MONITOR.enabled) return;
    
    // Filtrar mensajes según configuración
    if (MSG_MONITOR.filterByType && type !== MSG_MONITOR.filterByType) return;
    if (MSG_MONITOR.filterByOrigin && direction === 'RECIBIDO' && data.origen !== MSG_MONITOR.filterByOrigin) return;
    if (MSG_MONITOR.filterByDestination && direction === 'ENVIADO' && destination !== MSG_MONITOR.filterByDestination) return;
    
    // Crear objeto de mensaje para el log
    const now = new Date();
    const timestamp = now.toISOString();
    const shortTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    
    const logEntry = {
        direction,      // 'ENVIADO' o 'RECIBIDO'
        timestamp,      // Marca de tiempo ISO
        shortTime,      // Hora legible HH:MM:SS.mmm
        destination,    // Destino del mensaje o origen si es recibido
        type,           // Tipo de mensaje
        data,           // Datos del mensaje
        error           // Error si hubo alguno
    };
    
    // Guardar en el historial de mensajes
    MSG_MONITOR.logMessages.push(logEntry);
    
    // Mantener el historial dentro del límite
    if (MSG_MONITOR.logMessages.length > MSG_MONITOR.maxLogLength) {
        MSG_MONITOR.logMessages.shift();
    }
    
    // Formatear mensaje para consola
    let consoleMsg = `[${shortTime}] ${direction} ${direction === 'ENVIADO' ? 'a' : 'de'} ${destination}: ${type}`;
    const logColor = error ? 'color: red;' : (direction === 'ENVIADO' ? 'color: #4caf50;' : 'color: #2196f3;');
    
    // Mostrar en consola si está activado
    if (MSG_MONITOR.toConsole) {
        console.groupCollapsed(`%c${consoleMsg}`, logColor);
        console.log('Datos:', data);
        if (error) console.error('Error:', error);
        console.log('Timestamp:', timestamp);
        console.groupEnd();
    }
    
    // Mostrar en overlay de debug si está disponible y activado
    if (MSG_MONITOR.toDebugOverlay && window.debugLog) {
        const msgData = error ? { ...data, error: error.message || 'Error desconocido' } : data;
        window.debugLog(`${direction} ${direction === 'ENVIADO' ? 'a' : 'de'} ${destination}: ${type}`, msgData);
    }
    
    return logEntry;
}

// Exponer función para obtener el historial de mensajes
function getMensajesLog() {
    return [...MSG_MONITOR.logMessages];
}

// Exponer función para limpiar el historial
function limpiarMensajesLog() {
    MSG_MONITOR.logMessages = [];
    return true;
}

// Exponer función para configurar el monitor
function configurarMonitor(config = {}) {
    Object.assign(MSG_MONITOR, config);
    console.log('Monitor de mensajes configurado:', MSG_MONITOR);
    return MSG_MONITOR;
}

// Sistema de monitoreo de mensajería para diagnóstico
let mensajeriaMonitor = {
    habilitado: true,
    logLevel: 'debug', // 'debug', 'info', 'warn', 'error', 'none'
    historial: [],
    maxHistorial: 100,
    
    registrarMensaje(direccion, destino, tipo, datos, resultado) {
        if (!this.habilitado) return;
        
        // Crear entrada de log
        const entrada = {
            timestamp: Date.now(),
            direccion, // 'enviado' o 'recibido'
            destino,   // ID del iframe destino o origen
            tipo,      // Tipo de mensaje
            datos,     // Datos del mensaje
            resultado, // Resultado de la operación (para envíos)
            error: null // Error si ocurrió
        };
        
        // Registrar error si existe
        if (resultado && resultado.error) {
            entrada.error = resultado.error;
        }
        
        // Añadir al historial y limitar tamaño
        this.historial.push(entrada);
        if (this.historial.length > this.maxHistorial) {
            this.historial.shift();
        }
        
        // Logging según nivel configurado
        if (this.logLevel === 'none') return;
        
        const logMethod = entrada.error ? 'error' : 
                         (this.logLevel === 'debug' ? 'debug' : 'log');
        
        const emoji = direccion === 'enviado' ? '📤' : '📥';
        const dirText = direccion === 'enviado' ? 'ENVIADO A' : 'RECIBIDO DE';
        
        console[logMethod](
            `${emoji} [MENSAJERÍA] ${dirText} ${destino}: ${tipo}`, 
            datos, 
            resultado || ''
        );
        
        // Logging adicional en debug
        if (this.logLevel === 'debug' && window.debugLog) {
            window.debugLog(`${emoji} ${dirText} ${destino}: ${tipo}`);
        }
    },
    
    // Obtener estadísticas de comunicación
    obtenerEstadisticas() {
        if (this.historial.length === 0) {
            return { mensaje: "No hay mensajes registrados" };
        }
        
        const stats = {
            totalMensajes: this.historial.length,
            enviados: this.historial.filter(m => m.direccion === 'enviado').length,
            recibidos: this.historial.filter(m => m.direccion === 'recibido').length,
            errores: this.historial.filter(m => m.error).length,
            porDestino: {},
            porTipo: {}
        };
        
        // Agrupar por destino
        this.historial.forEach(m => {
            stats.porDestino[m.destino] = (stats.porDestino[m.destino] || 0) + 1;
            stats.porTipo[m.tipo] = (stats.porTipo[m.tipo] || 0) + 1;
        });
        
        return stats;
    },
    
    // Limpiar historial
    limpiar() {
        this.historial = [];
        console.log('🧹 [MENSAJERÍA] Historial de mensajes limpiado');
    }
};

// Exportamos el monitor para que esté disponible globalmente
window.mensajeriaMonitor = mensajeriaMonitor;

// Función para interceptar envíos de mensajes
const enviarMensajeOriginal = enviarMensaje;
enviarMensaje = async function(destinoId, tipo, datos) {
    try {
        const resultado = await enviarMensajeOriginal(destinoId, tipo, datos);
        // Registrar después de enviar
        mensajeriaMonitor.registrarMensaje('enviado', destinoId, tipo, datos, resultado);
        return resultado;
    } catch (error) {
        // Registrar error
        mensajeriaMonitor.registrarMensaje('enviado', destinoId, tipo, datos, { error });
        throw error;
    }
};

// Modificar el procesador de mensajes para interceptar mensajes recibidos
const procesarMensajeOriginal = procesarMensaje;
procesarMensaje = function(event) {
    try {
        const origen = event.source === window ? 'ventana_principal' : 
                      (event.source === parent ? 'padre' : 'desconocido');
        
        // Solo procesar mensajes válidos
        if (event.data && typeof event.data === 'object' && event.data.tipo) {
            mensajeriaMonitor.registrarMensaje('recibido', origen, event.data.tipo, event.data.datos);
        }
    } catch (e) {
        console.error('Error al registrar mensaje recibido:', e);
    }
    
    // Llamar al procesador original
    return procesarMensajeOriginal(event);
};

// El código original continúa...

// Exportar funciones de monitoreo
export { logMessage, getMensajesLog, limpiarMensajesLog, configurarMonitor };

// IMPORTANTE: Modificar las funciones existentes para incorporar el monitoreo

// Modificación de la función enviarMensaje original
export async function enviarMensaje(destino, tipo, datos) {
    try {
        // Código original de enviarMensaje
        // ... (tu implementación original aquí)
        
        // Añadir logging
        logMessage('ENVIADO', destino, tipo, datos);
        
        // Continúa con la implementación original
        
        // Al retornar la respuesta, también la logueamos
        // Si la función original ya devuelve algo, puedes hacer:
        // const respuesta = ... (código original para obtener respuesta)
        // logMessage('RECIBIDO', destino, `RESPUESTA_${tipo}`, respuesta);
        // return respuesta;
        
    } catch (error) {
        // Log del error
        logMessage('ERROR_ENVIO', destino, tipo, datos, error);
        throw error; // Re-lanzar el error para mantener comportamiento original
    }
}

// Modificación de la función que registra controladores de mensajes
export function registrarControlador(tipoMensaje, controlador) {
    // Crear un wrapper para el controlador que haga logging
    const controladorConLogging = (mensaje) => {
        // Log de mensaje recibido
        logMessage('RECIBIDO', mensaje.origen || 'desconocido', tipoMensaje, mensaje);
        
        try {
            // Llamar al controlador original
            const resultado = controlador(mensaje);
            
            // Si el controlador devuelve una promesa, logear el resultado cuando se resuelva
            if (resultado && typeof resultado.then === 'function') {
                resultado
                    .then(res => {
                        logMessage('RESPUESTA', mensaje.origen || 'desconocido', `RESPUESTA_${tipoMensaje}`, res);
                        return res; // Importante devolver el resultado para mantener la cadena de promesas
                    })
                    .catch(error => {
                        logMessage('ERROR_CONTROLADOR', mensaje.origen || 'desconocido', tipoMensaje, mensaje, error);
                        throw error; // Re-lanzar el error
                    });
            } else if (resultado) {
                // Si es una respuesta síncrona, logearla directamente
                logMessage('RESPUESTA', mensaje.origen || 'desconocido', `RESPUESTA_${tipoMensaje}`, resultado);
            }
            
            return resultado; // Devolver el resultado original
        } catch (error) {
            // Log del error
            logMessage('ERROR_CONTROLADOR', mensaje.origen || 'desconocido', tipoMensaje, mensaje, error);
            throw error; // Re-lanzar el error para mantener comportamiento original
        }
    };
    
    // Registrar el controlador con wrapper en lugar del original
    // Código original para registrar controlador, pero usando controladorConLogging
    // ... (tu implementación original aquí, reemplazando controlador por controladorConLogging)
}

// Si hay una función para inicializar el sistema de mensajería, también la modificamos
export function inicializarMensajeria(opciones = {}) {
    logMessage('SISTEMA', 'mensajeria', 'INICIALIZACION', opciones);
    
    // Código original de inicialización
    // ... (tu implementación original aquí)
    
    // Esto asume que tu función original devuelve algo o una promesa
    // const resultado = ... (código original)
    
    // Registramos el éxito de la inicialización
    // logMessage('SISTEMA', 'mensajeria', 'INICIALIZACION_COMPLETADA', { opciones, resultado });
    
    // return resultado;
}

// Esta sección asume que puedes tener un sistema de respaldo básico si falla la mensajería
function configurarRespaldoMensajeria() {
    // Añadir un event listener global como respaldo
    window.addEventListener('message', function(event) {
        try {
            const data = event.data;
            
            // Ignorar mensajes que no parecen ser parte de nuestro sistema
            if (!data || typeof data !== 'object' || (!data.tipo && !data.type)) {
                return;
            }
            
            // Identificar origen lo mejor posible
            let origen = 'desconocido';
            if (event.source) {
                // Intentar identificar el iframe de origen
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    if (event.source === iframe.contentWindow) {
                        origen = iframe.id || 'iframe-sin-id';
                        break;
                    }
                }
            }
            
            // Registrar en el sistema de monitoreo
            logMessage('RECIBIDO_RESPALDO', origen, data.tipo || data.type || 'MENSAJE_SIN_TIPO', data);
            
        } catch (e) {
            console.error('[MENSAJERIA_RESPALDO] Error al procesar mensaje:', e);
        }
    });
    
    logMessage('SISTEMA', 'mensajeria', 'RESPALDO_CONFIGURADO', { timestamp: new Date().toISOString() });
}

// Exportar función de respaldo para uso en situaciones de emergencia
export { configurarRespaldoMensajeria };

// Exportar la API pública
export async function inicializarMensajeria(config) {
    return await _inicializarMensajeria(config);
}

export function registrarControlador(tipo, manejador) {
    return _registrarControlador(tipo, manejador);
}

export async function enviarMensaje(destino, tipo, datos = {}) {
    return await _enviarMensaje(destino, tipo, datos);
}

// Re-export TIPOS_MENSAJE from constants.js
export { TIPOS_MENSAJE };

// Exportar las nuevas funciones
export {
    enviarMensajeConConfirmacion,
    enviarConfirmacion,
    enviarError
};

export default {
    inicializarMensajeria,
    registrarControlador,
    enviarMensaje,
    enviarMensajeConConfirmacion,
    enviarConfirmacion,
    enviarError,
    TIPOS_MENSAJE
};
