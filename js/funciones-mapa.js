import { 
  inicializarMensajeria,
  enviarMensaje, 
  registrarControlador,
  TIPOS_MENSAJE 
} from './mensajeria.js';
import { logger, configurarUtils, crearObjetoError } from '../js/utils.js';
configurarUtils({ iframeId: 'hijo-mapa', debug: true });

// Estado del módulo
let mapa = null;
const marcadoresParadas = new Map();
let paradasCargadas = new Map();
let manejadorActualizacionParada = null;
let estaInicializado = false;

// Estado del array de paradas
let arrayParadasLocal = null;
let hashArrayParadas = null;
let ultimaSincronizacion = null;
let intentosSincronizacion = 0;
const MAX_INTENTOS_SINCRONIZACION = 5;

/**
 * Inicializa el sistema de mapa with las paradas y coordenadas
 * @param {Object} opciones - Opciones de inicialización
 */
function inicializarMapa(opciones = {}) {
    logger.info('[MAPA] Inicializando mapa...');
    
    // Comprobar si tenemos el array de paradas
    let arrayParadas;
    
    if (opciones.arrayParadas) {
        // Usar array proporcionado en las opciones
        arrayParadas = opciones.arrayParadas;
        procesarArrayParadas(arrayParadas);
    } else if (window.AVENTURA_PARADAS) {
        // Usar array global si está disponible
        arrayParadas = window.AVENTURA_PARADAS;
        procesarArrayParadas(arrayParadas);
    } else {
        logger.info('[MAPA] No se encontró array de paradas, solicitando al padre...');
        
        // Verificar si la mensajería está disponible
        if (enviarMensaje) {
            enviarMensaje('padre', TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS, {
                timestamp: Date.now()
            }).then(respuesta => {
                if (respuesta && respuesta.exito && respuesta.paradas) {
                    logger.info('[MAPA] Array de paradas recibido del padre');
                    procesarArrayParadas(respuesta.paradas);
                } else {
                    logger.error('[MAPA] Respuesta inválida del padre al solicitar paradas:', respuesta);
                    crearObjetoError('solicitud_paradas_fallida', new Error('No se recibieron paradas válidas del padre.'), { respuesta });
                }
            }).catch(error => {
                logger.error('[MAPA] Error al solicitar array de paradas:', error);
                crearObjetoError('solicitud_paradas_error', error);
            });
            
            // Salir de la función - la inicialización continuará cuando recibamos respuesta
            return;
        } else {
            logger.error('[MAPA] No hay array de paradas disponible ni sistema de mensajería');
            return;
        }
    }
}

/**
 * Procesa el array de paradas recibido para inicializar el mapa
 * @param {Array} arrayParadas - Array con las paradas y tramos
 */
function procesarArrayParadas(arrayParadas) {
    if (!arrayParadas || !Array.isArray(arrayParadas) || arrayParadas.length === 0) {
        logger.error('[MAPA] Array de paradas inválido o vacío');
        return;
    }
    
    logger.info(`[MAPA] Procesando array con ${arrayParadas.length} paradas/tramos`);
    
    // Guardar referencia local y calcular hash
    arrayParadasLocal = arrayParadas;
    hashArrayParadas = calcularHashArray(arrayParadasLocal);
    ultimaSincronizacion = Date.now();
    
    // Preparar marcadores para paradas
    const marcadores = prepararMarcadoresParadas(arrayParadas);
    
    // Preparar rutas para tramos
    const rutas = prepararRutasTramos(arrayParadas);
    
    // Inicializar el mapa con los elementos
    crearMapaConElementos({
        marcadores,
        rutas,
        arrayParadas: arrayParadas // Pasar el array completo
    });
    
    // Registrar manejadores de mensajes para eventos de navegación
    registrarManejadoresMensajes();
    
    logger.info('[MAPA] Inicialización completada con array de paradas');
    
    // Notificar que el mapa está listo
    if (typeof enviarMensaje === 'function') {
        enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.COMPONENTE_LISTO, {
            componente: 'mapa',
            timestamp: Date.now(),
            elementosCargados: {
                paradas: marcadores.length,
                tramos: rutas.length,
                totalElementos: arrayParadas.length
            }
        }).catch(error => logger.error('[MAPA] Error al notificar inicialización:', error));
    }
}

