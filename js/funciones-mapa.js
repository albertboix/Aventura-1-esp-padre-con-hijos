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
let rutasActivas = []; // Añadir variable para separar rutas activas de tramos
let marcadorUsuario = null;

// Estado del mapa para seguimiento interno
const estadoMapa = {
    inicializado: false,
    modo: 'casa', // 'casa' o 'aventura'
    paradaActual: 0,
    tramoActual: null, // Añadido: Variable tramoActual definida
    posicionUsuario: null,
    watchId: null, // Añadido: Variable watchId definida
    siguiendoRuta: false // Añadido: Variable para controlar seguimiento de ruta
};

// Referencia local a los datos de paradas
let arrayParadasLocal = []; // Añadido: Array inicializado vacío

// Estilos CSS para notificaciones de waypoint - PROBLEMA 16: Faltaban estilos CSS
const WAYPOINT_STYLES = `
.waypoint-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: rgba(33, 150, 243, 0.9);
    color: white;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 9999;
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
    max-width: 80%;
}

.waypoint-notification.show {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
}

.notif-icon {
    font-size: 24px;
    margin-right: 12px;
}

.notif-content {
    flex: 1;
}

.notif-title {
    font-weight: bold;
    margin-bottom: 4px;
}

.notif-progress {
    height: 6px;
    background: rgba(255,255,255,0.3);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 4px;
}

.notif-bar {
    height: 100%;
    background: white;
    border-radius: 3px;
}
`;

/**
 * Inicializa el mapa y los manejadores de mensajes.
 * @param {object} config - Configuración del mapa.
 * @returns {Promise<L.Map>} La instancia del mapa de Leaflet.
 */
