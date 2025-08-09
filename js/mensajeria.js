// Mensajería centralizada para padre e hijos (Aventura 1)
// Versión estandarizada con estado global y flujos específicos por hijo

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };

// Tipos de mensajes estandarizados
export const TIPOS_MENSAJE = {
  // Comandos del sistema
  SISTEMA: {
    INICIALIZACION: 'sistema:inicializacion',
    CONFIRMACION: 'sistema:confirmacion',
    ERROR: 'sistema:error',
    SOLICITUD_ESTADO: 'sistema:solicitud_estado',
    ACTUALIZACION_ESTADO: 'sistema:actualizacion_estado',
    CAMBIO_MODO: 'sistema:cambio_modo'
  },
  
  // Comandos de audio (hijo3)
  AUDIO: {
    REPRODUCIR: 'audio:reproducir',
    PAUSAR: 'audio:pausar',
    DETENER: 'audio:detener',
    VOLUMEN: 'audio:volumen',
    ESTADO: 'audio:estado'
  },
  
  // Comandos de navegación (hijo2)
  NAVEGACION: {
    ESTABLECER_DESTINO: 'navegacion:establecer_destino',
    CANCELAR: 'navegacion:cancelar',
    ACTUALIZAR_POSICION: 'navegacion:actualizar_posicion',
    LLEGADA_DESTINO: 'navegacion:llegada_destino'
  },
  
  // Comandos de retos (hijo4)
  RETO: {
    INICIAR: 'reto:iniciar',
    COMPLETAR: 'reto:completar',
    FALLAR: 'reto:fallar',
    PROGRESO: 'reto:progreso'
  },
  
  // Comandos de modo casa/aventura (hijo5)
  MODO: {
    CAMBIAR: 'modo:cambiar',
    ACTUALIZAR: 'modo:actualizar'
  }
};

// Códigos de error estandarizados
const ERRORES = {
  MENSAJE_INVALIDO: 'MENSAJE_INVALIDO',
  DESTINO_NO_DISPONIBLE: 'DESTINO_NO_DISPONIBLE',
  TIMEOUT: 'TIMEOUT',
  ENVIO_FALLIDO: 'ENVIO_FALLIDO',
  TIPO_INVALIDO: 'TIPO_INVALIDO',
  MENSAJE_DUPLICADO: 'MENSAJE_DUPLICADO',
  ESTADO_INVALIDO: 'ESTADO_INVALIDO',
  OPERACION_NO_PERMITIDA: 'OPERACION_NO_PERMITIDA'
};

// Configuración por defecto
let config = {
    iframeId: 'desconocido',
    logLevel: LOG_LEVELS.INFO,
    debug: false,
    dominioPermitido: '*',
    maxRetries: 3,
    retryDelay: 1000,
    mensajeTtl: 5 * 60 * 1000 // 5 minutos de vida para los mensajes
};

// Sistema de seguimiento de mensajes procesados
const mensajesProcesados = new Map();

// Sistema de logging mejorado
class Logger {
    constructor() { 
        this.logLevel = LOG_LEVELS.INFO; 
    }
    
    setNivel(nivel) { 
        this.logLevel = nivel; 
        this.info('Nivel de log actualizado', { nivel });
    }
    
    debug(mensaje, datos) { 
        if (this.logLevel <= LOG_LEVELS.DEBUG) {
            console.debug(`[${new Date().toISOString()}] [DEBUG] ${mensaje}`, datos);
        }
    }
    
    info(mensaje, datos) { 
        if (this.logLevel <= LOG_LEVELS.INFO) {
            console.log(`[${new Date().toISOString()}] [INFO] ${mensaje}`, datos);
        }
    }
    
    warn(mensaje, datos) { 
        if (this.logLevel <= LOG_LEVELS.WARN) {
            console.warn(`[${new Date().toISOString()}] [WARN] ${mensaje}`, datos);
        }
    }
    
    error(mensaje, error) { 
        if (this.logLevel <= LOG_LEVELS.ERROR) {
            console.error(`[${new Date().toISOString()}] [ERROR] ${mensaje}`, error);
        }
    }
}

const logger = new Logger();

// Limpiar mensajes antiguos periódicamente
setInterval(() => {
    const ahora = Date.now();
    let eliminados = 0;
    
    for (const [id, timestamp] of mensajesProcesados.entries()) {
        if (ahora - timestamp > config.mensajeTtl) {
            mensajesProcesados.delete(id);
            eliminados++;
        }
    }
    
    if (eliminados > 0) {
        logger.debug(`Limpieza de mensajes: ${eliminados} mensajes antiguos eliminados`);
    }
}, 60000); // Ejecutar cada minuto

