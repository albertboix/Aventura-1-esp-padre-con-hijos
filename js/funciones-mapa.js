/**
 * Módulo que maneja la visualización del mapa y la interacción con las paradas
 * Se comunica con el padre a través del sistema de mensajería
 */

// Importar la mensajería
import { Mensajeria, TIPOS_MENSAJE, enviarMensaje } from '../Aventura-1-esp-padre-con-hijos/js/mensajeria.js';

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
export function inicializarMapa(opciones = {}) {
    console.log('[MAPA] Inicializando mapa...');
    
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
        // Solicitar el array al padre mediante mensajería
        console.log('[MAPA] No se encontró array de paradas, solicitando al padre...');
        
        // Verificar si la mensajería está disponible
        if (window.Mensajeria && window.Mensajeria.enviarMensaje) {
            window.Mensajeria.enviarMensaje('padre', 'datos:solicitar_array_paradas', {
                timestamp: Date.now()
            }).then(respuesta => {
                if (respuesta && respuesta.exito && respuesta.datos && respuesta.datos.AVENTURA_PARADAS) {
                    console.log('[MAPA] Array de paradas recibido del padre');
                    procesarArrayParadas(respuesta.datos.AVENTURA_PARADAS);
                } else {
                    console.error('[MAPA] Respuesta inválida del padre:', respuesta);
                    intentarObtenerParadasEmergencia();
                }
            }).catch(error => {
                console.error('[MAPA] Error al solicitar array de paradas:', error);
                intentarObtenerParadasEmergencia();
            });
            
            // Salir de la función - la inicialización continuará cuando recibamos respuesta
            return;
        } else {
            console.error('[MAPA] No hay array de paradas disponible ni sistema de mensajería');
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
        console.error('[MAPA] Array de paradas inválido o vacío');
        return;
    }
    
    console.log(`[MAPA] Procesando array con ${arrayParadas.length} paradas/tramos`);
    
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
    
    console.log('[MAPA] Inicialización completada con array de paradas');
    
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
        }).catch(error => console.warn('[MAPA] Error al notificar inicialización:', error));
    }
}

/**
 * Intenta obtener el array de paradas del padre usando diversos métodos
 * @returns {Promise<Array>} - Promise con el array de paradas
 */
async function solicitarArrayParadasAlPadre() {
    intentosSincronizacion++;
    
    console.log(`[MAPA] Solicitando array de paradas (intento ${intentosSincronizacion}/${MAX_INTENTOS_SINCRONIZACION})...`);
    
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
        console.error('[MAPA] Error al solicitar array de paradas:', error);
        
        // Si no se ha superado el máximo de intentos, intentar de nuevo con retraso exponencial
        if (intentosSincronizacion < MAX_INTENTOS_SINCRONIZACION) {
            const tiempoEspera = Math.pow(2, intentosSincronizacion) * 1000;
            console.log(`[MAPA] Reintentando en ${tiempoEspera}ms...`);
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
    console.log('[MAPA] Intentando obtener paradas por métodos alternativos...');
    
    // Método 1: Intentar acceder directamente al array desde window.parent
    if (window.parent && window.parent !== window) {
        try {
            if (window.parent.AVENTURA_PARADAS) {
                console.log('[MAPA] Array de paradas encontrado en window.parent');
                procesarArrayParadas(window.parent.AVENTURA_PARADAS);
                return;
            }
        } catch (error) {
            console.error('[MAPA] Error al acceder a window.parent.AVENTURA_PARADAS:', error);
        }
    }
    
    // Método 2: Intentar mediante postMessage (sin usar mensajeria.js)
    try {
        window.parent.postMessage({ 
            tipo: 'solicitar_array_paradas', 
            origen: 'funciones-mapa',
            timestamp: Date.now() 
        }, '*');
        
        // Configurar un listener temporal para la respuesta
        const listener = event => {
            if (event.data && event.data.tipo === 'respuesta_array_paradas' && 
                event.data.datos && Array.isArray(event.data.datos.AVENTURA_PARADAS)) {
                window.removeEventListener('message', listener);
                procesarArrayParadas(event.data.datos.AVENTURA_PARADAS);
            }
        };
        
        window.addEventListener('message', listener);
        
        // Eliminar el listener después de un tiempo prudencial
        setTimeout(() => {
            window.removeEventListener('message', listener);
            console.warn('[MAPA] No se recibió respuesta mediante postMessage');
        }, 10000);
        
    } catch (error) {
        console.error('[MAPA] Error al solicitar array mediante postMessage:', error);
    }
    
    // Método 3: Cargar un array de paradas mínimo para funcionamiento básico
    console.warn('[MAPA] Usando array de paradas de emergencia (mínimo)');
    const paradasEmergencia = generarArrayParadasEmergencia();
    procesarArrayParadas(paradasEmergencia);
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
        console.warn("[MAPA] Error al calcular hash de array:", e);
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
                console.log('[MAPA] Detectada actualización en array de paradas. Solicitando nuevos datos...');
                const arrayActualizado = await solicitarArrayParadasAlPadre();
                if (arrayActualizado) {
                    actualizarElementosMapa(arrayActualizado);
                }
            }
        } catch (error) {
            console.error('[MAPA] Error al verificar actualizaciones de array:', error);
        }
    }, 300000); // 5 minutos
}

