/**
 * Módulo de logging centralizado para toda la aplicación.
 * @module Logger
 * @version 3.2.0
 */

// Importar constantes directamente para evitar dependencias circulares
import { LOG_LEVELS, NIVELES_SEVERIDAD, CATEGORIAS_EVENTOS, TIPOS_MENSAJE } from './constants.js';

// Evitamos la importación directa para romper la dependencia circular
// import { enviarMensaje } from './mensajeria.js';

// Función para enviar mensajes que será configurada desde mensajeria.js
let enviarMensajeFunc = null;

// Referencia a las funciones de monitoreo de app.js
let monitoring = {
    registrarEvento: (tipo, datos, nivel = 'info') => {
        if (!tipo.startsWith('SISTEMA.') && !tipo.startsWith('MONITOREO.')) {
            console.warn(`Tipo de evento potencialmente no válido: ${tipo}`);
        }
        
        if (enviarMensajeFunc) {
            return enviarMensajeFunc('padre', TIPOS_MENSAJE.MONITOREO.EVENTO, { tipo, datos, nivel });
        } else {
            console.warn('Función enviarMensaje no disponible, evento encolado para envío posterior');
            return Promise.resolve({ encolado: true });
        }
    },
    registrarError: (error, contexto = {}) => {
        if (enviarMensajeFunc) {
            return enviarMensajeFunc('padre', TIPOS_MENSAJE.MONITOREO.ERROR, { error, contexto });
        } else if (window.notificarError) {
            return window.notificarError('LOGGER_ERROR', error, contexto);
        }
        return null;
    },
    registrarMetrica: (nombre, valor, unidad = 'ms') => {
        return enviarMensaje('padre', TIPOS_MENSAJE.MONITOREO.METRICA, { nombre, valor, unidad });
    }
};

// Safe console method fallback
const safeConsoleMethod = (typeof console !== 'undefined' && console.log) 
  ? console.log.bind(console) 
  : () => {};

// Store original console.warn
const originalWarn = (typeof console !== 'undefined' && console.warn) 
  ? console.warn.bind(console) 
  : () => {};

// Override console.warn to filter out specific messages
if (typeof console !== 'undefined' && console.warn) {
  // Usar un enfoque más seguro para filtrar mensajes específicos
  const originalWarn = console.warn.bind(console);
  console.warn = function (...args) {
    if (args[0]?.includes('Permissions policy violation') && args[0]?.includes('unload is not allowed')) {
        return; // Ignorar este mensaje específico
    }
    originalWarn(...args); // Llamar al método original para otros mensajes
  };
}

// Nombres de niveles para mostrar
export const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];

// Colores para la consola
export const DEFAULT_COLORS = {
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
  logLevel: LOG_LEVELS.INFO, // FIX 2: Default más seguro para producción
  debug: false, // FIX 2: Default más seguro para producción
  iframeId: 'unknown',
  maxHistory: 200,
  showTimestamp: true,
  showLevel: true,
  showIframeId: true,
  colors: DEFAULT_COLORS
};

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
    // FIX 5: Obtener información del llamador solo para errores para mejorar el rendimiento.
    location: level >= LOG_LEVELS.ERROR ? getCallerInfo() : undefined,
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
    if (enviarMensajeFunc) {
      enviarMensajeFunc('padre', TIPOS_MENSAJE.UI.NOTIFICACION, logEntry);
    } else {
      console.warn('Función enviarMensaje no disponible aún');
    }
  } catch (error) {
    console.error('Error al enviar log al padre:', error);
  }
}

/**
 * Muestra el log en la consola con formato
 * @private
 * @param {Object} logEntry - Entrada de log
 */
function outputToConsole(logEntry) {
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
        } else {
          // FIX 4: Hacer el log de objetos más seguro. Dejar que el navegador lo maneje.
          // Evita errores con referencias circulares que rompen JSON.stringify.
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
    console.warn('Logger encountered an issue:', e);
  }
}

