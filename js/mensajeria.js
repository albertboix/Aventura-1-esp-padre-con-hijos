/**
 * Módulo de mensajería para comunicación entre iframes.
 * @module Mensajeria
 * @version 2.3.0
 */

// Cargar tipos de mensaje
async function loadTiposMensaje() {
  if (window.TIPOS_MENSAJE) return Promise.resolve();
  
  return new Promise((resolve) => {
    const tipos = {
      NAVEGACION: {
        INICIAR: 'navegacion.iniciar',
        INICIADA: 'navegacion.iniciada',
        CANCELADA: 'navegacion.cancelada',
        DESTINO_ESTABLECIDO: 'navegacion.destino_establecido',
        LLEGADA_DETECTADA: 'navegacion.llegada_detectada',
        ERROR: 'navegacion.error',
        SOLICITAR_DESTINO: 'navegacion.solicitar_destino',
        ESTADO: 'navegacion.estado',
        CAMBIO_PARADA: 'navegacion.cambio_parada'
      },
      SISTEMA: {
        ERROR: 'sistema.error',
        ESTADO: 'sistema.estado',
        CAMBIO_MODO: 'sistema.cambio_modo',
        COMPONENTE_LISTO: 'sistema.componente_listo'
      },
      CONTROL: {
        ESTADO: 'control.estado',
        HABILITAR: 'control.habilitar',
        DESHABILITAR: 'control.deshabilitar'
      }
    };
    
    window.TIPOS_MENSAJE = tipos;
    resolve();
  });
}

// Importar utilidades
import { configurarUtils, crearObjetoError } from './utils.js';

// Definir constantes internas para evitar dependencia circular
const INTERNAL_TIPOS_MENSAJE = Object.freeze({
  SISTEMA: Object.freeze({
    INICIALIZACION_COMPLETA: 'SISTEMA.INICIALIZACION_COMPLETA',
    ERROR: 'SISTEMA.ERROR',
    COMPONENTE_LISTO: 'SISTEMA.COMPONENTE_LISTO',
    CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
    ESTADO: 'SISTEMA.ESTADO',
    ACTUALIZACION_COMPLETADA: 'SISTEMA.ACTUALIZACION_COMPLETADA'
  }),
  NAVEGACION: Object.freeze({
    INICIAR: 'NAVEGACION.INICIAR',
    INICIADA: 'NAVEGACION.INICIADA',
    CANCELADA: 'NAVEGACION.CANCELADA',
    DESTINO_ESTABLECIDO: 'NAVEGACION.DESTINO_ESTABLECIDO',
    LLEGADA_DETECTADA: 'NAVEGACION.LLEGADA_DETECTADA',
    ERROR: 'NAVEGACION.ERROR',
    SOLICITAR_DESTINO: 'NAVEGACION.SOLICITAR_DESTINO',
    ESTADO: 'NAVEGACION.ESTADO',
    ESTABLECER_DESTINO: 'NAVEGACION.ESTABLECER_DESTINO',
    DETENER: 'NAVEGACION.DETENER',
    CAMBIO_PARADA: 'NAVEGACION.CAMBIO_PARADA',
    ACTUALIZAR_UBICACION: 'NAVEGACION.ACTUALIZAR_UBICACION'
  }),
  CONTROL: Object.freeze({
    ESTADO: 'CONTROL.ESTADO',
    HABILITAR: 'CONTROL.HABILITAR',
    DESHABILITAR: 'CONTROL.DESHABILITAR'
  })
});

// Exportar una copia de las constantes internas
export const TIPOS_MENSAJE = JSON.parse(JSON.stringify(INTERNAL_TIPOS_MENSAJE));

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

// Logger por defecto (se actualizará después de la inicialización)
let logger = {
  debug: console.debug.bind(console),
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

// Estado de inicialización
let isLoggerInitialized = false;

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

/**
 * Valida un mensaje entrante.
 * @param {Object} mensaje - Mensaje a validar.
 * @returns {Boolean} True si el mensaje es válido, false de lo contrario.
 */
function validarMensaje(mensaje) {
  if (!mensaje) return false;
  
  const { origen, destino, tipo, timestamp, version } = mensaje;
  
  // Validar campos requeridos
  if (!origen || !destino || !tipo || !timestamp || !version) {
    logger.warn('[Mensajeria] Mensaje inválido: faltan campos requeridos', mensaje);
    return false;
  }
  
  // Validar tipos
  if (typeof origen !== 'string' || 
      typeof destino !== 'string' || 
      typeof tipo !== 'string' || 
      typeof timestamp !== 'string' || 
      typeof version !== 'string') {
    logger.warn('[Mensajeria] Mensaje inválido: tipos incorrectos', mensaje);
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

// Limpiar al cerrar la página
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', limpiarMensajeria);
  
  // Inicialización automática solo si no hay un módulo de sistema de módulos
  if (!window.mensajeriaInicializada && !window.__esModule) {
    window.mensajeriaInicializada = true;
    
    // Cargar TIPOS_MENSAJE para el contexto global
    loadTiposMensaje().then(() => {
      // Configurar manejador de mensajes global
      const messageHandler = (event) => {
        if (event.data && event.data.tipo && estado.manejadores.has(event.data.tipo)) {
          recibirMensaje(event);
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Limpiar el manejador al desmontar
      window.addEventListener('beforeunload', () => {
        window.removeEventListener('message', messageHandler);
      });
    });
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

export default {
  inicializarMensajeria,
  registrarControlador,
  enviarMensaje,
  TIPOS_MENSAJE
};
