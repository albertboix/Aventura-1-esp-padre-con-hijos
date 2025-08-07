/**
 * @module Mensajeria
 * @description Sistema de mensajería centralizada para la aplicación Valencia Tour.
 * Proporciona una API robusta para la comunicación entre iframes con soporte para
 * reintentos, confirmaciones, métricas y manejo de errores.
 * 
 * @example
 * // Uso básico
 * import Mensajeria from './mensajeria.js';
 * 
 * // Inicialización
 * await Mensajeria.inicializar({ iframeId: 'miIframe' });
 * 
 * // Registrar manejador
 * Mensajeria.on('tipo.mensaje', (datos, metadata) => {
 *   console.log('Mensaje recibido:', datos);
 * });
 * 
 * // Enviar mensaje
 * await Mensajeria.enviar('destino', 'tipo.mensaje', { clave: 'valor' });
 */

/**
 * Niveles de log disponibles
 * @readonly
 * @enum {number}
 */
export const LOG_LEVELS = Object.freeze({
  DEBUG: 0,   // Mensajes detallados para depuración
  INFO: 1,    // Información general de operaciones
  WARN: 2,    // Advertencias de posibles problemas
  ERROR: 3,   // Errores que no detienen la ejecución
  NONE: 4     // No mostrar logs
});

/**
 * Códigos de error estandarizados
 * @readonly
 * @enum {string}
 */
export const ERRORES = Object.freeze({
  // Errores de validación
  MENSAJE_INVALIDO: 'MENSAJE_INVALIDO',
  DESTINO_INVALIDO: 'DESTINO_INVALIDO',
  TIPO_INVALIDO: 'TIPO_INVALIDO',
  
  // Errores de red/comunicación
  DESTINO_NO_DISPONIBLE: 'DESTINO_NO_DISPONIBLE',
  TIMEOUT: 'TIMEOUT',
  ENVIO_FALLIDO: 'ENVIO_FALLIDO',
  
  // Errores de estado
  NO_INICIALIZADO: 'NO_INICIALIZADO',
  YA_INICIALIZADO: 'YA_INICIALIZADO',
  
  // Errores de mensajes
  MENSAJE_DUPLICADO: 'MENSAJE_DUPLICADO',
  CONFIRMACION_PENDIENTE: 'CONFIRMACION_PENDIENTE',
  
  // Errores de sistema
  ERROR_INTERNO: 'ERROR_INTERNO'
});

/**
 * Tipos de mensaje predefinidos
 * @readonly
 * @enum {string}
 */
export const TIPOS_MENSAJE = Object.freeze({
  // Mensajes del sistema
  INICIALIZACION: 'sistema:inicializacion',
  CAMBIO_MODO: 'sistema:cambio_modo',
  CAMBIO_ESTADO: 'sistema:cambio_estado',
  HABILITAR_CONTROLES: 'sistema:habilitar_controles',
  DESHABILITAR_CONTROLES: 'sistema:deshabilitar_controles',
  
  // Mensajes específicos de módulos
  SELECCION_PUNTO: 'hijo5:seleccion_punto',
  AUDIO: 'hijo3:audio',
  NAVEGACION: 'hijo2:navegacion',
  RETO: 'hijo4:reto',
  CONFIRMACION: 'sistema:confirmacion',
  
  // Flujo de navegación
  USUARIO_FUERA_RADIO: 'usuario-fuera-radio',
  ESTADO_INICIAL: 'estado-inicial',
  PARADA_COMPLETADA: 'parada-completada',
  VER_IMAGEN: 'ver-imagen',
  
  // Navegación
  INICIO_NAVEGACION: 'inicio-navegacion',
  FIN_NAVEGACION: 'fin-navegacion',
  LLEGADA_PARADA: 'llegada-parada',
  OCULTAR_FLECHA: 'ocultar-flecha-navegacion'
});

