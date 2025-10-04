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
let rutasActivas = [];
let marcadorUsuario = null;

// Estado del mapa para seguimiento interno
const estadoMapa = {
    inicializado: false,
    modo: 'casa',
    paradaActual: 0,
    tramoActual: null,
    posicionUsuario: null,
    watchId: null,
    siguiendoRuta: false
};

// Referencia local a los datos de paradas
let arrayParadasLocal = [];
let mapaListo = false;

/**
 * Inicializa el mapa y los manejadores de mensajes.
 * @param {object} config - Configuración del mapa.
 * @returns {Promise<L.Map>} La instancia del mapa de Leaflet.
 */
export async function inicializarMapa(config = {}) {
    logger.info('🗺️ Inicializando mapa...');
    const containerId = config.containerId || 'mapa';
    const mapConfig = {
        center: CONFIG.MAPA.CENTER,
        zoom: CONFIG.MAPA.ZOOM,
        minZoom: CONFIG.MAPA.MIN_ZOOM,
        maxZoom: CONFIG.MAPA.MAX_ZOOM,
        zoomControl: CONFIG.MAPA.ZOOM_CONTROL,
        ...config
    };

    try {
        if (typeof L === 'undefined') {
            throw new Error("Leaflet (L) no está cargado.");
        }

        mapa = L.map(containerId, mapConfig);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(mapa);

        logger.info('Mapa inicializado correctamente');
        return mapa;
    } catch (error) {
        logger.error('❌ Error al inicializar mapa:', error);
        throw error;
    }
}

/**
 * Limpia los recursos del mapa.
 */
function limpiarRecursos() {
    try {
        // Limpiar marcadores de usuario
        if (marcadorUsuario) {
            mapa.removeLayer(marcadorUsuario);
            marcadorUsuario = null;
        }

        // Limpiar marcador de destino
        if (marcadorDestino) {
            mapa.removeLayer(marcadorDestino);
            marcadorDestino = null;
        }

        // Limpiar marcadores de paradas
        marcadoresParadas.forEach(marcador => mapa.removeLayer(marcador));
        marcadoresParadas.clear();

        // Limpiar rutas
        rutasTramos.forEach(ruta => mapa.removeLayer(ruta));
        rutasTramos = [];

        rutasActivas.forEach(ruta => mapa.removeLayer(ruta));
        rutasActivas = [];

        logger.debug('Recursos del mapa limpiados');
    } catch (error) {
        logger.error('Error al limpiar recursos del mapa:', error);
    }
}

/**
 * Muestra todas las paradas en el mapa.
 * @param {Array} paradasExternas - Paradas proporcionadas externamente (opcional).
 */
export async function mostrarTodasLasParadas(paradasExternas) {
    try {
        if (paradasExternas) {
            arrayParadasLocal = paradasExternas;
        }

        if (!mapa) {
            throw new Error('Mapa no inicializado');
        }

        marcadoresParadas.forEach(marcador => mapa.removeLayer(marcador));
        marcadoresParadas.clear();

        arrayParadasLocal.forEach(parada => {
            if (parada.coordenadas) {
                const marcador = L.marker([parada.coordenadas.lat, parada.coordenadas.lng], {
                    title: parada.nombre || `Parada ${parada.id}`
                }).addTo(mapa);

                marcadoresParadas.set(parada.id, marcador);
            }
        });

        logger.info(`Se han añadido ${marcadoresParadas.size} marcadores al mapa`);
    } catch (error) {
        logger.error('Error al mostrar todas las paradas:', error);
    }
}

/**
 * Actualiza el marcador de la posición actual del usuario en el mapa.
 * @param {Object} coordenadas - Coordenadas {lat, lng, accuracy}.
 */
function actualizarPuntoActual(coordenadas) {
    try {
        if (!mapa) {
            throw new Error('Mapa no inicializado');
        }

        if (marcadorUsuario) {
            mapa.removeLayer(marcadorUsuario);
        }

        marcadorUsuario = L.circle([coordenadas.lat, coordenadas.lng], {
            radius: coordenadas.accuracy || 10,
            color: '#4285F4',
            fillColor: '#4285F4',
            fillOpacity: 0.5
        }).addTo(mapa);

        logger.info('Posición del usuario actualizada');
    } catch (error) {
        logger.error('Error al actualizar la posición del usuario:', error);
    }
}

/**
 * Dibuja un tramo específico en el mapa.
 * @param {Object} tramo - Objeto tramo con inicio, fin y waypoints.
 * @param {boolean} destacado - Si es true, se muestra con énfasis.
 * @returns {L.Polyline} La polyline creada.
 */
function dibujarTramo(tramo, destacado = false) {
    try {
        if (!tramo || !tramo.inicio || !tramo.fin) {
            throw new Error('Datos del tramo incompletos');
        }

        const puntos = [tramo.inicio, ...(tramo.waypoints || []), tramo.fin].map(p => [p.lat, p.lng]);

        const polyline = L.polyline(puntos, {
            color: destacado ? '#ff4500' : '#3388ff',
            weight: destacado ? 6 : 4,
            opacity: destacado ? 0.9 : 0.7
        }).addTo(mapa);

        return polyline;
    } catch (error) {
        logger.error('Error al dibujar tramo:', error);
        return null;
    }
}