/**
 * Intenta obtener el array de paradas del padre usando diversos métodos
 * @returns {Promise<Array>} - Promise con el array de paradas
 */
async function solicitarArrayParadasAlPadre() {
    intentosSincronizacion++;
    
    logger.info(`[MAPA] Solicitando array de paradas (intento ${intentosSincronizacion}/${MAX_INTENTOS_SINCRONIZACION})...`);
    
    try {
        // Método 1: Usar la utilidad ArrayParadasHelpers si está disponible
        if (typeof ArrayParadasHelpers !== 'undefined' && 
            typeof ArrayParadasHelpers.solicitarArrayParadas === 'function') {
            const arrayParadas = await ArrayParadasHelpers.solicitarArrayParadas();
            if (arrayParadas && Array.isArray(arrayParadas) && arrayParadas.length > 0) {
                return arrayParadas;
            }
        }
        
        // Método 2: Usar enviarMensaje directamente
        const respuesta = await enviarMensaje('padre', TIPOS_MENSAJE.DATOS.SOLICITAR_ARRAY_PARADAS, {
            timestamp: Date.now()
        });
        
        if (respuesta && respuesta.exito && respuesta.datos && respuesta.datos.AVENTURA_PARADAS) {
            return respuesta.datos.AVENTURA_PARADAS;
        }
        
        throw new Error('No se recibió un array de paradas válido');
        
    } catch (error) {
        logger.error('[MAPA] Error al solicitar array de paradas:', error);
        
        // Si no se ha superado el máximo de intentos, intentar de nuevo con retraso exponencial
        if (intentosSincronizacion < MAX_INTENTOS_SINCRONIZACION) {
            const tiempoEspera = Math.pow(2, intentosSincronizacion) * 1000;
            logger.info(`[MAPA] Reintentando en ${tiempoEspera}ms...`);
            await new Promise(resolve => setTimeout(resolve, tiempoEspera));
            return solicitarArrayParadasAlPadre();
        }
        
        throw error;
    }
}

/**
 * Intenta obtener el array de paradas a través de métodos alternativos
 * cuando el sistema de mensajería falla
 */
function intentarObtenerParadasEmergencia() {
    logger.error('[MAPA] No se pudo obtener el array de paradas a través de la mensajería. El mapa no puede continuar la inicialización.');
    crearObjetoError('obtencion_paradas_critico', new Error('Fallo total al obtener el array de paradas.'), {});
    // Ya no se intenta acceder a window.parent ni usar postMessage directamente.
}

/**
 * Genera un array mínimo de paradas para casos de emergencia
 * @returns {Array} - Array básico con algunas paradas esenciales
 */
function generarArrayParadasEmergencia() {
    // Implementar un array mínimo con las paradas más importantes
    return [
        { 
            padreid: "padre-P-0", 
            tipo: "inicio", 
            parada_id: 'P-0', 
            audio_id: "audio-P-0", 
            reto_id: "R-2",
            coordenadas: { lat: 39.47876, lng: -0.37626 } 
        },
        // Añadir algunas paradas más esenciales aquí
        { 
            padreid: "padre-P-36", 
            tipo: "parada", 
            parada_id: 'P-36', 
            audio_id: "audio-P-36",
            coordenadas: { lat: 39.47773, lng: -0.37671 }
        }
    ];
}

/**
 * Calcula un hash simple para verificar la integridad del array
 * @param {Array} array - Array para calcular el hash
 * @returns {string} - Hash del array
 */
function calcularHashArray(array) {
    try {
        const str = JSON.stringify(array);
        // Hash simple basado en la longitud y primeros/últimos elementos
        return `${array.length}_${str.length}_${str.charCodeAt(0)}_${str.charCodeAt(str.length-1)}`;
    } catch (e) {
        logger.warn("[MAPA] Error al calcular hash de array:", e);
        return `${array.length}_unknownhash`;
    }
}