/**
 * Esquema de validación para mensajes
 * @type {Object}
 */
const ESQUEMA_MENSAJE = {
  id: { type: 'string', required: true },
  origen: { type: 'string', required: true },
  destino: { type: 'string', required: true },
  tipo: { type: 'string', required: true },
  timestamp: { type: 'number', required: true },
  datos: { type: 'object', required: false },
  metadata: { type: 'object', required: false }
};

/**
 * Configuración por defecto para la mensajería
 * @type {Object}
 */
const CONFIG_POR_DEFECTO = Object.freeze({
  // Identificación
  iframeId: 'desconocido',
  
  // Logging
  logLevel: LOG_LEVELS.INFO,
  debug: false,
  
  // Seguridad
  dominioPermitido: window.location.origin || '*',
  
  // Reintentos
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 10000,
  factorBackoff: 2,
  
  // Timeouts
  timeoutMensaje: 10000, // 10 segundos
  
  // TTL
  mensajeTtl: 5 * 60 * 1000, // 5 minutos
  
  // Métricas
  habilitarMetricas: true,
  
  // Confirmaciones
  confirmacionesHabilitadas: true
});

let config = { ...CONFIG_POR_DEFECTO };

// Sistema de seguimiento de mensajes mejorado
const mensajesProcesados = new Map();
const mensajesPendientes = new Map();
const metricas = {
    mensajesEnviados: 0,
    mensajesRecibidos: 0,
    mensajesFallidos: 0,
    errores: 0,
    reintentos: 0,
    tiempoPromedioRespuesta: 0,
    ultimoError: null,
    ultimoMensaje: null,
    ultimaActualizacion: new Date().toISOString()
};

// Configuración de reintentos con retroceso exponencial
const RETRY_CONFIG = {
    maxRetries: 5,
    initialDelay: 1000, // 1 segundo
    maxDelay: 30000,   // 30 segundos
    factor: 2,         // Factor de multiplicación para el retraso
    jitter: 0.5        // Variación aleatoria en el retraso (0-1)
};

/**
 * Genera un ID único para mensajes
 * @returns {string} ID único generado
 */
function generarIdUnico() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Calcula el tiempo de espera con retroceso exponencial
 * @param {number} intento - Número de intento actual
 * @returns {number} Tiempo de espera en milisegundos
 */
function calcularTiempoEspera(intento) {
    const { initialDelay, maxDelay, factor, jitter } = RETRY_CONFIG;
    const delay = Math.min(initialDelay * Math.pow(factor, intento - 1), maxDelay);
    const jitterAmount = delay * jitter * Math.random();
    return delay + jitterAmount;
}

// Historial de mensajes para depuración (últimos 100 mensajes)
const historialMensajes = [];
const MAX_HISTORIAL = 100;

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

/**
 * Crea un mensaje con metadatos estandarizados
 * @param {string} tipo - Tipo de mensaje (de TIPOS_MENSAJE)
 * @param {Object} [datos={}] - Datos del mensaje
 * @param {string} [destino=null] - ID del iframe destino
 * @param {Object} [opciones={}] - Opciones adicionales
 * @returns {Object} Mensaje formateado
 */
function crearMensaje(tipo, datos = {}, destino = null, opciones = {}) {
    if (!tipo || typeof tipo !== 'string') {
        const error = new Error('El tipo de mensaje es requerido y debe ser una cadena');
        error.codigo = 'TIPO_INVALIDO';
        throw error;
    }
    
    const mensaje = {
        id: generarIdUnico(),
        tipo,
        datos,
        timestamp: Date.now(),
        timestampISO: new Date().toISOString(),
        origen: config.iframeId,
        destino,
        version: '2.0.0',
        // Metadatos adicionales
        secuencia: metricas.mensajesEnviados + 1,
        ...opciones
    };

    // Añadir información de seguimiento si está habilitado
    if (opciones.habilitarSeguimiento !== false) {
        mensaje._seguimiento = {
            intento: opciones.intento || 1,
            maxIntentos: opciones.maxIntentos || RETRY_CONFIG.maxRetries,
            timeout: opciones.timeout || config.timeoutMensaje
        };
    }

    // Asegurar que los datos tengan un tipo si no lo tienen
    if (!mensaje.datos.tipo) {
        mensaje.datos.tipo = tipo.split(':').pop(); // Extrae el último segmento como subtipo
    }

    logger.debug('Mensaje creado', { tipo, destino, id: mensaje.id });
    return mensaje;
}

