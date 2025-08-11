/**
 * Módulo que maneja la visualización del mapa y la interacción con las paradas
 * Se comunica con el padre a través del sistema de mensajería
 */

// Importar la mensajería
import { Mensajeria, TIPOS_MENSAJE } from './mensajeria.js';

// Estado del módulo
let mapa;
const marcadoresParadas = new Map();
let paradasCargadas = new Map();

/**
 * Inicializa el mapa y configura los manejadores de mensajes
 */
export function inicializarMapa() {
    try {
        // Verificar que exista el contenedor del mapa
        const contenedorMapa = document.getElementById('mapa');
        if (!contenedorMapa) {
            console.error('No se encontró el elemento con id="mapa"');
            return;
        }

        // Inicializar el mapa de Leaflet
        mapa = L.map('mapa').setView([39.4699, -0.3763], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapa);

        console.log('Mapa inicializado correctamente');
        
        // Registrar manejadores de mensajes
        registrarManejadores();
        
        // Cargar paradas iniciales
        cargarParadasIniciales();
        
    } catch (error) {
        console.error('Error al inicializar el mapa:', error);
    }
}

/**
 * Registra los manejadores de mensajes
 */
function registrarManejadores() {
    // Manejar actualizaciones de paradas
    Mensajeria.registrarControlador(TIPOS_MENSAJE.DATOS.ACTUALIZACION_PARADA, (mensaje) => {
        const { paradaId, datos } = mensaje.datos;
        if (datos) {
            actualizarMarcadorParada(paradaId, datos);
        }
    });
    
    console.log('Manejadores de mensajes registrados');
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

// Inicializar el mapa cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarMapa);
} else {
    setTimeout(inicializarMapa, 0);
}

// Exportar las funciones que necesiten ser accesibles desde otros módulos
export default {
    inicializarMapa
};
