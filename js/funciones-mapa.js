/**
 * Módulo que maneja la visualización del mapa y la interacción con las paradas
 * Se comunica con el padre a través del sistema de mensajería
 */

// Importar mensajería y configuración
import { 
    inicializarMensajeria, 
    enviarMensaje, 
    registrarControlador 
} from './mensajeria.js';
import { CONFIG } from './config.js';
import { TIPOS_MENSAJE } from './constants.js';
import logger from './logger.js';

// Estado del módulo
let mapa = null;
const marcadoresParadas = new Map();
let marcadorDestino = null;
let rutasTramos = [];

// Estado del mapa para seguimiento interno
const estadoMapa = {
    inicializado: false,
    modo: 'casa', // 'casa' o 'aventura'
    paradaActual: 0,
    posicionUsuario: null
};

// Referencia local a los datos de paradas
let arrayParadasLocal = [];

/**
 * Inicializa el mapa y los manejadores de mensajes.
 * @param {object} config - Configuración del mapa.
 * @returns {Promise<L.Map>} La instancia del mapa de Leaflet.
 */
export async function inicializarMapa(config = {}) {
    logger.info('🗺️ Inicializando mapa...');

    if (typeof L === 'undefined') {
        throw new Error("Leaflet (L) no está cargado.");
    }

    // Usar valores por defecto si no se proporcionan
    const mapConfig = {
        center: [39.4699, -0.3763], // Valencia
        zoom: 16,
        ...config
    };
    
    // Obtener el contenedor del mapa
    const containerId = config.containerId || 'mapa';
    const container = document.getElementById(containerId);
    
    if (!container) {
        throw new Error(`Contenedor del mapa con ID "${containerId}" no encontrado.`);
    }

    mapa = L.map(containerId, {
        center: mapConfig.center,
        zoom: mapConfig.zoom,
        minZoom: mapConfig.minZoom || 12,
        maxZoom: mapConfig.maxZoom || 18,
        zoomControl: mapConfig.zoomControl !== undefined ? mapConfig.zoomControl : false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapa);
    
    // Actualizar estado
    estadoMapa.inicializado = true;
    logger.info('Mapa inicializado correctamente');
    
    return mapa;
}

/**
 * Inicializa el módulo de mapa
 * @returns {Promise<boolean>} True si la inicialización fue exitosa
 */
export async function inicializarModuloMapa() {
    if (estadoMapa.inicializado) {
        logger.info('El módulo de mapa ya está inicializado');
        return true;
    }

    try {
        logger.info('Inicializando módulo de mapa...');
        
        // La mensajería ya debería estar inicializada por el módulo principal
        if (typeof enviarMensaje !== 'function') {
            throw new Error('La mensajería no está inicializada');
        }
        
        registrarManejadoresMensajes();
        await inicializarMapa();
        
        estadoMapa.inicializado = true;
        logger.info('Módulo de mapa inicializado correctamente');
        return true;
        
    } catch (error) {
        const errorMsg = 'Error al inicializar el módulo de mapa: ' + error.message;
        logger.error(errorMsg, error);
        
        await notificarError('inicializacion_modulo_mapa', error);
        
        estadoMapa.inicializado = false;
        throw error; // Re-lanzar para que el llamador sepa que hubo un error
    }
}

/**
 * Registra los manejadores de mensajes para el mapa
 */
function registrarManejadoresMensajes() {
    // Registrar manejadores para mensajes relacionados con el mapa
    registrarControlador(TIPOS_MENSAJE.NAVEGACION.ESTABLECER_DESTINO, manejarEstablecerDestino);
    registrarControlador(TIPOS_MENSAJE.NAVEGACION.ACTUALIZAR_POSICION, manejarActualizarPosicion);
    registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, manejarCambioModoMapa);
    
    logger.debug('Manejadores de mensajes del mapa registrados');
}

/**
 * Notifica un error al sistema
 * @param {string} codigo - Código de error
 * @param {Error} error - Objeto de error
 */
async function notificarError(codigo, error) {
    try {
        await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
            origen: 'mapa',
            codigo,
            mensaje: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        logger.error('Error al notificar error:', e);
    }
}

/**
 * Maneja el mensaje para establecer un destino en el mapa
 * @param {Object} mensaje - Mensaje recibido
 */
