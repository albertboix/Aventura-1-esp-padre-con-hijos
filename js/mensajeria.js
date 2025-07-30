/**
 * Módulo de utilidades para la comunicación entre iframes
 * Proporciona funciones estandarizadas para el envío y recepción de mensajes
 */

// Niveles de log para el sistema de mensajería
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// Configuración por defecto
let config = {
    logLevel: LOG_LEVELS.INFO,
    iframeId: 'desconocido',
    debug: false
};

// Tipos de mensajes estandarizados
const TIPOS_MENSAJE = {
    // Comandos del sistema
    SISTEMA: {
        PING: 'sistema:ping',
        PONG: 'sistema:pong',
        INICIALIZACION: 'sistema:inicializacion',
        ERROR: 'sistema:error',
        CONFIGURACION: 'sistema:configuracion'
    },
    
    // Navegación
    NAVEGACION: {
        INICIAR: 'navegacion:iniciar',
        DETENER: 'navegacion:detener',
        ACTUALIZAR_UBICACION: 'navegacion:actualizar_ubicacion',
        LLEGADA_PARADA: 'navegacion:llegada_parada',
        SIGUIENTE_PUNTO: 'navegacion:siguiente_punto'
    },
    
    // Audio
    AUDIO: {
        REPRODUCIR: 'audio:reproducir',
        PAUSAR: 'audio:pausar',
        DETENER: 'audio:detener',
        ACTUALIZAR_PROGRESO: 'audio:actualizar_progreso',
        TERMINADO: 'audio:terminado'
    },
    
    // Retos
    RETOS: {
        MOSTRAR: 'retos:mostrar',
        OCULTAR: 'retos:ocultar',
        INICIAR: 'retos:iniciar',
        COMPLETADO: 'retos:completado',
        FALLIDO: 'retos:fallido',
        REINICIAR: 'retos:reiniciar'
    },
    
    // Estado
    ESTADO: {
        ACTUALIZAR: 'estado:actualizar',
        SOLICITAR: 'estado:solicitar',
        SINCRONIZAR: 'estado:sincronizar'
    },
    
    // Interfaz de usuario
    UI: {
        MOSTRAR_MENSAJE: 'ui:mostrar_mensaje',
        OCULTAR_MENSAJE: 'ui:ocultar_mensaje',
        ACTUALIZAR_INTERFAZ: 'ui:actualizar_interfaz'
    }
};

/**
 * Clase para manejar el registro de mensajes
 */
class Logger {
    constructor(prefix = '') {
        this.prefix = prefix ? `[${prefix}]` : '';
    }

    debug(...args) {
        if (config.logLevel <= LOG_LEVELS.DEBUG) {
            console.debug(`%c${this.getTimestamp()} ${this.prefix}`, 'color: #666', ...args);
        }
    }

    log(...args) {
        if (config.logLevel <= LOG_LEVELS.INFO) {
            console.log(`%c${this.getTimestamp()} ${this.prefix}`, 'color: #2196F3', ...args);
        }
    }

    info(...args) {
        this.log(...args);
    }

    warn(...args) {
        if (config.logLevel <= LOG_LEVELS.WARN) {
            console.warn(`%c${this.getTimestamp()} ${this.prefix}`, 'color: #FF9800', ...args);
        }
    }

    error(...args) {
        if (config.logLevel <= LOG_LEVELS.ERROR) {
            console.error(`%c${this.getTimestamp()} ${this.prefix}`, 'color: #F44336', ...args);
        }
    }

    getTimestamp() {
        const now = new Date();
        return `[${now.toISOString().substr(11, 12)}:${now.getUTCMilliseconds().toString().padStart(3, '0')}]`;
    }
}

// Instancia global del logger
const logger = new Logger();

/**
 * Crea un mensaje estandarizado
 * @param {string} tipo - Tipo de mensaje (usar TIPOS_MENSAJE)
 * @param {Object} datos - Datos del mensaje
 * @param {string} destino - Destinatario del mensaje
 * @param {string} origen - Origen del mensaje (se autocompleta si no se especifica)
 * @returns {Object} Mensaje estandarizado
 */
function crearMensaje(tipo, datos = {}, destino = null, origen = null) {
    const mensaje = {
        version: '1.0',
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        tipo,
        origen: origen || config.iframeId,
        destino,
        datos
    };

    logger.debug(`Mensaje creado:`, mensaje);
    return mensaje;
}

/**
 * Valida la estructura de un mensaje
 * @param {Object} mensaje - Mensaje a validar
 * @returns {Object} { valido: boolean, error: string }
 */
function validarMensaje(mensaje) {
    if (!mensaje) {
        return { valido: false, error: 'Mensaje nulo o indefinido' };
    }

    const camposRequeridos = ['version', 'id', 'timestamp', 'tipo', 'origen'];
    const faltantes = camposRequeridos.filter(campo => !(campo in mensaje));

    if (faltantes.length > 0) {
        return { 
            valido: false, 
            error: `Campos requeridos faltantes: ${faltantes.join(', ')}` 
        };
    }

    // Validar tipo de mensaje
    const tipoValido = Object.values(TIPOS_MENSAJE).some(
        categoria => Object.values(categoria).includes(mensaje.tipo)
    );

    if (!tipoValido) {
        return {
            valido: false,
            error: `Tipo de mensaje no válido: ${mensaje.tipo}`
        };
    }

    return { valido: true };
}

/**
 * Inicializa el sistema de mensajería
 * @param {Object} opciones - Opciones de configuración
 * @param {string} opciones.iframeId - Identificador del iframe
 * @param {number} opciones.logLevel - Nivel de log (0-4)
 * @param {boolean} opciones.debug - Modo depuración
 */
function inicializarMensajeria({ iframeId, logLevel = LOG_LEVELS.INFO, debug = false } = {}) {
    if (iframeId) {
        config.iframeId = iframeId;
        logger.prefix = `[${iframeId}]`;
    }
    
    if (logLevel !== undefined) {
        config.logLevel = logLevel;
    }
    
    config.debug = debug;
    
    if (debug) {
        config.logLevel = LOG_LEVELS.DEBUG;
        logger.debug('Modo depuración activado');
    }
    
    logger.log('Sistema de mensajería inicializado', config);
}

// Exportar la API pública
export {
    TIPOS_MENSAJE,
    LOG_LEVELS,
    logger,
    crearMensaje,
    validarMensaje,
    inicializarMensajeria,
    config as configuracionMensajeria
};

// Si se usa directamente en el navegador (sin módulos)
if (typeof window !== 'undefined') {
    window.Mensajeria = {
        TIPOS_MENSAJE,
        LOG_LEVELS,
        logger,
        crearMensaje,
        validarMensaje,
        inicializarMensajeria,
        config: config
    };
}