/**
 * Maneja el mensaje para mostrar una ruta entre dos puntos.
 * @param {Object} mensaje - Mensaje con origen, destino, color, grosor.
 */
function manejarMostrarRuta(mensaje) {
    try {
        const { origen, destino, color, grosor } = mensaje.datos || {};

        if (!origen || !destino) {
            throw new Error('Coordenadas de origen o destino no válidas');
        }

        const polyline = L.polyline([origen, destino], {
            color: color || '#0077ff',
            weight: grosor || 6,
            opacity: 0.8
        }).addTo(mapa);

        rutasActivas.push(polyline);
        logger.info('Ruta mostrada en el mapa');
    } catch (error) {
        logger.error('Error al manejar mostrar ruta:', error);
    }
}

/**
 * Inicializa el módulo de mapa.
 * @returns {Promise<boolean>} True si la inicialización fue exitosa.
 */
export async function inicializarModuloMapa() {
    if (estadoMapa.inicializado) {
        logger.info('El módulo de mapa ya está inicializado');
        return true;
    }

    try {
        logger.info('Inicializando módulo de mapa...');
        
        if (typeof enviarMensaje !== 'function') {
            throw new Error('La mensajería no está inicializada');
        }
        
        registrarManejadoresMensajes();
        await inicializarMapa();
        await solicitarDatosParadas();
        
        estadoMapa.inicializado = true;
        logger.info('Módulo de mapa inicializado correctamente');
        return true;
    } catch (error) {
        logger.error('Error al inicializar el módulo de mapa:', error);
        estadoMapa.inicializado = false;
        throw error;
    }
}

/**
 * Registra los manejadores de mensajes para el mapa.
 */
function registrarManejadoresMensajes() {
    registrarControlador(TIPOS_MENSAJE.NAVEGACION.ESTABLECER_DESTINO, manejarEstablecerDestino);
    registrarControlador(TIPOS_MENSAJE.NAVEGACION.ACTUALIZAR_POSICION, manejarActualizarPosicion);
    registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, manejarCambioModoMapa);
    registrarControlador(TIPOS_MENSAJE.NAVEGACION.MOSTRAR_RUTA, manejarMostrarRuta);
    registrarControlador(TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS, async () => ({
        exito: true,
        paradas: arrayParadasLocal,
        timestamp: new Date().toISOString()
    }));
    logger.debug('Manejadores de mensajes del mapa registrados');
}

/**
 * Actualiza el marcador de una parada específica en el mapa.
 * @param {string} paradaId - ID de la parada a actualizar.
 * @param {Object} coordenadas - Nuevas coordenadas {lat, lng}.
 */
function actualizarMarcadorParada(paradaId, coordenadas) {
    try {
        if (!mapa) {
            throw new Error('Mapa no inicializado');
        }

        const marcador = marcadoresParadas.get(paradaId);
        if (marcador) {
            marcador.setLatLng([coordenadas.lat, coordenadas.lng]);
            logger.info(`Marcador de parada ${paradaId} actualizado`);
        } else {
            logger.warn(`No se encontró marcador para la parada ${paradaId}`);
        }
    } catch (error) {
        logger.error('Error al actualizar marcador de parada:', error);
    }
}

/**
 * Actualiza el modo del mapa (casa o aventura).
 * @param {string} nuevoModo - El nuevo modo ('casa' o 'aventura').
 */
function actualizarModoMapa(nuevoModo) {
    try {
        if (!mapa) {
            throw new Error('Mapa no inicializado');
        }

        if (nuevoModo === 'casa') {
            // Configuración específica para el modo casa
            mapa.setZoom(13);
            logger.info('Mapa actualizado al modo casa');
        } else if (nuevoModo === 'aventura') {
            // Configuración específica para el modo aventura
            mapa.setZoom(16);
            logger.info('Mapa actualizado al modo aventura');
        } else {
            throw new Error(`Modo no válido: ${nuevoModo}`);
        }
    } catch (error) {
        logger.error('Error al actualizar el modo del mapa:', error);
    }
}

/**
 * Busca las coordenadas de una parada por su ID
 * @param {string} paradaId - ID de la parada a buscar
 * @returns {Object|null} Objeto con lat y lng, o null si no se encuentra
 */
function buscarCoordenadasParada(paradaId) {
    if (!paradaId) {
        logger.warn('No se proporcionó un ID de parada');
        return null;
    }
    
    const parada = arrayParadasLocal.find(p => p.id === paradaId || p.parada_id === paradaId);
    
    if (!parada) {
        logger.warn(`No se encontró la parada con ID: ${paradaId}`);
        return null;
    }
    
    return parada.coordenadas || null;
}

// Exportar funciones públicas
export {
    estadoMapa,
    actualizarModoMapa,
    buscarCoordenadasParada,
    buscarCoordenadasTramo,
    obtenerNombreParada,
    actualizarMarcadorParada,
    actualizarPuntoActual,
    limpiarRecursos,
    cargarDatosParada,
    establecerDatosParadas
};
