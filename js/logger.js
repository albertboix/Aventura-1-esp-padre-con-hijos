/**
 * Módulo de logging centralizado para toda la aplicación.
 * @module Logger
 * @version 1.0.0
 */

// Niveles de log
const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
});

// Configuración por defecto
let config = {
  logLevel: LOG_LEVELS.INFO,
  debug: false,
  iframeId: 'unknown',
  colors: {
    debug: '#9E9E9E',
    info: '#2196F3',
    warn: '#FFC107',
    error: '#F44336',
    reset: '%c',
    timestamp: '#4CAF50'
  }
};

/**
 * Configura el logger
 * @param {Object} newConfig - Configuración del logger
 * @param {string} newConfig.iframeId - ID del iframe actual
 * @param {boolean} [newConfig.debug] - Habilita/deshabilita modo debug
 * @param {number} [newConfig.logLevel] - Nivel de log (0-4)
 */
export function configurarLogger(newConfig = {}) {
  config = { ...config, ...newConfig };
  
  // Asegurar que el nivel de log sea válido
  if (typeof config.logLevel === 'string') {
    config.logLevel = LOG_LEVELS[config.logLevel.toUpperCase()] ?? LOG_LEVELS.INFO;
  }
}

/**
 * Función de log base
 * @private
 * @param {string} level - Nivel de log
 * @param {string} message - Mensaje a registrar
 * @param {*} [data] - Datos adicionales
 */
function log(level, message, data = null) {
  const levelValue = typeof level === 'string' ? LOG_LEVELS[level.toUpperCase()] : level;
  
  // No hacer nada si el nivel de log es menor al configurado
  if (levelValue < config.logLevel) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${config.iframeId}] [${level.toUpperCase()}]`;
  
  // Estilo para la consola
  const style = `color: ${config.colors[level.toLowerCase()]}; font-weight: bold`;
  
  // Imprimir en consola
  if (data) {
    console.log(`%c${prefix} ${message}`, style, data);
  } else {
    console.log(`%c${prefix} ${message}`, style);
  }
  
  // Enviar mensaje al padre si estamos en un iframe
  if (window.parent !== window && window.enviarMensaje) {
    try {
      window.enviarMensaje('padre', 'LOGGER.LOG', {
        level: level.toUpperCase(),
        message,
        data,
        timestamp,
        origen: config.iframeId
      }).catch(error => {
        console.error('Error al enviar log al padre:', error);
      });
    } catch (error) {
      console.error('Error al enviar log al padre:', error);
    }
  }
}

// API Pública
export const logger = {
  /**
   * Mensaje de depuración
   * @param {string} message - Mensaje a registrar
   * @param {*} [data] - Datos adicionales
   */
  debug: (message, data) => log('debug', message, data),
  
  /**
   * Mensaje informativo
   * @param {string} message - Mensaje a registrar
   * @param {*} [data] - Datos adicionales
   */
  info: (message, data) => log('info', message, data),
  
  /**
   * Mensaje de advertencia
   * @param {string} message - Mensaje a registrar
   * @param {*} [data] - Datos adicionales
   */
  warn: (message, data) => log('warn', message, data),
  
  /**
   * Mensaje de error
   * @param {string} message - Mensaje a registrar
   * @param {Error|*} [error] - Objeto de error o datos adicionales
   */
  error: (message, error) => {
    if (error instanceof Error) {
      log('error', `${message}: ${error.message}`, error.stack);
    } else {
      log('error', message, error);
    }
  }
};

// Hacer disponible globalmente para compatibilidad
if (typeof window !== 'undefined') {
  window.Logger = logger;
}

export default logger;
