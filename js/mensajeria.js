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
    debug: false,
    maxRetries: 3,
    retryDelay: 1000,
    connectionCheckInterval: 5000,
    messageQueue: [],
    isOnline: true,
    messageHistory: new Map(),
    maxHistorySize: 100
};

// Estado de la conexión
let connectionCheckInterval = null;

// Tipos de mensajes estandarizados
const TIPOS_MENSAJE = {
    // Comandos del sistema
    SISTEMA: {
        PING: 'sistema:ping',
        PONG: 'sistema:pong',
        INICIALIZACION: 'sistema:inicializacion',
        ERROR: 'sistema:error',
        CONFIGURACION: 'sistema:configuracion',
        CAMBIO_MODO: 'sistema:cambio_modo',
        HABILITAR_CONTROLES: 'sistema:habilitar_controles',
        DESHABILITAR_CONTROLES: 'sistema:deshabilitar_controles',
        GPS_ESTADO: 'sistema:gps_estado',
        GPS_ACTUALIZACION: 'sistema:gps_actualizacion',
        REENVIAR_A_HIJO: 'sistema:reenviar_a_hijo',
        BROADCAST: 'sistema:broadcast',
        ESTADO_SOLICITUD: 'sistema:estado_solicitud',
        ESTADO_ACTUALIZACION: 'sistema:estado_actualizacion'
    },
    
    // Navegación
    NAVEGACION: {
        INICIAR: 'navegacion:iniciar',
        DETENER: 'navegacion:detener',
        ACTUALIZAR_UBICACION: 'navegacion:actualizar_ubicacion',
        LLEGADA_PARADA: 'navegacion:llegada_parada',
        SIGUIENTE_PUNTO: 'navegacion:siguiente_punto',
        CAMBIO_PARADA: 'navegacion:cambio_parada',
        CAMBIO_TRAMO: 'navegacion:cambio_tramo'
    },
    
    // Audio
    AUDIO: {
        REPRODUCIR: 'audio:reproducir',
        PAUSAR: 'audio:pausar',
        DETENER: 'audio:detener',
        ACTUALIZAR_PROGRESO: 'audio:actualizar_progreso',
        TERMINADO: 'audio:terminado',
        CAMBIO_VOLUMEN: 'audio:cambio_volumen',
        MUTEAR: 'audio:mutear',
        DESMUTEAR: 'audio:desmutear'
    },
    
    // Retos
    RETOS: {
        MOSTRAR: 'retos:mostrar',
        OCULTAR: 'retos:ocultar',
        INICIAR: 'retos:iniciar',
        COMPLETADO: 'retos:completado',
        FALLIDO: 'retos:fallido',
        REINICIAR: 'retos:reiniciar',
        RESULTADO: 'retos:resultado',
        PROGRESO: 'retos:progreso'
    },
    
    // Estado
    ESTADO: {
        ACTUALIZAR: 'estado:actualizar',
        SOLICITAR: 'estado:solicitar',
        SINCRONIZAR: 'estado:sincronizar',
        CAMBIO_MODO: 'estado:cambio_modo',
        ACTUALIZAR_CONTROLES: 'estado:actualizar_controles'
    },
    
    // Interfaz de usuario
    UI: {
        MOSTRAR_MENSAJE: 'ui:mostrar_mensaje',
        OCULTAR_MENSAJE: 'ui:ocultar_mensaje',
        ACTUALIZAR_INTERFAZ: 'ui:actualizar_interfaz',
        CAMBIO_MODO: 'ui:cambio_modo',
        NOTIFICACION: 'ui:notificacion'
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

// Estado global de la aplicación
const estadoGlobal = {
    // Estado de la aplicación
    modo: 'aventura', // 'casa' o 'aventura'
    controlesHabilitados: true,
    motivoDeshabilitado: null,
    
    // Estado del GPS
    gpsActivo: true,
    ultimaUbicacion: null,
    precisionUbicacion: null,
    
    // Metadatos
    ultimaAccion: null,
    timestamp: Date.now(),
    version: '1.0.0'
};

/**
 * Actualiza el estado del GPS en la aplicación
 * @param {boolean} activo - Estado del GPS
 * @param {Object} ubicacion - Datos de ubicación (opcional)
 */
function actualizarEstadoGPS(activo, ubicacion = null) {
    estadoGlobal.gpsActivo = activo;
    
    if (ubicacion) {
        estadoGlobal.ultimaUbicacion = {
            latitud: ubicacion.latitud || null,
            longitud: ubicacion.longitud || null,
            precision: ubicacion.precision || null,
            timestamp: Date.now()
        };
        estadoGlobal.precisionUbicacion = ubicacion.precision || null;
    }
    
    // Notificar a los controladores registrados
    dispararEvento('actualizacionGPS', {
        gpsActivo: activo,
        ubicacion: estadoGlobal.ultimaUbicacion
    });
}

/**
 * Maneja los mensajes entrantes
 * @param {MessageEvent} event - Evento de mensaje
 */
function manejarMensajeEntrante(event) {
    try {
        const mensaje = event.data;
        
        // Validar mensaje básico
        if (!mensaje || typeof mensaje !== 'object') {
            return;
        }
        
        // Registrar mensaje recibido
        logger.debug('Mensaje recibido:', mensaje);
        
        // Manejar mensajes del sistema
        if (mensaje.tipo === TIPOS_MENSAJE.SISTEMA.PING) {
            // Responder a ping
            if (mensaje.origen !== config.iframeId) {
                enviarMensaje(mensaje.origen, TIPOS_MENSAJE.SISTEMA.PONG);
            }
            return;
        }
        
        if (mensaje.tipo === TIPOS_MENSAJE.SISTEMA.PONG) {
            // Actualizar estado de conexión
            config.isOnline = true;
            return;
        }
        
        // Manejar actualizaciones de GPS
        if (mensaje.tipo === TIPOS_MENSAJE.SISTEMA.GPS_ESTADO) {
            actualizarEstadoGPS(
                mensaje.datos.activo,
                mensaje.datos.ubicacion
            );
            return;
        }
        
        // Disparar evento para que los controladores registrados lo manejen
        if (mensaje.tipo) {
            const tipoEvento = mensaje.tipo.split(':').pop();
            dispararEvento(tipoEvento, {
                ...mensaje.datos,
                origen: mensaje.origen,
                destino: mensaje.destino,
                timestamp: mensaje.timestamp
            });
        }
        
    } catch (error) {
        logger.error('Error al procesar mensaje entrante:', error);
    }
}

// Controladores de eventos
const controladores = {
    cambioModo: [],
    habilitarControles: [],
    deshabilitarControles: [],
    actualizarEstado: []
};

/**
 * Registra un controlador para un tipo de evento
 * @param {string} tipo - Tipo de evento ('cambioModo', 'habilitarControles', 'deshabilitarControles', 'actualizarEstado')
 * @param {Function} controlador - Función que manejará el evento
 * @returns {Function} Función para eliminar el controlador
 */
function registrarControlador(tipo, controlador) {
    if (!controladores[tipo]) {
        logger.warn(`Tipo de controlador no válido: ${tipo}`);
        return () => {};
    }
    
    controladores[tipo].push(controlador);
    
    // Retorna una función para eliminar el controlador
    return () => {
        const index = controladores[tipo].indexOf(controlador);
        if (index !== -1) {
            controladores[tipo].splice(index, 1);
        }
    };
}

/**
 * Dispara un evento a todos los controladores registrados
 * @param {string} tipo - Tipo de evento
 * @param {*} datos - Datos a enviar a los controladores
 */
function dispararEvento(tipo, datos) {
    if (!controladores[tipo]) {
        logger.warn(`No hay controladores para el tipo: ${tipo}`);
        return;
    }
    
    controladores[tipo].forEach(controlador => {
        try {
            controlador(datos);
        } catch (error) {
            logger.error(`Error en el controlador de ${tipo}:`, error);
        }
    });
}

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
function inicializarMensajeria({ 
    iframeId, 
    logLevel = LOG_LEVELS.INFO, 
    debug = false,
    maxRetries = 3,
    retryDelay = 1000,
    connectionCheckInterval = 5000,
    maxHistorySize = 100
} = {}) {
    // Actualizar configuración
    Object.assign(config, {
        iframeId: iframeId || config.iframeId,
        logLevel: logLevel in LOG_LEVELS ? logLevel : LOG_LEVELS.INFO,
        debug: Boolean(debug),
        maxRetries: Math.max(1, parseInt(maxRetries) || 3),
        retryDelay: Math.max(100, parseInt(retryDelay) || 1000),
        connectionCheckInterval: Math.max(1000, parseInt(connectionCheckInterval) || 5000),
        maxHistorySize: Math.max(10, parseInt(maxHistorySize) || 100)
    });
    
    // Iniciar monitoreo de conexión
    iniciarMonitoreoConexion();
    
    // Configurar manejador de mensajes entrantes
    window.addEventListener('message', manejarMensajeEntrante);
    
    // Configurar evento beforeunload para limpieza
    window.addEventListener('beforeunload', () => {
        detenerMonitoreoConexion();
        window.removeEventListener('message', manejarMensajeEntrante);
    });
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

/**
 * Habilita o deshabilita los controles según el modo especificado
 * @param {string} modo - Modo de operación ('casa' o 'aventura')
 * @param {Object} opciones - Opciones adicionales
 * @param {string} [opciones.motivo] - Razón del cambio de estado
 * @param {boolean} [opciones.forzar] - Forzar el cambio aunque ya esté en ese estado
 * @returns {boolean} true si se realizó el cambio, false en caso contrario
 */
function enableControls(modo = 'casa', { motivo = 'sin_especificar', forzar = false } = {}) {
    if (!['casa', 'aventura'].includes(modo)) {
        logger.warn(`Modo no válido: ${modo}. Usando 'casa' por defecto.`);
        modo = 'casa';
    }
    
    // No hacer nada si el modo es el mismo y no se fuerza
    if (estadoGlobal.modo === modo && !forzar) {
        logger.debug(`Los controles ya están en modo '${modo}'. No se realizan cambios.`);
        return false;
    }
    
    const estadoAnterior = { ...estadoGlobal };
    
    // Actualizar estado
    estadoGlobal.modo = modo;
    estadoGlobal.controlesHabilitados = true;
    estadoGlobal.motivoDeshabilitacion = null;
    estadoGlobal.ultimaAccion = 'enableControls';
    estadoGlobal.timestamp = Date.now();
    
    logger.info(`Controles habilitados en modo '${modo}'. Motivo: ${motivo}`);
    
    // Notificar a los controladores
    dispararEvento('cambioModo', { 
        modo, 
        motivo,
        estadoAnterior,
        estadoActual: { ...estadoGlobal }
    });
    
    return true;
}

/**
 * Deshabilita los controles con un motivo específico
 * @param {string} motivo - Razón por la que se deshabilitan los controles
 * @returns {boolean} true si se deshabilitaron los controles, false si ya estaban deshabilitados
 */
function disableControls(motivo = 'sin_especificar') {
    if (!estadoGlobal.controlesHabilitados) {
        logger.debug(`Los controles ya están deshabilitados. Motivo anterior: ${estadoGlobal.motivoDeshabilitacion || 'sin_especificar'}`);
        return false;
    }
    
    const estadoAnterior = { ...estadoGlobal };
    
    // Actualizar estado
    estadoGlobal.controlesHabilitados = false;
    estadoGlobal.motivoDeshabilitacion = motivo;
    estadoGlobal.ultimaAccion = 'disableControls';
    estadoGlobal.timestamp = Date.now();
    
    logger.info(`Controles deshabilitados. Motivo: ${motivo}`);
    
    // Notificar a los controladores
    dispararEvento('deshabilitarControles', {
        motivo,
        estadoAnterior,
        estadoActual: { ...estadoGlobal }
    });
    
    return true;
}

/**
 * Maneja el cambio de modo de la aplicación
 * @param {string} modo - Nuevo modo ('casa' o 'aventura')
 * @param {boolean} habilitar - Si es true, habilita los controles
 * @param {Object} opciones - Opciones adicionales
 * @param {string} [opciones.motivo] - Razón del cambio de modo
 * @param {boolean} [opciones.forzar] - Forzar el cambio aunque ya esté en ese modo
 * @returns {boolean} true si se realizó el cambio, false en caso contrario
 */
function manejarCambioModo(modo, habilitar = false, { motivo = 'cambio_modo', forzar = false } = {}) {
    if (!['casa', 'aventura'].includes(modo)) {
        logger.warn(`Modo no válido: ${modo}. No se realizan cambios.`);
        return false;
    }
    
    const estadoAnterior = { ...estadoGlobal };
    let cambioRealizado = false;
    
    // Cambiar el modo si es diferente o si se fuerza
    if (estadoGlobal.modo !== modo || forzar) {
        estadoGlobal.modo = modo;
        cambioRealizado = true;
        
        // Notificar a los controladores del cambio de modo
        dispararEvento('cambioModo', {
            modo,
            motivo,
            estadoAnterior,
            estadoActual: { ...estadoGlobal, modo }
        });
    }
    
    // Habilitar/deshabilitar controles según corresponda
    if (habilitar) {
        cambioRealizado = enableControls(modo, { motivo, forzar }) || cambioRealizado;
    } else {
        cambioRealizado = disableControls(motivo) || cambioRealizado;
    }
    
    // Notificar a todos los controladores del estado actual
    if (cambioRealizado) {
        dispararEvento('actualizarEstado', {
            motivo,
            estadoAnterior,
            estadoActual: { ...estadoGlobal }
        });
    }
    
    return cambioRealizado;
}

// Cola de mensajes pendientes
const messageQueue = [];
const pendingMessages = new Map();
let messageIdCounter = 0;

/**
 * Envía un mensaje con reintentos automáticos
 * @param {string} destino - Destinatario del mensaje
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @param {Object} opciones - Opciones adicionales
 * @param {number} [opciones.maxRetries=3] - Número máximo de reintentos
 * @param {number} [opciones.timeout=5000] - Tiempo de espera para reintentos (ms)
 * @param {boolean} [opciones.important=false] - Si es true, se reintentará incluso en modo offline
 * @returns {Promise<Object>} Respuesta del mensaje
 */
async function enviarMensajeConReintentos(destino, tipo, datos = {}, {
    maxRetries = config.maxRetries,
    timeout = 5000,
    important = false
} = {}) {
    const messageId = `msg_${Date.now()}_${messageIdCounter++}`;
    const message = crearMensaje(tipo, datos, destino, config.iframeId);
    
    // Añadir a la cola si estamos offline y no es importante
    if (!config.isOnline && !important) {
        messageQueue.push({ message, options: { maxRetries, timeout, important } });
        return { success: false, queued: true, messageId };
    }

    let attempts = 0;
    const sendAttempt = async () => {
        try {
            attempts++;
            logger.debug(`Enviando mensaje (intento ${attempts}/${maxRetries}):`, message);
            
            // Usar el método de envío existente
            const result = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error('Tiempo de espera agotado'));
                }, timeout);

                enviarMensaje(destino, tipo, datos)
                    .then(result => {
                        clearTimeout(timer);
                        resolve(result);
                    })
                    .catch(error => {
                        clearTimeout(timer);
                        reject(error);
                    });
            });

            // Mensaje enviado con éxito
            config.messageHistory.set(messageId, { 
                ...message, 
                status: 'delivered',
                timestamp: Date.now(),
                attempts
            });
            
            // Limpiar el historial si es necesario
            if (config.messageHistory.size > config.maxHistorySize) {
                const oldestKey = config.messageHistory.keys().next().value;
                config.messageHistory.delete(oldestKey);
            }

            return { success: true, messageId, ...result };
            
        } catch (error) {
            logger.error(`Error al enviar mensaje (${messageId}):`, error);
            
            if (attempts < maxRetries) {
                logger.debug(`Reintentando envío (${attempts + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, timeout));
                return sendAttempt();
            }
            
            // Agregar a la cola para reintentar más tarde
            messageQueue.unshift({ 
                message, 
                options: { 
                    maxRetries: maxRetries - attempts,
                    timeout,
                    important 
                } 
            });
            
            return { 
                success: false, 
                queued: true, 
                messageId, 
                error: error.message 
            };
        }
    };

    return sendAttempt();
}

/**
 * Envía un mensaje a un hijo específico a través del padre
 * @param {string} childId - ID del iframe hijo
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @returns {Promise<Object>} Resultado del envío
 */
async function enviarAHijo(childId, tipo, datos = {}) {
    return enviarMensajeConReintentos('padre', TIPOS_MENSAJE.SISTEMA.REENVIAR_A_HIJO, {
        destino: childId,
        tipo,
        datos,
        timestamp: Date.now()
    }, { important: true });
}

/**
 * Envía un mensaje a todos los hijos a través del padre
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @returns {Promise<Array>} Resultados del envío
 */
async function broadcast(tipo, datos = {}) {
    return enviarMensajeConReintentos('padre', TIPOS_MENSAJE.SISTEMA.BROADCAST, {
        tipo,
        datos,
        timestamp: Date.now()
    }, { important: true });
}

/**
 * Procesa la cola de mensajes pendientes
 */
async function procesarColaMensajes() {
    while (messageQueue.length > 0 && config.isOnline) {
        const { message, options } = messageQueue.shift();
        try {
            await enviarMensajeConReintenos(
                message.destino, 
                message.tipo, 
                message.datos, 
                options
            );
        } catch (error) {
            logger.error('Error al procesar mensaje de la cola:', error);
            // Reinsertar al principio para reintentar más tarde
            messageQueue.unshift({ message, options });
            break;
        }
    }
}

/**
 * Verifica el estado de la conexión
 */
async function verificarConexion() {
    try {
        await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.PING);
        if (!config.isOnline) {
            config.isOnline = true;
            logger.info('Conexión restablecida');
            await procesarColaMensajes();
        }
    } catch (error) {
        if (config.isOnline) {
            config.isOnline = false;
            logger.warn('Sin conexión, poniendo mensajes en cola');
        }
    }
}

// Iniciar el monitoreo de conexión
function iniciarMonitoreoConexion() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
    }
    
    connectionCheckInterval = setInterval(() => {
        verificarConexion();
    }, config.connectionCheckInterval);
}

// Detener el monitoreo de conexión
function detenerMonitoreoConexion() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
}

// Exportar la API pública
export {
    // Constantes
    TIPOS_MENSAJE,
    LOG_LEVELS,
    
    // Funciones principales
    crearMensaje,
    validarMensaje,
    inicializarMensajeria,
    
    // Funciones de control
    enableControls,
    disableControls,
    manejarCambioModo,
    
    // Manejo de eventos
    registrarControlador,
    dispararEvento,
    
    // Estado
    estadoGlobal,
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