export async function inicializarMapa(config = {}) {
    logger.info('🗺️ Inicializando mapa...');
    
    // PROBLEMA 17: Insertar estilos CSS para notificaciones
    if (!document.getElementById('waypoint-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'waypoint-styles';
        styleElement.textContent = WAYPOINT_STYLES;
        document.head.appendChild(styleElement);
        logger.debug('Estilos CSS para notificaciones de waypoint insertados');
    }
    
    return new Promise((resolve, reject) => {
        try {
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
            let container = document.getElementById(containerId);
            
            if (!container) {
                logger.warn(`Contenedor del mapa con ID "${containerId}" no encontrado. Creando uno nuevo...`);
                // Crear el contenedor si no existe
                container = document.createElement('div');
                container.id = containerId;
                document.body.prepend(container);
                logger.info('✅ Contenedor del mapa creado dinámicamente');
            }
            
            // Preparar el contenedor explícitamente
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.zIndex = '10';
            container.style.backgroundColor = '#f5f5f5';
            
            // Si ya existe un mapa, destruirlo para evitar problemas
            if (window.mapa && typeof window.mapa.remove === 'function') {
                window.mapa.remove();
                window.mapa = null;
            }

            // Crear nueva instancia del mapa
            const mapInstance = L.map(containerId, {
                center: mapConfig.center,
                zoom: mapConfig.zoom,
                minZoom: mapConfig.minZoom || 12,
                maxZoom: mapConfig.maxZoom || 18,
                zoomControl: mapConfig.zoomControl !== undefined ? mapConfig.zoomControl : true,
                attributionControl: true
            });

            // Añadir capa base de OpenStreetMap con opciones explícitas
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                tileSize: 256,
                maxZoom: 19,
                minZoom: 1,
                detectRetina: true
            }).addTo(mapInstance);

            // Actualizar estado
            estadoMapa.inicializado = true;
            window.mapa = mapInstance; // Referencia global
            mapa = mapInstance; // Guardar referencia local también (PROBLEMA 5: Faltaba asignar a variable local)
            
            // Verificar que el mapa se inicializó correctamente
            if (typeof mapInstance.getCenter === 'function') {
                logger.info('✅ Mapa inicializado correctamente en:', mapInstance.getCenter());
                
                // Forzar actualización del tamaño
                setTimeout(() => {
                    mapInstance.invalidateSize(true);
                    logger.info('🔄 Tamaño del mapa actualizado forzosamente');
                }, 300);
                
                resolve(mapInstance);
            } else {
                reject(new Error('El mapa no se inicializó correctamente'));
            }
            
        } catch (error) {
            logger.error('❌ Error al inicializar mapa:', error);
            reject(error);
        }
    });
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
        
        // Solicitar datos de paradas al padre después de inicializar
        await solicitarDatosParadas();
        
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
    
    // PROBLEMA 18: Registrar manejadores para recepción de paradas y estado del sistema
    registrarControlador(TIPOS_MENSAJE.DATOS.RESPUESTA_PARADAS, manejarRecepcionParadas);
    registrarControlador(TIPOS_MENSAJE.SISTEMA.ESTADO, manejarEstadoSistema);
    
    // Añadir manejador para mostrar ruta (polyline)
    registrarControlador(TIPOS_MENSAJE.NAVEGACION.MOSTRAR_RUTA, manejarMostrarRuta);
    
    // Registrar controlador específico para solicitud de paradas
    registrarControlador(TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS, async (mensaje) => {
        try {
            // Responder con las paradas actuales
            return {
                exito: true,
                paradas: arrayParadasLocal,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error al responder solicitud de paradas:', error);
            return {
                exito: false,
                error: error.message
            };
        }
    });
    
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
    console.log('🗺️ [MAPA] manejarEstablecerDestino INVOCADO con:', mensaje);
    console.log('📋 [MAPA] Datos del mensaje:', mensaje.datos);

    const { punto } = mensaje.datos || {};
    if (!punto) {
        console.warn('⚠️ [MAPA] Mensaje de establecer destino sin punto');
        return;
    }

    console.log('🎯 [MAPA] Estableciendo destino para punto:', punto);

    try {
        // Buscar coordenadas según el tipo de punto
        let coordenadas = null;
        if (punto.parada_id) {
            coordenadas = buscarCoordenadasParada(punto.parada_id);
        } else if (punto.tramo_id) {
            coordenadas = buscarCoordenadasTramo(punto.tramo_id)?.fin;
        }

        if (!coordenadas) {
            console.warn(`❌ [MAPA] No se encontraron coordenadas para el punto: ${JSON.stringify(punto)}`);
            return;
        }

        console.log('📍 [MAPA] Coordenadas encontradas:', coordenadas);

        // Centrar mapa y actualizar marcador
        console.log('🎯 [MAPA] Centrando mapa en:', coordenadas);
        mapa.flyTo([coordenadas.lat, coordenadas.lng], 17);
        actualizarMarcadorParada(coordenadas, obtenerNombreParada(punto));

        console.log('✅ [MAPA] Destino establecido correctamente');

    } catch (error) {
        console.error('❌ [MAPA] Error al establecer destino:', error);
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
        
        // PROBLEMA 19: Verificar proximidad a waypoints cuando hay seguimiento activo
        if (estadoMapa.siguiendoRuta && estadoMapa.modo === 'aventura') {
            verificarProximidadWaypoints(coordenadas);
        }
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
 * Muestra todas las paradas en el mapa
 */
function mostrarTodasLasParadas() {
    try {
        logger.info('Mostrando todas las paradas en el mapa');
        
        // Verificar que tengamos una instancia válida del mapa
        if (!mapa) {
            logger.error('No se pueden mostrar paradas: mapa no inicializado');
            console.error('❌ [MAPA] No se pueden mostrar paradas: mapa no inicializado');
            return;
        }
        
        // Verificar que tengamos datos de paradas
        if (!arrayParadasLocal || arrayParadasLocal.length === 0) {
            logger.warn('No hay datos de paradas para mostrar en el mapa');
            console.warn('⚠️ [MAPA] Array de paradas vacío o no inicializado');
            return;
        }
        
        console.log('📍 [MAPA] Mostrando paradas en el mapa. Total paradas:', arrayParadasLocal.length);
        console.log('📍 [MAPA] Primera parada:', arrayParadasLocal[0]);
        
        // Limpiar marcadores previos antes de añadir nuevos
        marcadoresParadas.forEach((marcador) => {
            if (mapa.hasLayer(marcador)) {
                mapa.removeLayer(marcador);
            }
        });
        marcadoresParadas.clear();
        
        // Implementación básica - mostrar paradas en el mapa
        arrayParadasLocal.forEach((parada, index) => {
            if (parada.coordenadas && parada.coordenadas.lat && parada.coordenadas.lng) {
                const { lat, lng } = parada.coordenadas;
                
                // Crear marcador con un estilo más visible y distintivo
                const icono = L.divIcon({
                    className: 'marcador-parada',
                    html: `<div style="background-color: ${parada.tipo === 'parada' ? '#2196F3' : '#FF9800'}; 
                                        border-radius: 50%; width: 24px; height: 24px; 
                                        display: flex; justify-content: center; align-items: center; 
                                        color: white; font-weight: bold; border: 2px solid white;">
                            ${parada.parada_id ? parada.parada_id.split('-')[1] : index}
                          </div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                    popupAnchor: [0, -12]
                });
                
                const marcador = L.marker([lat, lng], { 
                    icon: icono,
                    title: parada.nombre || `Parada ${index + 1}`
                }).addTo(mapa);

                // Añadir tooltip con el nombre de la parada
                if (parada.nombre) {
                    marcador.bindTooltip(parada.nombre, {
                        permanent: false,
                        direction: 'top',
                        className: 'tooltip-parada',
                        offset: [0, -12]
                    });
                }

                // Guardar referencia al marcador
                marcadoresParadas.set(parada.parada_id || `parada-${index}`, marcador);
                marcadoresParadas.set(parada.id || parada.parada_id || parada.tramo_id || `parada-${index}`, marcador);
                
                console.log(`✅ [MAPA] Marcador añadido para ${parada.nombre || `Parada ${index}`} en ${lat}, ${lng}`);
            } else {
                console.warn(`⚠️ [MAPA] La parada ${parada.nombre || index} no tiene coordenadas válidas`, parada);
            }
        });
        
        logger.info(`Se han añadido ${marcadoresParadas.size} marcadores al mapa`);
        console.log(`✅ [MAPA] Total de ${marcadoresParadas.size} marcadores añadidos al mapa`);
    } catch (error) {
        logger.error('Error al mostrar todas las paradas:', error);
        console.error('❌ [MAPA] Error al mostrar paradas:', error);
    }
}

/**
 * Maneja la recepción de datos de paradas
 * @param {Object} mensaje - Mensaje recibido
 */
function manejarRecepcionParadas(mensaje) {
    try {
        // Aceptar múltiples formatos de datos para mayor compatibilidad
        const { paradas, aventuraParadas, puntos, puntosRuta } = mensaje.datos || {};
        
        // Encontrar el array de paradas válido (en orden de prioridad)
        const paradasData = paradas || aventuraParadas || puntos || puntosRuta;
        
        if (!paradasData || !Array.isArray(paradasData) || paradasData.length === 0) {
            logger.warn('Mensaje de paradas recibido sin datos válidos');
            return { exito: false, error: 'Datos de paradas inválidos o vacíos' };
        }
        
        logger.info(`Recibidas ${paradasData.length} paradas`);
        console.log(`📦 [MAPA] Recibidas ${paradasData.length} paradas del padre`);
        
        // Actualizar el array local - usar copia profunda para evitar referencias
        establecerDatosParadas(JSON.parse(JSON.stringify(paradasData)));
        
        // Solicitar detalles adicionales si es necesario
        if (paradasData.length > 0 && !paradasData[0].coordenadas) {
            logger.info('Paradas recibidas sin coordenadas, solicitando datos completos');
            enviarMensaje('padre', TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS_COMPLETAS, {
                timestamp: new Date().toISOString()
            }).catch(err => logger.error('Error al solicitar paradas completas:', err));
        }
        
        // Si estamos en modo casa, mostrar todas las paradas inmediatamente
        if (estadoMapa.modo === 'casa') {
            console.log('🏠 [MAPA] Modo casa detectado, mostrando todas las paradas');
            // Pequeño delay para asegurar que el mapa esté listo
            setTimeout(() => {
                mostrarTodasLasParadas();
            }, 100);
        } else {
            // En modo aventura, mostrar solo la parada actual y anteriores
            console.log('🚶‍♂️ [MAPA] Modo aventura detectado, ocultando paradas futuras');
            ocultarParadasFuturas();
        }
        
        return {
            exito: true,
            paradasCargadas: paradasData.length
        };
    } catch (error) {
        logger.error('Error al manejar recepción de paradas:', error);
        return {
            exito: false,
            error: error.message
        };
    }
}

/**
 * Notifica al usuario que ha alcanzado un waypoint
 * @param {number} numero - Número del waypoint
 * @param {number} total - Total de waypoints
 */
function notificarWaypointAlcanzado(numero, total) {
    // Crear o actualizar elemento de notificación
    let notifElement = document.getElementById('waypoint-notification');
    if (!notifElement) {
        notifElement = document.createElement('div');
        notifElement.id = 'waypoint-notification';
        notifElement.className = 'waypoint-notification';
        document.body.appendChild(notifElement);
    }
    
    // Actualizar contenido
    notifElement.innerHTML = `
        <div class="notif-icon">🏁</div>
        <div class="notif-content">
            <div class="notif-title">¡Punto ${numero} alcanzado!</div>
            <div class="notif-subtitle">${numero} de ${total} puntos completados</div>
            <div class="notif-progress">
                <div class="notif-bar" style="width: ${(numero/total) * 100}%"></div>
            </div>
        </div>
    `;
    
    // Mostrar la notificación
    notifElement.classList.add('show');
    
    // Ocultar después de unos segundos
    setTimeout(() => {
        notifElement.classList.remove('show');
    }, 3000);
}

/**
 * Establece los datos de paradas para el módulo
 * @param {Array} paradas - Array con datos de paradas
 * @returns {boolean} True si los datos se establecieron correctamente
 */
export function establecerDatosParadas(paradas) {
    if (!paradas || !Array.isArray(paradas)) {
        logger.warn('Se intentó establecer un array de paradas inválido');
        return false;
    }
    
    arrayParadasLocal = [...paradas];
    logger.info(`Datos de ${paradas.length} paradas establecidos en el módulo de mapa`);
    console.log(`📦 [MAPA] Array local actualizado con ${paradas.length} paradas`);
    
    // Si el mapa ya está inicializado y estamos en modo casa, mostrar las paradas
    if (mapa && estadoMapa.inicializado && estadoMapa.modo === 'casa') {
        console.log('🏠 [MAPA] Modo casa activo, mostrando todas las paradas tras actualizar datos');
        mostrarTodasLasParadas();
    }
    
    return true;
}

/**
 * Maneja el estado del sistema
 * @param {Object} mensaje - Mensaje recibido
 * PROBLEMA 18: Implementación de función faltante
 */
function manejarEstadoSistema(mensaje) {
    try {
        const { modo, paradas, paradaActual } = mensaje.datos || {};
        
        // Actualizar modo si viene en el mensaje
        if (modo && modo !== estadoMapa.modo) {
            actualizarModoMapa(modo);
        }
        
        // Actualizar parada actual si viene en el mensaje
        if (typeof paradaActual === 'number' && paradaActual !== estadoMapa.paradaActual) {
            estadoMapa.paradaActual = paradaActual;
            logger.info(`Parada actual actualizada a: ${paradaActual}`);
        }
        
        // Actualizar paradas si vienen en el mensaje
        if (paradas && Array.isArray(paradas) && paradas.length > 0) {
            establecerDatosParadas(paradas);
        }
        
        return { exito: true };
    } catch (error) {
        logger.error('Error al manejar estado del sistema:', error);
        return { exito: false, error: error.message };
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
    
    const modoAnterior = estadoMapa.modo;
    estadoMapa.modo = modo;
    logger.info(`Modo del mapa actualizado a: ${modo}`);
    console.log(`🔄 [MAPA] Modo del mapa actualizado de ${modoAnterior} a ${modo}`);
    
    // PROBLEMA 6: Funciones no definidas
    // Reemplazar llamadas a funciones no definidas con implementaciones básicas
    if (modo === 'casa') {
        // Mostrar todas las paradas
        console.log('🏠 [MAPA] Activando modo casa - mostrando todas las paradas');
        mostrarTodasLasParadas();
        
        // PROBLEMA 20: Desactivar seguimiento de posición en modo casa
        activarSeguimientoUsuario(false);
        estadoMapa.siguiendoRuta = false;
    } else {
        // Mostrar solo la parada actual y las completadas
        console.log('🚶‍♂️ [MAPA] Activando modo aventura - ocultando paradas futuras');
        ocultarParadasFuturas();
    }
}

/**
 * Oculta paradas futuras en modo aventura
 * PROBLEMA 6: Implementación de función faltante
 */
function ocultarParadasFuturas() {
    try {
        logger.info('Ocultando paradas futuras en modo aventura');
        
        // Implementación básica - ocultar paradas futuras
        const paradaActualIndex = arrayParadasLocal.findIndex(p => 
            p.parada === estadoMapa.paradaActual ||
            (p.id && p.id === `P-${estadoMapa.paradaActual}`)
        );
        
        if (paradaActualIndex >= 0) {
            // Ocultar paradas futuras
            arrayParadasLocal.forEach((parada, index) => {
                const marcador = marcadoresParadas.get(parada.id);
                if (marcador) {
                    if (index > paradaActualIndex) {
                        mapa.removeLayer(marcador);
                    } else {
                        if (!mapa.hasLayer(marcador)) {
                            marcador.addTo(mapa);
                        }
                    }
                }
            });
        }
    } catch (error) {
        logger.error('Error al ocultar paradas futuras:', error);
    }
}

/**
 * Dibuja un tramo específico en el mapa with waypoints y decoraciones
 * @param {Object} tramo - Objeto tramo con inicio, fin y waypoints
 * @param {boolean} destacado - Si es true, se muestra con énfasis
 * @returns {L.Polyline} La polyline creada
 * PROBLEMA 11: Función no estaba definida pero se usa en mostrarTramo
 */
function dibujarTramo(tramo, destacado = false) {
    if (!tramo || !tramo.inicio || !tramo.fin) {
        logger.warn('No se puede dibujar el tramo, faltan datos');
        return null;
    }
    
    // Crear array de puntos para la polyline
    const puntos = [
        [tramo.inicio.lat, tramo.inicio.lng]
    ];
    
    // Añadir waypoints si existen para crear una ruta con curvas naturales
    if (tramo.waypoints && tramo.waypoints.length) {
        tramo.waypoints.forEach(wp => {
            puntos.push([wp.lat, wp.lng]);
        });
    }
    
    // Añadir punto final
    puntos.push([tramo.fin.lat, tramo.fin.lng]);
    
    // Estilo base de la polyline
    const estilo = {
        color: destacado ? '#ff4500' : '#3388ff',
        weight: destacado ? 6 : 4,
        opacity: destacado ? 0.9 : 0.7,
        dashArray: destacado ? null : '10, 10',
        lineCap: 'round',
        lineJoin: 'round'
    };
    
    // Crear la polyline
    const polyline = L.polyline(puntos, estilo).addTo(mapa);
    
    // Añadir decoraciones (flechas) para indicar la dirección
    // PROBLEMA 20: Verificar si L.polylineDecorator está disponible
    if (typeof L.polylineDecorator === 'function') {
        try {
            const decoraciones = L.polylineDecorator(polyline, {
                patterns: [
                    {
                        offset: '10%',
                        repeat: 100,
                        symbol: L.Symbol.arrowHead({
                            pixelSize: 15,
                            headAngle: 45,
                            pathOptions: {
                                fillColor: destacado ? '#ff4500' : '#3388ff',
                                fillOpacity: 0.8,
                                weight: 0
                            }
                        })
                    }
                ]
            }).addTo(mapa);
        } catch (error) {
            logger.warn('No se pudieron añadir decoraciones al tramo:', error);
        }
    }
    
    return polyline;
}

/**
 * Muestra un tramo específico en el mapa y centra la vista
 * @param {string} tramoId - ID del tramo a mostrar
 * PROBLEMA 12: Función usada pero no definida
 */
function mostrarTramo(tramoId) {
    try {
        // Buscar tramo por ID
        const tramo = buscarCoordenadasTramo(tramoId);
        if (!tramo) {
            logger.warn(`Tramo no encontrado: ${tramoId}`);
            return;
        }
        
        // Limpiar tramos anteriores
        rutasTramos.forEach(ruta => mapa.removeLayer(ruta));
        rutasTramos = [];
        
        // Dibujar este tramo destacado
        const polyline = dibujarTramo(tramo, true);
        rutasTramos.push(polyline);
        
        // Determinar bounds para ajustar la vista
        const bounds = polyline.getBounds();
        mapa.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 17
        });
        
        // Añadir marcadores solo en inicio y fin
        const inicioMarker = L.marker([tramo.inicio.lat, tramo.inicio.lng], {
            icon: L.divIcon({
                className: 'inicio-marker',
                html: '<div class="marker-letter">A</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(mapa);
        
        const finMarker = L.marker([tramo.fin.lat, tramo.fin.lng], {
            icon: L.divIcon({
                className: 'fin-marker',
                html: '<div class="marker-letter">B</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(mapa);
        
        // Guardar referencia
        rutasTramos.push(inicioMarker, finMarker);
        
        // PROBLEMA 13: Actualizar estadoMapa.tramoActual para correcta detección de waypoints
        estadoMapa.tramoActual = tramoId;
    } catch (error) {
        logger.error('Error al mostrar tramo:', error);
    }
}

/**
 * Actualiza el marcador de posición actual del usuario
 * @param {Object} coordenadas - Coordenadas {lat, lng}
 * PROBLEMA 7: Función usada pero no definida
 */
function actualizarPuntoActual(coordenadas) {
    if (!mapa) {
        logger.warn('No se puede actualizar posición: mapa no inicializado');
        return;
    }
    
    // Guardar coordenadas
    estadoMapa.posicionUsuario = coordenadas;
    
    // Eliminar marcador anterior si existe
    if (marcadorUsuario) {
        mapa.removeLayer(marcadorUsuario);
        if (marcadorUsuario.marcadorPunto) {
            mapa.removeLayer(marcadorUsuario.marcadorPunto);
        }
    }
    
    // Crear nuevo marcador
    marcadorUsuario = L.circle([coordenadas.lat, coordenadas.lng], {
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 0.8,
        radius: coordenadas.accuracy || 10,
        weight: 2
    }).addTo(mapa);
    
    // Crear marcador de posición exacta
    const iconoUsuario = L.divIcon({
        className: 'marcador-usuario',
        html: '<div class="usuario-punto"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
    
    const marcadorPunto = L.marker([coordenadas.lat, coordenadas.lng], {
        icon: iconoUsuario,
        zIndexOffset: 1000
    }).addTo(mapa);
    
    // Guardar referencia al marcador de punto también
    marcadorUsuario.marcadorPunto = marcadorPunto;
}

/**
 * Limpia los recursos del mapa
 * PROBLEMA 8: Función incompleta
 */
function limpiarRecursos() {
    try {
        // Limpiar seguimiento de usuario
        if (estadoMapa.watchId) {
            navigator.geolocation.clearWatch(estadoMapa.watchId);
            estadoMapa.watchId = null;
        }
        
        // Eliminar marcadores
        if (marcadorUsuario) {
            if (mapa) mapa.removeLayer(marcadorUsuario);
            if (marcadorUsuario.marcadorPunto && mapa) {
                mapa.removeLayer(marcadorUsuario.marcadorPunto);
            }
            marcadorUsuario = null;
        }
        
        // Eliminar marcador de destino
        if (marcadorDestino && mapa) {
            mapa.removeLayer(marcadorDestino);
            marcadorDestino = null;
        }
        
        // Eliminar marcadores de paradas
        marcadoresParadas.forEach((marcador) => {
            if (mapa) mapa.removeLayer(marcador);
        });
        marcadoresParadas.clear();
        
        // Eliminar rutas
        rutasTramos.forEach(ruta => {
            if (mapa) mapa.removeLayer(ruta);
        });
        rutasTramos = [];
        
        // Limpiar rutas activas (creadas con manejarMostrarRuta)
        rutasActivas.forEach(ruta => {
            if (mapa.hasLayer(ruta)) {
                mapa.removeLayer(ruta);
            }
        });
        rutasActivas = [];
        
        logger.debug('Recursos del mapa limpiados');
    } catch (error) {
        logger.error('Error al limpiar recursos del mapa:', error);
    }
}

// PROBLEMA 14: Limpiar recursos cuando se descargue la página
window.addEventListener('beforeunload', () => {
    limpiarRecursos();
});

/**
 * Carga los datos de una parada específica
 * @param {string} paradaId - ID de la parada a cargar
 * @returns {Object|null} Datos de la parada o null si no se encuentra
 * PROBLEMA 9: Función faltante pero exportada
 */
function cargarDatosParada(paradaId) {
    try {
        // Buscar parada por ID
        const parada = arrayParadasLocal.find(p => 
            p.id === paradaId || 
            p.parada_id === paradaId
        );
        
        if (!parada) {
            logger.warn(`Parada no encontrada: ${paradaId}`);
            return null;
        }
        
        logger.info(`Datos de parada ${paradaId} cargados`);
        return parada;
    } catch (error) {
        logger.error(`Error al cargar datos de parada ${paradaId}:`, error);
        return null;
    }
}

/**
 * Inicia la navegación activa desde un punto a otro
 * @param {string} tramoId - ID del tramo a navegar
 */
export function iniciarNavegacionTramo(tramoId) {
    try {
        // Mostrar el tramo en el mapa
        mostrarTramo(tramoId);
        
        // Buscar datos del tramo
        const tramo = arrayParadasLocal.find(p => p.id === tramoId || p.tramo_id === tramoId);
        if (!tramo) {
            logger.warn(`Tramo no encontrado para navegación: ${tramoId}`);
            return;
        }
        
        // Si estamos en modo aventura, activar seguimiento de posición del usuario
        if (estadoMapa.modo === 'aventura') {
            activarSeguimientoUsuario(true);
            // PROBLEMA 15: Marcar que estamos siguiendo una ruta
            estadoMapa.siguiendoRuta = true;
        }
        
        logger.info(`Navegación iniciada para tramo: ${tramoId}`);
    } catch (error) {
        logger.error('Error al iniciar navegación de tramo:', error);
    }
}

/**
 * Activa o desactiva el seguimiento de la posición del usuario
 * @param {boolean} activar - Si es true, activa el seguimiento
 */
function activarSeguimientoUsuario(activar) {
    // Si ya hay un watcher activo, cancelarlo primero
    if (estadoMapa.watchId) {
        navigator.geolocation.clearWatch(estadoMapa.watchId);
        estadoMapa.watchId = null;
    }
    
    if (!activar) return;
    
    // Solicitar permiso para geolocalización
    if (navigator.geolocation) {
        estadoMapa.watchId = navigator.geolocation.watchPosition(
            position => {
                const { latitude, longitude, accuracy } = position.coords;
                const coordenadas = { 
                    lat: latitude, 
                    lng: longitude,
                    accuracy: accuracy || 10 // PROBLEMA 20: Usar valor por defecto si no hay exactitud
                };
                
                // Actualizar marcador de posición del usuario
                actualizarPuntoActual(coordenadas);
                
                // Verificar proximidad a waypoints si estamos en modo aventura
                if (estadoMapa.modo === 'aventura' && estadoMapa.siguiendoRuta) {
                    verificarProximidadWaypoints(coordenadas);
                }
            },
            error => {
                logger.error('Error de geolocalización:', error);
                alert('No se pudo obtener tu ubicación. Por favor activa el GPS.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        alert('Tu navegador no soporta geolocalización.');
    }
}

/**
 * Verifica si el usuario está cerca de algún waypoint del tramo actual
 * @param {Object} coordenadasUsuario - Coordenadas del usuario {lat, lng}
 */
function verificarProximidadWaypoints(coordenadasUsuario) {
    // Obtener tramo actual
    const tramo = arrayParadasLocal.find(p => 
        p.id === estadoMapa.tramoActual || 
        p.tramo_id === estadoMapa.tramoActual
    );
    
    if (!tramo || !tramo.waypoints || !tramo.waypoints.length) return;
    
    // Distancia de proximidad en metros
    const DISTANCIA_PROXIMA = 25;
    
    // Verificar cada waypoint
    tramo.waypoints.forEach((waypoint, index) => {
        // Calcular distancia
        const distancia = calcularDistancia(coordenadasUsuario, waypoint);
        
        // Si está cerca y no se ha registrado como visitado
        if (distancia <= DISTANCIA_PROXIMA && !tramo.waypointsVisitados?.includes(index)) {
            // Marcar como visitado
            if (!tramo.waypointsVisitados) tramo.waypointsVisitados = [];
            tramo.waypointsVisitados.push(index);
            
            // PROBLEMA 16: Llamar a notificarWaypointAlcanzado para mostrar notificación
            notificarWaypointAlcanzado(index + 1, tramo.waypoints.length);
            
            // Verificar progreso del tramo (por ejemplo para estadísticas)
            const progreso = (tramo.waypointsVisitados.length / tramo.waypoints.length) * 100;
            logger.debug(`Waypoint ${index + 1} alcanzado, distancia: ${distancia.toFixed(2)}m, progreso: ${progreso.toFixed(0)}%`);
            
            // Notificar al padre que se alcanzó un waypoint
            enviarMensaje('padre', TIPOS_MENSAJE.NAVEGACION.WAYPOINT_ALCANZADO, {
                tramoId: estadoMapa.tramoActual,
                waypointIndex: index,
                totalWaypoints: tramo.waypoints.length,
                progreso: Math.round(progreso),
                coordenadas: waypoint,
                timestamp: new Date().toISOString()
            }).catch(error => logger.error('Error al notificar waypoint alcanzado:', error));
        }
    });
}

/**
 * Calcula la distancia en metros entre dos puntos geográficos
 * @param {Object} punto1 - Coordenadas del primer punto {lat, lng}
 * @param {Object} punto2 - Coordenadas del segundo punto {lat, lng}
 * @returns {number} Distancia en metros
 */
function calcularDistancia(punto1, punto2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = punto1.lat * Math.PI/180;
    const φ2 = punto2.lat * Math.PI/180;
    const Δφ = (punto2.lat - punto1.lat) * Math.PI/180;
    const Δλ = (punto2.lng - punto1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distancia en metros
}

/**
 * Maneja el mensaje para mostrar una ruta entre dos puntos
 * @param {Object} mensaje - Mensaje con origen, destino, color, grosor
 * @returns {Object} Resultado de la operación
 */
function manejarMostrarRuta(mensaje) {
    const { origen, destino, color, grosor, mostrarFlecha } = mensaje.datos || {};
    
    if (!origen || !destino || !origen.lat || !origen.lng || !destino.lat || !destino.lng) {
        logger.warn('Mensaje MOSTRAR_RUTA sin coordenadas válidas');
        return { exito: false, error: 'Coordenadas inválidas' };
    }
    
    try {
        // Limpiar rutas anteriores
        limpiarRutasActivas();
        
        // Crear puntos para polyline
        const puntos = [
            [origen.lat, origen.lng],
            [destino.lat, destino.lng]
        ];
        
        // Configurar estilo
        const estiloRuta = {
            color: color || '#0077ff',
            weight: grosor || 6,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
        };
        
        // Crear polyline
        const polyline = L.polyline(puntos, estiloRuta).addTo(mapa);
        
        // Añadir flechas de dirección si se solicita
        if (mostrarFlecha && typeof L.polylineDecorator === 'function') {
            const decorador = L.polylineDecorator(polyline, {
                patterns: [
                    {
                        offset: '25%',
                        repeat: 50,
                        symbol: L.Symbol.arrowHead({
                            pixelSize: 15,
                            headAngle: 45,
                            pathOptions: {
                                fillColor: color || '#0077ff',
                                fillOpacity: 0.8,
                                weight: 0
                            }
                        })
                    }
                ]
            }).addTo(mapa);
            
            // Guardar referencia al decorador
            rutasActivas.push(decorador);
        }
        
        // Guardar referencia a la ruta
        rutasActivas.push(polyline);
        
        // Ajustar vista para mostrar toda la ruta
        const bounds = polyline.getBounds();
        mapa.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 17
        });
        
        logger.info('Ruta mostrada exitosamente');
        return { exito: true };
    } catch (error) {
        logger.error('Error al mostrar ruta:', error);
        return { exito: false, error: error.message };
    }
}

/**
 * Limpia las rutas activas en el mapa
 */
function limpiarRutasActivas() {
    if (!mapa) return;
    
    // Limpiar rutas activas (creadas con manejarMostrarRuta)
    rutasActivas.forEach(ruta => {
        if (mapa.hasLayer(ruta)) {
            mapa.removeLayer(ruta);
        }
    });
    rutasActivas = [];
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
    cargarDatosParada
};
