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
 * Genera un ID único con mayor entropía usando timestamp, aleatorio y prefijo opcional
 * @param {string} [prefix='msg'] - Prefijo opcional para el ID
 * @returns {string} ID único garantizado
 */
export function generarIdUnico(prefix = 'msg') {
    // Usar timestamp con milisegundos
    const timestamp = Date.now();
    // Generar componente aleatorio con mayor entropía
    const random = Math.random().toString(36).substring(2, 10) + 
                  Math.random().toString(36).substring(2, 10);
    // Componente único del navegador (cuando esté disponible)
    let uniqueComponent = '';
    if (typeof window !== 'undefined') {
        // Usar información de la sesión cuando esté disponible
        uniqueComponent = window.name || window.sessionStorage?.getItem('session-id') || '';
    }
    
    return `${prefix}-${timestamp}-${random}-${uniqueComponent}`;
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

/**
 * Genera un hash simple para el contenido de un mensaje
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @returns {string} Hash del contenido
 */
export function generarHashContenido(tipo, datos = {}) {
    const contenido = `${tipo}:${JSON.stringify(datos)}`;
    let hash = 0;
    for (let i = 0; i < contenido.length; i++) {
        const char = contenido.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir a entero de 32 bits
    }
    return Math.abs(hash).toString(16);
}

export default {
    configurarUtils,
    crearObjetoError,
    validarObjeto,
    generarId,
    generarIdUnico,
    debounce,
    throttle
};
