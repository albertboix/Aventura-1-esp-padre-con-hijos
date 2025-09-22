/**
 * Configuración global de la aplicación
 * @module Config
 */

import { LOG_LEVELS } from './constants.js';

/**
 * Configuración de la aplicación
 */
export const CONFIG = {
    // Configuración general
    DEBUG: true,
    LOG_LEVEL: LOG_LEVELS.DEBUG,
    ID_PADRE: 'codigo-padre',
    IFRAME_ID: 'padre',
    
    // Configuración de iframes
    HIJOS: {
        CASA: { id: 'hijo5-casa', nombre: 'Botón Casa' },
        COORDENADAS: { id: 'hijo2', nombre: 'Coordenadas' },
        AUDIO: { id: 'hijo3', nombre: 'Audio' },
        RETOS: { id: 'hijo4-retos', nombre: 'Retos' }
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

export default {
    CONFIG,
    LOG_LEVELS
};
    LOG_LEVELS