/**
 * Actualiza los elementos del mapa con un nuevo array de paradas
 * @param {Array} nuevoArray - El nuevo array de paradas
 */
function actualizarElementosMapa(nuevoArray) {
    if (!nuevoArray || !Array.isArray(nuevoArray) || nuevoArray.length === 0) {
        console.error('[MAPA] Array de actualización inválido o vacío');
        return;
    }
    
    // Actualizar referencia local y hash
    arrayParadasLocal = nuevoArray;
    hashArrayParadas = calcularHashArray(arrayParadasLocal);
    ultimaSincronizacion = Date.now();
    
    console.log(`[MAPA] Actualizando elementos con nuevo array (${nuevoArray.length} elementos)`);
    
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
    
    console.log('[MAPA] Elementos del mapa actualizados exitosamente');
    
    // Notificar actualización completada
    if (typeof enviarMensaje === 'function') {
        enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ACTUALIZACION_COMPLETADA, {
            componente: 'mapa',
            tipoActualizacion: 'array_paradas',
            elementosActualizados: nuevoArray.length,
            timestamp: Date.now()
        }).catch(e => console.warn('[MAPA] Error al notificar actualización:', e));
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
    
    console.log(`[MAPA] Preparados ${marcadores.length} marcadores de paradas`);
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
    console.log(`[MAPA] Buscando coordenadas para parada ${paradaId}`);
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
    
    console.log(`[MAPA] Preparadas ${rutas.length} rutas de tramos`);
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
    console.log(`[MAPA] Buscando coordenadas para tramo ${tramoId}`);
    return null;
}

/**
 * Crea el mapa y añade los elementos
 * @param {Object} opciones - Opciones para crear el mapa
 */
function crearMapaConElementos(opciones) {
    // Esta función debería implementar la creación del mapa con Leaflet
    console.log('[MAPA] Creando mapa con elementos:', opciones);
    // Implementación pendiente
}

/**
 * Registra manejadores de mensajes para eventos de navegación
 */