/**
 * Función principal de logging
 * @private
 * @param {number} level - Nivel de log
 * @param {string} message - Mensaje a registrar
 * @param {*} [data] - Datos adicionales
 * @param {Object} [options] - Opciones adicionales
 * @param {boolean} [options.skipMonitoring] - Si es true, no registrar en el sistema de monitoreo
async log(level, message, data, options = {}) {
    // Verificar si el nivel de log está habilitado
    if (level < this.currentConfig.logLevel) {
        return null;
    }

    // Crear entrada de log
    const logEntry = this.formatLogEntry(level, message, data);
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

// Función para configurar el logger con monitoreo automático
const configureLoggerWithMonitoring = (options = {}) => {
    const config = configureLogger(options);
    
    // Registrar evento de inicialización si el monitoreo está habilitado
    if (options.enableMonitoring !== false) {
        try {
            monitoring.registrarEvento(
                'logger_inicializado',
                { 
                    config: {
                        logLevel: config.logLevel,
                        iframeId: config.iframeId,
                        version: '3.2.0',
                        source: 'app.js'
                    },
                    timestamp: new Date().toISOString()
                },
                'info'
            );
        } catch (error) {
            console.error('Error al registrar evento de inicialización:', error);
        }
    }
    
    return config;
};

// Función de log principal
function log(level, message, data = null) {
    // Verificar si el nivel de log es suficiente
    if (level < config.logLevel) {
        return;
    }

    const logEntry = formatLogEntry(level, message, data);
    
    // Agregar al historial
    logHistory.push(logEntry);
    if (logHistory.length > config.maxHistory) {
        logHistory.shift();
    }
    
    // Mostrar en consola si está habilitado
    if (config.debug) {
        outputToConsole(logEntry);
    }
    
    // Enviar al padre si es necesario
    if (config.iframeId && window.parent !== window) {
        sendToParent(logEntry);
    }
    
    return logEntry;
}

/**
 * Registra un error crítico y lo notifica al sistema de monitoreo.
 * @param {Error} error - Objeto de error.
 * @param {Object} [contexto] - Contexto adicional del error.
 */
export function registrarErrorCritico(error, contexto = {}) {
    try {
        console.error('[Error Crítico]', error);
        if (enviarMensajeFunc) {
            enviarMensajeFunc('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
                mensaje: error.message,
                stack: error.stack,
                contexto,
                timestamp: new Date().toISOString()
            });
        } else {
            console.warn('Función enviarMensaje no disponible para registrar error crítico');
        }
    } catch (e) {
        console.error('Error al registrar un error crítico:', e);
    }
}

/**
 * Maneja errores críticos y los notifica al sistema de monitoreo.
 * @param {Error} error - Objeto de error.
 * @param {string} origen - ID del origen del mensaje.
 * @param {Object} [contexto] - Contexto adicional del error.
 */
export function manejarErrorCritico(error, origen, contexto = {}) {
    try {
        logger.error(`[Error Crítico] Origen: ${origen}`, error);
        enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
            mensaje: error.message,
            stack: error.stack,
            origen,
            contexto,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        logger.error('Error al manejar un error crítico:', e);
    }
}

/**
/**
 * Registra un evento de confirmación (ACK/NACK).
 * @param {string} tipo - Tipo de confirmación ('ACK' o 'NACK').
 * @param {Object} mensaje - Mensaje relacionado.
 * @param {Object} [contexto] - Contexto adicional del error.
 */
export function registrarConfirmacion(tipo, mensaje, contexto = {}) {
    logger.info(`[${tipo}] Confirmación recibida para mensaje ${mensaje.mensajeId}`);
}
/**
 * Registra un evento de monitoreo.
 * @param {string} tipo - Tipo de evento.
 * @param {Object} datos - Datos del evento.ACK).
 * @param {string} [nivel='info'] - Nivel de severidad ('debug', 'info', 'warn', 'error').
/**
 * Registra un evento de monitoreo.
 * @param {string} tipo - Tipo de evento.
 * @param {Object} datos - Datos del evento.
 * @param {string} [nivel='info'] - Nivel de severidad ('debug', 'info', 'warn', 'error').
 */
export function registrarEvento(tipo, datos = {}, nivel = 'info') {
    try {
        const evento = {
            tipo,
            datos,
            nivel,
            timestamp: new Date().toISOString()
        };
        console.log(`[Evento ${nivel.toUpperCase()}]:`, evento);
        // Enviar al sistema de monitoreo si está habilitado
        if (window.enviarMensaje) {
            enviarMensaje('padre', TIPOS_MENSAJE.MONITOREO.EVENTO, evento);
        }
    } catch (error) {
        console.error('Error al registrar evento:', error);
    }
}
/**
 * Registra un evento de diagnóstico.
 * @param {string} tipo - Tipo de evento.
 * @param {Object} datos - Datos del evento.
 */