function crearMensaje(tipo, datos = {}, destino = null) {
    if (!tipo || typeof tipo !== 'string') {
        const error = new Error('El tipo de mensaje es requerido y debe ser una cadena');
        logger.error('Error al crear mensaje', error);
        throw error;
    }
    
    const mensaje = {
        version: '1.1', // Versión incrementada para señalar cambios en la estructura
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        tipo,
        origen: config.iframeId,
        destino,
        datos: { ...datos } // Clonar para evitar mutaciones
    };
    
    // Asegurar que los datos tengan un tipo si no lo tienen
    if (!mensaje.datos.tipo) {
        mensaje.datos.tipo = tipo.split(':').pop(); // Extrae el último segmento como subtipo
    }
    
    logger.debug('Mensaje creado', { tipo, destino, id: mensaje.id });
    return mensaje;
}

function validarMensaje(m) {
    if (!m) return { valido: false, error: 'Mensaje nulo' };
    const req = ['version', 'id', 'timestamp', 'tipo', 'origen'];
    const faltan = req.filter(c => !(c in m));
    if (faltan.length > 0) return { valido: false, error: `Faltan: ${faltan.join(', ')}` };
    return { valido: true };
}

/**
 * Envía un mensaje a un iframe destino
 * @param {string} destino - ID del iframe destino
 * @param {string} tipo - Tipo de mensaje (de TIPOS_MENSAJE)
 * @param {Object} [datos={}] - Datos del mensaje
 * @returns {Object} El mensaje enviado
 * @throws {Error} Si no se puede encontrar el iframe o hay un error al enviar
 */
function enviarMensaje(destino, tipo, datos = {}) {
    // Validar parámetros
    if (!destino || typeof destino !== 'string') {
        const error = new Error('El destino es requerido y debe ser una cadena');
        logger.error('Error al enviar mensaje', error);
        throw error;
    }
    
    if (!tipo || typeof tipo !== 'string') {
        const error = new Error('El tipo de mensaje es requerido y debe ser una cadena');
        logger.error('Error al enviar mensaje', error);
        throw error;
    }
    
    // Crear el mensaje
    const mensaje = crearMensaje(tipo, datos, destino);
    
    // Obtener la ventana de destino
    let ventanaDestino;
    
    if (destino === 'padre' && window.parent !== window) {
        ventanaDestino = window.parent;
    } else {
        const iframe = document.getElementById(destino);
        if (!iframe || !iframe.contentWindow) {
            const error = new Error(`No se pudo encontrar el iframe con ID: ${destino}`);
            logger.error('Error al enviar mensaje', { 
                error: error.message, 
                destino, 
                tipo, 
                mensaje 
            });
            throw error;
        }
        ventanaDestino = iframe.contentWindow;
    }
    
    // Intentar enviar el mensaje
    try {
        // Usar el dominio configurado o '*' si no está definido
        const targetOrigin = config.dominioPermitido || '*';
        
        // Registrar el envío
        logger.debug(`[${config.iframeId}] Enviando mensaje a ${destino}`, {
            tipo,
            mensajeId: mensaje.id,
            timestamp: new Date().toISOString(),
            datos: Object.keys(datos)
        });
        
        // Enviar el mensaje
        ventanaDestino.postMessage(JSON.stringify(mensaje), targetOrigin);
        
        return mensaje;
        
    } catch (error) {
        // Registrar el error
        logger.error(`[${config.iframeId}] Error al enviar mensaje a ${destino}`, {
            tipo,
            mensajeId: mensaje.id,
            error: error.message,
            stack: error.stack
        });
        
        throw new Error(`Error al enviar mensaje a ${destino}: ${error.message}`);
    }
}

/**
 * Envía un mensaje con reintentos automáticos y manejo de timeouts
 * @param {string} destino - ID del iframe destino
 * @param {string} tipo - Tipo de mensaje (de TIPOS_MENSAJE)
 * @param {Object} [datos={}] - Datos del mensaje
 * @param {Object} [opciones={}] - Opciones de envío
 * @param {number} [opciones.maxRetries=3] - Número máximo de reintentos
 * @param {number} [opciones.retryDelay=1000] - Tiempo entre reintentos en ms
 * @param {number} [opciones.timeout=5000] - Tiempo máximo de espera por intento
 * @param {boolean} [opciones.esperarConfirmacion=true] - Si espera confirmación de recepción
 * @returns {Promise<Object>} Promesa que se resuelve con la respuesta o rechaza con error
 */
