/**
 * Módulo principal de la aplicación que gestiona el estado global y la lógica de negocio.
 * @version 2.1.0
 */

// 1. Importar dependencias
import { MODOS, TIPOS_MENSAJE } from './constants.js';
import logger from './logger.js';
import { registrarControlador, enviarMensaje, inicializarMensajeria } from './mensajeria.js';
import { CONFIG } from './config.js';

// 3. Estado unificado de la aplicación
export const estado = {
  // Estado de inicialización
  inicializado: false,
  inicializando: false,
  ultimoError: null,
  
  // Estado de la aplicación
  modo: {
    actual: MODOS.CASA,
    anterior: null,
    ultimoCambio: null
  },
  
  // Estado de los servicios
  gpsActivo: false,
  controlesHabilitados: true,
  mensajeriaInicializada: false,
  
  // Estado de navegación
  puntoActual: AVENTURA_PARADAS[0],
  tramoActual: null,
  
  // Referencias
  mensajeria: null,
  
  // Versión
  version: '2.1.0'
};

// 4. Manejadores de Lógica de Negocio
async function manejarCambioModo(mensaje) {
  const { modo } = mensaje.datos;
  if (modo && estado.modo !== modo) {
    logger.info(`🔄 Cambiando modo de '${estado.modo}' a '${modo}'`);
    estado.modo = modo;
    estado.gpsActivo = (modo === MODOS.AVENTURA);
    
    // Notificar a todos los iframes sobre el cambio de modo
    await enviarMensaje('todos', TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, { 
        modo: estado.modo,
        gpsActivo: estado.gpsActivo 
    });
  }
}

async function manejarSolicitudDestino(mensaje) {
    // Lógica para avanzar al siguiente punto en la aventura
    const indiceActual = AVENTURA_PARADAS.findIndex(p => p.id === estado.puntoActual.id);
    const siguienteIndice = (indiceActual + 1) % AVENTURA_PARADAS.length;
    estado.puntoActual = AVENTURA_PARADAS[siguienteIndice];

    logger.info(`📍 Nuevo destino: ${estado.puntoActual.nombre}`);

    // Notificar a todos los hijos del nuevo punto
    await enviarMensaje('todos', TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA, { punto: estado.puntoActual });
}

// 5. Inicialización del módulo
export async function inicializar() {
  if (estado.inicializado || estado.inicializando) {
    logger.warn('La aplicación ya está inicializada o en proceso de inicialización');
    return;
  }

  estado.inicializando = true;
  logger.info('🧠 Inicializando aplicación...');

  try {
    // Inicializar mensajería
    await inicializarMensajeria({
      iframeId: CONFIG.IFRAME_ID,
      debug: CONFIG.DEBUG,
      logLevel: CONFIG.LOG_LEVEL
    });

    // Registrar manejadores
    registrarControlador(TIPOS_MENSAJE.SISTEMA.PING, manejarPing);
    registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, manejarCambioModo);
    registrarControlador(TIPOS_MENSAJE.NAVEGACION.SOLICITAR_DESTINO, manejarSolicitudDestino);

    // Actualizar estado
    estado.inicializado = true;
    estado.mensajeriaInicializada = true;
    
    logger.info('✅ Aplicación inicializada correctamente');
    
    // Notificar inicialización exitosa
    await notificarInicializacion();
    
    return true;
  } catch (error) {
    await notificarError('inicializacion', error);
    throw error;
  } finally {
    estado.inicializando = false;
  }
}

// 6. Manejadores de mensajes

/**
 * Maneja el mensaje PING para verificar la conectividad
 */
function manejarPing(mensaje) {
  logger.debug('PING recibido:', mensaje);
  return { 
    estado: 'activo', 
    timestamp: new Date().toISOString(),
    version: estado.version
  };
}

// 7. Funciones de utilidad

/**
 * Inicializa la mensajería de la aplicación
 */
async function inicializarMensajeriaApp() {
  if (estado.inicializando || estado.inicializado) {
    logger.warn('La mensajería ya está inicializada o en proceso de inicialización');
    return;
  }

  logger.info('Inicializando mensajería...');

  try {
    // Inicializar el módulo de mensajería
    await inicializarMensajeria({
      iframeId: CONFIG.IFRAME_ID,
      debug: CONFIG.DEBUG,
      logLevel: CONFIG.LOG_LEVEL,
      reintentos: CONFIG.REINTENTOS
    });

    logger.info('Mensajería inicializada correctamente');
    return true;
  } catch (error) {
    await notificarError('inicializacion_mensajeria', error);
    throw error;
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

// Inicialización automática cuando se carga el módulo directamente
if (typeof window !== 'undefined' && !window.__esModule) {
  (async () => {
    try {
      // 1. Configurar utilidades
      configurarUtils({
        debug: CONFIG.DEBUG,
        logLevel: CONFIG.LOG_LEVEL,
        reintentos: CONFIG.REINTENTOS
      });

      // 2. Configurar logger
      logger.configure({
        level: CONFIG.LOG_LEVEL,
        debug: CONFIG.DEBUG
      });

      // 3. Inicializar mensajería
      await inicializarMensajeria({
        iframeId: CONFIG.IFRAME_ID,
        debug: CONFIG.DEBUG,
        logLevel: CONFIG.LOG_LEVEL
      });

      // 4. Registrar manejadores
      registrarManejadores();

      // 5. Inicializar aplicación
      await inicializar();
      
      // 6. Notificar que la inicialización ha terminado
      notificarInicializacion();
      
    } catch (error) {
      const errorMsg = 'Error crítico durante la inicialización';
      console.error(errorMsg, error);
      notificarError('inicializacion_critica', new Error(`${errorMsg}: ${error.message}`));
    }
  })();
}

// Exportar solo lo necesario
export {
  inicializar,
  notificarError,
  manejarCambioModo,
  estadoApp as estado
};

// No exportar CONFIG directamente para evitar duplicados
