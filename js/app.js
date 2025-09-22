/**
 * Módulo principal de la aplicación que gestiona el estado global y la lógica de negocio.
 * @version 2.1.0
 */

// 1. Importar dependencias
import { MODOS, TIPOS_MENSAJE } from './constants.js';
import logger from './logger.js';
import { registrarControlador, enviarMensaje, inicializarMensajeria } from './mensajeria.js';
import { CONFIG } from './config.js';

// 3. Estado unificado de la aplicación
export const estado = {
  // Estado de inicialización
  inicializado: false,
  inicializando: false,
  ultimoError: null,
  
  // Estado de la aplicación
  modo: {
    actual: MODOS.CASA,
    anterior: null,
    ultimoCambio: null
  },
  
  // Estado de los servicios
  gpsActivo: false,
  controlesHabilitados: true,
  mensajeriaInicializada: false,
  
  // Estado de navegación
  puntoActual: null, // Será inicializado con la primera parada
  tramoActual: null,
  
  // Referencias
  mensajeria: null,
  
  // Versión
  version: '2.1.0'
};

// 4. Manejadores de Lógica de Negocio
async function manejarCambioModo(mensaje) {
  const { modo } = mensaje.datos;
  if (modo && estado.modo !== modo) {
    logger.info(`🔄 Cambiando modo de '${estado.modo}' a '${modo}'`);
    estado.modo = modo;
    estado.gpsActivo = (modo === MODOS.AVENTURA);
    
    // Notificar a todos los iframes sobre el cambio de modo
    await enviarMensaje('todos', TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, { 
        modo: estado.modo,
        gpsActivo: estado.gpsActivo 
    });
  }
}

async function manejarSolicitudDestino(mensaje) {
    // Lógica para avanzar al siguiente punto en la aventura
    const indiceActual = AVENTURA_PARADAS ? AVENTURA_PARADAS.findIndex(p => p.id === estado.puntoActual?.id) : -1;
    const siguienteIndice = indiceActual >= 0 ? (indiceActual + 1) % AVENTURA_PARADAS.length : 0;
    estado.puntoActual = AVENTURA_PARADAS ? AVENTURA_PARADAS[siguienteIndice] : null;

    logger.info(`📍 Nuevo destino: ${estado.puntoActual?.nombre || 'Desconocido'}`);

    // Notificar a todos los hijos del nuevo punto
    if (estado.puntoActual) {
        await enviarMensaje('todos', TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA, { punto: estado.puntoActual });
    }
}

// 5. Inicialización del módulo
export async function inicializar() {
    if (estado.inicializado || estado.inicializando) {
        logger.warn('La aplicación ya está inicializada o en proceso de inicialización');
        return;
    }

    estado.inicializando = true;
    logger.info('🧠 Inicializando aplicación...');

    try {
        // Inicializar mensajería
        await inicializarMensajeria({
            iframeId: CONFIG.IFRAME_ID,
            debug: CONFIG.DEBUG,
            logLevel: CONFIG.LOG_LEVEL
        });

        // Registrar manejadores con duplicate prevention
        if (!estado.manejadoresRegistrados) {
            logger.debug('Registrando manejadores de mensajes...');
            
            // Registrar manejador PING
            logger.debug('Registrando manejador PING');
            registrarControlador(TIPOS_MENSAJE.SISTEMA.PING, manejarPing);
            
            // Registrar otros manejadores
            registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, manejarCambioModo);
            registrarControlador(TIPOS_MENSAJE.NAVEGACION.SOLICITAR_DESTINO, manejarSolicitudDestino);
            
            // Marcar como registrados
            estado.manejadoresRegistrados = true;
            logger.debug('Manejadores registrados correctamente');
        } else {
            logger.debug('Los manejadores ya estaban registrados');
        }

        // Actualizar estado
        estado.inicializado = true;
        estado.mensajeriaInicializada = true;
        
        logger.info('✅ Aplicación inicializada correctamente');
        
        // Notificar inicialización exitosa
        await notificarInicializacion();
        
        return true;
    } catch (error) {
        await notificarError('inicializacion', error);
        throw error;
    } finally {
        estado.inicializando = false;
    }
}