/**
 * Verifica periódicamente si hay actualizaciones en el array de paradas
 */
function programarVerificacionActualizaciones() {
    // Verificar cada 5 minutos si hay cambios en el array de paradas
    setInterval(async () => {
        if (!hashArrayParadas || !arrayParadasLocal) return;
        
        try {
            // Solicitar hash actual al padre
            const respuesta = await enviarMensaje('padre', TIPOS_MENSAJE.DATOS.VERIFICAR_HASH_ARRAY, {
                hashLocal: hashArrayParadas,
                timestamp: Date.now()
            });
            
            if (respuesta && respuesta.datos && !respuesta.datos.coincide) {
                logger.info('[MAPA] Detectada actualización en array de paradas. Solicitando nuevos datos...');
                const arrayActualizado = await solicitarArrayParadasAlPadre();
                if (arrayActualizado) {
                    actualizarElementosMapa(arrayActualizado);
                }
            }
        } catch (error) {
            logger.error('[MAPA] Error al verificar actualizaciones de array:', error);
        }
    }, 300000); // 5 minutos
}

/**
 * Actualiza los elementos del mapa con un nuevo array de paradas
 * @param {Array} nuevoArray - El nuevo array de paradas
 */
function actualizarElementosMapa(nuevoArray) {
    if (!nuevoArray || !Array.isArray(nuevoArray) || nuevoArray.length === 0) {
        logger.error('[MAPA] Array de actualización inválido o vacío');
        return;
    }
    
    // Actualizar referencia local y hash
    arrayParadasLocal = nuevoArray;
    hashArrayParadas = calcularHashArray(arrayParadasLocal);
    ultimaSincronizacion = Date.now();
    
    logger.info(`[MAPA] Actualizando elementos con nuevo array (${nuevoArray.length} elementos)`);
    
    // Implementar lógica para actualizar marcadores y rutas sin reiniciar todo el mapa
    // Esta es una implementación simplificada - en producción probablemente querrás
    // realizar una actualización más inteligente que solo modifique lo que cambió
    
    // Eliminar marcadores antiguos
    marcadoresParadas.forEach(marcador => {
        if (mapa && marcador) {
            mapa.removeLayer(marcador);
        }
    });
    marcadoresParadas.clear();
    
    // Añadir nuevos marcadores
    const marcadores = prepararMarcadoresParadas(nuevoArray);
    marcadores.forEach(marcadorInfo => {
        // Lógica para añadir el marcador al mapa
        const marcador = L.marker([marcadorInfo.lat, marcadorInfo.lng], {
            title: marcadorInfo.titulo
        }).addTo(mapa);
        
        marcadoresParadas.set(marcadorInfo.id, marcador);
    });
    
    logger.info('[MAPA] Elementos del mapa actualizados exitosamente');
    
    // Notificar actualización completada
    if (typeof enviarMensaje === 'function') {
        enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ACTUALIZACION_COMPLETADA, {
            componente: 'mapa',
            tipoActualizacion: 'array_paradas',
            elementosActualizados: nuevoArray.length,
            timestamp: Date.now()
        }).catch(e => logger.error('[MAPA] Error al notificar actualización:', e));
    }
}

/**
 * Prepara los marcadores para las paradas
 * @param {Array} arrayParadas - Array de paradas
 * @returns {Array} - Array de marcadores
 */