async function enviarMensajeConReintenos(destino, tipo, datos = {}, opciones = {}) {
    const {
        maxRetries = config.maxRetries,
        retryDelay = config.retryDelay,
        timeout = 5000,
        esperarConfirmacion = true
    } = opciones;
    
    let attempts = 0;
    let lastError = null;
    
    // No esperar confirmación para mensajes de confirmación
    const esperar = esperarConfirmacion && tipo !== TIPOS_MENSAJE.CONFIRMACION;
    
    // Crear un ID único para este envío si no se proporciona uno
    const mensajeId = datos.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Si es un mensaje que espera confirmación, crear una promesa que se resolverá con la confirmación
    let resolverConfirmacion, rechazarConfirmacion;
    let confirmacionRecibida = false;
    
    if (esperar) {
        const promesaConfirmacion = new Promise((resolve, reject) => {
            resolverConfirmacion = (respuesta) => {
                confirmacionRecibida = true;
                clearTimeout(timeoutId);
                resolve(respuesta);
            };
            rechazarConfirmacion = (error) => {
                confirmacionRecibida = true;
                clearTimeout(timeoutId);
                reject(error);
            };
        });
        
        // Configurar un manejador temporal para la confirmación
        const manejadorConfirmacion = (mensaje) => {
            if (mensaje.datos?.idMensajeOriginal === mensajeId) {
                // Eliminar el manejador temporal
                Mensajeria.eliminarControlador(TIPOS_MENSAJE.CONFIRMACION, manejadorConfirmacion);
                
                if (mensaje.datos.estado === 'error') {
                    rechazarConfirmacion(new Error(`Error en destino: ${mensaje.datos.mensaje || 'Error desconocido'}`));
                } else {
                    resolverConfirmacion(mensaje.datos);
                }
            }
        };
        
        // Registrar el manejador temporal
        Mensajeria.registrarControlador(TIPOS_MENSAJE.CONFIRMACION, manejadorConfirmacion);
        
        // Configurar timeout para la confirmación
        const timeoutId = setTimeout(() => {
            if (!confirmacionRecibida) {
                Mensajeria.eliminarControlador(TIPOS_MENSAJE.CONFIRMACION, manejadorConfirmacion);
                rechazarConfirmacion(new Error(`Timeout esperando confirmación para mensaje ${mensajeId}`));
            }
        }, timeout);
        
        // Configurar limpieza en caso de que la promesa sea rechazada
        promesaConfirmacion.catch(() => {
            clearTimeout(timeoutId);
            Mensajeria.eliminarControlador(TIPOS_MENSAJE.CONFIRMACION, manejadorConfirmacion);
        });
    }
    
    // Función para realizar un intento de envío
    const intentarEnvio = async () => {
        attempts++;
        
        try {
            logger.debug(`[${config.iframeId}] Intento ${attempts}/${maxRetries} de enviar mensaje`, {
                tipo,
                destino,
                mensajeId,
                esperandoConfirmacion: esperar
            });
            
            // Crear una copia de los datos para no modificar el original
            const datosEnvio = { ...datos, id: mensajeId };
            
            // Enviar el mensaje
            const resultado = enviarMensaje(destino, tipo, datosEnvio);
            
            // Si no necesitamos esperar confirmación, retornar inmediatamente
            if (!esperar) {
                logger.debug(`[${config.iframeId}] Mensaje enviado sin esperar confirmación`, {
                    tipo,
                    destino,
                    mensajeId
                });
                return { exito: true, mensaje: 'Enviado sin esperar confirmación' };
            }
            
            // Esperar la confirmación con un timeout
            try {
                const confirmacion = await Promise.race([
                    promesaConfirmacion,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout esperando confirmación')), timeout)
                    )
                ]);
                
                logger.debug(`[${config.iframeId}] Confirmación recibida`, {
                    tipo,
                    destino,
                    mensajeId,
                    confirmacion
                });
                
                return confirmacion;
                
            } catch (error) {
                throw new Error(`Error en confirmación: ${error.message}`);
            }
            
        } catch (error) {
            lastError = error;
            
            // Si aún tenemos intentos disponibles, reintentar después del retryDelay
            if (attempts < maxRetries) {
                const delay = retryDelay * Math.pow(2, attempts - 1); // Backoff exponencial
                logger.warn(`[${config.iframeId}] Error en intento ${attempts}/${maxRetries}, reintentando en ${delay}ms`, {
                    tipo,
                    destino,
                    mensajeId,
                    error: error.message,
                    proximoIntentoEn: `${delay}ms`
                });
                
                // Esperar antes de reintentar (con backoff exponencial)
                await new Promise(resolve => setTimeout(resolve, delay));
                return intentarEnvio();
            }
            
            // Si se agotaron los intentos, lanzar el último error
            throw new Error(`Error al enviar mensaje después de ${maxRetries} intentos: ${error.message}`);
        }
    };
    
    // Iniciar el proceso de envío
    try {
        const resultado = await intentarEnvio();
        logger.info(`[${config.iframeId}] Mensaje enviado exitosamente`, {
            tipo,
            destino,
            mensajeId,
            intentos: attempts
        });
        return resultado;
        
    } catch (error) {
        logger.error(`[${config.iframeId}] Error al enviar mensaje después de ${attempts} intentos`, {
            tipo,
            destino,
            mensajeId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Suscripción a mensajes por tipo
const controladores = {};
function registrarControlador(tipo, controlador) {
    if (!controladores[tipo]) controladores[tipo] = [];
    controladores[tipo].push(controlador);
}

// Dispara los controladores registrados para un tipo
async function manejarMensajeEntrante(event) {
    const logPrefix = `[${config.iframeId}]`;
    
    // Verificar origen del mensaje
    if (config.dominioPermitido !== '*' && event.origin !== config.dominioPermitido) {
        logger.warn(`${logPrefix} Mensaje de origen no permitido`, { 
            origen: event.origin, 
            dominioPermitido: config.dominioPermitido 
        });
        return;
    }

    let mensaje;
    try {
        mensaje = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // Validar estructura básica del mensaje
        if (!validarMensaje(mensaje)) {
            logger.warn(`${logPrefix} Mensaje recibido no válido`, { mensaje });
            return;
        }
        
        // Verificar si el mensaje ya fue procesado (protección contra duplicados)
        if (mensaje.id && mensajesProcesados.has(mensaje.id)) {
            logger.debug(`${logPrefix} Mensaje duplicado ignorado`, { 
                id: mensaje.id, 
                tipo: mensaje.tipo,
                origen: mensaje.origen
            });
            return;
        }
        
        // Registrar el mensaje como procesado
        if (mensaje.id) {
            mensajesProcesados.set(mensaje.id, Date.now());
        }
        
        logger.debug(`${logPrefix} Mensaje recibido`, { 
            id: mensaje.id, 
            tipo: mensaje.tipo,
            origen: mensaje.origen,
            destino: mensaje.destino
        });
        
        // Ignorar mensajes que no son para este iframe
        if (mensaje.destino && mensaje.destino !== config.iframeId) {
            logger.debug(`${logPrefix} Mensaje no es para este destino`, { 
                id: mensaje.id,
                destinoEsperado: config.iframeId,
                destinoRecibido: mensaje.destino
            });
            return;
        }
        
        // Manejar confirmaciones primero (no requieren confirmación a su vez)
        if (mensaje.tipo === TIPOS_MENSAJE.CONFIRMACION) {
            logger.debug(`${logPrefix} Confirmación recibida`, { 
                idMensajeOriginal: mensaje.datos?.idMensajeOriginal,
                estado: mensaje.datos?.estado
            });
            // No es necesario confirmar una confirmación
            return;
        }
        
        // Disparar manejadores de forma asíncrona
        const manejadores = obtenerManejadores(mensaje.tipo);
        
        if (manejadores.length === 0) {
            logger.warn(`${logPrefix} No hay manejadores registrados para el tipo`, { 
                tipo: mensaje.tipo,
                mensajeId: mensaje.id
            });
        } else {
            logger.debug(`${logPrefix} Procesando con ${manejadores.length} manejadores`, { 
                tipo: mensaje.tipo,
                mensajeId: mensaje.id
            });
            
            // Ejecutar manejadores en secuencia
            for (const handler of manejadores) {
                try {
                    await Promise.resolve(handler(mensaje, event));
                    logger.debug(`${logPrefix} Manejador ejecutado correctamente`, { 
                        tipo: mensaje.tipo,
                        mensajeId: mensaje.id
                    });
                } catch (error) {
                    logger.error(`${logPrefix} Error en manejador para ${mensaje.tipo}`, { 
                        mensajeId: mensaje.id,
                        error: error.message,
                        stack: error.stack
                    });
                }
            }
        }
        
        // Enviar confirmación de recepción (excepto para confirmaciones)
        if (mensaje.tipo !== TIPOS_MENSAJE.CONFIRMACION && mensaje.origen) {
            try {
                await enviarMensajeConReintenos(
                    mensaje.origen,
                    TIPOS_MENSAJE.CONFIRMACION,
                    {
                        idMensajeOriginal: mensaje.id,
                        tipoOriginal: mensaje.tipo,
                        estado: 'procesado',
                        timestamp: new Date().toISOString()
                    },
                    { maxRetries: 2, timeout: 1000 }
                );
                logger.debug(`${logPrefix} Confirmación enviada`, { 
                    idMensajeOriginal: mensaje.id,
                    destino: mensaje.origen
                });
            } catch (error) {
                logger.error(`${logPrefix} Error al enviar confirmación`, { 
                    idMensajeOriginal: mensaje.id,
                    error: error.message,
                    stack: error.stack
                });
            }
        }
        
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar mensaje`, { 
            error: error.message, 
            stack: error.stack,
            rawData: event.data 
        });
    }
}

/**
 * Inicializa el sistema de mensajería
 * @param {Object} [opciones={}] - Opciones de configuración
 * @param {string} [opciones.iframeId] - Identificador único para este iframe
 * @param {string} [opciones.dominioPermitido='*'] - Dominio permitido para la comunicación
 * @param {number} [opciones.logLevel=LOG_LEVELS.INFO] - Nivel de log
 * @param {boolean} [opciones.debug=false] - Modo depuración
 * @param {number} [opciones.maxRetries=3] - Número máximo de reintentos
 * @param {number} [opciones.retryDelay=1000] - Tiempo entre reintentos en ms
 * @param {number} [opciones.mensajeTtl=300000] - Tiempo de vida de los mensajes en ms (5 minutos)
 */
function inicializarMensajeria(opciones = {}) {
    // Configuración por defecto
    const configPorDefecto = {
        iframeId: `iframe_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        dominioPermitido: '*',
        logLevel: LOG_LEVELS.INFO,
        debug: false,
        maxRetries: 3,
        retryDelay: 1000,
        mensajeTtl: 5 * 60 * 1000 // 5 minutos
    };
    
    // Combinar configuraciones
    config = { ...configPorDefecto, ...opciones };
    
    // Configurar logger
    logger.setNivel(config.logLevel);
    
    // Limpiar manejadores anteriores
    window.removeEventListener('message', manejarMensajeEntrante);
    
    // Agregar manejador de mensajes con capture=false para mejor rendimiento
    window.addEventListener('message', manejarMensajeEntrante, false);
    
    // Registrar evento de cierre para limpieza
    window.addEventListener('beforeunload', () => {
        // Notificar al padre que el iframe se está cerrando
        if (window.parent !== window) {
            try {
                enviarMensaje('padre', TIPOS_MENSAJE.CAMBIO_ESTADO, {
                    estado: 'cerrando',
                    timestamp: new Date().toISOString()
                });
            } catch (e) {
                // Ignorar errores al cerrar
            }
        }
    });
    
    // Registrar evento de inicialización
    logger.info('Sistema de mensajería inicializado', { 
        iframeId: config.iframeId,
        dominioPermitido: config.dominioPermitido,
        logLevel: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === config.logLevel),
        debug: config.debug
    });
    
    // Notificar al padre que estamos listos (si no es la ventana principal)
    if (window.parent !== window) {
        enviarMensajeConReintenos(
            'padre', 
            TIPOS_MENSAJE.INICIALIZACION, 
            { 
                estado: 'listo',
                iframeId: config.iframeId,
                timestamp: new Date().toISOString(),
                version: '1.1.0',
                capacidades: ['confirmaciones', 'reintentos', 'logging']
            },
            { 
                maxRetries: 3, 
                retryDelay: 1000,
                timeout: 2000,
                esperarConfirmacion: true
            }
        ).catch(error => {
            logger.error('Error notificando inicialización al padre', {
                error: error.message,
                stack: error.stack
            });
        });
    }
    
    return config;
}

// API pública
const Mensajeria = {
    TIPOS_MENSAJE,
    ERRORES,
    LOG_LEVELS,
    logger,
    crearMensaje,
    validarMensaje,
    inicializar: inicializarMensajeria, // Alias para compatibilidad
    inicializarMensajeria,
    enviarMensaje,
    enviarMensajeConReintentos,
    enviarMensajeConReintenos: enviarMensajeConReintentos, // Alias para compatibilidad
    registrarControlador,
    manejarMensajeEntrante, // Asegurar que está disponible
    // Añadir funciones de control
    enableControls: function() { console.log('enableControls llamado desde mensajeria'); },
    disableControls: function() { console.log('disableControls llamado desde mensajeria'); }
};

// Export universal
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mensajeria;
} else if (typeof define === 'function' && define.amd) {
    define([], function () { return Mensajeria; });
} else if (typeof window !== 'undefined') {
    window.Mensajeria = Mensajeria;
}
