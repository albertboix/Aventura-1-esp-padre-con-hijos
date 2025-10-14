/**
 * Módulo que maneja la visualización del mapa y la interacción con las paradas
 * Se comunica con el padre a través del sistema de mensajería
 */

// Importar mensajería y configuración
import mensajeria, { 
    inicializarMensajeria, 
    enviarMensaje, 
    enviarMensajeConConfirmacion,
    registrarControlador,
    enviarEventoAHijos,
    enviarMensajeConTimeout
    // Las siguientes funciones ahora se importan a través del objeto mensajeria
    // manejarError,
    // enviarMensajeEnCola,
    // manejarMensajeNoReconocido,
    // manejarErrorCritico,
    // manejarDiagnosticoYMonitoreo,
    // manejarSincronizacionEstadoGlobal,
    // validarMensajeEntrante
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
export const estadoMapa = {
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
 * Verifica y corrige problemas comunes con el contenedor del mapa.
 * @param {string} containerId - ID del contenedor del mapa.
 * @returns {HTMLElement|null} - El contenedor corregido o null si no se puede arreglar.
 */
export function verificarContenedorMapa(containerId = 'mapa') {
    let contenedor = document.getElementById(containerId);
    if (!contenedor) {
        console.warn(`Contenedor con ID "${containerId}" no encontrado. Creando uno nuevo.`);
        contenedor = document.createElement('div');
        contenedor.id = containerId;
        contenedor.style.cssText = 'width: 100%; height: 400px; position: relative;';
        document.body.appendChild(contenedor);
    }

    if (contenedor.offsetWidth === 0 || contenedor.offsetHeight === 0) {
        contenedor.style.width = '100%';
        contenedor.style.height = '400px';
        console.log('Dimensiones del contenedor corregidas.');
    }

    return contenedor;
}

/**
 * Inicializa el mapa y verifica el contenedor.
 * @param {Object} config - Configuración del mapa.
 * @returns {Promise<L.Map>} - Instancia del mapa.
 */
export async function inicializarMapa(config = {}) {
    logger.info('Inicializando mapa...');
    const containerId = config.containerId || 'mapa';

    // Verificar y corregir el contenedor del mapa
    const mapContainer = verificarContenedorMapa(containerId);
    if (!mapContainer) {
        throw new Error(`No se pudo verificar/reparar el contenedor #${containerId}`);
    }

    // Si ya existe una instancia del mapa, devolverla
    if (mapaInstance && !mapaInstance._destroyed) {
        logger.info('Usando instancia existente del mapa');
        return mapaInstance;
    }

    // Crear nueva instancia del mapa
    mapaInstance = L.map(containerId, {
        center: CONFIG.MAPA.CENTER,
        zoom: CONFIG.MAPA.ZOOM,
        minZoom: CONFIG.MAPA.MIN_ZOOM,
        maxZoom: CONFIG.MAPA.MAX_ZOOM,
        zoomControl: CONFIG.MAPA.ZOOM_CONTROL
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapaInstance);

    logger.info('Mapa inicializado correctamente');
    return mapaInstance;
}

/**
 * Espera a que un elemento sea visible en el DOM
 * @param {string} selector - Selector del elemento a esperar
 * @param {number} [timeout=5000] - Tiempo máximo de espera en ms
 * @returns {Promise<HTMLElement>} El elemento cuando esté visible
 */
async function esperarElementoVisible(selector, timeout = 5000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
        // First check if element already exists
        const checkNow = document.querySelector(selector);
        if (checkNow && checkNow.offsetParent !== null) {
            logger.info(`Elemento ${selector} ya está disponible en el DOM`);
            return resolve(checkNow);
        }
        
        logger.info(`Esperando elemento ${selector} (timeout: ${timeout}ms)...`);
        
        // Create a more robust checking mechanism
        const checkElement = () => {
            const element = document.querySelector(selector);
            const elapsed = Date.now() - startTime;
            
            // Element exists and is visible
            if (element && element.offsetParent !== null) {
                logger.info(`Elemento ${selector} encontrado después de ${elapsed}ms`);
                return resolve(element);
            }
            
            // Element exists but may not be visible yet - force visibility
            if (element && elapsed > timeout / 2) {
                logger.warn(`Elemento ${selector} existe pero podría no ser visible. Forzando visibilidad...`);
                element.style.display = 'block';
                element.style.visibility = 'visible';
                element.style.opacity = '1';
                element.style.height = element.style.height || '400px';
                element.style.width = element.style.width || '100%';
                
                // Give a short delay to apply styles then resolve
                setTimeout(() => resolve(element), 100);
                return;
            }
            
            // Timeout reached
            if (elapsed >= timeout) {
                // Last chance: if element exists at all, force it and resolve
                const lastChance = document.querySelector(selector);
                if (lastChance) {
                    logger.warn(`Tiempo agotado pero elemento ${selector} existe. Forzando visibilidad como último recurso.`);
                    lastChance.style.display = 'block';
                    lastChance.style.visibility = 'visible';
                    lastChance.style.opacity = '1';
                    lastChance.style.height = lastChance.style.height || '400px';
                    lastChance.style.width = lastChance.style.width || '100%';
                    return resolve(lastChance);
                }
                
                // Create element as last resort if it doesn't exist at all
                if (selector === '#mapa') {
                    logger.warn(`Creando elemento ${selector} ya que no existe después de ${elapsed}ms`);
                    const newMap = document.createElement('div');
                    newMap.id = 'mapa';
                    newMap.style.width = '100%';
                    newMap.style.height = '400px';
                    newMap.style.display = 'block';
                    document.body.insertBefore(newMap, document.body.firstChild);
                    return resolve(newMap);
                }
                
                return reject(new Error(`Tiempo de espera agotado para el selector: ${selector} (${elapsed}ms)`));
            }
            
            // Continue checking
            requestAnimationFrame(checkElement);
        };
        
        checkElement();
    });
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
 * Valida las coordenadas proporcionadas.
 * @param {Object} coordenadas - Coordenadas a validar.
 * @returns {boolean} - True si las coordenadas son válidas, lanza un error si no lo son.
 */
function validarCoordenadas(coordenadas) {
    if (!coordenadas || typeof coordenadas !== 'object') {
        throw new Error('Coordenadas no válidas: deben ser un objeto.');
    }

    const { lat, lng } = coordenadas;

    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        throw new Error('Coordenadas no válidas: latitud fuera de rango.');
    }

    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
        throw new Error('Coordenadas no válidas: longitud fuera de rango.');
    }

    return true;
}