function prepararMarcadoresParadas(arrayParadas) {
    const marcadores = [];
    
    // Filtrar solo paradas (no tramos)
    const paradas = arrayParadas.filter(item => 
        item.tipo === "parada" || item.tipo === "inicio");
    
    paradas.forEach(parada => {
        // Buscar coordenadas asociadas a esta parada
        const coordenadas = buscarCoordenadasParada(parada.parada_id);
        
        if (coordenadas && coordenadas.lat && coordenadas.lng) {
            marcadores.push({
                id: parada.parada_id,
                lat: coordenadas.lat,
                lng: coordenadas.lng,
                titulo: obtenerNombreParada(parada),
                icono: parada.tipo === "inicio" ? 'inicio' : 'parada',
                datos: {
                    audio_id: parada.audio_id,
                    reto_id: parada.reto_id,
                    retos: parada.retos,
                    tipo: parada.tipo
                }
            });
        }
    });
    
    logger.info(`[MAPA] Preparados ${marcadores.length} marcadores de paradas`);
    return marcadores;
}

/**
 * Busca las coordenadas de una parada por su ID
 * @param {string} paradaId - ID de la parada
 * @returns {Object|null} - Coordenadas {lat, lng} o null
 */
function buscarCoordenadasParada(paradaId) {
    // Esta función debería implementarse según la estructura de datos de coordenadas
    // Por ahora, devolvemos null como placeholder
    logger.debug(`[MAPA] Buscando coordenadas para parada ${paradaId}`);
    return null;
}

/**
 * Obtiene el nombre de una parada
 * @param {Object} parada - Objeto de parada
 * @returns {string} - Nombre de la parada
 */
function obtenerNombreParada(parada) {
    // Esta función debería implementarse según la estructura de datos de paradas
    return parada.nombre || `Parada ${parada.parada_id}`;
}

/**
 * Prepara las rutas para los tramos
 * @param {Array} arrayParadas - Array de paradas
 * @returns {Array} - Array de rutas
 */
function prepararRutasTramos(arrayParadas) {
    const rutas = [];
    
    // Filtrar solo tramos
    const tramos = arrayParadas.filter(item => item.tipo === "tramo");
    
    tramos.forEach(tramo => {
        // Buscar coordenadas asociadas a este tramo
        const coordenadas = buscarCoordenadasTramo(tramo.tramo_id);
        
        if (coordenadas && coordenadas.puntos && coordenadas.puntos.length > 1) {
            rutas.push({
                id: tramo.tramo_id,
                puntos: coordenadas.puntos,
                color: '#3388ff',
                grosor: 3,
                datos: {
                    audio_id: tramo.audio_id,
                    tipo: tramo.tipo
                }
            });
        }
    });
    
    logger.info(`[MAPA] Preparadas ${rutas.length} rutas de tramos`);
    return rutas;
}

/**
 * Busca las coordenadas de un tramo por su ID
 * @param {string} tramoId - ID del tramo
 * @returns {Object|null} - Objeto con puntos de la ruta o null
 */
function buscarCoordenadasTramo(tramoId) {
    // Esta función debería implementarse según la estructura de datos de coordenadas
    // Por ahora, devolvemos null como placeholder
    logger.debug(`[MAPA] Buscando coordenadas para tramo ${tramoId}`);
    return null;
}

/**
 * Crea el mapa y añade los elementos
 * @param {Object} opciones - Opciones para crear el mapa
 * @returns {L.Map} Instancia del mapa de Leaflet
 */
function crearMapaConElementos(opciones = {}) {
    logger.info('[MAPA] Creando mapa con opciones:', opciones);
    
    // Obtener el contenedor o crearlo si no existe
    let mapContainer = document.getElementById(opciones.containerId || 'mapa');
    
    if (!mapContainer) {
        logger.warn(`[MAPA] No se encontró el contenedor con ID '${opciones.containerId}', creando uno nuevo`);
        mapContainer = document.createElement('div');
        mapContainer.id = opciones.containerId || 'mapa';
        mapContainer.style.width = '100%';
        mapContainer.style.height = '100%';
        document.body.appendChild(mapContainer);
    }
    
    // Configuración por defecto
    const defaultOptions = {
        center: [39.4699, -0.3763], // Valencia
        zoom: 14,
        minZoom: 12,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: true
    };
    
    // Combinar opciones
    const mapOptions = { ...defaultOptions, ...opciones };
    
    try {
        // Crear el mapa
        const map = L.map(mapContainer, {
            center: mapOptions.center,
            zoom: mapOptions.zoom,
            minZoom: mapOptions.minZoom,
            maxZoom: mapOptions.maxZoom,
            zoomControl: mapOptions.zoomControl,
            attributionControl: mapOptions.attributionControl
        });
        
        // Añadir capa base de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: mapOptions.maxZoom
        }).addTo(map);
        
        logger.info('[MAPA] Mapa creado exitosamente');
        return map;
        
    } catch (error) {
        logger.error('[MAPA] Error al crear el mapa:', error);
        throw error;
    }
}

