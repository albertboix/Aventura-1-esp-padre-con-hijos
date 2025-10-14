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
    
    // Configuración del sistema de mensajería
    MENSAJERIA: {
        // Valores por defecto
        iframeId: 'unknown',
        logLevel: isDevelopmentMode() ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO,
        debug: isDevelopmentMode(),
        reintentos: {
            maximos: 3,
            tiempoEspera: 1000,
            factor: 2
        },
        // Tiempo de limpieza de instancias inactivas (ms)
        tiempoLimpieza: 15 * 60 * 1000, // 15 minutos
        tiempoInactividad: 30 * 60 * 1000, // 30 minutos
        
        // Configuración de la cola de mensajes pendientes
        COLA_PENDIENTES: {
            // Máximo de mensajes en la cola
            MAXIMO: 50,
            // Máximo de mensajes urgentes en la cola
            MAX_URGENTES: 10,
            // Intervalo entre procesamiento de la cola (ms)
            INTERVALO: 5000,
            // Número de mensajes a procesar en cada lote
            LOTE: 5,
            // Factor de backoff exponencial para reintentos
            FACTOR_BACKOFF: 1.5,
            // Retraso base para reintentos (ms)
            RETRASO_BASE: 1000,
            // Retraso máximo para reintentos (ms)
            MAX_RETRASO: 30000,
            // Edad máxima de un mensaje en cola (ms) - 24 horas por defecto
            MAX_EDAD_MS: 24 * 60 * 60 * 1000
        }
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

// Exportar constantes y configuración
export { LOG_LEVELS };

// Exportar CONFIG como predeterminado para facilitar importación
export default CONFIG;

// Proporcionar acceso global para compatibilidad con versiones anteriores del código
if (typeof window !== 'undefined') {
    window.Config = { CONFIG, LOG_LEVELS };
}
