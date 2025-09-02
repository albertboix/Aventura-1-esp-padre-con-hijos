/**
 * Módulo de mensajería para comunicación entre iframes.
 * @module Mensajeria
 * @version 2.1.1
 */

/**
 * Módulo de mensajería para comunicación entre iframes.
 * @version 2.1.1
 */

// Importar utilidades y configuración
import { configurarUtils, crearObjetoError } from './utils.js';
import { TIPOS_MENSAJE } from './constants.js';
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

// Export all functions at the bottom to avoid duplicate exports

/**
 * Inicializa el sistema de mensajería.
 * @param {Object} config - Configuración de mensajería.
 */
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
  
  // Guardar instancia
  estado.instancias.set(id, instancia);
  return instancia;
}

/**
 * Inicializa el sistema de mensajería
 * @param {Object} config - Configuración de mensajería
 * @returns {Promise<Object>} Instancia de mensajería inicializada
 */
async function inicializarMensajeria(config = {}) {
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
    logger.configure({
      iframeId: instancia.id,
      logLevel: instancia.config.logLevel,
      debug: instancia.config.debug
    });
    
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
  
  logger.info(`Mensajería inicializada para ${estado.iframeId}`);
}

/**
 * Registra un controlador para un tipo de mensaje.
 * @param {string} tipo - Tipo de mensaje.
 * @param {Function} manejador - Función manejadora.
 */
function registrarControlador(tipo, manejador) {
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
async function enviarMensaje(destino, tipo, datos = {}) {
  if (!destino || !tipo) {
    logger.error('[Mensajeria] Falta destino o tipo en enviarMensaje', { destino, tipo });
    return;
  }

  const mensaje = {
    origen: estado.iframeId,
    destino,
    tipo,
    datos,
    timestamp: Date.now()
  };

  // Si el mensaje es de cambio de modo, añade el estado del GPS
  if (tipo === TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO && datos.modo) {
    mensaje.datos.gpsActivo = datos.modo === 'aventura';
  }

  // Envío a todos los iframes
  if (destino === 'todos') {
    const promesas = [];
    
    // Enviar al padre si es necesario
    if (window.parent !== window) {
      promesas.push(
        new Promise(resolve => {
          window.parent.postMessage(mensaje, '*');
          resolve();
        })
      );
    }
    
    // Enviar a todos los iframes hijos
    estado.iframes.forEach(iframe => {
      const el = document.getElementById(iframe.id);
      if (el && el.contentWindow) {
        promesas.push(
          new Promise(resolve => {
            el.contentWindow.postMessage(mensaje, '*');
            resolve();
          })
        );
      }
    });
    
    return Promise.all(promesas)
      .then(() => ({ exito: true }))
      .catch(error => ({
        exito: false,
        error: 'Error al enviar mensajes a todos los destinos',
        detalles: error
      }));
  }

  // Envío al padre
  if (destino === 'padre') {
    if (window.parent !== window) {
      window.parent.postMessage(mensaje, '*');
    } else {
      logger.warn('[Mensajeria] No hay window.parent para enviar mensaje al padre');
    }
    return { exito: true };
  }

  // Envío a un iframe hijo específico
  const iframe = document.getElementById(destino);
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(mensaje, '*');
    return;
  }

  logger.warn(`[Mensajeria] No se encontró destino: ${destino}`);
}

/**
 * Valida un mensaje entrante.
 * @param {Object} mensaje - Mensaje a validar.
 * @returns {Boolean} True si el mensaje es válido, false de lo contrario.
 */
function validarMensaje(mensaje) {
  if (!mensaje) {
    if (estado.debug) console.debug('[Mensajeria] Mensaje vacío recibido');
    return false;
  }
  
  const requeridos = ['tipo', 'datos', 'origen', 'destino'];
  const faltantes = requeridos.filter(campo => mensaje[campo] === undefined);
  
  if (faltantes.length > 0) {
    if (estado.debug) console.warn(`[Mensajeria] Mensaje inválido, campos faltantes: ${faltantes.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Recibe y procesa mensajes entrantes.
 * @param {MessageEvent} event - Evento de mensaje.
 */
function recibirMensaje(event) {
  try {
    const mensaje = event.data;
    
    // Validar el mensaje
    if (!validarMensaje(mensaje)) {
      if (estado.debug) console.debug('[Mensajeria] Mensaje ignorado - validación fallida:', mensaje);
      return;
    }
    
    // Verificar si el mensaje es para este iframe
    if (mensaje.destino !== estado.iframeId && mensaje.destino !== 'todos') {
      if (estado.debug) console.debug(`[Mensajeria] Mensaje ignorado - destino incorrecto (${mensaje.destino})`);
      return;
    }
    
    if (!mensaje || !mensaje.tipo) {
      logger.warn('[Mensajeria] Mensaje recibido sin tipo', mensaje);
      return;
    }
    if (estado.debug) logger.debug(`[Mensajeria] Recibido: ${mensaje.tipo}`, mensaje);

    const manejador = estado.manejadores.get(mensaje.tipo);
    if (!manejador) {
      logger.warn(`[Mensajeria] No hay manejador para tipo: ${mensaje.tipo}`);
      return;
    }

    try {
      const resultado = manejador(mensaje);
      // Si el manejador retorna una promesa, manejar errores
      if (resultado && typeof resultado.then === 'function') {
        resultado.catch(error => {
          logger.error(`[Mensajeria] Error en manejador de ${mensaje.tipo}:`, error);
        });
      }
    } catch (error) {
      logger.error(`[Mensajeria] Error en manejador de ${mensaje.tipo}:`, error);
    }
  } catch (error) {
    logger.error(`[Mensajeria] Error en recibirMensaje:`, error);
  }
}

// Limpiar recursos de mensajería
function limpiarMensajeria() {
  if (estado.inicializado) {
    window.removeEventListener('message', recibirMensaje);
    estado.manejadores.clear();
    estado.iframes = [];
    estado.inicializado = false;
    if (estado.debug) console.debug(`[Mensajeria] Recursos liberados para ${estado.iframeId}`);
  }
}

// Limpiar al cerrar la página
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', limpiarMensajeria);
}

// Export all functions in a single statement
export {
  inicializarMensajeria,
  registrarControlador,
  enviarMensaje,
  recibirMensaje,
  limpiarMensajeria,
  TIPOS_MENSAJE
};