/**
 * Registra manejadores de mensajes para eventos de navegación
 */
function registrarManejadoresMensajes() {
    try {
        // Registrar manejador para cambio de parada
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA, manejarCambioParada);
        
        // Registrar manejador para llegada a parada
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.LLEGADA_DETECTADA, manejarLlegadaParada);
        
        // Registrar manejador para actualización GPS
        registrarControlador(TIPOS_MENSAJE.GPS.ACTUALIZACION, manejarActualizacionGPS);
        
        // Registrar manejador para actualización de array de paradas
        registrarControlador(TIPOS_MENSAJE.DATOS.ARRAY_ACTUALIZADO, manejarArrayParadasActualizado);
        
        // Registrar manejador para verificar hash del array
        registrarControlador(TIPOS_MENSAJE.DATOS.VERIFICAR_HASH, manejarVerificacionHash);
        
        // Registrar manejador para cambio de modo siguiendo el protocolo estandarizado
        registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, async (mensaje) => {
            // Validar estructura del mensaje
            if (!mensaje || typeof mensaje !== 'object' || !mensaje.datos) {
                throw new Error('Mensaje de cambio de modo inválido: estructura incorrecta');
            }
            
            const { datos } = mensaje;
            const { modo, timestamp = Date.now(), motivo, forzar = false } = datos;
            
            // Validar modo
            if (modo !== 'casa' && modo !== 'aventura') {
                throw new Error(`Modo no válido: ${modo}. Debe ser 'casa' o 'aventura'`);
            }
            
            // Validar timestamp
            if (typeof timestamp !== 'number' || isNaN(new Date(timestamp).getTime())) {
                throw new Error(`Timestamp inválido: ${timestamp}`);
            }
            
            try {
                logger.info(`[MAPA] Procesando solicitud de cambio a modo: ${modo}` + 
                          (motivo ? ` (Motivo: ${motivo})` : ''));
                
                // Verificar si ya está en el modo solicitado
                const modoActual = document.body.classList.contains('modo-casa') ? 'casa' : 'aventura';
                if (!forzar && modoActual === modo) {
                    logger.info(`[MAPA] Ya está en modo ${modo}, ignorando solicitud`);
                    return { 
                        exito: true, 
                        modo, 
                        estado: 'ya_estaba_en_modo',
                        timestamp: Date.now()
                    };
                }
                
                // Actualizar el estado del mapa según el modo
                await actualizarModoMapa(modo);
                
                // Preparar confirmación
                const confirmacion = {
                    exito: true,
                    origen: CONFIG.IFRAME_ID,
                    datos: { 
                        modo,
                        modoAnterior: modoActual,
                        timestamp: Date.now(),
                        timestampSolicitud: timestamp,
                        motivo,
                        detalles: 'Modo actualizado correctamente en el mapa',
                        version: '1.0.0'
                    }
                };
                
                // Enviar confirmación al padre
                if (typeof enviarMensaje === 'function') {
                    await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO_CONFIRMACION, confirmacion)
                        .catch(error => {
                            logger.error('[MAPA] Error al enviar confirmación de cambio de modo:', error);
                            throw new Error('No se pudo confirmar el cambio de modo');
                        });
                }
                
                logger.info(`[MAPA] Confirmación de cambio a modo ${modo} enviada`);
                return { 
                    exito: true, 
                    modo, 
                    estado: 'confirmado',
                    timestamp: Date.now() 
                };
                
            } catch (error) {
                logger.error(`[MAPA] Error al procesar cambio a modo ${modo}:`, error);
                
                // Notificar error al padre
                if (typeof enviarMensaje === 'function') {
                    const mensajeError = {
                        tipo: 'cambio_modo',
                        mensaje: `Error al cambiar el modo a ${modo}: ${error.message}`,
                        stack: error.stack,
                        origen: CONFIG.IFRAME_ID,
                        timestamp: Date.now(),
                        datos: { 
                            modo,
                            modoAnterior: document.body.classList.contains('modo-casa') ? 'casa' : 'aventura',
                            timestamp: Date.now(),
                            error: error.message
                        }
                    };
                    
                    enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, mensajeError)
                        .catch(e => logger.error('[MAPA] Error al notificar error de cambio de modo:', e));
                }
                
                // Relanzar error para manejo superior
                throw error;
            }
        });
        
        // Manejador para mensajes de estado de modo
        registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO_ESTADO, (mensaje) => {
            const { datos } = mensaje || {};
            if (!datos) return;
            
            const { modo, confirmado, timestamp } = datos;
            if (confirmado && (modo === 'casa' || modo === 'aventura')) {
                logger.info(`[MAPA] Estado de modo actualizado a: ${modo} (${new Date(timestamp).toISOString()})`);
                // Asegurarse de que la interfaz esté sincronizada
                actualizarElementosDeInterfaz(modo);
            }
        });
        
        // Manejador para errores del sistema
        registrarControlador(TIPOS_MENSAJE.SISTEMA.ERROR, (mensaje) => {
            const { datos } = mensaje || {};
            if (!datos) return;
            
            const { tipo, mensaje: mensajeError, origen, timestamp } = datos;
            if (tipo === 'cambio_modo_fallido') {
                logger.error(
                    `[MAPA] Error en cambio de modo: ${mensajeError}`,
                    `\nOrigen: ${origen || 'desconocido'}`,
                    `\nHora: ${new Date(timestamp).toISOString()}`
                );
                // Opcional: Restaurar a un estado conocido o mostrar mensaje al usuario
            }
        });
        
        logger.info('[MAPA] Manejadores de mensajes registrados correctamente');
    } catch (error) {
        logger.error('[MAPA] Error al registrar manejadores de mensajes:', error);
        throw error;
    }
}

