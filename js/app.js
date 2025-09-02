/**
 * Módulo principal de la aplicación
 * @version 1.0.0
 */

// Importar módulos
import { inicializarMensajeria, registrarControlador, enviarMensaje } from './mensajeria.js';
import { configurarUtils } from './utils.js';
import { CONFIG as CONFIG_SHARED } from './config.js';
import { LOG_LEVELS, TIPOS_MENSAJE, MODOS } from './constants.js';
import logger from './logger.js';

// Configuración global
export const CONFIG = {
  ...CONFIG_SHARED, // Heredar configuración compartida
  // Configuración específica de la aplicación
  ARCHIVO_PADRE: 'codigo-padre.html',  // Nombre del archivo HTML principal
  VERSION: '1.0.0',
  REINTENTOS: {
    MAXIMOS: 3,
    TIEMPO_ESPERA: 1000,
    FACTOR: 2
  },
  
  // Configuración de todos los iframes hijos
  HIJOS: {
    HAMBURGUESA: { id: 'hijo1-hamburguesa', nombre: 'Menú Hamburguesa', src: 'botones-y-subfunciones-hamburguesa.html' },
    OPCIONES:    { id: 'hijo1-opciones',    nombre: 'Opciones',         src: 'botones-y-subfunciones-opciones.html' },
    COORDENADAS: { id: 'hijo2',             nombre: 'Mapa',             src: 'Av1-botones-coordenadas.html' },
    AUDIO:       { id: 'hijo3',             nombre: 'Reproductor Audio', src: 'Av1_audio_esp.html' },
    RETOS:       { id: 'hijo4',             nombre: 'Retos',            src: 'Av1-esp-retos-preguntas.html' },
    CASA:        { id: 'hijo5-casa',        nombre: 'Casa',             src: 'Av1-boton-casa.html' }
  }
};

// Estado de la aplicación
const estadoApp = {
  inicializando: false,
  inicializado: false,
  modo: { actual: 'casa', anterior: null },
  gpsActivo: false,
  controlesHabilitados: true,
  puntoActual: null,
  tramoActual: null,
  mensajeriaInicializada: false,
  modulosCargados: false,
  mensajeria: null,
  mapa: null
};

// Inicializar el logger
configurarUtils({
  iframeId: CONFIG.IFRAME_ID,
  debug: CONFIG.DEBUG,
  logLevel: CONFIG.LOG_LEVEL
});

// Hacer utilidades disponibles globalmente
window.enviarMensaje = enviarMensaje;
window.TIPOS_MENSAJE = TIPOS_MENSAJE; // Ya importado de constants.js
window.logger = logger;

// Función para inicializar la mensajería
async function inicializarMensajeriaApp() {
  if (estadoApp.inicializando || estadoApp.inicializado) {
    logger.warn('La mensajería ya está inicializada o en proceso de inicialización');
    return;
  }

  estadoApp.inicializando = true;
  logger.info('Inicializando mensajería...');

  try {
    // Inicializar el módulo de mensajería
    await mensajeria.inicializarMensajeria({
      iframeId: CONFIG.IFRAME_ID,
      debug: CONFIG.DEBUG,
      logLevel: CONFIG.LOG_LEVEL,
      reintentos: {
        maximos: CONFIG.REINTENTOS.MAXIMOS,
        tiempoEspera: CONFIG.REINTENTOS.TIEMPO_ESPERA,
        factor: CONFIG.REINTENTOS.FACTOR
      },
      // Pasar información de los iframes hijos
      iframes: Object.values(CONFIG.HIJOS).map(hijo => ({
        id: hijo.id,
        nombre: hijo.nombre,
        src: hijo.src
      }))
    });

    estadoApp.mensajeriaInicializada = true;
    logger.info('Mensajería inicializada correctamente');
    
    // Registrar los iframes hijos en el estado de la aplicación
    estadoApp.hijos = { ...CONFIG.HIJOS };
    logger.info(`Iframes hijos registrados: ${Object.keys(estadoApp.hijos).join(', ')}`);
    
  } catch (error) {
    estadoApp.inicializando = false;
    notificarError('inicializacion_mensajeria', error);
    throw error;
  } finally {
    estadoApp.inicializando = false;
  }
}

