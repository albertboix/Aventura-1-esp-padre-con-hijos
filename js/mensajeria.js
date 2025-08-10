/**
 * SISTEMA DE MENSAJERÍA CENTRALIZADA
 * Versión 2.0 - Comunicación bidireccional padre-hijos
 * Soporta múltiples iframes y manejo de errores robusto
 */

// ================== TIPOS DE MENSAJE UNIFICADOS ==================
export const TIPOS_MENSAJE = {
    // Sistema
    SISTEMA: {
        INICIALIZACION: 'sistema:inicializacion',
        CAMBIO_MODO: 'sistema:cambio_modo',
        LISTO: 'sistema:listo',
        ERROR: 'sistema:error'
    },
    // Navegación
    NAVEGACION: {
        CAMBIO_PARADA: 'navegacion:cambio_parada',
        CAMBIO_TRAMO: 'navegacion:cambio_tramo',
        GPS_ESTADO: 'navegacion:gps_estado'
    },
    // Audio
    AUDIO: {
        REPRODUCIR: 'audio:reproducir',
        PAUSAR: 'audio:pausar',
        DETENER: 'audio:detener',
        FINALIZADO: 'audio:finalizado'
    }
};

// ================== CONFIGURACIÓN GLOBAL ==================
const CONFIG = {
    DEBUG: true,
    TIMEOUT: 5000,
    MAX_RETRIES: 3
};

// ================== ESTADO GLOBAL ==================
let sistemaInicializado = false;
let manejadores = new Map();

/**
 * Inicializa el sistema de mensajería
 */
export async function inicializarMensajeria(config = {}) {
    if (sistemaInicializado) {
        console.warn('Sistema de mensajería ya inicializado');
        return;
    }
    
    Object.assign(CONFIG, config);
    sistemaInicializado = true;
    
    console.log('✅ Sistema de mensajería inicializado');
}

/**
 * Registra un controlador para un tipo de mensaje
 */
export function registrarControlador(tipo, manejador) {
    manejadores.set(tipo, manejador);
    console.log(`📝 Controlador registrado para: ${tipo}`);
}

/**
 * Envía un mensaje
 */
export async function enviarMensaje(destino, tipo, datos, opciones = {}) {
    const mensaje = {
        tipo,
        datos,
        destino,
        origen: CONFIG.iframeId || 'desconocido',
        timestamp: new Date().toISOString(),
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    try {
        if (destino === 'padre') {
            window.parent.postMessage(mensaje, '*');
        } else {
            // Enviar a otros iframes
            const iframe = document.getElementById(destino);
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(mensaje, '*');
            }
        }
        
        if (CONFIG.DEBUG) {
            console.log(`📤 Mensaje enviado:`, mensaje);
        }
        
        return mensaje.id;
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
        throw error;
    }
}

// Manejador global de mensajes
window.addEventListener('message', async (event) => {
    const { tipo, datos, origen } = event.data;
    
    if (manejadores.has(tipo)) {
        try {
            await manejadores.get(tipo)({ tipo, datos, origen });
        } catch (error) {
            console.error(`❌ Error procesando mensaje ${tipo}:`, error);
        }
    }
});

export default {
    inicializarMensajeria,
    registrarControlador,
    enviarMensaje,
    TIPOS_MENSAJE
};