/**
 * Manejador para el mensaje de cambio de parada.
 * @param {Object} mensaje - Mensaje recibido con los datos de la parada.
 */
function manejarCambioParada(mensaje) {
    try {
        const { punto } = mensaje.datos || {};
        if (!punto) {
            logger.warn('[MAPA] No se recibió punto en el mensaje de cambio de parada');
            return { exito: false, error: 'No se recibió punto' };
        }
        // Aquí puedes actualizar el estado del mapa, centrarlo, resaltar parada, etc.
        logger.info('[MAPA] Cambio de parada solicitado:', punto);
        // Ejemplo: centrar el mapa en la parada si tienes la función centrarMapa
        // centrarMapa(punto.coordenadas);
        return { exito: true, punto };
    } catch (error) {
        logger.error('[MAPA] Error en manejarCambioParada:', error);
        return { exito: false, error: error.message };
    }
}

/**
 * Manejador para el mensaje de llegada a parada.
 * @param {Object} mensaje - Mensaje recibido con los datos de la parada.
 */
function manejarLlegadaParada(mensaje) {
    try {
        const { punto } = mensaje.datos || {};
        if (!punto) {
            logger.warn('[MAPA] No se recibió punto en el mensaje de llegada a parada');
            return { exito: false, error: 'No se recibió punto' };
        }
        // Aquí puedes actualizar el estado del mapa, mostrar popup, etc.
        logger.info('[MAPA] Llegada a parada detectada:', punto);
        // Ejemplo: mostrar información de la parada
        // mostrarPopupParada(punto);
        return { exito: true, punto };
    } catch (error) {
        logger.error('[MAPA] Error en manejarLlegadaParada:', error);
        return { exito: false, error: error.message };
    }
}