function registrarManejadoresMensajes() {
    if (!window.Mensajeria || !window.Mensajeria.registrarControlador) {
        console.warn('[MAPA] Sistema de mensajería no disponible para registrar controladores');
        return;
    }
    
    // Registrar manejador para cambio de parada
    window.Mensajeria.registrarControlador('navegacion:cambio_parada', manejarCambioParada);
    
    // Registrar manejador para llegada a parada
    window.Mensajeria.registrarControlador('navegacion:llegada_detectada', manejarLlegadaParada);
    
    // Registrar manejador para actualización de posición GPS
    window.Mensajeria.registrarControlador('gps:actualizar', manejarActualizacionGPS);
    
    // Registrar manejador para actualización del array de paradas
    window.Mensajeria.registrarControlador('datos:array_paradas_actualizado', manejarArrayParadasActualizado);
    
    // Registrar manejador para verificar hash del array
    window.Mensajeria.registrarControlador('datos:verificar_hash_array', manejarVerificacionHash);
    
    // Registrar manejador para cambio de modo usando el estándar correcto
    window.Mensajeria.registrarControlador(
        TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO,
        (mensaje) => {
            const { modo } = mensaje.datos || {};
            console.log('[MAPA] Cambio de modo recibido:', modo);
            // ...actualiza la interfaz/mapa según el modo...
        }
    );
    
    console.log('[MAPA] Manejadores de mensajes registrados');
}

/**
 * Maneja el evento de cambio de parada
 * @param {Object} mensaje - Mensaje recibido
 */
function manejarCambioParada(mensaje) {
    console.log('[MAPA] Cambio de parada recibido:', mensaje);
    
    if (mensaje.datos && mensaje.datos.parada_id) {
        // Resaltar marcador de la parada en el mapa
        resaltarMarcador(mensaje.datos.parada_id);
        
        // Centrar mapa en la parada
        centrarMapaEnParada(mensaje.datos.parada_id);
    }
}

/**
 * Resalta un marcador en el mapa
 * @param {string} paradaId - ID de la parada
 */
function resaltarMarcador(paradaId) {
    // Implementación pendiente
    console.log(`[MAPA] Resaltando marcador de parada ${paradaId}`);
}

/**
 * Centra el mapa en una parada
 * @param {string} paradaId - ID de la parada
 */
function centrarMapaEnParada(paradaId) {
    // Implementación pendiente
    console.log(`[MAPA] Centrando mapa en parada ${paradaId}`);
}

/**
 * Maneja el evento de llegada a una parada
 * @param {Object} mensaje - Mensaje recibido
 */
function manejarLlegadaParada(mensaje) {
    console.log('[MAPA] Llegada a parada detectada:', mensaje);
    
    if (mensaje.datos && mensaje.datos.parada_id) {
        // Animar marcador para indicar llegada
        animarMarcador(mensaje.datos.parada_id, 'llegada');
        
        // Si hay audio asociado a la parada, activar notificación visual
        if (mensaje.datos.audio_id) {
            mostrarNotificacionAudio(mensaje.datos.audio_id);
        }
        
        // Si hay reto asociado, activar notificación visual
        if (mensaje.datos.reto_id || (mensaje.datos.retos && mensaje.datos.retos.length)) {
            mostrarNotificacionReto(mensaje.datos.reto_id || mensaje.datos.retos[0]);
        }
    }
}

/**
 * Anima un marcador en el mapa
 * @param {string} paradaId - ID de la parada
 * @param {string} tipoAnimacion - Tipo de animación
 */
function animarMarcador(paradaId, tipoAnimacion) {
    // Implementación pendiente
    console.log(`[MAPA] Animando marcador ${paradaId} con animación ${tipoAnimacion}`);
}

/**
 * Muestra una notificación de audio disponible
 * @param {string} audioId - ID del audio
 */
function mostrarNotificacionAudio(audioId) {
    // Implementación pendiente
    console.log(`[MAPA] Mostrando notificación de audio ${audioId}`);
}

/**
 * Muestra una notificación de reto disponible
 * @param {string} retoId - ID del reto
 */
function mostrarNotificacionReto(retoId) {
    // Implementación pendiente
    console.log(`[MAPA] Mostrando notificación de reto ${retoId}`);
}

/**
 * Maneja la actualización de la posición GPS
 * @param {Object} mensaje - Mensaje recibido
 */
function manejarActualizacionGPS(mensaje) {
    if (mensaje.datos && mensaje.datos.lat && mensaje.datos.lng) {
        // Actualizar marcador de posición del usuario
        actualizarPosicionUsuario(mensaje.datos.lat, mensaje.datos.lng, mensaje.datos.precision);
    }
}

