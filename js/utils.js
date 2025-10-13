/**
 * Utilidades generales para la aplicación
 * @module Utils
 * @version 1.2.0
 */

import logger from './logger.js';

/**
 * Genera un ID único utilizando caracteres aleatorios
 * @param {string} [prefix=''] - Prefijo opcional para el ID
 * @returns {string} ID único generado
 */
export function generarIdUnico(prefix = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${prefix ? prefix + '-' : ''}${timestamp}-${random}`;
}

/**
 * Genera un hash simple para el contenido proporcionado
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @returns {string} Hash generado
 */
export function generarHashContenido(tipo, datos) {
    try {
        // Serialize data to JSON, keeping only essential properties for comparison
        const serialized = JSON.stringify({
            tipo,
            // For position data, round coordinates to reduce noise
            lat: datos.lat ? Math.round(datos.lat * 10000) / 10000 : undefined,
            lng: datos.lng ? Math.round(datos.lng * 10000) / 10000 : undefined,
            // Other essential properties depending on the type
            ...(datos.parada_id ? { parada_id: datos.parada_id } : {}),
            ...(datos.tramo_id ? { tramo_id: datos.tramo_id } : {})
        });
        
        // Simple hash function for strings
        let hash = 0;
        for (let i = 0; i < serialized.length; i++) {
            const char = serialized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        // Convert to hexadecimal string and ensure positive value
        return (hash >>> 0).toString(16);
    } catch (error) {
        logger.error('Error al generar hash de contenido:', error);
        return `error-${Date.now()}`;
    }
}

/**
 * Wrapper for async functions to handle errors consistently
 * @param {Function} fn - The async function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export function asyncHandler(fn) {
    return async function(...args) {
        try {
            return await fn(...args);
        } catch (error) {
            logger.error(`Error en ${fn.name || 'función asíncrona'}:`, error);
            
            // Add additional context to the error
            const contextualizedError = new Error(`Error en ${fn.name || 'función asíncrona'}: ${error.message}`);
            contextualizedError.originalError = error;
            contextualizedError.args = args;
            
            // Re-throw the error with added context
            throw contextualizedError;
        }
    };
}

/**
 * Validates the parameters against a schema
 * @param {Object} params - The parameters to validate
 * @param {Object} schema - The schema to validate against
 * @param {string} [context] - The context for error messages
 * @returns {Object} - Validation result with valido and error properties
 */
export function validarParametros(params, schema, context = '') {
    try {
        // Handle null or undefined params
        if (params === null || params === undefined) {
            return {
                valido: false,
                error: `${context ? context + ': ' : ''}Los parámetros no pueden ser null o undefined`
            };
        }
        
        // Validate each parameter against the schema
        for (const key in schema) {
            const fieldSchema = schema[key];
            let value = params[key];
            
            // If the field is required and missing
            if (fieldSchema.requerido && (value === undefined || value === null)) {
                return {
                    valido: false,
                    error: `${context ? context + ': ' : ''}Parámetro requerido faltante: ${key}`
                };
            }
            
            // If field is not required and missing, use default value if available
            if ((value === undefined || value === null) && !fieldSchema.requerido) {
                if ('valorPorDefecto' in fieldSchema) {
                    value = fieldSchema.valorPorDefecto;
                    params[key] = value; // Update the params object with the default value
                }
                continue; // Skip further validation for this field
            }
            
            // Check type if the value is defined
            if (value !== undefined && value !== null) {
                // Type validation
                const expectedType = fieldSchema.tipo;
                let actualType = typeof value;
                
                // Special handling for arrays
                if (Array.isArray(value)) {
                    actualType = 'array';
                }
                
                if (expectedType && actualType !== expectedType && 
                    !(expectedType === 'array' && Array.isArray(value))) {
                    return {
                        valido: false,
                        error: `${context ? context + ': ' : ''}Tipo inválido para ${key}, se esperaba ${expectedType} pero se recibió ${actualType}`
                    };
                }
                
                // Custom validation function
                if (fieldSchema.validar && typeof fieldSchema.validar === 'function') {
                    if (!fieldSchema.validar(value)) {
                        return {
                            valido: false,
                            error: `${context ? context + ': ' : ''}Validación personalizada fallida para ${key}`
                        };
                    }
                }
            }
        }
        
        return { valido: true };
    } catch (error) {
        return {
            valido: false,
            error: `${context ? context + ': ' : ''}Error durante la validación: ${error.message}`
        };
    }
}

/**
 * Configura las funciones utilitarias con los ajustes de la aplicación
 * @param {Object} options - Opciones de configuración
 */
export function configurarUtils(options = {}) {
    // Almacena la configuración para las utilidades
    const config = {
        debug: options.debug || false,
        logLevel: options.logLevel || 1,
        ...options
    };
    
    // Aplica la configuración a las funciones utilitarias existentes
    if (options.logger && typeof options.logger.configure === 'function') {
        options.logger.configure({
            debug: config.debug,
            logLevel: config.logLevel
        });
    }
    
    return config;
}

// Additional utility functions could be added here...

export default {
    generarIdUnico,
    generarHashContenido,
    asyncHandler,
    validarParametros,
    configurarUtils
};
