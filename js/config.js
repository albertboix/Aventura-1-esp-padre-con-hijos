/**
 * Configuración global de la aplicación
 * @module Config
 */

import { LOG_LEVELS } from './constants.js';

// Helper function for environment detection in browsers
function isDevelopmentMode() {
    // Browser environment check instead of process.env
    if (typeof window !== 'undefined') {
        return window.__DEV__ === true || 
               window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1';
    }
    return false;
}

/**
 * Configuración de la aplicación
 */
export const CONFIG = {
    // Configuración general
    DEBUG: isDevelopmentMode(),
    LOG_LEVEL: isDevelopmentMode() ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO,
    ID_PADRE: 'codigo-padre', // Confirmado: ID coincide con el iframe real del padre
    IFRAME_ID: 'padre',
    
    // Configuración de iframes
    HIJOS: {
        CASA: { id: 'hijo5-casa', nombre: 'Botón Casa' },
        COORDENADAS: { id: 'hijo2', nombre: 'Coordenadas' },
        AUDIO: { id: 'hijo3', nombre: 'Audio' },
        RETOS: { id: 'hijo4', nombre: 'Retos' } // Confirmado: ID coincide con el iframe real
    },
    
    // Configuración de reintentos
    REINTENTOS: {
        maximos: 3,
        tiempoEspera: 1000,
        factor: 2
    },
    
    // Configuración del mapa
    MAPA: {
        CENTER: [39.4699, -0.3763], // Valencia
        ZOOM: 13,
        MIN_ZOOM: 12,
        MAX_ZOOM: 18,
        ZOOM_CONTROL: false
    }
};

// Export LOG_LEVELS to fix dependency issues
export { LOG_LEVELS };

// Cambiar las exportaciones para usar CommonJS si ES6 no es compatible
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, LOG_LEVELS };
} else {
    window.Config = { CONFIG, LOG_LEVELS };
}