// 6. Manejadores de mensajes

/**
 * Maneja el mensaje PING para verificar la conectividad
 */
function manejarPing(mensaje) {
    logger.debug('PING recibido:', mensaje);
    return { 
        estado: 'activo', 
        timestamp: new Date().toISOString(),
        version: estado.version
    };
}

// 7. Funciones de utilidad

/**
 * Inicializa la mensajería de la aplicación
 */
async function inicializarMensajeriaApp() {
    if (estado.mensajeriaInicializada) {
        logger.warn('La mensajería ya está inicializada');
        return;
    }

    logger.info('Inicializando mensajería...');

    try {
        // Inicializar el módulo de mensajería
        await inicializarMensajeria({
            iframeId: CONFIG.IFRAME_ID,
            debug: CONFIG.DEBUG,
            logLevel: CONFIG.LOG_LEVEL,
            reintentos: CONFIG.REINTENTOS
        });

        estado.mensajeriaInicializada = true;
        logger.info('Mensajería inicializada correctamente');
        return true;
    } catch (error) {
        await notificarError('inicializacion_mensajeria', error);
        throw error;
    }
}

// Función para notificar errores
export async function notificarError(tipo, error) {
    // Usar el logger para registrar el error
    logger.error(`Error (${tipo}):`, error);
    
    // Enviar mensaje de error al padre si es necesario
    if (typeof enviarMensaje === 'function') {
        try {
            await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
                tipo,
                mensaje: error.message,
                stack: error.stack,
                origen: CONFIG.IFRAME_ID,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            logger.error('Error al notificar error al padre:', e);
        }
    }
}

// Función para notificar inicialización exitosa
async function notificarInicializacion() {
    if (typeof enviarMensaje === 'function') {
        try {
            await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ESTADO, {
                tipo: 'inicializacion_completada',
                estado: 'listo',
                origen: CONFIG.IFRAME_ID,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error al notificar inicialización:', error);
        }
    }
}

/**
 * Maneja el cambio de modo de la aplicación
 * @param {Object} mensaje - Mensaje con datos del cambio de modo
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function manejarCambioModo(mensaje) {
    try {
        const { modo } = mensaje.datos || {};
        if (!modo) {
            return { exito: false, error: 'Modo no especificado' };
        }
        
        logger.info(`Cambiando a modo: ${modo}`);
        
        // Actualizar estado
        estado.modo.anterior = estado.modo.actual;
        estado.modo.actual = modo;
        estado.modo.ultimoCambio = new Date().toISOString();
        estado.gpsActivo = (modo === MODOS.AVENTURA);
        
        return { 
            exito: true, 
            modo, 
            modoAnterior: estado.modo.anterior 
        };
    } catch (error) {
        logger.error('Error al cambiar de modo:', error);
        return { exito: false, error: error.message };
    }
}

/**
 * Facilita el envío de un cambio de modo
 * @param {string} nuevoModo - Nuevo modo ('casa' o 'aventura')
 * @param {string} origen - ID del remitente
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function enviarCambioModo(nuevoModo, origen = 'app') {
    if (nuevoModo !== 'casa' && nuevoModo !== 'aventura') {
        throw new Error(`Modo inválido: ${nuevoModo}`);
    }
    
    return await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, { 
        modo: nuevoModo,
        origen,
        timestamp: new Date().toISOString()
    });
}

// Función para registrar manejadores de mensajes
async function registrarManejadores() {
    try {
        // Los manejadores ya están registrados en la inicialización
        if (!estado.manejadoresRegistrados) {
            logger.debug('Registrando manejadores...');
            
            // Registrar solo lo básico
            registrarControlador(TIPOS_MENSAJE.SISTEMA.PING, manejarPing);
            registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, manejarCambioModo);
            registrarControlador(TIPOS_MENSAJE.NAVEGACION.SOLICITAR_DESTINO, manejarSolicitudDestino);
            
            estado.manejadoresRegistrados = true;
        }
        
        logger.info('Manejadores de mensajes registrados correctamente');
        return true;
    } catch (error) {
        logger.error('Error al registrar manejadores:', error);
        throw error;
    }
}

// Export what's needed
export {
    inicializar,
    CONFIG
};