function manejarEstablecerDestino(mensaje) {
    const { punto } = mensaje.datos || {};
    if (!punto) {
        logger.warn('Mensaje de establecer destino sin punto');
        return;
    }

    try {
        // Buscar coordenadas según el tipo de punto
        let coordenadas = null;
        if (punto.parada_id) {
            coordenadas = buscarCoordenadasParada(punto.parada_id);
        } else if (punto.tramo_id) {
            coordenadas = buscarCoordenadasTramo(punto.tramo_id)?.fin;
        }

        if (!coordenadas) {
            logger.warn(`No se encontraron coordenadas para el punto: ${JSON.stringify(punto)}`);
            return;
        }

        // Centrar mapa y actualizar marcador
        mapa.flyTo([coordenadas.lat, coordenadas.lng], 17);
        actualizarMarcadorParada(coordenadas, obtenerNombreParada(punto));
        
    } catch (error) {
        logger.error('Error al establecer destino:', error);
    }
}

/**
 * Maneja el mensaje para actualizar la posición del usuario
 * @param {Object} mensaje - Mensaje recibido
 */
function manejarActualizarPosicion(mensaje) {
    const { coordenadas } = mensaje.datos || {};
    if (!coordenadas || !coordenadas.lat || !coordenadas.lng) {
        logger.warn('Mensaje de actualizar posición sin coordenadas válidas');
        return;
    }

    try {
        estadoMapa.posicionUsuario = coordenadas;
        actualizarPuntoActual(coordenadas);
    } catch (error) {
        logger.error('Error al actualizar posición:', error);
    }
}

/**
 * Maneja el cambio de modo del mapa
 * @param {Object} mensaje - Mensaje recibido
 */
function manejarCambioModoMapa(mensaje) {
    const { modo } = mensaje.datos || {};
    if (!modo) {
        logger.warn('Mensaje de cambio de modo sin modo especificado');
        return;
    }

    try {
        actualizarModoMapa(modo);
    } catch (error) {
        logger.error('Error al cambiar modo del mapa:', error);
    }
}

/**
 * Busca las coordenadas de una parada por su ID
 * @param {string} paradaId - ID de la parada
 * @returns {Object|null} Coordenadas {lat, lng} o null si no se encuentra
 */
function buscarCoordenadasParada(paradaId) {
    // Buscar en el array local de paradas
    const parada = arrayParadasLocal.find(p => p.id === paradaId || p.parada_id === paradaId);
    return parada ? parada.coordenadas : null;
}

/**
 * Busca las coordenadas de un tramo por su ID
 * @param {string} tramoId - ID del tramo
 * @returns {Object|null} Objeto con inicio, fin y waypoints, o null si no se encuentra
 */
function buscarCoordenadasTramo(tramoId) {
    // Buscar en el array local de paradas
    const tramo = arrayParadasLocal.find(p => p.id === tramoId || p.tramo_id === tramoId);
    if (!tramo) return null;
    
    return {
        inicio: tramo.inicio,
        fin: tramo.fin,
        waypoints: tramo.waypoints || []
    };
}

/**
 * Obtiene el nombre de una parada a partir de su objeto punto
 * @param {Object} punto - Objeto punto con información de la parada
 * @returns {string} Nombre de la parada o texto por defecto
 */
function obtenerNombreParada(punto) {
    if (!punto) return 'Punto desconocido';
    
    // Buscar por ID
    const paradaId = punto.parada_id || punto.tramo_id || punto.id;
    const parada = arrayParadasLocal.find(p => 
        p.id === paradaId || 
        p.parada_id === paradaId || 
        p.tramo_id === paradaId
    );
    
    return parada ? parada.nombre : (punto.nombre || 'Punto sin nombre');
}

/**
 * Actualiza el marcador de la parada actual
 * @param {Object} coordenadas - Coordenadas {lat, lng}
 * @param {string} nombre - Nombre para el popup
 */
function actualizarMarcadorParada(coordenadas, nombre) {
    if (!mapa) {
        logger.warn('No se puede actualizar marcador: mapa no inicializado');
        return;
    }
    
    // Eliminar marcador anterior si existe
    if (marcadorDestino) {
        mapa.removeLayer(marcadorDestino);
    }
    
    // Crear nuevo marcador
    marcadorDestino = L.marker([coordenadas.lat, coordenadas.lng], {
        icon: L.divIcon({
            className: 'marcador-destino',
            html: '📍',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        })
    }).addTo(mapa);
    
    // Añadir popup si hay nombre
    if (nombre) {
        marcadorDestino.bindPopup(`<b>${nombre}</b>`).openPopup();
    }
}