// Función para notificar errores
async function notificarError(tipo, error) {
  // Usar el logger para registrar el error
  logger.error(`Error (${tipo}):`, error);
  
  // Enviar mensaje de error al padre si es necesario
  if (enviarMensaje) {
    try {
      await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
        tipo,
        mensaje: error.message,
        stack: error.stack,
        origen: CONFIG.IFRAME_ID,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      logger.error('Error al notificar error al padre:', e);
    }
  }
}

// Función para notificar inicialización exitosa
async function notificarInicializacion() {
  if (typeof enviarMensaje === 'function') {
    try {
      await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ESTADO, {
        tipo: 'inicializacion_completada',
        estado: 'listo',
        origen: CONFIG.IFRAME_ID,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error al notificar inicialización:', error);
    }
  }
}

// Manejador de mensaje PING
function manejarPing(mensaje) {
  logger.debug('PING recibido:', mensaje);
  return { estado: 'activo', timestamp: new Date().toISOString() };
}

// Manejador de cambio de modo
async function manejarCambioModo(mensaje) {
  try {
    const { modo } = mensaje.datos || {};
    logger.info(`Cambiando a modo: ${modo}`);
    // Implementar lógica de cambio de modo aquí
    return { exito: true, modo };
  } catch (error) {
    logger.error('Error al cambiar de modo:', error);
    throw error;
  }
}

// Función para registrar manejadores de mensajes
async function registrarManejadores() {
  try {
    logger.info('Registrando manejadores de mensajes...');
    
    if (typeof mensajeria.registrarControlador === 'function') {
      mensajeria.registrarControlador(TIPOS_MENSAJE.SISTEMA.PING, manejarPing);
      mensajeria.registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, manejarCambioModo);
    }
    
    logger.info('Manejadores de mensajes registrados correctamente');
    return true;
  } catch (error) {
    logger.error('Error al registrar manejadores:', error);
    throw error;
  }
}

// Inicialización principal de la aplicación
async function inicializar() {
  if (estadoApp.inicializado || estadoApp.inicializando) {
    logger.info('La aplicación ya está inicializada o en proceso');
    return;
  }

  try {
    estadoApp.inicializando = true;
    logger.info('Iniciando inicialización de la aplicación...');
    
    await inicializarMensajeriaApp();
    await registrarManejadores();
    await notificarInicializacion();
    
    estadoApp.inicializado = true;
    estadoApp.inicializando = false;
    
    logger.info('Aplicación inicializada correctamente');
    return true;
  } catch (error) {
    estadoApp.inicializando = false;
    await notificarError('inicializacion', error);
    throw error;
  }
}

/**
 * Inicializa la aplicación principal
 * @returns {Promise<boolean>} True si la inicialización fue exitosa
 */
export async function inicializarAplicacion() {
  if (estadoApp.inicializado || estadoApp.inicializando) {
    logger.warn('La aplicación ya está inicializada o en proceso de inicialización');
    return false;
  }

  try {
    estadoApp.inicializando = true;
    logger.info('Iniciando inicialización de la aplicación...');
    
    // 1. Inicializar mensajería
    await inicializarMensajeriaApp();
    
    // 2. Registrar manejadores de mensajes
    await registrarManejadores();
    
    // 3. Notificar que la aplicación está lista
    await notificarInicializacion();
    
    estadoApp.inicializado = true;
    estadoApp.inicializando = false;
    
    logger.info('Aplicación inicializada correctamente');
    return true;
    
  } catch (error) {
    const errorMsg = 'Error crítico al inicializar la aplicación: ' + error.message;
    logger.error(errorMsg, error);
    
    // Notificar error al sistema
    if (typeof enviarMensaje === 'function') {
      await enviarMensaje('*', TIPOS_MENSAJE.SISTEMA.ERROR, {
        tipo: 'inicializacion',
        mensaje: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }).catch(e => console.error('Error al notificar error:', e));
    }
    
    estadoApp.inicializando = false;
    throw error; // Re-lanzar para que el llamador sepa que hubo un error
  }
}

// Inicializar automáticamente si se carga este módulo directamente
if (typeof window !== 'undefined' && document.readyState !== 'loading') {
  // El DOM ya está listo, inicializar directamente
  inicializarAplicacion().catch(console.error);
} else if (typeof document !== 'undefined') {
  // Esperar a que el DOM esté listo
  document.addEventListener('DOMContentLoaded', () => {
    inicializarAplicacion().catch(console.error);
  });
}

// Exportar solo lo necesario
export {
  inicializar,
  notificarError,
  manejarCambioModo,
  CONFIG,
  estadoApp as estado
};