/**
 * Carga los datos de una parada específica desde el padre
 * @param {string} paradaId - ID de la parada a cargar
 * @returns {Promise<boolean>} - True si se cargaron los datos correctamente
 */
async function cargarDatosParada(paradaId) {
    try {
        logger.info(`[MAPA] Solicitando datos para parada: ${paradaId}`);
        
        // Usar la mensajería para solicitar los datos al padre
        const respuesta = await enviarMensaje(
            'padre',
            TIPOS_MENSAJE.DATOS.SOLICITAR_PARADA,
            { paradaId },
            { esperarRespuesta: true, timeout: 5000 }
        );
        
        if (respuesta && respuesta.exito) {
            logger.info(`[MAPA] Datos recibidos para parada ${paradaId}:`, respuesta.datos);
            actualizarMarcadorParada(paradaId, respuesta.datos);
            return true;
        } else {
            logger.warn(`[MAPA] No se pudieron obtener datos para la parada ${paradaId}`);
            return false;
        }
    } catch (error) {
        logger.error(`[MAPA] Error solicitando datos de parada ${paradaId}:`, error);
        return false;
    }
}

/**
 * Actualiza la interfaz del mapa según el modo especificado
 * @param {'casa'|'aventura'} modo - El modo al que cambiar
 * @param {Object} [opciones] - Opciones adicionales
 * @param {boolean} [opciones.forzar=false] - Forzar la actualización aunque ya esté en el modo solicitado
 * @returns {Promise<{exito: boolean, modo: string, timestamp: number}>}
 * @throws {Error} Si el modo no es válido o hay un error al actualizar
 */
async function actualizarModoMapa(modo, opciones = {}) {
    const { forzar = false } = opciones;
    const timestampInicio = Date.now();
    
    // Validar modo
    if (modo !== 'casa' && modo !== 'aventura') {
        throw new Error(`Modo no válido: ${modo}. Debe ser 'casa' o 'aventura'`);
    }
    
    // Verificar si ya está en el modo solicitado
    const modoActual = document.body.classList.contains('modo-casa') ? 'casa' : 'aventura';
    if (!forzar && modoActual === modo) {
        logger.info(`[MAPA] Ya está en modo ${modo}, no se requiere actualización`);
        return { 
            exito: true, 
            modo, 
            estado: 'ya_estaba_en_modo',
            timestamp: Date.now()
        };
    }
    
    try {
        logger.info(`[MAPA] Iniciando actualización a modo: ${modo} (${new Date(timestampInicio).toISOString()})`);
        
        // 1. Actualizar clases CSS del contenedor del mapa
        const contenedorMapa = document.querySelector('.map-container') || document.body;
        if (contenedorMapa) {
            // Usar requestAnimationFrame para animaciones suaves
            await new Promise((resolve) => {
                requestAnimationFrame(() => {
                    contenedorMapa.classList.remove('modo-casa', 'modo-aventura');
                    contenedorMapa.classList.add(`modo-${modo}`);
                    resolve();
                });
            });
        }
        
        // 2. Aplicar estilos específicos del modo al mapa
        if (mapa && typeof mapa.setStyle === 'function') {
            const estilos = {
                casa: {
                    weight: 2,
                    opacity: 0.8,
                    color: '#4a8fe7',
                    fillOpacity: 0.2,
                    fillColor: '#4a8fe7',
                    dashArray: '3',
                    className: `estilo-modo-casa-${Date.now()}`
                },
                aventura: {
                    weight: 3,
                    opacity: 1,
                    color: '#e74c3c',
                    fillOpacity: 0.3,
                    fillColor: '#e74c3c',
                    dashArray: null,
                    className: `estilo-modo-aventura-${Date.now()}`
                }
            };
            
            // Aplicar estilos con transición suave
            await new Promise((resolve) => {
                requestAnimationFrame(() => {
                    try {
                        mapa.eachLayer(layer => {
                            if (layer.setStyle) {
                                layer.setStyle(estilos[modo]);
                            }
                        });
                        
                        // Forzar actualización de la vista
                        if (mapa._renderer) {
                            mapa._renderer._update();
                        }
                        resolve();
                    } catch (error) {
                        logger.error('[MAPA] Error al aplicar estilos del mapa:', error);
                        resolve(); // Continuar aunque falle el estilo
                    }
                });
            });
        }
        
        // 3. Actualizar otros elementos de la interfaz
        try {
            await actualizarElementosDeInterfaz(modo);
        } catch (error) {
            logger.error('[MAPA] Error al actualizar elementos de interfaz:', error);
            // Continuar aunque falle la actualización de la interfaz
        }
        
        const tiempoTranscurrido = Date.now() - timestampInicio;
        logger.info(`[MAPA] Actualización a modo ${modo} completada en ${tiempoTranscurrido}ms`);
        
        return { 
            exito: true, 
            modo, 
            modoAnterior: modoActual,
            timestamp: Date.now(),
            tiempoTranscurrido
        };
        
    } catch (error) {
        logger.error(`[MAPA] Error al actualizar al modo ${modo}:`, error);
        
        // Intentar restaurar un estado consistente
        try {
            if (mapa) {
                mapa.setStyle({
                    weight: 1,
                    opacity: 0.7,
                    color: '#666',
                    fillOpacity: 0.1,
                    fillColor: '#999',
                    dashArray: null
                });
            }
        } catch (recoveryError) {
            logger.error('[MAPA] Error al restaurar estilo por defecto:', recoveryError);
            // No relanzar este error para no sobrescribir el error original
        }
        
        // Crear un error mejor formateado para el manejo superior
        const errorActualizado = new Error(
            `Error al cambiar al modo ${modo}: ${error.message || error}`
        );
        errorActualizado.name = 'ErrorCambioModo';
        errorActualizado.detalles = {
            modoSolicitado: modo,
            modoAnterior: document.body.classList.contains('modo-casa') ? 'casa' : 'aventura',
            timestamp: Date.now(),
            tiempoTranscurrido: Date.now() - timestampInicio,
            errorOriginal: error
        };
        
        throw errorActualizado;
    }
}

