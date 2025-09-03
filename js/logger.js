/**
 * Módulo de logging centralizado para toda la aplicación.
 * @module Logger
 * @version 3.1.0
 */

// Importar constantes directamente para evitar dependencias circulares
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Safe console method fallback
const safeConsoleMethod = (typeof console !== 'undefined' && console.log) 
  ? console.log.bind(console) 
  : () => {};

// Nombres de niveles para mostrar
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];

// Colores para la consola
const DEFAULT_COLORS = {
  DEBUG: '#9E9E9E',  // Gris
  INFO: '#2196F3',   // Azul
  WARN: '#FFC107',   // Amarillo
  ERROR: '#F44336',  // Rojo
  NONE: '#000000',   // Negro
  timestamp: '#4CAF50',
  reset: '%c'
};

// Configuración por defecto
let config = {
  logLevel: LOG_LEVELS.DEBUG,
  debug: true,
  iframeId: 'unknown',
  maxHistory: 200,
  showTimestamp: true,
  showLevel: true,
  showIframeId: true,
  colors: DEFAULT_COLORS
};

// Configuración inicial
const newConfig = {
  ...config,
  // Valores por defecto, serán sobrescritos por configure()
  debug: true,
  iframeId: 'unknown',
  logLevel: (typeof CONFIG !== 'undefined' && CONFIG?.LOG_LEVEL && Object.values(LOG_LEVELS).includes(CONFIG.LOG_LEVEL))
    ? CONFIG.LOG_LEVEL 
    : LOG_LEVELS.DEBUG
};

// Asignar la nueva configuración
config = newConfig;

// Historial de logs en memoria
let logHistory = [];

/**
 * Formatea la marca de tiempo actual
 * @private
 * @returns {string} Timestamp formateado (YYYY-MM-DD HH:MM:SS)
 */
function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').replace(/\..+/, '');
}

/**
 * Obtiene el nombre del nivel de log
 * @private
 * @param {number} level - Nivel de log
 * @returns {string} Nombre del nivel
 */
function getLevelName(level) {
  return LEVEL_NAMES[level] || 'UNKNOWN';
}

/**
 * Obtiene información del llamador para depuración
 * @private
 * @returns {string} Información del llamador
 */
function getCallerInfo() {
  try {
    const error = new Error();
    if (!error.stack) return '';
    
    // Obtener la línea del stack que no sea del logger
    const stackLines = error.stack.split('\n').slice(2);
    const callerLine = stackLines.find(line => 
      !line.includes('logger.js') && 
      !line.includes('node_modules')
    );
    
    return callerLine ? callerLine.trim() : '';
  } catch (e) {
    return '';
  }
}

/**
 * Formatea un mensaje de log con metadatos
 * @private
 * @param {number} level - Nivel de log
 * @param {string} message - Mensaje principal
 * @param {*} [data] - Datos adicionales
 * @returns {Object} Objeto de log formateado
 */
function formatLogEntry(level, message, data = null) {
  const timestamp = formatTimestamp();
  const levelName = getLevelName(level);
  
  return {
    timestamp,
    level,
    levelName,
    message,
    data,
    iframeId: config.iframeId,
    location: getCallerInfo(),
    ...(data instanceof Error ? {
      error: {
        message: data.message,
        stack: data.stack,
        name: data.name
      }
    } : {})
  };
}

/**
 * Envía el log a la ventana padre si estamos en un iframe
 * @private
 * @param {Object} logEntry - Entrada de log
 */
function sendToParent(logEntry) {
  if (typeof window === 'undefined' || window === window.parent) return;
  
  try {
    // Usar el sistema de mensajería centralizado si está disponible
    if (window.enviarMensaje) {
      window.enviarMensaje('padre', 'SISTEMA.LOG', logEntry)
        .catch(error => {
          safeConsoleMethod('Error al enviar log a través del sistema de mensajería:', error);
          // Fallback al método directo si falla el sistema de mensajería
          fallbackToDirectPostMessage(logEntry);
        });
    } else {
      // Fallback al método directo si no hay sistema de mensajería
      fallbackToDirectPostMessage(logEntry);
    }
  } catch (error) {
    safeConsoleMethod('Error en sendToParent:', error);
  }
}