/**
 * Actualiza el marcador de la posición actual del usuario en el mapa.
 * @param {Object} coordenadas - Coordenadas {lat, lng, accuracy}.
 */
function actualizarPuntoActual(coordenadas) {
    try {
        validarCoordenadas(coordenadas);

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
            throw new Error('Datos del tramo incompletos.');
        }

        validarCoordenadas(tramo.inicio);
        validarCoordenadas(tramo.fin);

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
 * @param {Object} mensaje - Mensaje con origen, destino, color, grosor o datos de tramo.
 * @returns {Object} Resultado de la operación
 */
function manejarMostrarRuta(mensaje) {
    try {
        // Validación de entrada
        if (!mensaje || !mensaje.datos) {
            throw new Error('Mensaje no válido para mostrar ruta');
        }

        const { tramo, origen, destino, color, grosor } = mensaje.datos || {};
        
        // Caso 1: Si tenemos datos de tramo
        if (tramo && tramo.inicio && tramo.fin) {
            if (!mapa) {
                throw new Error('Mapa no inicializado');
            }
            
            // Dibujar polyline del tramo
            const polyline = dibujarTramo(tramo, true);
            if (polyline) {
                logger.info('Polyline dibujada en el mapa:', tramo);
                rutasActivas.push(polyline);
            } else {
                throw new Error('Error al dibujar la polyline en el mapa');
            }
            
            // Agregar marcadores si es necesario
            if (tramo.inicio) {
                L.marker([tramo.inicio.lat, tramo.inicio.lng], { 
                    icon: L.icon({ iconUrl: 'red-pin.png' }) 
                }).addTo(mapa);
            }
            
            if (tramo.fin) {
                L.marker([tramo.fin.lat, tramo.fin.lng], { 
                    icon: L.icon({ iconUrl: 'flag.png' }) 
                }).addTo(mapa);
            }
            
            return { 
                exito: true, 
                mensaje: 'Ruta de tramo mostrada correctamente',
                tipo: 'tramo'
            };
        }
        
        // Caso 2: Si tenemos origen y destino como coordenadas
        if (origen && destino) {
            // Validar que origen y destino son coordenadas válidas
            if (!origen.lat || !origen.lng || !destino.lat || !destino.lng) {
                throw new Error('Coordenadas de origen o destino incompletas');
            }

            const polyline = L.polyline([origen, destino], {
                color: color || '#0077ff',
                weight: grosor || 6,
                opacity: 0.8
            }).addTo(mapa);

            rutasActivas.push(polyline);
            logger.info('Ruta origen-destino mostrada en el mapa');
            
            return { 
                exito: true, 
                mensaje: 'Ruta origen-destino mostrada correctamente',
                tipo: 'origen-destino'
            };
        } 
        
        // Caso 3: No hay datos suficientes
        throw new Error('Datos insuficientes para mostrar ruta: se requiere tramo completo o par origen-destino');
        
    } catch (error) {
        // Manejo de errores simplificado - la función manejarError ya no está disponible
        logger.error(`[Mapa] Error al mostrar ruta: ${error.message}`, { 
            tipo: TIPOS_MENSAJE.NAVEGACION.MOSTRAR_RUTA,
            origen: mensaje.origen,
            detalles: error.stack
        });
        return { exito: false, error: error.message };
    }
}

/**
 * Establece un destino en el mapa.
 * @param {Object} mensaje - Mensaje con datos de destino.
 * @returns {Object} Resultado de la operación.
 */
function manejarEstablecerDestino(mensaje) {
    try {
        // Validación de entrada
        if (!mensaje || !mensaje.datos) {
            throw new Error('Mensaje no válido para establecer destino');
        }

        const { destino, opciones } = mensaje.datos || {};
        
        // Validar que destino tiene coordenadas válidas
        if (!destino || !destino.lat || !destino.lng) {
            throw new Error('Destino inválido o sin coordenadas');
        }
        
        // Validar que el mapa esté inicializado
        if (!mapa) {
            throw new Error('Mapa no inicializado');
        }
        
        // Eliminar marcador anterior si existe
        if (marcadorDestino) {
            mapa.removeLayer(marcadorDestino);
        }
        
        // Crear nuevo marcador
        marcadorDestino = L.marker([destino.lat, destino.lng], {
            icon: L.icon({
                iconUrl: opciones?.iconUrl || 'destino-pin.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            }),
            title: opciones?.titulo || 'Destino'
        }).addTo(mapa);
        
        // Si se solicita centrar el mapa en el destino
        if (opciones?.centrar) {
            mapa.setView([destino.lat, destino.lng], opciones.zoom || mapa.getZoom());
        }
        
        logger.info(`Destino establecido en [${destino.lat}, ${destino.lng}]`);
        return { 
            exito: true, 
            mensaje: 'Destino establecido correctamente'
        };
    } catch (error) {
        logger.error('Error al manejar establecer destino:', error);
        return { 
            exito: false,
            error: error.message 
        };
    }
}

/**
 * Actualiza la posición del usuario en el mapa.
 * @param {Object} mensaje - Mensaje con datos de posición.
 * @returns {Object} Resultado de la operación.
 */
function manejarActualizarPosicion(mensaje) {
    try {
        // Validación de entrada
        if (!mensaje || !mensaje.datos) {
            throw new Error('Mensaje no válido para actualizar posición');
        }

        const { posicion } = mensaje.datos || {};
        
        // Validar que posición tiene coordenadas válidas
        if (!posicion || !posicion.lat || !posicion.lng) {
            throw new Error('Posición inválida o sin coordenadas');
        }
        
        // Validar que el mapa esté inicializado
        if (!mapa) {
            throw new Error('Mapa no inicializado');
        }
        
        // Actualizar el punto del usuario
        actualizarPuntoActual({
            lat: posicion.lat,
            lng: posicion.lng,
            accuracy: posicion.accuracy || 10
        });
        
        // Actualizar estado interno
        estadoMapa.posicionUsuario = {
            lat: posicion.lat,
            lng: posicion.lng,
            accuracy: posicion.accuracy || 10,
            timestamp: Date.now()
        };
        
        // Si se solicita seguir al usuario, centrar el mapa
        if (estadoMapa.siguiendoRuta && mensaje.datos.centrar !== false) {
            mapa.setView([posicion.lat, posicion.lng], mapa.getZoom());
        }
        
        logger.info(`Posición de usuario actualizada a [${posicion.lat}, ${posicion.lng}]`);
        return {
            exito: true,
            mensaje: 'Posición actualizada correctamente'
        };
    } catch (error) {
        // Manejo de errores simplificado
        logger.error(`[Mapa] Error al actualizar posición: ${error.message}`, { 
            tipo: TIPOS_MENSAJE.NAVEGACION.ACTUALIZAR_POSICION,
            origen: mensaje.origen,
            detalles: error.stack
        });
        return {
            exito: false,
            error: error.message
        };
    }
}

/**
 * Actualiza el modo del mapa (casa o aventura).
 * @param {Object} mensaje - Mensaje con datos del modo.
 * @returns {Object} Resultado de la operación.
 */
function manejarCambioModoMapa(mensaje) {
    try {
        // Validación de entrada
        if (!mensaje || !mensaje.datos) {
            throw new Error('Mensaje no válido para cambio de modo');
        }

        const { modo } = mensaje.datos || {};
        
        // Validar que el modo es válido
        if (!modo || (modo !== 'casa' && modo !== 'aventura')) {
            throw new Error(`Modo no válido: ${modo}`);
        }
        
        // No hacer nada si ya estamos en ese modo
        if (estadoMapa.modo === modo) {
            logger.info(`El mapa ya está en modo ${modo}`);
            return {
                exito: true,
                mensaje: `El mapa ya está en modo ${modo}`,
                cambiado: false
            };
        }
        
        // Actualizar el modo del mapa
        actualizarModoMapa(modo);
        
        // Actualizar estado interno
        const modoAnterior = estadoMapa.modo;
        estadoMapa.modo = modo;
        
        logger.info(`Modo del mapa cambiado de ${modoAnterior} a ${modo}`);
        return {
            exito: true,
            mensaje: `Modo cambiado a ${modo}`,
            modoAnterior,
            cambiado: true
        };
    } catch (error) {
        logger.error('Error al manejar cambio de modo del mapa:', error);
        return {
            exito: false,
            error: error.message
        };
    }
}

/**
 * Maneja el mensaje para mostrar una parada o tramo.
 * @param {Object} mensaje - Mensaje con datos del tramo o parada.
 * @returns {Object} Resultado de la operación.
 */

/**
 * Solicita datos de paradas al padre.
 * @returns {Promise<Array>} Array de paradas recibidas.
 */
export async function solicitarDatosParadas() {
    try {
        const respuesta = await enviarMensajeConTimeout(
            'padre',
            TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS,
            { timestamp: new Date().toISOString() },
            5000 // Timeout de 5 segundos
        );
        return respuesta.paradas || [];
    } catch (error) {
        logger.error('Error al solicitar datos de paradas:', error);
        return [];
    }
}

/**
 * Registra los manejadores de mensajes para el mapa.
 */
function registrarManejadoresMensajes() {
    try {
        // Validar que la función registrarControlador está disponible
        if (typeof registrarControlador !== 'function') {
            throw new Error('La función registrarControlador no está disponible');
        }
        
        // Registrar manejadores de mensajes con manejo de errores
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.ESTABLECER_DESTINO, manejarEstablecerDestino);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.ACTUALIZAR_POSICION, manejarActualizarPosicion);
        registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, manejarCambioModoMapa);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.MOSTRAR_RUTA, manejarMostrarRuta);
        
        // Manejador de solicitud de paradas
        registrarControlador(TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS, async () => {
            try {
                return {
                    exito: true,
                    paradas: arrayParadasLocal,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                logger.error('Error al manejar solicitud de paradas:', error);
                return {
                    exito: false,
                    error: error.message
                };
            }
        });
        
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA, manejarCambioParadaTramo);
        logger.debug('Manejadores de mensajes del mapa registrados correctamente');
    } catch (error) {
        logger.error('Error al registrar manejadores de mensajes:', error);
        throw error; // Propagar el error para que se pueda manejar en la inicialización
    }
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
            marcador.setLatLng([coordenadas.lat, coordenidas.lng]); // Corregido 'coordenidas' a 'coordenadas'
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

