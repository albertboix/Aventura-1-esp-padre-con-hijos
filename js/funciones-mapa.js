/**
 * Módulo que maneja la visualización del mapa y la interacción con las paradas
 * Se comunica con el padre a través del sistema de mensajería
 */

// Importar la mensajería
import { Mensajeria, TIPOS_MENSAJE } from './mensajeria.js';

// Estado del módulo
let mapa = null;
const marcadoresParadas = new Map();
let paradasCargadas = new Map();
let manejadorActualizacionParada = null;
let estaInicializado = false;

/**
 * Inicializa el mapa y configura los manejadores de mensajes
 * @returns {boolean} true si la inicialización fue exitosa
 */
export function inicializarMapa() {
    try {
        if (estaInicializado) {
            console.warn('El mapa ya está inicializado');
            return true;
        }

        // Verificar que exista el contenedor del mapa
        const contenedorMapa = document.getElementById('mapa');
        if (!contenedorMapa) {
            console.error('No se encontró el elemento con id="mapa"');
            return false;
        }

        // Verificar que Leaflet esté disponible
        if (typeof L === 'undefined') {
            console.error('Error: Leaflet no está cargado');
            return false;
        }

        // Inicializar el mapa de Leaflet
        mapa = L.map('mapa').setView([39.4699, -0.3763], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 10
        }).addTo(mapa);

        console.log('Mapa inicializado correctamente');
        
        // Configurar eventos del mapa
        configurarEventosMapa();
        
        // Registrar manejadores de mensajes
        if (!registrarManejadores()) {
            console.error('Error al registrar manejadores de mensajes');
            return false;
        }
        
        // Cargar paradas iniciales
        cargarParadasIniciales();
        
        estaInicializado = true;
        return true;
        
    } catch (error) {
        console.error('Error al inicializar el mapa:', error);
        return false;
    }
}

/**
 * Configura los eventos del mapa
 */
function configurarEventosMapa() {
    if (!mapa) return;

    // Evento de zoom
    mapa.on('zoomend', () => {
        console.log('Nivel de zoom actualizado:', mapa.getZoom());
    });

    // Evento de movimiento del mapa
    mapa.on('moveend', () => {
        const center = mapa.getCenter();
        console.log('Mapa movido a:', center);
        // Opcional: Cargar paradas visibles en la vista actual
        // cargarParadasEnVista(center, mapa.getZoom());
    });

    // Manejar clics en el mapa
    mapa.on('click', (e) => {
        console.log('Clic en coordenadas:', e.latlng);
    });
}

/**
 * Registra los manejadores de mensajes
 * @returns {boolean} true si se registraron correctamente
 */
function registrarManejadores() {
    try {
        // Limpiar manejadores anteriores si existen
        if (manejadorActualizacionParada) {
            Mensajeria.removerControlador(TIPOS_MENSAJE.DATOS.ACTUALIZACION_PARADA, manejadorActualizacionParada);
        }

        // Manejar actualizaciones de paradas
        manejadorActualizacionParada = (mensaje) => {
            try {
                const { paradaId, datos } = mensaje.datos || {};
                
                if (!paradaId) {
                    console.error('Mensaje de actualización sin ID de parada:', mensaje);
                    return;
                }
                
                if (datos) {
                    console.log(`Actualizando marcador para parada ${paradaId}`);
                    actualizarMarcadorParada(paradaId, datos);
                } else {
                    console.warn(`Mensaje sin datos para parada ${paradaId}`);
                }
            } catch (error) {
                console.error('Error procesando actualización de parada:', error, mensaje);
            }
        };

        // Registrar el manejador
        Mensajeria.registrarControlador(
            TIPOS_MENSAJE.DATOS.ACTUALIZACION_PARADA, 
            manejadorActualizacionParada
        );
        
        console.log('Manejadores de mensajes registrados correctamente');
        return true;
        
    } catch (error) {
        console.error('Error al registrar manejadores:', error);
        return false;
    }
}

/**
 * Carga las paradas iniciales del sistema
 */
