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
        
        // Inicializar el mapa si no está ya inicializado
        if (!window.mapa) {
            try {
                logger.info('Inicializando mapa...');
                window.mapa = await inicializarMapa({
                    containerId: 'mapa',
                    center: [39.4699, -0.3763], // Coordenadas de Valencia
                    zoom: 14,
                    minZoom: 10,
                    maxZoom: 18
                });
                logger.info('Mapa inicializado correctamente');
            } catch (error) {
                logger.error('Error al inicializar el mapa:', error);
                throw new Error('No se pudo inicializar el mapa: ' + error.message);
            }
        }
        
        // Actualizar el tamaño del mapa después de un breve retraso para asegurar que el contenedor tenga dimensiones
        setTimeout(() => {
            if (window.mapa && typeof window.mapa.invalidateSize === 'function') {
                window.mapa.invalidateSize(true);
                logger.info('Tamaño del mapa actualizado');
            }
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
    let mapa = document.getElementById('mapa');
    if (!mapa) {
        console.error('❌ El contenedor del mapa no existe en el DOM');
        // Create the container if it doesn't exist
        console.log('🔄 Creando el contenedor del mapa dinámicamente');
        mapa = document.createElement('div');
        mapa.id = 'mapa';
        mapa.style.position = 'fixed';
        mapa.style.top = '0';
        mapa.style.left = '0';
        mapa.style.width = '100vw';
        mapa.style.height = '100vh';
        mapa.style.zIndex = '10';
        mapa.style.backgroundColor = '#f5f5f5';
        document.body.prepend(mapa);
        console.log('✅ Contenedor del mapa creado dinámicamente');
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
        // Verificar si window.mapa es una instancia válida de Leaflet Map
        if (window.mapa instanceof window.L.Map) {
            try {
                console.log('- Instancia de mapa existe y es válida (window.mapa)');
                console.log('- Centro del mapa:', window.mapa.getCenter());
                console.log('- Zoom del mapa:', window.mapa.getZoom());
                
                // Forzar actualización del mapa
                window.mapa.invalidateSize(true);
                console.log('✅ Mapa actualizado con invalidateSize()');
            } catch (e) {
                console.error('❌ Error al acceder a métodos del mapa:', e);
                return false;
            }
        } else {
            console.error('❌ window.mapa existe pero NO es una instancia válida de L.Map');
            return false;
        }
    } else {
        console.error('❌ No hay instancia de mapa (window.mapa undefined)');
        return false;
    }
    
    // Verificar si hay capas
    if (window.mapa && window.mapa._layers) {
        console.log('- Número de capas del mapa:', Object.keys(window.mapa._layers).length);
    }
    
    // Verificar si hay elementos de Leaflet en el DOM
    const leafletContainers = document.querySelectorAll('.leaflet-container, .leaflet-map-pane');
    console.log('- Elementos Leaflet en DOM:', leafletContainers.length);
    
    return leafletContainers.length > 0 && window.mapa instanceof window.L.Map;
}

/**
 * Diagnóstico de la comunicación con hijo5-casa
 * Ver js/comunicacion-componentes.md para más información sobre el flujo completo
 * @param {boolean} detallado - Si es true, muestra información detallada
 * @returns {Promise<Object>} Resultado del diagnóstico
 */
export async function diagnosticarComunicacionCasa(detallado = false) {
    console.log('DIAGNÓSTICO DE COMUNICACIÓN CASA-PADRE:');
    
    // 1. Verificar que el iframe existe
    const iframeCasa = document.getElementById('hijo5-casa');
    if (!iframeCasa) {
        console.error('❌ El iframe hijo5-casa no existe en el DOM');
        return { exito: false, error: 'iframe_no_encontrado' };
    }
    
    console.log('- iframe hijo5-casa encontrado:', iframeCasa);
    console.log('- iframe visible:', window.getComputedStyle(iframeCasa).display !== 'none');
    console.log('- iframe dimensiones:', iframeCasa.offsetWidth + 'x' + iframeCasa.offsetHeight);
    
    // 2. Verificar estado de la mensajería
    if (!estado.mensajeriaInicializada) {
        console.warn('⚠️ Sistema de mensajería no inicializado');
    }
    
    console.log('- Sistema mensajería inicializado:', estado.mensajeriaInicializada);
    console.log('- Hijos inicializados:', Array.from(estado.hijosInicializados));
    console.log('- Hijo casa inicializado:', estado.hijosInicializados.has('hijo5-casa'));
    
    // 3. Verificar modo actual
    console.log('- Modo actual:', estado.modo.actual);
    console.log('- Modo anterior:', estado.modo.anterior);
    
    // 4. Prueba de envío de mensaje si está en modo detallado
    if (detallado && typeof enviarMensaje === 'function') {
        try {
            console.log('📤 Enviando mensaje de prueba a hijo5-casa...');
            const respuesta = await enviarMensaje('hijo5-casa', 'SISTEMA.PING', { 
                timestamp: Date.now(),
                origen: 'diagnostico'
            });
            console.log('📥 Respuesta recibida:', respuesta);
        } catch (error) {
            console.error('❌ Error al enviar mensaje de prueba:', error);
        }
    }
    
    return { 
        exito: true,
        iframeCasa: iframeCasa ? true : false,
        mensajeria: estado.mensajeriaInicializada,
        hijoCasaInicializado: estado.hijosInicializados.has('hijo5-casa'),
        modo: estado.modo.actual
    };
}

/**
 * Prueba la orquestación de componentes con una parada específica
 * Ver js/comunicacion-componentes.md para más información sobre el proceso de orquestación
 * @param {string} paradaId - ID de la parada a probar (ej: 'P-1', 'TR-2')
 * @returns {Promise<Object>} Resultado de la prueba
 */
export async function probarOrquestacionParada(paradaId) {
    if (!paradaId) {
        console.error('❌ Se requiere un ID de parada para la prueba');
        return { exito: false, error: 'id_parada_requerido' };
    }
    
    console.log(`🧪 PRUEBA DE ORQUESTACIÓN para parada ${paradaId}:`);
    
    try {
        // 1. Verificar que estamos en modo casa
        if (estado.modo.actual !== 'casa') {
            console.warn('⚠️ Cambiando a modo casa para la prueba...');
            await enviarCambioModo('casa', 'prueba_orquestacion');
        }
        
        // 2. Crear un mensaje similar al que enviaría hijo5-casa
        const mensajeSimulado = {
            origen: 'prueba',
            tipo: 'NAVEGACION.CAMBIO_PARADA',
            datos: {
                punto: { parada_id: paradaId },
                origen: 'prueba_orquestacion',
                timestamp: Date.now()
            }
        };
        
        console.log('📤 Enviando mensaje simulado:', mensajeSimulado);
        
        // 3. Enviar el mensaje al padre
        const respuesta = await enviarMensaje('padre', 'NAVEGACION.CAMBIO_PARADA', mensajeSimulado.datos);
        console.log('📥 Respuesta recibida:', respuesta);
        
        return {
            exito: true,
            mensaje: `Prueba de orquestación para ${paradaId} completada`,
            respuesta
        };
    } catch (error) {
        console.error(`❌ Error en prueba de orquestación: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

// Exportar funciones públicas para que puedan ser usadas por otros módulos
export {
    inicializarMapa
};
