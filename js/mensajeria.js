/**
 * Módulo de mensajería para comunicación entre iframes.
 * @module Mensajeria
 * @version 2.1.0
 */

// Importar el logger y utilidades
import { logger, TIPOS_MENSAJE, configurarUtils, crearObjetoError } from './utils.js';

// Estado interno de la mensajería
const estado = {
  iframeId: null,
  logLevel: 1,
  debug: false,
  manejadores: new Map(),
  iframes: [],
  inicializado: false,
  reintentos: { maximos: 3, tiempoEspera: 1000, factor: 2 }
};

/**
 * Inicializa el sistema de mensajería.
 * @param {Object} config - Configuración de mensajería.
 */
export async function inicializarMensajeria(config = {}) {
  if (estado.inicializado) return;
  estado.iframeId = config.iframeId || 'unknown';
  estado.logLevel = config.logLevel ?? 1;
  estado.debug = config.debug ?? false;
  estado.iframes = config.iframes || [];
  estado.reintentos = config.reintentos || estado.reintentos;
  configurarUtils({ iframeId: estado.iframeId, logLevel: estado.logLevel, debug: estado.debug });
  window.addEventListener('message', recibirMensaje, false);
  estado.inicializado = true;
  logger.info(`[Mensajeria] Inicializada para ${estado.iframeId}`);
}

/**
 * Registra un controlador para un tipo de mensaje.
 * @param {string} tipo - Tipo de mensaje.
 * @param {Function} manejador - Función manejadora.
 */
export function registrarControlador(tipo, manejador) {
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
export async function enviarMensaje(destino, tipo, datos = {}) {
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
    if (window.parent !== window) {
      window.parent.postMessage(mensaje, '*');
    }
    estado.iframes.forEach(iframe => {
      const el = document.getElementById(iframe.id);
      if (el && el.contentWindow) {
        el.contentWindow.postMessage(mensaje, '*');
      }
    });
    return;
  }

  // Envío al padre
  if (destino === 'padre') {
    if (window.parent !== window) {
      window.parent.postMessage(mensaje, '*');
    }
    return;
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
 * Recibe y procesa mensajes entrantes.
 * @param {MessageEvent} event - Evento de mensaje.
 */
function recibirMensaje(event) {
  const msg = event.data;
  if (!msg || !msg.tipo) return;
  if (estado.debug) logger.debug(`[Mensajeria] Recibido: ${msg.tipo}`, msg);

  const manejador = estado.manejadores.get(msg.tipo);
  if (typeof manejador === 'function') {
    try {
      const resultado = manejador(msg);
      // Si el manejador retorna una promesa, manejar errores
      if (resultado && typeof resultado.then === 'function') {
        resultado.catch(error => {
          logger.error(`[Mensajeria] Error en manejador de ${msg.tipo}:`, error);
        });
      }
    } catch (error) {
      logger.error(`[Mensajeria] Error en manejador de ${msg.tipo}:`, error);
    }
  } else {
    logger.warn(`[Mensajeria] No hay manejador para tipo: ${msg.tipo}`);
  }
}

// Exportar tipos de mensaje y logger
export { TIPOS_MENSAJE, logger, configurarUtils, crearObjetoError };