/**
 * Método de respaldo para enviar mensajes directamente (solo para compatibilidad)
 * @private
 * @param {Object} logEntry - Entrada de log
 */
function fallbackToDirectPostMessage(logEntry) {
  try {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'LOG_ENTRY',
        payload: logEntry
      }, '*');
    }
  } catch (error) {
    safeConsoleMethod('Error en fallbackToDirectPostMessage:', error);
  }
}

/**
 * Muestra el log en la consola con formato
 * @private
 * @param {Object} logEntry - Entrada de log
 */
function outputToConsole(logEntry) {
  if (!config.debug) return;
  
  try {
    const { level, message, data, timestamp, levelName } = logEntry;
    
    // Obtener el nombre del nivel
    const levelNameStr = getLevelName(level) || levelName || 'LOG';
    
    // Determinar el método de consola a usar
    const consoleMethod = 
      level >= LOG_LEVELS.ERROR ? 'error' :
      level >= LOG_LEVELS.WARN ? 'warn' :
      level >= LOG_LEVELS.INFO ? 'info' : 'log';
    
    // Construir prefijo del mensaje
    const prefixParts = [];
    
    if (config.showTimestamp) {
      const timeStr = timestamp || formatTimestamp();
      prefixParts.push(`[${timeStr}]`);
    }
    
    if (config.showLevel) {
      prefixParts.push(`[${levelNameStr}]`);
    }
    
    if (config.showIframeId && config.iframeId && config.iframeId !== 'unknown') {
      prefixParts.push(`[${config.iframeId}]`);
    }
    
    const prefix = prefixParts.join(' ');
    const fullMessage = `${prefix} ${message}`.trim();
    
    // Verificar si el método de consola existe
    const safeConsoleMethod = typeof console[consoleMethod] === 'function' 
      ? console[consoleMethod] 
      : console.log;
    
    // Aplicar formato con colores si está habilitado
    if (config.colors) {
      const color = (config.colors[levelNameStr] || config.colors.INFO);
      const styles = [
        `color: ${color}`,
        'font-weight: bold',
        'font-family: monospace',
        'background: #f5f5f5',
        'padding: 2px 4px',
        'border-radius: 3px'
      ].join(';');
      
      safeConsoleMethod(`%c${fullMessage}`, styles);
    } else {
      safeConsoleMethod(fullMessage);
    }
    
    // Mostrar datos adicionales si existen
    if (data !== undefined && data !== null) {
      try {
        if (data instanceof Error) {
          safeConsoleMethod(data);
        } else if (typeof data === 'object') {
          safeConsoleMethod(JSON.parse(JSON.stringify(data, null, 2)));
        } else {
          safeConsoleMethod(data);
        }
      } catch (e) {
        safeConsoleMethod('Error al formatear datos del log:', e);
        safeConsoleMethod(data);
      }
    }
    
    // Mostrar ubicación del llamador en desarrollo
    if (config.debug && logEntry.location) {
      safeConsoleMethod(`  at ${logEntry.location}`);
    }
  } catch (e) {
    safeConsoleMethod('Error en outputToConsole:', e);
  }
}

/**
 * Función principal de logging
 * @private
 * @param {number} level - Nivel de log
 * @param {string} message - Mensaje a registrar
 * @param {*} [data] - Datos adicionales
 */
function log(level, message, data) {
  if (level < config.logLevel) return;
  
  const logEntry = formatLogEntry(level, message, data);
  
  // Añadir al historial
  logHistory.push(logEntry);
  if (logHistory.length > config.maxHistory) {
    logHistory.shift();
  }
  
  // Enviar a la ventana padre si es necesario
  if (config.iframeId !== 'unknown') {
    sendToParent(logEntry);
  }
  
  // Mostrar en consola si está habilitado
  if (config.debug) {
    outputToConsole(logEntry);
  }
}

