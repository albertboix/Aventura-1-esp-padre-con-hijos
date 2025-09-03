/**
 * Módulo principal de la aplicación
 * @version 1.0.0
 */

// Importar módulos
import { 
  inicializarMensajeria, 
  registrarControlador, 
  enviarMensaje,
  TIPOS_MENSAJE 
} from './mensajeria.js';
import { configurarUtils } from './utils.js';
import { CONFIG as CONFIG_SHARED } from './config.js';
import { LOG_LEVELS, MODOS } from './constants.js';
import logger from './logger.js';

// Configuración global
const CONFIG = {
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
  // Estado de inicialización
  inicializando: false,
  inicializado: false,
  
  // Estado de la aplicación
  modo: { 
    actual: 'casa', 
    anterior: null,
    ultimoCambio: null
  },
  
  // Estado de los servicios
  gpsActivo: false,
  controlesHabilitados: true,
  mensajeriaInicializada: false,
  modulosCargados: false,
  
  // Estado de navegación
  puntoActual: null,
  tramoActual: null,
  
  // Referencias
  mensajeria: null,
  mapa: null,
  
  // Último error
  ultimoError: null,
  
  // Versión
  version: '1.0.0'
};

// Inicializar el logger
configurarUtils({
  iframeId: CONFIG.IFRAME_ID,
  debug: CONFIG.DEBUG,
  logLevel: CONFIG.LOG_LEVEL
});

// Hacer utilidades disponibles globalmente
// Estas se configurarán después de inicializar la mensajería

// Función para inicializar la mensajería
async function inicializarMensajeriaApp() {
  if (estadoApp.inicializando || estadoApp.inicializado) {
    logger.warn('La mensajería ya está inicializada o en proceso de inicialización');
    return;
  }

  estadoApp.inicializando = true;
  logger.info('Inicializando mensajería...');

  try {
    // Importar dinámicamente para evitar circular dependencies
    const mensajeriaModule = await import('./mensajeria.js');
    
    // Inicializar el módulo de mensajería centralizado
    await mensajeriaModule.inicializarMensajeria({
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

    // Configurar utilidades globales
    window.enviarMensaje = mensajeriaModule.enviarMensaje;
    window.registrarControlador = mensajeriaModule.registrarControlador;
    window.TIPOS_MENSAJE = TIPOS_MENSAJE;
    
    // Configurar estado
    estadoApp.mensajeriaInicializada = true;
    estadoApp.mensajeria = mensajeriaModule;
    
    logger.info('Mensajería inicializada correctamente');
    
    // Registrar los iframes hijos en el estado de la aplicación
    estadoApp.hijos = { ...CONFIG.HIJOS };
    logger.info(`Iframes hijos registrados: ${Object.keys(estadoApp.hijos).join(', ')}`);
    
    // Notificar que la mensajería está lista
    await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.INICIALIZACION_COMPLETA, {
      componente: 'app',
      estado: 'mensajeria_lista'
    });
    
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
  if (estadoApp.inicializando || estadoApp.inicializado) {
    logger.warn('La aplicación ya está inicializada o en proceso de inicialización');
    return;
  }

  estadoApp.inicializando = true;
  logger.info('Inicializando aplicación...');

  try {
    // 1. Inicializar mensajería primero
    await inicializarMensajeriaApp();
    
    // 2. Registrar manejadores de mensajes
    registrarManejadores();
    
    // 3. Notificar que la aplicación está lista
    await notificarInicializacion();
    
    // 4. Configurar estado
    estadoApp.inicializado = true;
    logger.info('Aplicación inicializada correctamente');
    
    // 5. Notificar al padre que la aplicación está lista
    if (window.enviarMensaje) {
      await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.INICIALIZACION_COMPLETA, {
        componente: 'app',
        estado: 'aplicacion_lista',
        timestamp: new Date().toISOString()
      });
    } else {
      logger.warn('No se pudo notificar al padre: enviarMensaje no está disponible');
    }
    
  } catch (error) {
    const errorInfo = {
      mensaje: error.message,
      stack: error.stack,
      tipo: 'inicializacion',
      timestamp: new Date().toISOString()
    };
    
    logger.error('Error durante la inicialización:', errorInfo);
    
    // Intentar notificar el error al padre si es posible
    if (window.enviarMensaje) {
      try {
        await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
          ...errorInfo,
          origen: CONFIG.IFRAME_ID || 'app'
        });
      } catch (e) {
        console.error('No se pudo notificar el error al padre:', e);
      }
    }
    
    estadoApp.inicializando = false;
    throw error;
  } finally {
    if (!estadoApp.inicializado) {
      estadoApp.inicializando = false;
    }
  }
}

/**
 * Inicializa la aplicación principal
 * @returns {Promise<boolean>} True si la inicialización fue exitosa
 */
export async function inicializarAplicacion() {
  if (estadoApp.inicializando) {
    if (CONFIG.DEBUG) console.debug('[App] Inicialización ya en curso');
    return false;
  }
  
  if (estadoApp.inicializado) {
    if (CONFIG.DEBUG) console.debug('[App] Ya inicializado');
    return true;
  }
  
  estadoApp.inicializando = true;
  estadoApp.ultimoError = null;
  
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
    const errorInfo = {
      mensaje: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    estadoApp.ultimoError = errorInfo;
    console.error('[App] Error en inicialización:', errorInfo);
    
    // Notificar el error al padre si es posible
    if (estadoApp.mensajeriaInicializada) {
      try {
        await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
          tipo: 'inicializacion',
          error: errorInfo
        });
      } catch (e) {
        console.error('[App] Error al notificar error de inicialización:', e);
      }
    }
    
    return false;
  } finally {
    estadoApp.inicializando = false;
  }
}

// Exportar la configuración
export { CONFIG };

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

// Hacer CONFIG disponible globalmente para compatibilidad
window.CONFIG = CONFIG;

// Exportar solo lo necesario
export {
  inicializar,
  notificarError,
  manejarCambioModo,
  estadoApp as estado
};

// No exportar CONFIG directamente para evitar duplicados