/**
 * Actualiza elementos de la interfaz de usuario según el modo
 * @param {'casa'|'aventura'} modo - Modo actual
 * @returns {Promise<void>}
 */
// Configuración del módulo
const CONFIG = {
  IFRAME_ID: 'hijo-mapa', // ID único para este iframe
  DEBUG: true,
  LOG_LEVEL: 1, // 0: debug, 1: info, 2: warn, 3: error
};

/**
 * Inicializa el módulo de mapa
 */
async function inicializar() {
    try {
        logger.info(`[${CONFIG.IFRAME_ID}] Inicializando módulo de mapa...`);
        
        await inicializarMensajeria({
            iframeId: CONFIG.IFRAME_ID,
            debug: CONFIG.DEBUG,
            logLevel: CONFIG.LOG_LEVEL
        });
        
        registrarManejadoresMensajes();
        inicializarMapa();
        
        logger.info(`[${CONFIG.IFRAME_ID}] Módulo de mapa inicializado correctamente`);
    } catch (error) {
        logger.error(`[${CONFIG.IFRAME_ID}] Error al inicializar el módulo de mapa:`, error);
        crearObjetoError('inicializacion_modulo_mapa', error, {});
    }
}

document.addEventListener('DOMContentLoaded', inicializar);

window.addEventListener('beforeunload', () => {
    limpiarRecursos();
});

// Exportar funciones principales
export default {
    inicializarMapa,
    actualizarModoMapa,
    buscarCoordenadasParada,
    obtenerNombreParada,
    actualizarMarcadorParada,
    limpiarRecursos,
    cargarDatosParada
};

// Exportar funciones individualmente para pruebas
export {
    inicializarMapa,
    actualizarModoMapa,
    buscarCoordenadasParada,
    obtenerNombreParada,
    actualizarMarcadorParada,
    limpiarRecursos,
    cargarDatosParada
};
