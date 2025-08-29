/**
 * Módulo de utilidades y constantes compartidas para toda la aplicación.
 * @version 1.0.0
 */

// ================== CONSTANTES COMPARTIDAS ==================

/**
 * Niveles de severidad para el logging.
 */
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

/**
 * Modos de operación de la aplicación.
 */
export const MODOS = {
  CASA: 'casa',
  AVENTURA: 'aventura'
};

/**
 * Tipos de puntos en la ruta.
 */
export const TIPOS_PUNTO = {
  PARADA: 'parada',
  TRAMO: 'tramo',
  INICIO: 'inicio'
};

/**
 * Tipos de mensaje utilizados en el sistema de mensajería
 */
export const TIPOS_MENSAJE = {
  SISTEMA: {
    INICIALIZACION: 'SISTEMA.INICIALIZACION',
    INICIALIZACION_COMPLETADA: 'SISTEMA.INICIALIZACION_COMPLETADA',
    ERROR: 'SISTEMA.ERROR',
    COMPONENTE_LISTO: 'SISTEMA.COMPONENTE_LISTO',
    CONFIGURACION: 'SISTEMA.CONFIGURACION',
    ACTUALIZAR_ESTADO: 'SISTEMA.ACTUALIZAR_ESTADO',
    SINCRONIZAR_ESTADO: 'SISTEMA.SINCRONIZAR_ESTADO',
    CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
    REINICIAR: 'SISTEMA.REINICIAR'
  },
  NAVEGACION: {
    CAMBIO_PARADA: 'NAVEGACION.CAMBIO_PARADA',
    LLEGADA_PARADA: 'NAVEGACION.LLEGADA_PARADA',
    INICIAR_NAVEGACION: 'NAVEGACION.INICIAR_NAVEGACION',
    DETENER_NAVEGACION: 'NAVEGACION.DETENER_NAVEGACION',
    ACTUALIZAR_RUTA: 'NAVEGACION.ACTUALIZAR_RUTA',
    ACTUALIZAR_POSICION: 'NAVEGACION.ACTUALIZAR_POSICION'
  },
  GPS: {
    POSICION_ACTUALIZADA: 'GPS.POSICION_ACTUALIZADA',
    ERROR: 'GPS.ERROR',
    SOLICITAR_UBICACION: 'GPS.SOLICITAR_UBICACION',
    ACTUALIZAR_PRECISION: 'GPS.ACTUALIZAR_PRECISION'
  },
  DATOS: {
    SOLICITAR_PARADAS: 'DATOS.SOLICITAR_PARADAS',
    ACTUALIZAR_PARADAS: 'DATOS.ACTUALIZAR_PARADAS',
    SOLICITAR_ARRAY_PARADAS: 'DATOS.SOLICITAR_ARRAY_PARADAS',
    VERIFICAR_HASH_ARRAY: 'DATOS.VERIFICAR_HASH_ARRAY',
    ARRAY_ACTUALIZADO: 'DATOS.ARRAY_ACTUALIZADO'
  },
  RETO: {
    MOSTRAR: 'RETO.MOSTRAR',
    OCULTAR: 'RETO.OCULTAR',
    RESPUESTA: 'RETO.RESPUESTA',
    COMPLETADO: 'RETO.COMPLETADO',
    ERROR: 'RETO.ERROR',
    ACTUALIZAR_ESTADO: 'RETO.ACTUALIZAR_ESTADO'
  },
  UI: {
    ACTUALIZAR_INTERFAZ: 'UI.ACTUALIZAR_INTERFAZ',
    MOSTRAR_MENSAJE: 'UI.MOSTRAR_MENSAJE',
    OCULTAR_MENSAJE: 'UI.OCULTAR_MENSAJE',
    MOSTRAR_CARGA: 'UI.MOSTRAR_CARGA',
    OCULTAR_CARGA: 'UI.OCULTAR_CARGA',
    ACTUALIZAR_PROGRESO: 'UI.ACTUALIZAR_PROGRESO',
    NOTIFICACION: 'UI.NOTIFICACION'
  }
};

// ================== CONFIGURACIÓN GLOBAL ==================

const globalConfig = {
  logLevel: LOG_LEVELS.INFO,
  debug: false,
  iframeId: 'desconocido'
};

/**
 * Configura las utilidades compartidas. Debe llamarse al inicio de cada componente.
 * @param {object} config - Objeto de configuración.
 * @param {string} config.iframeId - ID del iframe actual.
 * @param {number} [config.logLevel] - Nivel de log.
 * @param {boolean} [config.debug] - Activar modo debug.
 */
export function configurarUtils(config = {}) {
  if (config.iframeId) globalConfig.iframeId = config.iframeId;
  if (config.logLevel !== undefined) globalConfig.logLevel = config.logLevel;
  if (config.debug !== undefined) globalConfig.debug = config.debug;
}

// ================== LOGGER ESTANDARIZADO ==================

/**
 * Logger estandarizado para toda la aplicación.
 */
export const logger = {
  log: (level, message, data = null) => {
    if (level >= globalConfig.logLevel) {
      const levelStr = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'LOG';
      const baseMessage = `[${globalConfig.iframeId}] ${message}`;
      
      const logData = data ? [baseMessage, data] : [baseMessage];

      switch (level) {
        case LOG_LEVELS.ERROR:
          console.error(...logData);
          break;
        case LOG_LEVELS.WARN:
          console.warn(...logData);
          break;
        case LOG_LEVELS.INFO:
          console.info(...logData);
          break;
        case LOG_LEVELS.DEBUG:
          if (globalConfig.debug) {
            console.debug(...logData);
          }
          break;
        default:
          console.log(...logData);
      }
    }
  },
  debug: (message, data) => logger.log(LOG_LEVELS.DEBUG, message, data),
  info: (message, data) => logger.log(LOG_LEVELS.INFO, message, data),
  warn: (message, data) => logger.log(LOG_LEVELS.WARN, message, data),
  error: (message, error) => {
      const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
      logger.log(LOG_LEVELS.ERROR, message, errorData);
  }
};

// ================== MANEJO DE ERRORES ESTANDARIZADO ==================

/**
 * Crea un objeto de error estandarizado para ser enviado por mensajería.
 * @param {string} tipo - Tipo de error (ej. 'inicializacion', 'comunicacion').
 * @param {Error|string} error - El objeto de error o un mensaje.
 * @param {object} [datosAdicionales={}] - Datos contextuales.
 * @returns {object} Un objeto de error estandarizado.
 */
export function crearObjetoError(tipo, error, datosAdicionales = {}) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorInfo = {
        tipo,
        mensaje: errorObj.message,
        stack: globalConfig.debug ? errorObj.stack : 'Stack no disponible.',
        origen: globalConfig.iframeId,
        ...datosAdicionales,
        timestamp: new Date().toISOString()
    };
    
    logger.error(`Error creado: ${tipo}`, errorInfo);
    return errorInfo;
}

// Si este archivo es solo un stub, no es necesario modificarlo.
// Si se usa como utilitario, importa desde './js/utils.js' y configura el logger si corresponde.
