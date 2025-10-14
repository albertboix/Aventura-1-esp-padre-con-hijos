/**
 * Utilidades generales para la aplicación
 * @module Utils
 */

import logger from './logger.js';

import { CONFIG } from './config.js';

// Configuración por defecto (usar CONFIG.MENSAJERIA como base)
let config = {
    iframeId: CONFIG.MENSAJERIA.iframeId,
    debug: CONFIG.DEBUG,
    logLevel: CONFIG.LOG_LEVEL
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

/**
 * Obtiene un valor de localStorage con validación de tipo y fallback
 * @param {string} key - Clave para obtener del localStorage
 * @param {any} defaultValue - Valor por defecto si no existe o hay error
 * @param {string} [expectedType] - Tipo esperado ('string', 'number', 'boolean', 'object', 'array')
 * @returns {any} Valor recuperado o valor por defecto
 */
export function getFromStorage(key, defaultValue = null, expectedType = null) {
    try {
        // Verificar disponibilidad de localStorage
        if (typeof localStorage === 'undefined') {
            logger.warn('localStorage no disponible en este entorno');
            return defaultValue;
        }

        const storedValue = localStorage.getItem(key);
        
        // Si no hay valor almacenado, retornar default
        if (storedValue === null) {
            return defaultValue;
        }
        
        // Intentar analizar el valor JSON
        let parsedValue;
        try {
            parsedValue = JSON.parse(storedValue);
        } catch (e) {
            // Si no es JSON válido, usar el valor como string
            parsedValue = storedValue;
        }
        
        // Validación de tipo si se especifica
        if (expectedType) {
            const actualType = Array.isArray(parsedValue) ? 'array' : typeof parsedValue;
            if (actualType !== expectedType) {
                logger.warn(`Tipo incorrecto en localStorage para ${key}. Esperado: ${expectedType}, actual: ${actualType}`);
                return defaultValue;
            }
        }
        
        return parsedValue;
    } catch (error) {
        logger.warn(`Error al leer ${key} de localStorage:`, error);
        return defaultValue;
    }
}

/**
 * Almacena un valor en localStorage con manejo de errores
 * @param {string} key - Clave para almacenar en localStorage
 * @param {any} value - Valor para almacenar
 * @returns {boolean} True si se almacenó correctamente, False si hubo error
 */
export function setToStorage(key, value) {
    try {
        // Verificar disponibilidad de localStorage
        if (typeof localStorage === 'undefined') {
            logger.warn('localStorage no disponible en este entorno');
            return false;
        }
        
        // Convertir a string si no es un string
        const valueToStore = typeof value === 'string' 
            ? value 
            : JSON.stringify(value);
        
        localStorage.setItem(key, valueToStore);
        return true;
    } catch (error) {
        const errorType = error.name || 'Error desconocido';
        logger.warn(`Error (${errorType}) al guardar ${key} en localStorage:`, error);
        
        // Intentar identificar si es un error de cuota
        if (error.name === 'QuotaExceededError' || 
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.message.includes('quota')) {
            logger.warn('Se ha excedido la cuota de localStorage. Intentando liberar espacio...');
            // Aquí se podría implementar lógica para liberar espacio
        }
        
        return false;
    }
}

/**
 * Sistema de caché para elementos DOM frecuentemente utilizados
 * Mejora el rendimiento evitando búsquedas repetidas en el DOM
 */
const domCache = {
    // Almacén de elementos
    _elements: new Map(),
    
    /**
     * Obtiene un elemento del DOM, usando la caché si ya existe
     * @param {string} id - ID del elemento
     * @returns {HTMLElement|null} Elemento encontrado o null
     */
    getElementById(id) {
        if (!id) return null;
        
        // Si ya está en caché, devolverlo
        if (this._elements.has(id)) {
            return this._elements.get(id);
        }
        
        // Si no está en caché, buscarlo y almacenarlo
        const element = document.getElementById(id);
        if (element) {
            this._elements.set(id, element);
        }
        
        return element;
    },
    
    /**
     * Obtiene elementos por selector CSS, usando la caché si ya existen
     * @param {string} selector - Selector CSS
     * @param {HTMLElement} [parent=document] - Elemento padre donde buscar
     * @returns {NodeList} Lista de elementos
     */
    querySelectorAll(selector, parent = document) {
        if (!selector) return [];
        
        const cacheKey = `${parent === document ? 'document' : parent.id || 'unknown'}_${selector}`;
        
        // Si ya está en caché, devolverlo
        if (this._elements.has(cacheKey)) {
            return this._elements.get(cacheKey);
        }
        
        // Si no está en caché, buscarlo y almacenarlo
        const elements = parent.querySelectorAll(selector);
        if (elements && elements.length > 0) {
            this._elements.set(cacheKey, elements);
        }
        
        return elements;
    },
    
    /**
     * Obtiene un único elemento por selector CSS, usando la caché
     * @param {string} selector - Selector CSS
     * @param {HTMLElement} [parent=document] - Elemento padre donde buscar
     * @returns {HTMLElement|null} Elemento encontrado o null
     */
    querySelector(selector, parent = document) {
        if (!selector) return null;
        
        const cacheKey = `${parent === document ? 'document' : parent.id || 'unknown'}_${selector}_single`;
        
        // Si ya está en caché, devolverlo
        if (this._elements.has(cacheKey)) {
            return this._elements.get(cacheKey);
        }
        
        // Si no está en caché, buscarlo y almacenarlo
        const element = parent.querySelector(selector);
        if (element) {
            this._elements.set(cacheKey, element);
        }
        
        return element;
    },
    
    /**
     * Actualiza o agrega un elemento a la caché
     * @param {string} id - ID o clave para el elemento
     * @param {HTMLElement} element - Elemento a almacenar
     */
    set(id, element) {
        if (!id || !element) return;
        this._elements.set(id, element);
    },
    
    /**
     * Elimina un elemento de la caché
     * @param {string} id - ID o clave del elemento
     */
    remove(id) {
        if (!id) return;
        this._elements.delete(id);
    },
    
    /**
     * Limpia toda la caché o elementos específicos que coincidan con un patrón
     * @param {string} [pattern] - Patrón para filtrar elementos (opcional)
     */
    clear(pattern = null) {
        if (!pattern) {
            this._elements.clear();
            return;
        }
        
        // Eliminar solo los elementos que coincidan con el patrón
        for (const key of this._elements.keys()) {
            if (key.includes(pattern)) {
                this._elements.delete(key);
            }
        }
    }
};

// Exportar el sistema de caché DOM
export const DOMCache = domCache;

// Exportar todo a través de default
export default {
    configurarUtils,
    crearObjetoError,
    validarObjeto,
    generarHashContenido,
    generarId,
    generarIdUnico,
    debounce,
    throttle,
    getFromStorage,
    setToStorage,
    DOMCache: domCache
};