/**
 * Configura el logger con nuevas opciones
 * @param {Object} options - Opciones de configuración
 * @param {string} [options.iframeId] - Identificador del iframe
 * @param {number} [options.logLevel] - Nivel de log mínimo
 * @param {boolean} [options.debug] - Habilita la salida por consola
 * @param {number} [options.maxHistory] - Número máximo de entradas en el historial
 * @param {boolean} [options.showTimestamp] - Mostrar marca de tiempo
 * @param {boolean} [options.showLevel] - Mostrar nivel de log
 * @param {boolean} [options.showIframeId] - Mostrar ID del iframe
 * @param {boolean|Object} [options.colors] - Usar colores en la consola o configuración personalizada
 * @returns {Object} Configuración actual
 */
function configureLogger(options = {}) {
  // Actualizar configuración
  Object.assign(config, options);
  
  // Manejar configuración de colores
  if (options.colors && typeof options.colors === 'object') {
    config.colors = { ...DEFAULT_COLORS, ...options.colors };
  } else if (options.colors === false) {
    config.colors = false;
  }
  
  return { ...config };
}

/**
 * Obtiene el historial de logs
 * @param {number} [limit] - Número máximo de entradas a devolver
 * @returns {Array} Historial de logs
 */
function getLogHistory(limit) {
  return limit ? logHistory.slice(-limit) : [...logHistory];
}

/**
 * Limpia el historial de logs
 * @returns {number} Número de entradas eliminadas
 */
function clearLogHistory() {
  const count = logHistory.length;
  logHistory = [];
  return count;
}

// API Pública del Logger
const logger = {
  /**
   * Registra un mensaje de depuración
   * @param {string} message - Mensaje a registrar
   * @param {*} [data] - Datos adicionales
   */
  debug: (message, data) => log(LOG_LEVELS.DEBUG, message, data),
  
  /**
   * Registra un mensaje informativo
   * @param {string} message - Mensaje a registrar
   * @param {*} [data] - Datos adicionales
   */
  info: (message, data) => log(LOG_LEVELS.INFO, message, data),
  
  /**
   * Registra una advertencia
   * @param {string} message - Mensaje a registrar
   * @param {*} [data] - Datos adicionales
   */
  warn: (message, data) => log(LOG_LEVELS.WARN, message, data),
  
  /**
   * Registra un error
   * @param {string|Error} message - Mensaje o objeto de error
   * @param {Error|*} [error] - Objeto de error o datos adicionales
   */
  error: (message, error) => {
    if (message instanceof Error) {
      log(LOG_LEVELS.ERROR, message.message, message);
    } else if (error instanceof Error) {
      log(LOG_LEVELS.ERROR, message, error);
    } else {
      log(LOG_LEVELS.ERROR, message, error);
    }
  },
  
  // Funciones de utilidad
  configure: configureLogger,
  getConfig: () => ({ ...config }),
  getLogHistory,
  clearLogHistory,
  LOG_LEVELS
};

// Hacer disponible globalmente para compatibilidad
if (typeof window !== 'undefined') {
  // Guardar consola original
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
  
  // Sobrescribir métodos de consola si está habilitado en la configuración
  if (config.debug) {
    console.log = function(...args) {
      logger.debug(args[0], args.slice(1));
      originalConsole.log(...args);
    };
    
    console.info = function(...args) {
      logger.info(args[0], args.slice(1));
      originalConsole.info(...args);
    };
    
    console.warn = function(...args) {
      logger.warn(args[0], args.slice(1));
      originalConsole.warn(...args);
    };
    
    console.error = function(...args) {
      logger.error(args[0], args.slice(1));
      originalConsole.error(...args);
    };
    
    console.debug = function(...args) {
      logger.debug(args[0], args.slice(1));
      originalConsole.debug(...args);
    };
  }
  
  // Exportar para uso global
  window.Logger = logger;
  window.LOG_LEVELS = LOG_LEVELS;
  
  // Configuración inicial
  configureLogger({
    iframeId: window.name || 'unknown',
    debug: process.env.NODE_ENV !== 'production'
  });
}

export default logger;
