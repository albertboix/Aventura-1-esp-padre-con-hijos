/**
 * Utilidades generales para la aplicación
 * @module Utils
 */

import logger from './logger.js';

// Configuración por defecto
let config = {
    iframeId: 'unknown',
    debug: false,
    logLevel: 1
};

/**
 * Configura las utilidades
 * @param {Object} options - Opciones de configuración
 */
export function configurarUtils(options = {}) {
    // Actualizar configuración
    config = { ...config, ...options };
    
    // Configurar logger si está disponible
    if (logger && typeof logger.configure === 'function') {
        logger.configure({
            iframeId: config.iframeId,
            logLevel: config.logLevel,
            debug: config.debug
        });
    }
    
    return config;
}

/**
 * Crea un objeto de error para reportar al sistema
 * @param {string} codigo - Código de error
 * @param {string|Error} error - Mensaje o objeto de error
 * @param {Object} [datos] - Datos adicionales
 * @returns {Object} Objeto de error formateado
 */
export function crearObjetoError(codigo, error, datos = {}) {
    // Si es un string, convertir a objeto Error
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    return {
        codigo,
        mensaje: errorObj.message,
        stack: errorObj.stack,
        timestamp: new Date().toISOString(),
        origen: config.iframeId,
        datos,
        nombre: errorObj.name || 'Error'
    };
}

/**
 * Valida un objeto para asegurar que tiene las propiedades requeridas
 * @param {Object} objeto - Objeto a validar
 * @param {string[]} propiedadesRequeridas - Lista de propiedades requeridas
 * @returns {boolean} True si el objeto es válido
 */
export function validarObjeto(objeto, propiedadesRequeridas) {
    if (!objeto || typeof objeto !== 'object') {
        return false;
    }
    
    return propiedadesRequeridas.every(prop => 
        Object.prototype.hasOwnProperty.call(objeto, prop) && 
        objeto[prop] !== undefined && 
        objeto[prop] !== null
    );
}

/**
 * Genera un ID único
 * @returns {string} ID único
 */
export function generarId() {
    return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función con debounce
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 * @param {Function} func - Función a ejecutar
 * @param {number} limit - Límite de tiempo en ms
 * @returns {Function} Función con throttle
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

export default {
    configurarUtils,
    crearObjetoError,
    validarObjeto,
    generarId,
    debounce,
    throttle
};