/**
 * Actualiza el modo del mapa (casa/aventura)
 * @param {string} modo - 'casa' o 'aventura'
 */
function actualizarModoMapa(modo) {
    if (modo !== 'casa' && modo !== 'aventura') {
        logger.warn(`Modo inválido: ${modo}. Debe ser 'casa' o 'aventura'`);
        return;
    }
    
    estadoMapa.modo = modo;
    logger.info(`Modo del mapa actualizado a: ${modo}`);
    
    // Actualizar visualización según el modo
    if (modo === 'casa') {
        // Mostrar todas las paradas
        mostrarTodasLasParadas();
    } else {
        // Mostrar solo la parada actual y las completadas
        ocultarParadasFuturas();
    }
}

/**
 * Muestra todas las paradas en el mapa (modo casa)
 */
function mostrarTodasLasParadas() {
    // Implementación según necesidades
    logger.info('Mostrando todas las paradas (modo casa)');
}

/**
 * Oculta las paradas futuras (modo aventura)
 */
function ocultarParadasFuturas() {
    // Implementación según necesidades
    logger.info('Ocultando paradas futuras (modo aventura)');
}

/**
 * Carga los datos de paradas desde una fuente externa
 * @param {Array} paradas - Array de paradas
 */
function cargarDatosParada(paradas) {
    if (!Array.isArray(paradas)) {
        logger.warn('cargarDatosParada: los datos proporcionados no son un array');
        return;
    }
    
    arrayParadasLocal = paradas;
    logger.info(`Datos de ${paradas.length} paradas cargados correctamente`);
}

/**
 * Actualiza la posición actual en el mapa
 * @param {Object} coordenadas - Coordenadas {lat, lng}
 * @param {Object} opciones - Opciones adicionales
 */
function actualizarPuntoActual(coordenadas, opciones = {}) {
    try {
        if (!mapa) {
            logger.warn('No se puede actualizar el punto: el mapa no está inicializado');
            return false;
        }

        // Opciones por defecto
        const config = {
            zoom: 18,
            animate: true,
            duration: 1,
            ...opciones
        };

        // Centrar el mapa en las nuevas coordenadas si se solicita
        if (config.centrar) {
            mapa.flyTo([coordenadas.lat, coordenadas.lng], config.zoom, {
                animate: config.animate,
                duration: config.duration
            });
        }

        // Actualizar marcador de posición actual si existe
        if (window.marcadorPosicionActual) {
            window.marcadorPosicionActual.setLatLng([coordenadas.lat, coordenadas.lng]);
        } else {
            // Crear marcador si no existe
            window.marcadorPosicionActual = L.marker([coordenadas.lat, coordenadas.lng], {
                icon: L.divIcon({
                    className: 'marcador-posicion-actual',
                    html: '📍',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            }).addTo(mapa);
        }

        return true;
    } catch (error) {
        logger.error('Error al actualizar el punto actual:', error);
        return false;
    }
}

/**
 * Limpia los recursos del mapa
 */
function limpiarRecursos() {
    try {
        // Eliminar marcadores
        if (marcadorDestino) {
            mapa.removeLayer(marcadorDestino);
            marcadorDestino = null;
        }
        
        if (window.marcadorPosicionActual) {
            mapa.removeLayer(window.marcadorPosicionActual);
            window.marcadorPosicionActual = null;
        }
        
        // Eliminar rutas
        rutasTramos.forEach(ruta => mapa.removeLayer(ruta));
        rutasTramos = [];
        
        logger.debug('Recursos del mapa limpiados');
    } catch (error) {
        logger.error('Error al limpiar recursos del mapa:', error);
    }
}

// Limpiar recursos cuando se descargue la página
window.addEventListener('beforeunload', () => {
    limpiarRecursos();
});

// Exportar funciones públicas
export {
    estadoMapa,
    inicializarModuloMapa,
    actualizarModoMapa,
    buscarCoordenadasParada,
    buscarCoordenadasTramo,
    obtenerNombreParada,
    actualizarMarcadorParada,
    actualizarPuntoActual,
    limpiarRecursos,
    cargarDatosParada
};