// Función para validar mensajes
function validarMensaje(m) {
    if (!m) return { valido: false, error: 'Mensaje nulo' };
    const req = ['version', 'id', 'timestamp', 'tipo', 'origen'];
    const faltan = req.filter(c => !(c in m));
    if (faltan.length > 0) return { valido: false, error: `Faltan: ${faltan.join(', ')}` };
    return { valido: true };
}

// Envía un mensaje a un iframe destino con manejo de errores mejorado
async function enviarMensaje(destino, tipo, datos = {}, opciones = {}) {
    // Validar parámetros con mensajes de error detallados
    const validaciones = [
        { cond: !destino || typeof destino !== 'string', error: 'Destino inválido' },
        { cond: !tipo || typeof tipo !== 'string', error: 'Tipo de mensaje inválido' },
        { cond: datos && typeof datos !== 'object', error: 'Los datos deben ser un objeto' },
        { cond: opciones && typeof opciones !== 'object', error: 'Las opciones deben ser un objeto' }
    ];

    for (const { cond, error } of validaciones) {
        if (cond) {
            const errorObj = new Error(error);
            errorObj.codigo = 'VALIDACION_FALLIDA';
            errorObj.detalles = { destino, tipo };
            throw errorObj;
        }
    }

    // Crear el mensaje con metadatos
    const mensaje = crearMensaje(tipo, datos, destino, {
        ...opciones,
        timestampEnvio: Date.now()
    });

    // Registrar el mensaje como pendiente
    mensajesPendientes.set(mensaje.id, {
        mensaje,
        timestamp: Date.now(),
        intentos: 1,
        estado: 'enviando',
        timeout: null
    });

    // Obtener el iframe destino con validación
    const iframe = document.getElementById(destino);
    if (!iframe || !iframe.contentWindow) {
        const error = new Error(`No se pudo encontrar el iframe con ID: ${destino}`);
        error.codigo = 'DESTINO_NO_ENCONTRADO';
        throw error;
    }

    // Validar origen del iframe
    try {
        const iframeOrigin = new URL(iframe.src).origin;
        if (iframeOrigin !== window.location.origin) {
            throw new Error('Origen del iframe no coincide');
        }
    } catch (e) {
        const error = new Error(`Origen del iframe no válido: ${e.message}`);
        error.codigo = 'ORIGEN_INVALIDO';
        throw error;
    }

    // Enviar el mensaje con manejo de errores mejorado
    try {
        const destinoWindow = iframe.contentWindow;
        const mensajeSerializado = JSON.stringify(mensaje);

        // Usar postMessage con transferencia estructurada si está disponible
        if (window.structuredClone) {
            const mensajeClonado = JSON.parse(mensajeSerializado);
            destinoWindow.postMessage(mensajeClonado, window.location.origin);
        } else {
            destinoWindow.postMessage(JSON.parse(mensajeSerializado), window.location.origin);
        }

        // Actualizar métricas
        const ahora = Date.now();
        metricas.mensajesEnviados++;
        metricas.ultimaActualizacion = new Date().toISOString();

        // Configurar timeout para confirmación
        const timeoutId = setTimeout(() => {
            const pendiente = mensajesPendientes.get(mensaje.id);
            if (pendiente && pendiente.estado === 'enviando') {
                pendiente.estado = 'timeout';
                metricas.errores++;

                // Notificar al sistema de monitoreo
                if (config.onError) {
                    const error = new Error(`Timeout al enviar mensaje ${mensaje.id}`);
                    error.codigo = 'TIMEOUT_ENVIO';
                    error.mensaje = mensaje;
                    config.onError(error);
                }
            }
        }, opciones.timeout || config.timeoutMensaje);

        // Actualizar estado del mensaje
        const pendiente = mensajesPendientes.get(mensaje.id);
        if (pendiente) {
            pendiente.timeout = timeoutId;
            pendiente.estado = 'enviado';
            pendiente.timestampEnvio = ahora;
        }

        return mensaje;

    } catch (error) {
        // Manejo de errores mejorado
        metricas.errores++;
        metricas.ultimoError = {
            codigo: 'ERROR_ENVIO',
            mensaje: error.message,
            timestamp: new Date().toISOString(),
            stack: error.stack
        };
        throw new Error(`Error al enviar mensaje a ${destino}: ${error.message}`);
    } finally {
        // Limpiar mensajes pendientes antiguos
        limpiarMensajesPendientes();
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
    const idTransaccion = opciones.idTransaccion || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const timestampInicio = Date.now();
    
    // Validar parámetros
    if (!config.iframeId || config.iframeId === 'desconocido') {
        const error = new Error('Sistema de mensajería no inicializado');
        error.codigo = ERRORES.NO_INICIALIZADO;
        throw error;
    }
    
    if (!destino || typeof destino !== 'string') {
        const error = new Error('El destino es requerido y debe ser una cadena');
        error.codigo = ERRORES.DESTINO_INVALIDO;
        throw error;
    }
    
    if (!tipo || typeof tipo !== 'string') {
        const error = new Error('El tipo de mensaje es requerido y debe ser una cadena');
        error.codigo = ERRORES.TIPO_INVALIDO;
        throw error;
    }
    
    // Combinar opciones con la configuración global
    const opcionesEnvio = {
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
        maxRetryDelay: config.maxRetryDelay,
        timeout: config.timeoutMensaje,
        esperarConfirmacion: config.confirmacionesHabilitadas,
        factorBackoff: config.factorBackoff,
        ...opciones
    };
    
    // Crear el mensaje base
    const mensaje = crearMensaje(tipo, {
        ...datos,
        _idTransaccion: idTransaccion,
        _timestampEnvio: timestampInicio
    }, destino);
    
    // Registrar en el historial
    registrarEnHistorial({
        id: mensaje.id,
        tipo,
        origen: config.iframeId,
        destino,
        timestamp: new Date().toISOString(),
        estado: 'enviando',
        intento: 0,
        idTransaccion
    });
    
    // Función para realizar el envío con reintentos
    const enviarConReintentos = async (intento = 0) => {
        const intentoActual = intento + 1;
        const tiempoEspera = Math.min(
            opcionesEnvio.retryDelay * Math.pow(opcionesEnvio.factorBackoff, intento),
            opcionesEnvio.maxRetryDelay
        );
        
        try {
            // Verificar si el mensaje ya fue confirmado por otro intento
            if (mensajesPendientes.has(mensaje.id) && 
                mensajesPendientes.get(mensaje.id).estado === 'confirmado') {
                const resultado = mensajesPendientes.get(mensaje.id).resultado;
                mensajesPendientes.delete(mensaje.id);
                return resultado;
            }
            
            // Configurar timeout
            const controladorTimeout = setTimeout(() => {
                const error = new Error(`Timeout al enviar mensaje a ${destino} (${tipo})`);
                error.codigo = ERRORES.TIMEOUT;
                throw error;
            }, opcionesEnvio.timeout);
            
            // Crear promesa para manejar la confirmación
            let resolverConfirmacion, rechazarConfirmacion;
            const promesaConfirmacion = new Promise((resolve, reject) => {
                resolverConfirmacion = resolve;
                rechazarConfirmacion = reject;
            });
            
            // Registrar el mensaje como pendiente
            mensajesPendientes.set(mensaje.id, {
                mensaje,
                timestamp: Date.now(),
                intento: intentoActual,
                estado: 'pendiente',
                resolver: resolverConfirmacion,
                rechazar: rechazarConfirmacion
            });
            
            // Enviar el mensaje
            enviarMensaje(destino, tipo, mensaje.datos);
            
            // Actualizar métricas
            metricas.mensajesEnviados++;
            
            // Si no se requiere confirmación, resolver inmediatamente
            if (!opcionesEnvio.esperarConfirmacion) {
                clearTimeout(controladorTimeout);
                mensajesPendientes.delete(mensaje.id);
                return Promise.resolve({ confirmado: true });
            }
            
            // Esperar confirmación con timeout
            const resultado = await Promise.race([
                promesaConfirmacion,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Tiempo de espera agotado')), opcionesEnvio.timeout)
                )
            ]);
            
            clearTimeout(controladorTimeout);
            return resultado;
            
        } catch (error) {
            clearTimeout(controladorTimeout);
            
            // Actualizar métricas
            metricas.errores++;
            metricas.ultimoError = {
                mensaje: error.message,
                codigo: error.codigo || 'DESCONOCIDO',
                timestamp: new Date().toISOString(),
                intento: intentoActual,
                tipo,
                destino
            };
            
            // Si se agotaron los reintentos, rechazar con el último error
            if (intentoActual >= opcionesEnvio.maxRetries) {
                logger.error(`Error al enviar mensaje después de ${intentoActual} intentos`, {
                    error: error.message,
                    tipo,
                    destino,
                    idTransaccion
                });
                
                // Eliminar de pendientes si existe
                if (mensajesPendientes.has(mensaje.id)) {
                    const { rechazar } = mensajesPendientes.get(mensaje.id);
                    mensajesPendientes.delete(mensaje.id);
                    if (rechazar) rechazar(error);
                }
                
                throw error;
            }
            
            // Esperar antes de reintentar
            await new Promise(resolve => setTimeout(resolve, tiempoEspera));
            
            // Reintentar
            metricas.reintentos++;
            return enviarConReintentos(intentoActual);
        }
    };
    
    // Iniciar el proceso de envío con reintentos
    try {
        const resultado = await enviarConReintenos();
        
        // Si llegamos aquí, el mensaje se envió correctamente
        logger.info(`[${config.iframeId}] Mensaje enviado exitosamente`, {
            tipo,
            destino,
            mensajeId: mensaje.id,
            idTransaccion
        });
        
        return resultado;
        
    } catch (error) {
        // El error ya fue registrado en enviarConReintenos, solo lo propagamos
        logger.error(`[${config.iframeId}] Error al enviar mensaje`, {
            tipo,
            destino,
            mensajeId: mensaje.id,
            idTransaccion,
            error: error.message,
            stack: error.stack
        });
        
        // Asegurarse de que el mensaje no quede como pendiente
        if (mensajesPendientes.has(mensaje.id)) {
            mensajesPendientes.delete(mensaje.id);
        }
        
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

// ================== FUNCIONES AUXILIARES ==================

/**
 * Registra un mensaje en el historial de mensajes
 * @param {Object} entrada - Entrada del historial
 */
function registrarEnHistorial(entrada) {
    historialMensajes.unshift(entrada);
    if (historialMensajes.length > MAX_HISTORIAL) {
        historialMensajes.pop();
    }
}

/**
 * Obtiene las métricas actuales del sistema
 * @returns {Object} Métricas de rendimiento
 */
function obtenerMetricas() {
    return {
        ...metricas,
        uptime: Date.now() - (window.performance.timing.navigationStart || 0),
        mensajesPendientes: mensajesPendientes.size,
        mensajesProcesados: mensajesProcesados.size,
        historicoMensajes: [...historialMensajes]
    };
}

/**
 * Limpia el estado de mensajes pendientes y procesados
 * @param {boolean} forzar - Si es true, limpia incluso los mensajes no confirmados
 */
function limpiarEstado(forzar = false) {
    if (forzar) {
        mensajesPendientes.clear();
    } else {
        // Solo limpiar mensajes antiguos
        const ahora = Date.now();
        for (const [id, entrada] of mensajesPendientes.entries()) {
            if (ahora - entrada.timestamp > config.mensajeTtl) {
                mensajesPendientes.delete(id);
            }
        }
    }
    
    // Limpiar mensajes procesados antiguos
    const ahora = Date.now();
    for (const [id, timestamp] of mensajesProcesados.entries()) {
        if (ahora - timestamp > config.mensajeTtl) {
            mensajesProcesados.delete(id);
        }
    }
}

// ================== API PÚBLICA ==================

const Mensajeria = {
    // Constantes
    TIPOS_MENSAJE,
    ERRORES,
    LOG_LEVELS,
    LOG_LEVELS,
    logger,
    crearMensaje,
    validarMensaje,
    inicializar: inicializarMensajeria, // Alias para compatibilidad
    inicializarMensajeria,
    enviarMensaje: enviarMensajeConReintenos,
    enviarMensajeConReintenos,
    registrarControlador,
    manejarMensajeEntrante,
    removerControladores: (tipo) => { delete controladores[tipo]; },
    
    // Métodos de utilidad
    obtenerMetricas,
    limpiarEstado,
    
    // Métodos de depuración
    getConfig: () => ({ ...config }),
    getEstado: () => ({
        inicializado: config.iframeId !== 'desconocido',
        mensajesPendientes: mensajesPendientes.size,
        mensajesProcesados: mensajesProcesados.size,
        metricas: obtenerMetricas()
    }),
    
    // Métodos de control
    /**
     * Habilita los controles en todos los iframes
     * @param {string} [modo='casa'] - Modo de operación
     * @param {Object} [opciones={}] - Opciones adicionales
     * @param {string} [opciones.motivo='sin_especificar'] - Razón del cambio
     * @param {boolean} [opciones.forzar=false] - Forzar la operación
     * @returns {Promise<boolean>} True si se completó exitosamente
     */
    async enableControls(modo = 'casa', { motivo = 'sin_especificar', forzar = false } = {}) {
        try {
            console.log(`[Mensajeria] Habilitando controles (modo: ${modo}, motivo: ${motivo})`);
            
            // Habilitar controles localmente
            document.body.classList.remove('controles-deshabilitados');
            
            // Notificar a todos los iframes
            await this.enviarATodos('sistema:controles_habilitados', { 
                modo, 
                motivo,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            console.error('Error al habilitar controles:', error);
            throw error;
        }
    },
    
    /**
     * Deshabilita los controles en todos los iframes
     * @param {string} [motivo='sin_especificar'] - Razón de la deshabilitación
     * @returns {Promise<boolean>} True si se completó exitosamente
     */
    async disableControls(motivo = 'sin_especificar') {
        try {
            console.log(`[Mensajeria] Deshabilitando controles (motivo: ${motivo})`);
            
            // Deshabilitar controles localmente
            document.body.classList.add('controles-deshabilitados');
            
            // Notificar a todos los iframes
            await this.enviarATodos('sistema:controles_deshabilitados', { 
                motivo,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            console.error('Error al deshabilitar controles:', error);
            throw error; // Re-lanzar el error para manejarlo más arriba
        }
    }
};

// Export universal
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mensajeria;
    module.exports.default = Mensajeria; // Para compatibilidad con ES modules
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return Mensajeria; });
} else {
    window.Mensajeria = Mensajeria;
}

// Para compatibilidad con CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports.default = MensajeriaCompleta;
}