/**
 * Obtiene el nombre de una parada por su ID
 * @param {string} paradaId - ID de la parada
 * @returns {string} Nombre de la parada o un valor por defecto si no se encuentra
 */
function obtenerNombreParada(paradaId) {
    if (!paradaId) {
        logger.warn('No se proporcionó un ID de parada');
        return 'Parada desconocida';
    }
    
    const parada = arrayParadasLocal.find(p => p.id === paradaId || p.parada_id === paradaId);
    
    if (!parada) {
        logger.warn(`No se encontró la parada con ID: ${paradaId}`);
        return `Parada ${paradaId}`; // Valor por defecto si no se encuentra
    }
    
    // Devolver el nombre de la parada o un valor por defecto si no tiene
    return parada.nombre || `Parada ${paradaId}`;
}

/**
 * Establece los datos de las paradas y actualiza la visualización
 * @param {Array} paradas - Array de objetos de paradas
 * @param {Object} [opciones] - Opciones adicionales
 * @param {boolean} [opciones.actualizarMapa=true] - Si se debe actualizar el mapa
 * @returns {boolean} True si se establecieron los datos correctamente
 */
function establecerDatosParadas(paradas, opciones = {}) {
    try {
        if (!Array.isArray(paradas)) {
            throw new Error('El parámetro paradas debe ser un array');
        }

        // Filtrar paradas inválidas
        const paradasValidas = paradas.filter(parada => {
            return parada && 
                   (parada.id || parada.parada_id) && 
                   parada.coordenadas && 
                   !isNaN(parada.coordenadas.lat) && 
                   !isNaN(parada.coordenadas.lng);
        });

        // Actualizar el array local
        arrayParadasLocal = paradasValidas;
        
        // Notificar al remitente que las paradas se recibieron correctamente
        if (opciones.origen) {
            enviarMensaje(opciones.origen, TIPOS_MENSAJE.DATOS.PARADAS_ACTUALIZADAS, {
                total: paradas.length,
                recibidas: paradasValidas.length,
                omitidas: paradas.length - paradasValidas.length,
                timestamp: new Date().toISOString()
            }).catch(error => {
                logger.error('Error al enviar confirmación de recepción:', error);
            });
        }
        
        // Actualizar el mapa si está configurado para hacerlo
        if (opciones.actualizarMapa !== false && mapa) {
            mostrarTodasLasParadas();
        }
        
        logger.info(`Datos de ${paradasValidas.length} paradas establecidos correctamente`);
        return true;
        
    } catch (error) {
        logger.error('Error al establecer las paradas:', error);
        
        // Notificar el error al remitente si es posible
        if (opciones.origen) {
            enviarMensaje(opciones.origen, TIPOS_MENSAJE.DATOS.ERROR_ACTUALIZACION_PARADAS, {
                error: 'Error al procesar las paradas',
                detalle: error.message,
                timestamp: new Date().toISOString()
            }).catch(err => {
                logger.error('Error al notificar error de procesamiento:', err);
            });
        }
        
        return false;
    }
}