export function registrarDiagnostico(tipo, datos = {}) {
    try {
        const evento = {
            tipo,
            datos,
            timestamp: new Date().toISOString()
        };
        logger.info(`Diagnóstico registrado: ${tipo}`, datos);
        // Enviar al sistema de monitoreo si está habilitado
        if (window.enviarMensaje) {
            enviarMensaje('padre', TIPOS_MENSAJE.MONITOREO.EVENTO, evento);
        }
    } catch (error) {
        logger.error('Error al registrar diagnóstico:', error);
    }
}

/**
 * Registra una métrica de rendimiento.
 * @param {string} nombre - Nombre de la métrica.
 * @param {number} valor - Valor de la métrica.
 * @param {string} [unidad='ms'] - Unidad de medida.
 */
export function registrarMetrica(nombre, valor, unidad = 'ms') {
    try {
        const metrica = {
            nombre,
            valor,
            unidad,
            timestamp: new Date().toISOString()
        };
        logger.info(`Métrica registrada: ${nombre} = ${valor}${unidad}`);
        // Enviar al sistema de monitoreo si está habilitado
        if (enviarMensajeFunc) {
            enviarMensajeFunc('padre', TIPOS_MENSAJE.MONITOREO.METRICA, metrica);
        }
    } catch (error) {
        logger.error('Error al registrar métrica:', error);
    }
}
/**
 * API Pública del Logger
 */
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
  configureWithMonitoring: configureLoggerWithMonitoring,
  getConfig: () => ({ ...config }),
  getLogHistory,
  clearLogHistory,
  LOG_LEVELS
};
// Hacer disponible globalmente para compatibilidad, pero sin sobrescribir la consola
if (typeof window !== 'undefined' && !window.Logger) {
  window.Logger = logger;
  window.LOG_LEVELS = LOG_LEVELS;
  // Configuración inicial si se ejecuta en un navegador
  if (window.name) {
    configureLogger({
      iframeId: window.name,
      debug: typeof window.__DEV__ !== 'undefined' ? window.__DEV__ :
             (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    });
  }
}

// Configurar el manejador de errores global después de que el logger esté disponible
const setupGlobalErrorHandler = () => {
    // Verificar si estamos en un navegador
    if (typeof window === 'undefined') return;
    // Verificar si ya hay un manejador de errores global
    if (window.__GLOBAL_ERROR_HANDLER_SETUP__) return;

    window.__GLOBAL_ERROR_HANDLER__ = (event) => {
        // Usar console.error como respaldo si el logger no está disponible
        if (window.logger?.error) {
            window.logger.error('Error global capturado:', event.message || event);
        } else {
            console.error('Error global capturado (logger no disponible):', event.message || event);
        }
    };

    window.addEventListener('error', window.__GLOBAL_ERROR_HANDLER__);
    window.__GLOBAL_ERROR_HANDLER_SETUP__ = true;
};
document.addEventListener('DOMContentLoaded', () => {
    // Pequeño retraso para asegurar que el logger esté disponibleConfigurar el manejador de errores globalor('Error global capturado:', event.message || event);
    setTimeout(() => {
        setupGlobalErrorHandler();

        // Registrar evento de inicialización
        try {
            monitoring.registrarEvento(
                TIPOS_MENSAJE.SISTEMA.APLICACION_INICIALIZADA,
                {
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                },
                'info'
            );
        } catch (error) {
            console.warn('No se pudo registrar el evento de inicialización:', error);
        }
    }, 100);
});
/**
 * Returns the current log level, with browser compatibility
 * @returns {number} Current log level
 */
function getCurrentLogLevel() {
  if (typeof window !== 'undefined') {
    if (window.__DEV__ === true) return LOG_LEVELS.DEBUG;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return LOG_LEVELS.DEBUG;
    }
  }
  return LOG_LEVELS.INFO; // Default for production
}

/**
 * Checks if we're in development mode, with browser compatibility
 * @returns {boolean} True if in development mode
 */
function isDevelopmentMode() {
  if (typeof window !== 'undefined') {
    return window.__DEV__ === true ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
  }
  return false;
}

// Use browser-compatible log level and debug detection
config.logLevel = getCurrentLogLevel();
if (isDevelopmentMode()) {
  config.debug = true;
}

// Función para configurar la función de envío de mensajes
export function configurarEnvioMensajes(enviarMensajeFn) {
  if (typeof enviarMensajeFn === 'function') {
    enviarMensajeFunc = enviarMensajeFn;
    logger.debug('Función de envío de mensajes configurada');
    return true;
  }
  return false;
}

// La función registrarEvento ya ha sido exportada arriba
export default logger;
