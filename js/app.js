/**
 * Módulo principal de la aplicación
 * @module App
 * @version 1.0.0
 */

import { TIPOS_MENSAJE, MODOS } from './constants.js';
import { enviarMensaje } from './mensajeria.js';
import logger from './logger.js';
import { inicializarMapa } from './funciones-mapa.js';

// Configuración global
export const CONFIG = {
    DEBUG: true,
    LOG_LEVEL: 1, // INFO
    ID_PADRE: 'codigo-padre',
    IFRAME_ID: 'padre',
    HIJOS: {
        CASA: { id: 'hijo5-casa', nombre: 'Botón Casa' },
        COORDENADAS: { id: 'hijo2', nombre: 'Coordenadas' },
        AUDIO: { id: 'hijo3', nombre: 'Audio' },
        RETOS: { id: 'hijo4-retos', nombre: 'Retos' }
    }
};

// Estado global de la aplicación
export const estado = {
    modo: { actual: 'casa', anterior: null },
    paradaActual: 0,
    mensajeriaInicializada: false,
    mapaInicializado: false,
    hijosInicializados: new Set(),
    paradas: []
};

/**
 * Inicializa la aplicación
 * @returns {Promise<boolean>} True si la inicialización fue exitosa
 */
export async function inicializar() {
    try {
        logger.info('Inicializando aplicación...');
        
        // No iniciamos mensajería aquí porque se hace en el código padre
        
        // Marcar como inicializada
        logger.info('Aplicación inicializada correctamente');
        return true;
    } catch (error) {
        logger.error('Error al inicializar la aplicación:', error);
        await notificarError('inicializacion', error);
        throw error;
    }
}

/**
 * Notifica un error al sistema
 * @param {string} codigo - Código de error
 * @param {Error} error - Objeto de error
 */
export async function notificarError(codigo, error) {
    try {
        if (typeof enviarMensaje === 'function') {
            await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
                origen: 'app',
                codigo,
                mensaje: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }
        
        logger.error(`[${codigo}] ${error.message}`, error);
    } catch (e) {
        logger.error('Error al notificar error:', e);
    }
}

/**
 * Envía un mensaje para cambiar el modo de la aplicación
 * @param {string} nuevoModo - Nuevo modo ('casa' o 'aventura')
 * @param {string} origen - Origen del cambio
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

/**
 * Manejador de cambio de modo (para uso interno)
 * @param {Object} mensaje - Mensaje recibido
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function manejarCambioModo(mensaje) {
    const { modo, origen } = mensaje.datos || {};
    
    // Validar el mensaje recibido
    if (!modo) {
        const errorMsg = 'Mensaje de cambio de modo inválido: falta modo';
        logger.error(errorMsg, mensaje);
        return { exito: false, error: errorMsg };
    }
    
    // Verificar si ya estamos en el modo solicitado
    if (modo === estado.modo.actual) {
        logger.info(`Ya estamos en modo ${modo}, no se requiere cambio`);
        return { exito: true, modo: estado.modo.actual, cambiado: false };
    }
    
    try {
        // Actualizar el estado local
        estado.modo.anterior = estado.modo.actual;
        estado.modo.actual = modo;
        
        logger.info(`Modo cambiado a ${modo} desde ${estado.modo.anterior}`);
        
        return { 
            exito: true, 
            modo: estado.modo.actual,
            modoAnterior: estado.modo.anterior,
            cambiado: true
        };
    } catch (error) {
        logger.error(`Error al cambiar a modo ${modo}:`, error);
        
        // Revertir cambios si es necesario
        estado.modo.actual = estado.modo.anterior;
        
        return { exito: false, error: error.message };
    }
}

// Exportar funciones públicas para que puedan ser usadas por otros módulos
export {
    inicializarMapa
};
