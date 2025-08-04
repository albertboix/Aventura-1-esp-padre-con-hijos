// Mensajería centralizada para padre e hijos (Aventura 1)
// Versión adaptada a tu arquitectura real

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
const ERRORES = {
    MENSAJE_INVALIDO: 'MENSAJE_INVALIDO',
    DESTINO_NO_DISPONIBLE: 'DESTINO_NO_DISPONIBLE',
    TIMEOUT: 'TIMEOUT',
    ENVIO_FALLIDO: 'ENVIO_FALLIDO',
    TIPO_INVALIDO: 'TIPO_INVALIDO'
};

const TIPOS_MENSAJE = {
    INICIALIZACION: 'sistema:inicializacion',
    CAMBIO_MODO: 'sistema:cambio_modo',
    CAMBIO_ESTADO: 'sistema:cambio_estado',
    HABILITAR_CONTROLES: 'sistema:habilitar_controles',
    DESHABILITAR_CONTROLES: 'sistema:deshabilitar_controles',
    SELECCION_PUNTO: 'hijo5:seleccion_punto',
    AUDIO: 'hijo3:audio',
    NAVEGACION: 'hijo2:navegacion',
    RETO: 'hijo4:reto',
    CONFIRMACION: 'sistema:confirmacion',
    
    // NUEVOS TIPOS PARA EL FLUJO DE NAVEGACIÓN
    USUARIO_FUERA_RADIO: 'usuario-fuera-radio',
    ESTADO_INICIAL: 'estado-inicial',
    PARADA_COMPLETADA: 'parada-completada',
    VER_IMAGEN: 'ver-imagen'
};

let config = {
    iframeId: 'desconocido',
    logLevel: LOG_LEVELS.INFO,
    debug: false,
    dominioPermitido: '*',
    maxRetries: 3,
    retryDelay: 1000
};

class Logger {
    constructor() { this.logLevel = LOG_LEVELS.INFO; }
    setNivel(n) { this.logLevel = n; }
    debug(msg, d) { if (this.logLevel <= LOG_LEVELS.DEBUG) console.debug('[MSG][DEBUG]', msg, d || ''); }
    info(msg, d) { if (this.logLevel <= LOG_LEVELS.INFO) console.info('[MSG][INFO]', msg, d || ''); }
    warn(msg, d) { if (this.logLevel <= LOG_LEVELS.WARN) console.warn('[MSG][WARN]', msg, d || ''); }
    error(msg, d) { if (this.logLevel <= LOG_LEVELS.ERROR) console.error('[MSG][ERROR]', msg, d || ''); }
}
const logger = new Logger();

function crearMensaje(tipo, datos = {}, destino = null, origen = null) {
    return {
        version: '1.0',
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        tipo,
        origen: origen || config.iframeId,
        destino,
        datos
    };
}

function validarMensaje(m) {
    if (!m) return { valido: false, error: 'Mensaje nulo' };
    const req = ['version', 'id', 'timestamp', 'tipo', 'origen'];
    const faltan = req.filter(c => !(c in m));
    if (faltan.length > 0) return { valido: false, error: `Faltan: ${faltan.join(', ')}` };
    return { valido: true };
}

function enviarMensaje(destino, tipo, datos = {}) {
    return new Promise((resolve, reject) => {
        try {
            let target;
            if (destino === 'padre') target = window.parent;
            else {
                const iframe = document.getElementById(destino);
                if (!iframe || !iframe.contentWindow) throw new Error('Destino no disponible');
                target = iframe.contentWindow;
            }
            const mensaje = crearMensaje(tipo, datos, destino, config.iframeId);
            target.postMessage(mensaje, config.dominioPermitido || '*');
            resolve({ success: true, mensaje });
        } catch (e) {
            logger.error('Error al enviar mensaje', e);
            reject(e);
        }
    });
}

async function enviarMensajeConReintentos(destino, tipo, datos = {}, { maxRetries = 3, timeout = 2000 } = {}) {
    let intentos = 0;
    while (intentos < maxRetries) {
        try {
            return await enviarMensaje(destino, tipo, datos);
        } catch (e) {
            intentos++;
            if (intentos >= maxRetries) throw e;
            await new Promise(res => setTimeout(res, timeout));
        }
    }
}

// Suscripción a mensajes por tipo
const controladores = {};
function registrarControlador(tipo, controlador) {
    if (!controladores[tipo]) controladores[tipo] = [];
    controladores[tipo].push(controlador);
}

// Dispara los controladores registrados para un tipo
function dispararControladores(tipo, mensaje) {
    if (controladores[tipo]) {
        controladores[tipo].forEach(fn => {
            try { fn(mensaje); } catch (e) { logger.error('Error en controlador', e); }
        });
    }
}

// Manejador único de mensajes entrantes
function manejarMensajeEntrante(event) {
    if (!event || !event.data) return;
    const mensaje = event.data;
    const valid = validarMensaje(mensaje);
    if (!valid.valido) {
        logger.warn('Mensaje no válido', mensaje);
        return;
    }
    // Confirmación automática
    if (mensaje.id && event.source && event.source.postMessage) {
        try {
            event.source.postMessage({
                tipo: TIPOS_MENSAJE.CONFIRMACION,
                mensajeOriginalId: mensaje.id,
                origen: config.iframeId,
                timestamp: Date.now()
            }, event.origin);
        } catch (e) { logger.error('No se pudo confirmar recepción', e); }
    }
    // Disparar controladores por tipo
    dispararControladores(mensaje.tipo, mensaje);
}

// Inicialización
function inicializarMensajeria({ iframeId, logLevel = LOG_LEVELS.INFO, debug = false, dominioPermitido = '*' } = {}) {
    config.iframeId = iframeId || config.iframeId;
    config.logLevel = logLevel;
    config.debug = debug;
    config.dominioPermitido = dominioPermitido;
    logger.setNivel(logLevel);
    window.addEventListener('message', manejarMensajeEntrante);
    logger.info('Mensajería inicializada', config);
}

// API pública
const Mensajeria = {
    TIPOS_MENSAJE,
    ERRORES,
    LOG_LEVELS,
    logger,
    crearMensaje,
    validarMensaje,
    inicializarMensajeria,
    enviarMensaje,
    enviarMensajeConReintentos,
    registrarControlador
};

// Export universal
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mensajeria;
} else if (typeof define === 'function' && define.amd) {
    define([], function () { return Mensajeria; });
} else if (typeof window !== 'undefined') {
    window.Mensajeria = Mensajeria;
}
