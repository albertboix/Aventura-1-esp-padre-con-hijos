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