/**
 * Actualiza la posición del usuario en el mapa
 * @param {number} lat - Latitud
 * @param {number} lng - Longitud
 * @param {number} precision - Precisión en metros
 */
function actualizarPosicionUsuario(lat, lng, precision) {
    // Implementación pendiente
    console.log(`[MAPA] Actualizando posición de usuario a [${lat}, ${lng}] (precisión: ${precision}m)`);
}

/**
 * Maneja la notificación de actualización del array de paradas
 * @param {Object} mensaje - Mensaje recibido
 */
function manejarArrayParadasActualizado(mensaje) {
    console.log('[MAPA] Notificación de actualización de paradas recibida');
    
    // Solicitar el array actualizado
    solicitarArrayParadasAlPadre()
        .then(arrayActualizado => {
            if (arrayActualizado) {
                console.log('[MAPA] Actualizando elementos del mapa con nuevo array');
                actualizarElementosMapa(arrayActualizado);
            }
        })
        .catch(error => {
            console.error('[MAPA] Error al solicitar array actualizado:', error);
        });
}

/**
 * Maneja la verificación del hash del array
 * @param {Object} mensaje - Mensaje recibido
 * @returns {Object} - Respuesta con el resultado de la verificación
 */
function manejarVerificacionHash(mensaje) {
    if (!mensaje || !mensaje.datos || !mensaje.datos.hashServidor) {
        return { exito: false, error: 'Datos de verificación incompletos' };
    }
    
    const { hashServidor } = mensaje.datos;
    const coincide = hashArrayParadas === hashServidor;
    
    return {
        exito: true,
        datos: {
            coincide,
            hashLocal: hashArrayParadas,
            hashServidor,
            ultimaSincronizacion
        }
    };
}

/**
 * Carga los datos de una parada específica desde el padre
 * @param {string} paradaId - ID de la parada a cargar
 * @returns {Promise<boolean>} - True si se cargaron los datos correctamente
 */
async function cargarDatosParada(paradaId) {
    try {
        console.log(`[MAPA] Solicitando datos para parada: ${paradaId}`);
        
        // Usar la mensajería para solicitar los datos al padre
        const respuesta = await Mensajeria.enviarMensaje(
            'padre',
            TIPOS_MENSAJE.DATOS.SOLICITAR_PARADA,
            { paradaId },
            { esperarRespuesta: true, timeout: 5000 }
        );
        
        if (respuesta && respuesta.exito) {
            console.log(`[MAPA] Datos recibidos para parada ${paradaId}:`, respuesta.datos);
            actualizarMarcadorParada(paradaId, respuesta.datos);
            return true;
        } else {
            console.warn(`[MAPA] No se pudieron obtener datos para la parada ${paradaId}`);
            return false;
        }
    } catch (error) {
        console.error(`[MAPA] Error solicitando datos de parada ${paradaId}:`, error);
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
        console.warn(`[MAPA] Datos de coordenadas faltantes para la parada ${paradaId}`);
        return;
    }

    const [lat, lng] = datosParada.coordenadas;
    const popupContent = `<b>${datosParada.nombre || `Parada ${paradaId}`}</b>`;

    if (marcadoresParadas.has(paradaId)) {
        // Actualizar marcador existente
        const marcador = marcadoresParadas.get(paradaId);
        marcador.setLatLng([lat, lng]);
        marcador.getPopup().setContent(popupContent);
        console.log(`[MAPA] Marcador actualizado para parada ${paradaId}`);
    } else {
        // Crear nuevo marcador
        const marcador = L.marker([lat, lng])
            .addTo(mapa)
            .bindPopup(popupContent);
        
        marcadoresParadas.set(paradaId, marcador);
        console.log(`[MAPA] Nuevo marcador creado para parada ${paradaId}`);
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
        console.log('[MAPA] Recursos del mapa liberados correctamente');
        
    } catch (error) {
        console.error('[MAPA] Error al limpiar recursos del mapa:', error);
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
                console.error('[MAPA] Error al inicializar el mapa automáticamente');
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
