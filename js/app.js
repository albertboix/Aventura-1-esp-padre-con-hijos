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
        RETOS: { id: 'hijo4', nombre: 'Retos' }
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
        
        // Intentar actualizar el tamaño del mapa para asegurar que se renderice correctamente
        setTimeout(() => {
            if (window.mapa && typeof window.mapa.invalidateSize === 'function') {
                logger.info('Actualizando tamaño del mapa...');
                window.mapa.invalidateSize(true);
            }
            
            // Ejecutar diagnóstico del mapa
            diagnosticarMapa().then(result => {
                console.log('Diagnóstico del mapa completado con resultado:', result);
            });
        }, 500);
        
        // Verificación visual del contenedor
        const mapaContainer = document.getElementById('mapa');
        if (mapaContainer) {
            // Añadir un borde temporal para verificación visual
            mapaContainer.style.border = '5px solid red';
            setTimeout(() => {
                mapaContainer.style.border = '1px solid #ccc';
            }, 3000);
        }
        
        // Marcar como inicializada
        logger.info('Aplicación inicializada correctamente');
        return true;
    } catch (error) {
        logger.error('Error al inicializar aplicación:', error);
        return false;
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

/**
 * Diagnóstico del mapa para verificar su visibilidad
 */
export async function diagnosticarMapa() {
    const mapa = document.getElementById('mapa');
    if (!mapa) {
        console.error('❌ El contenedor del mapa no existe en el DOM');
        return false;
    }

    console.log('DIAGNÓSTICO DEL MAPA:');
    console.log('- Elemento mapa:', mapa);
    console.log('- Display:', window.getComputedStyle(mapa).display);
    console.log('- Visibility:', window.getComputedStyle(mapa).visibility);
    console.log('- Z-index:', window.getComputedStyle(mapa).zIndex);
    console.log('- Dimensiones:', mapa.offsetWidth + 'x' + mapa.offsetHeight);
    console.log('- Position:', window.getComputedStyle(mapa).position);
    
    // Verificar si la instancia de Leaflet existe
    if (window.L) {
        console.log('- Leaflet está disponible (window.L):', window.L.version);
    } else {
        console.error('❌ Leaflet NO está disponible (window.L undefined)');
    }
    
    // Verificar si el mapa de Leaflet está instanciado
    if (window.mapa) {
        console.log('- Instancia de mapa existe (window.mapa)');
        console.log('- Centro del mapa:', window.mapa.getCenter());
        console.log('- Zoom del mapa:', window.mapa.getZoom());
        
        // Forzar actualización del mapa
        try {
            window.mapa.invalidateSize(true);
            console.log('✅ Mapa actualizado con invalidateSize()');
        } catch (e) {
            console.error('❌ Error al actualizar mapa:', e);
        }
    } else {
        console.error('❌ No hay instancia de mapa (window.mapa undefined)');
    }
    
    // Verificar si hay capas
    if (window.mapa && window.mapa._layers) {
        console.log('- Número de capas del mapa:', Object.keys(window.mapa._layers).length);
    }
    
    // Verificar si hay elementos de Leaflet en el DOM
    const leafletContainers = document.querySelectorAll('.leaflet-container, .leaflet-map-pane');
    console.log('- Elementos Leaflet en DOM:', leafletContainers.length);
    
    return true;
}

// Exportar funciones públicas para que puedan ser usadas por otros módulos
export {
    inicializarMapa
};