async function cargarParadasIniciales() {
    try {
        // Solicitar las primeras 5 paradas (ajustar según necesidad)
        for (let i = 0; i < 5; i++) {
            await cargarDatosParada(`P-${i}`);
        }
    } catch (error) {
        console.error('Error cargando paradas iniciales:', error);
    }
}

/**
 * Carga los datos de una parada específica desde el padre
 * @param {string} paradaId - ID de la parada a cargar
 */
async function cargarDatosParada(paradaId) {
    try {
        console.log(`Solicitando datos para parada: ${paradaId}`);
        
        // Usar la mensajería para solicitar los datos al padre
        const respuesta = await Mensajeria.enviarMensaje(
            'padre',
            TIPOS_MENSAJE.DATOS.SOLICITAR_PARADA,
            { paradaId },
            { esperarRespuesta: true, timeout: 5000 }
        );
        
        if (respuesta && respuesta.exito) {
            console.log(`Datos recibidos para parada ${paradaId}:`, respuesta.datos);
            actualizarMarcadorParada(paradaId, respuesta.datos);
            return true;
        } else {
            console.warn(`No se pudieron obtener datos para la parada ${paradaId}`);
            return false;
        }
    } catch (error) {
        console.error(`Error solicitando datos de parada ${paradaId}:`, error);
        return false;
    }
}

/**
 * Actualiza o crea un marcador en el mapa para una parada
 * @param {string} paradaId - ID de la parada
 * @param {Object} datosParada - Datos completos de la parada
 */
function actualizarMarcadorParada(paradaId, datosParada) {
    if (!datosParada || !datosParada.coordenadas) {
        console.warn(`Datos de coordenadas faltantes para la parada ${paradaId}`);
        return;
    }

    const [lat, lng] = datosParada.coordenadas;
    const popupContent = `<b>${datosParada.nombre || `Parada ${paradaId}`}</b>`;

    if (marcadoresParadas.has(paradaId)) {
        // Actualizar marcador existente
        const marcador = marcadoresParadas.get(paradaId);
        marcador.setLatLng([lat, lng]);
        marcador.getPopup().setContent(popupContent);
        console.log(`Marcador actualizado para parada ${paradaId}`);
    } else {
        // Crear nuevo marcador
        const marcador = L.marker([lat, lng])
            .addTo(mapa)
            .bindPopup(popupContent);
        
        marcadoresParadas.set(paradaId, marcador);
        console.log(`Nuevo marcador creado para parada ${paradaId}`);
    }
    
    // Almacenar los datos de la parada
    paradasCargadas.set(paradaId, datosParada);
}

/**
 * Limpia los recursos del módulo
 */
export function limpiarRecursos() {
    try {
        // Limpiar manejadores de mensajes
        if (manejadorActualizacionParada) {
            Mensajeria.removerControlador(TIPOS_MENSAJE.DATOS.ACTUALIZACION_PARADA, manejadorActualizacionParada);
            manejadorActualizacionParada = null;
        }
        
        // Limpiar el mapa
        if (mapa) {
            mapa.off(); // Remover todos los manejadores de eventos
            mapa.remove();
            mapa = null;
        }
        
        // Limpiar colecciones
        marcadoresParadas.clear();
        paradasCargadas.clear();
        
        estaInicializado = false;
        console.log('Recursos del mapa liberados correctamente');
        
    } catch (error) {
        console.error('Error al limpiar recursos del mapa:', error);
    }
}

// Inicializar el mapa cuando el DOM esté listo
function inicializar() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarMapa);
    } else {
        // Usar un pequeño retraso para asegurar que todo esté listo
        setTimeout(() => {
            if (!inicializarMapa()) {
                console.error('No se pudo inicializar el mapa correctamente');
            }
        }, 100);
    }
}

// Iniciar la aplicación
inicializar();

// Manejar recarga de la página
window.addEventListener('beforeunload', () => {
    limpiarRecursos();
});

// Exportar las funciones que necesiten ser accesibles desde otros módulos
export default {
    inicializarMapa,
    limpiarRecursos,
    actualizarMarcadorParada,
    cargarDatosParada
};
