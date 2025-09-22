/**
 * Módulo que maneja la visualización del mapa y la interacción con las paradas
 * Se comunica con el padre a través del sistema de mensajería
 */

// Importar mensajería y configuración
import { 
  inicializarMensajeria, 
  enviarMensaje, 
  registrarControlador 
} from './js/mensajeria.js';
import { CONFIG } from './js/config.js';
import { TIPOS_MENSAJE } from './js/constants.js';
import logger from './js/logger.js';

// Estado del módulo
let mapa = null;
const marcadoresParadas = new Map();
let marcadorDestino = null;
let rutasTramos = [];

const IFRAME_ID = 'hijo2'; // Este ID ya no se usa si el mapa está en el padre

/**
 * Inicializa el mapa y los manejadores de mensajes.
 * @param {object} config - Configuración con containerId y paradas.
 * @returns {Promise<L.Map>} La instancia del mapa de Leaflet.
 */
export async function inicializarMapa(config) {
    logger.info('🗺️ Inicializando mapa...');

    if (!config.containerId || !config.paradas) {
        throw new Error("La configuración del mapa requiere 'containerId' y 'paradas'.");
    }

    if (typeof L === 'undefined') {
        throw new Error("Leaflet (L) no está cargado.");
    }

    mapa = L.map(config.containerId, {
        center: [39.4699, -0.3763], // Valencia
        zoom: 16,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapa);

    // Dibujar marcadores de paradas
    config.paradas.forEach(parada => {
        if (parada.coordenadas) {
            const marker = L.marker([parada.coordenadas.lat, parada.coordenadas.lng]).addTo(mapa);
            marker.bindPopup(`<b>${parada.nombre}</b>`);
            marcadoresParadas.set(parada.id, marker);
        }
    });
    
    logger.info(`Se han dibujado ${marcadoresParadas.size} marcadores.`);
    return mapa;
}

// Punto de entrada
inicializar().catch(error => logger.error("Error fatal en la inicialización del mapa:", error));

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
        
        if (typeof notificarError === 'function') {
            await notificarError('inicializacion_modulo_mapa', error);
        }
        
        estadoMapa.inicializado = false;
        throw error; // Re-lanzar para que el llamador sepa que hubo un error
    }
}

// Limpiar recursos cuando se descargue la página
window.addEventListener('beforeunload', () => {
    limpiarRecursos();
});

// Función para actualizar el punto actual en el mapa
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

        // Centrar el mapa en las nuevas coordenadas
        mapa.flyTo([coordenadas.lat, coordenadas.lng], config.zoom, {
            animate: config.animate,
            duration: config.duration
        });

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

// Nueva función para dibujar la polyline desde la ubicación del usuario hasta la última parada/tramo completada
let polylineUsuarioUltimaParada = null;

function dibujarPolylineUsuarioUltimaParada(ubicacionUsuario, paradaActualIndex = 0) {
    // Obtener la parada/tramo actual
    const paradaActual = arrayParadasLocal?.[paradaActualIndex] || arrayParadasLocal?.[0];
    if (!ubicacionUsuario || !paradaActual) return;

    // Obtener coordenadas de la parada/tramo
    let destinoCoords = null;
    if (paradaActual.tipo === "parada" || paradaActual.tipo === "inicio") {
        destinoCoords = buscarCoordenadasParada(paradaActual.parada_id);
    } else if (paradaActual.tipo === "tramo") {
        // Para tramos, puedes usar el inicio o el fin
        destinoCoords = buscarCoordenadasTramo(paradaActual.tramo_id)?.fin;
    }
    if (!destinoCoords) return;

    // Eliminar polyline anterior si existe
    if (polylineUsuarioUltimaParada) {
        mapa.removeLayer(polylineUsuarioUltimaParada);
        polylineUsuarioUltimaParada = null;
    }

    // Dibujar nueva polyline
    polylineUsuarioUltimaParada = L.polyline([
        [ubicacionUsuario.lat, ubicacionUsuario.lng],
        [destinoCoords.lat, destinoCoords.lng]
    ], {
        color: '#0077cc',
        weight: 5,
        opacity: 0.8,
        dashArray: '10,10'
    }).addTo(mapa);
}

// Ejemplo de uso: llama a esta función cada vez que cambie la ubicación del usuario
// dibujarPolylineUsuarioUltimaParada({ lat: usuarioLat, lng: usuarioLng }, estadoApp.paradaActual);

// Si no se ha empezado, estadoApp.paradaActual será 0 y mostrará P-0 por defecto

// Exportar funciones públicas
export {
    inicializarMapa,
    actualizarModoMapa,
    buscarCoordenadasParada,
    obtenerNombreParada,
    actualizarMarcadorParada,
    actualizarPuntoActual,
    limpiarRecursos,
    cargarDatosParada
};

// Módulo listo para usar