/**
 * Carga los datos de una parada por su ID
 * @param {string|number} paradaId - ID de la parada a cargar
 * @param {Object} [opciones] - Opciones adicionales
 * @param {boolean} [opciones.forzarActualizacion=false] - Si es true, fuerza la actualización desde el servidor
 * @returns {Promise<Object>} Objeto con los datos de la parada
 * @throws {Error} Si no se puede cargar la parada
 */
async function cargarDatosParada(paradaId, opciones = {}) {
    const { forzarActualizacion = false } = opciones;
    
    // Validación de entrada
    if (paradaId === undefined || paradaId === null || paradaId === '') {
        const error = new Error('ID de parada no válido');
        error.code = 'INVALID_INPUT';
        throw error;
    }
    
    // Convertir a string para comparaciones consistentes
    const idParada = String(paradaId).trim();
    
    try {
        logger.info(`[cargarDatosParada] Solicitando datos para parada: ${idParada}`);
        
        // Buscar en caché local si no se fuerza actualización
        if (!forzarActualizacion) {
            const paradaLocal = arrayParadasLocal.find(p => 
                String(p.id) === idParada || String(p.parada_id) === idParada
            );
            
            if (paradaLocal) {
                logger.debug(`[cargarDatosParada] Parada encontrada en caché: ${idParada}`);
                return { ...paradaLocal, _fuente: 'cache' };
            }
        }
        
        // Si no está en caché o se fuerza actualización, pedir al servidor
        logger.debug(`[cargarDatosParada] Solicitando datos al servidor para parada: ${idParada}`);
        
        const respuesta = await enviarMensaje(
            'servidor', 
            TIPOS_MENSAJE.DATOS.SOLICITAR_PARADA, 
            {
                paradaId: idParada,
                timestamp: new Date().toISOString(),
                solicitudId: `parada_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            { 
                reintentos: 3,
                timeout: 10000 // 10 segundos de timeout
            }
        );
        
        if (!respuesta || !respuesta.datos) {
            throw new Error(`Respuesta inválida del servidor para la parada: ${idParada}`);
        }
        
        // Validar estructura de datos recibida
        if (typeof respuesta.datos !== 'object' || !respuesta.datos.id) {
            throw new Error(`Datos de parada inválidos recibidos: ${JSON.stringify(respuesta.datos)}`);
        }
        
        // Actualizar caché local
        const indiceExistente = arrayParadasLocal.findIndex(p => 
            String(p.id) === String(respuesta.datos.id) || 
            String(p.parada_id) === String(respuesta.datos.id)
        );
        
        if (indiceExistente >= 0) {
            arrayParadasLocal[indiceExistente] = { ...respuesta.datos };
        } else {
            arrayParadasLocal.push({ ...respuesta.datos });
        }
        
        logger.info(`[cargarDatosParada] Datos de parada ${idParada} cargados correctamente`);
        return { ...respuesta.datos, _fuente: 'servidor' };
        
    } catch (error) {
        const mensajeError = `Error al cargar datos de la parada ${idParada}: ${error.message}`;
        logger.error(mensajeError, { error });
        
        // Mejorar el objeto de error
        error.paradaId = idParada;
        error.timestamp = new Date().toISOString();
        
        // Intentar devolver datos de caché en caso de error si no se forzó actualización
        if (!forzarActualizacion) {
            const paradaLocal = arrayParadasLocal.find(p => 
                String(p.id) === idParada || String(p.parada_id) === idParada
            );
            
            if (paradaLocal) {
                logger.warn(`[cargarDatosParada] Usando datos en caché debido a error: ${idParada}`);
                return { ...paradaLocal, _fuente: 'cache_fallback' };
            }
        }
        
        throw error;
    }
}

/**
 * Busca las coordenadas de un tramo por su ID
 * @param {string} tramoId - ID del tramo a buscar
 * @returns {Object|null} Objeto con inicio, fin y waypoints, o null si no se encuentra
 */
function buscarCoordenadasTramo(tramoId) {
    if (!tramoId) {
        logger.warn('No se proporcionó un ID de tramo');
        return null;
    }
    
    // Buscar en el array de paradas locales (que también puede contener tramos)
    const tramo = arrayParadasLocal.find(t => t.id === tramoId || t.tramo_id === tramoId);
    
    if (!tramo) {
        logger.warn(`No se encontró el tramo con ID: ${tramoId}`);
        return null;
    }
    
    // Devolver la estructura esperada para un tramo
    return {
        inicio: tramo.inicio || tramo.coordenadas, // Usar coordenadas como inicio si no hay inicio específico
        fin: tramo.fin || tramo.coordenadas,       // Usar coordenadas como fin si no hay fin específico
        waypoints: tramo.waypoints || [],          // Waypoints opcionales
        nombre: tramo.nombre                        // Nombre opcional del tramo
    };
}

/**
 * Maneja el cambio de parada o tramo en el mapa.
 * @param {Object} mensaje - Mensaje con datos del tramo o parada.
 * @returns {Object} Resultado de la operación.
 */
export async function manejarCambioParadaTramo(mensaje) {
    try {
        if (!mensaje || !mensaje.datos) {
            throw new Error('Mensaje no válido para cambio de parada/tramo');
        }

        const { punto } = mensaje.datos || {};
        if (!punto || (!punto.tramo_id && !punto.parada_id)) {
            throw new Error('Datos incompletos: se requiere tramo_id o parada_id');
        }

        if (!mapa) {
            throw new Error('Mapa no inicializado');
        }

        if (punto.tramo_id) {
            const tramo = buscarCoordenadasTramo(punto.tramo_id);
            if (!tramo) {
                throw new Error(`No se encontraron datos para el tramo con ID: ${punto.tramo_id}`);
            }

            const polyline = dibujarTramo(tramo, true);
            if (!polyline) {
                throw new Error(`Error al dibujar polyline para tramo: ${punto.tramo_id}`);
            }

            logger.info(`Polyline dibujada para tramo: ${punto.tramo_id}`);
            estadoMapa.tramoActual = punto.tramo_id;

            return { exito: true, mensaje: `Tramo ${punto.tramo_id} mostrado correctamente`, tipo: 'tramo' };
        } else if (punto.parada_id) {
            const parada = buscarCoordenadasParada(punto.parada_id);
            if (!parada) {
                throw new Error(`No se encontraron datos para la parada con ID: ${punto.parada_id}`);
            }

            L.marker([parada.lat, parada.lng], { icon: L.icon({ iconUrl: 'highlight-pin.png' }) }).addTo(mapa);
            estadoMapa.paradaActual = punto.parada_id;

            return { exito: true, mensaje: `Parada ${punto.parada_id} mostrada correctamente`, tipo: 'parada' };
        }
    } catch (error) {
        logger.error('Error al manejar cambio de parada/tramo:', error);
        return { exito: false, error: error.message };
    }
}

/**
 * Habilita un botón para mostrar contenido relacionado.
 * @param {string} tipo - Tipo de contenido ('imagen' o 'video').
 * @param {string} id - ID único del tramo o parada.
 */
function habilitarBoton(tipo, id) {
    const boton = document.getElementById(`boton-${tipo}`);
    if (boton) {
        boton.disabled = false;
        boton.onclick = async () => {
            await enviarMensajeConConfirmacion('hijo2', TIPOS_MENSAJE.MEDIOS.MOSTRAR, { tipo, id });
        };
        logger.info(`Botón ${tipo} habilitado para ID: ${id}`);
    }
}

// Manejar mensajes de diagnóstico y monitoreo en el módulo del mapa
registrarControlador('*', (mensaje) => {
    try {
        // Validación simplificada
        if (!mensaje || typeof mensaje !== 'object' || !mensaje.tipo) {
            logger.warn('[Mapa] Mensaje recibido con formato inválido');
            return;
        }
        
        const { tipo, mensajeId, origen } = mensaje;

        if (tipo.startsWith('SISTEMA.')) {
            // Manejo simplificado de mensajes del sistema
            logger.debug(`[Mapa] Mensaje de sistema recibido: ${tipo}`);
        } else {
            // Manejo simplificado de mensajes no reconocidos
            logger.debug(`[Mapa] Mensaje no reconocido: ${tipo} desde ${origen || 'origen desconocido'}`);
        }
    } catch (error) {
        logger.error('Error al manejar mensaje en el módulo del mapa:', error);
    }
});

// Manejar errores críticos en el módulo del mapa
registrarControlador(TIPOS_MENSAJE.SISTEMA.ERROR, (mensaje) => {
    try {
        const { mensajeId, origen, mensaje: errorMensaje, stack } = mensaje;
        const error = new Error(errorMensaje);
        error.stack = stack;

        // Manejo de errores críticos simplificado
        logger.error(`[Mapa] Error crítico recibido desde ${origen}: ${errorMensaje}`, {
            mensajeId,
            stack,
            origen
        });
    } catch (error) {
        logger.error('Error al manejar mensaje de error crítico en el módulo del mapa:', error);
    }
});

// Eliminar lógica duplicada para validar mensajes
// Esto ya está centralizado en mensajeria.js

// Eliminar lógica duplicada para manejar errores críticos
// Esto ya está centralizado en mensajeria.js

// Eliminar lógica duplicada para manejar cambio de modo
// Esto ya está centralizado en app.js

// Registrar manejadores centralizados
registrarControlador(TIPOS_MENSAJE.SISTEMA.ESTADO, manejarSincronizacionEstadoGlobal);
