/**
 * Módulo que maneja la visualización del mapa y la interacción con las paradas
 * Se comunica con el padre a través del sistema de mensajería
 */

// Importar la mensajería
import { 
  inicializarMensajeria,
  enviarMensaje, 
  registrarControlador,
  TIPOS_MENSAJE 
} from './mensajeria.js';

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

// Estado global del módulo
const estadoMapa = {
  inicializado: false,
  mapa: null,
  arrayParadas: null,
  marcadoresParadas: new Map(),
  manejadoresRegistrados: false,
  opcionesActuales: null
};

/**
 * Inicializa el sistema de mapa with las paradas y coordenadas
 * @param {Object} opciones - Opciones de inicialización
 * @returns {Promise<boolean>} - True si la inicialización fue exitosa
 */
async function inicializarMapa(opciones = {}) {
  const logPrefix = '[MAPA]';
  try {
    if (config && config.debug) {
      logger.debug(`${logPrefix} Inicializando mapa...`);
    }
    
    // Si ya está inicializado, limpiar recursos primero
    if (estadoMapa.inicializado) {
      if (config && config.debug) {
        logger.debug(`${logPrefix} El mapa ya está inicializado, limpiando recursos...`);
      }
      await limpiarRecursos();
    }
    
    // Guardar opciones
    estadoMapa.opcionesActuales = { ...opciones };
    
    // Comprobar si tenemos el array de paradas
    let arrayParadas = null;
    
    // 1. Intentar obtener de las opciones
    if (opciones.arrayParadas) {
      if (config && config.debug) {
        logger.debug(`${logPrefix} Usando array de paradas proporcionado en opciones`);
      }
      arrayParadas = opciones.arrayParadas;
    }
    // 2. Intentar obtener del objeto global
    else if (window.AVENTURA_PARADAS) {
      if (config && config.debug) {
        logger.debug(`${logPrefix} Usando array de paradas global (AVENTURA_PARADAS)`);
      }
      arrayParadas = window.AVENTURA_PARADAS;
    }
    // 3. Intentar obtener a través de mensajería
    else if (window.parent !== window) {
      if (config && config.debug) {
        logger.debug(`${logPrefix} Solicitando array de paradas al padre...`);
      }
      try {
        arrayParadas = await solicitarArrayParadasAlPadre();
      } catch (error) {
        logger.error(`${logPrefix} Error al obtener paradas del padre:`, error);
        throw new Error('No se pudo obtener el array de paradas del padre');
      }
    }
    
    // Si no se pudo obtener el array de paradas
    if (!arrayParadas || !Array.isArray(arrayParadas) || arrayParadas.length === 0) {
      logger.warn(`${logPrefix} No se pudo obtener un array de paradas válido, usando datos de emergencia`);
      arrayParadas = generarArrayParadasEmergencia();
    }
    
    // Procesar array de paradas
    estadoMapa.arrayParadas = arrayParadas;
    procesarArrayParadas(arrayParadas);
    
    // Verificar contenedor antes de crear el mapa
    let contenedorId = opciones.containerId || opciones.contenedorMapa || 'mapa';
    let mapContainer = document.getElementById(contenedorId);
    if (!mapContainer) {
      console.error(`${logPrefix} No se encontró el contenedor del mapa (${contenedorId})`);
      mapContainer = document.createElement('div');
      mapContainer.id = contenedorId;
      mapContainer.style.width = '100vw';
      mapContainer.style.height = '100vh';
      document.body.appendChild(mapContainer);
    }
    if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
      mapContainer.style.width = '100vw';
      mapContainer.style.height = '100vh';
      console.warn(`${logPrefix} El contenedor del mapa tenía dimensiones 0, se han corregido`);
    }
    
    // Validar array de paradas
    if (!arrayParadas || !Array.isArray(arrayParadas) || arrayParadas.length === 0) {
      console.error(`${logPrefix} El array de paradas está vacío o no es válido`);
      alert('No se han podido cargar las paradas. El mapa no puede mostrarse.');
      return null;
    }
    
    // Crear el mapa y devolver la instancia
    estadoMapa.mapa = crearMapaConElementos({
      containerId: contenedorId,
      marcadores: prepararMarcadoresParadas(arrayParadas),
      rutas: prepararRutasTramos(arrayParadas),
      ...opciones
    });
    if (!estadoMapa.mapa) {
      console.error(`${logPrefix} No se pudo crear la instancia de Leaflet`);
      alert('No se pudo inicializar el mapa.');
      return null;
    }
    
    // Registrar manejadores de mensajes si no están registrados
    if (!estadoMapa.manejadoresRegistrados) {
      registrarManejadoresMensajes();
      estadoMapa.manejadoresRegistrados = true;
    }
    
    // Notificar que el mapa está listo
    if (enviarMensaje) {
      await enviarMensaje('padre', 'mapa:inicializado', {
        exito: true,
        timestamp: new Date().toISOString(),
        numParadas: arrayParadas.length
      });
    }
    
    estadoMapa.inicializado = true;
    console.log('[MAPA] Mapa inicializado correctamente');
    return true;
    
  } catch (error) {
    console.error('[MAPA] Error fatal en inicializarMapa:', error);
    alert('Error crítico al inicializar el mapa: ' + error.message);
    estadoMapa.inicializado = false;
    
    if (enviarMensaje) {
      await enviarMensaje('padre', 'SISTEMA.ERROR', {
        tipo: 'inicializacion_mapa',
        mensaje: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
    
    throw error;
  }
}

/**
 * Procesa el array de paradas recibido para inicializar el mapa
 * @param {Array} arrayParadas - Array con las paradas y tramos
 * @returns {boolean} - True si el procesamiento fue exitoso
 */
function procesarArrayParadas(arrayParadas) {
    if (!arrayParadas || !Array.isArray(arrayParadas) || arrayParadas.length === 0) {
        console.error('[MAPA] Array de paradas inválido o vacío');
        alert('No se han podido cargar las paradas. El mapa no puede mostrarse.');
        return false;
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
    console.error('[MAPA] No se pudo obtener el array de paradas a través de la mensajería. El mapa no puede continuar la inicialización.');
    notificarError('obtencion_paradas_critico', new Error('Fallo total al obtener el array de paradas.'));
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
    const paradas = arrayParadas.filter(item => item.tipo === "parada" || item.tipo === "inicio");
    paradas.forEach(parada => {
        const coordenadas = buscarCoordenadasParada(parada.parada_id);
        if (coordenadas && coordenadas.lat && coordenadas.lng) {
            const { audio, reto } = obtenerAudioRetoParada(parada.parada_id);
            marcadores.push({
                id: parada.parada_id,
                lat: coordenadas.lat,
                lng: coordenidas.lng,
                titulo: obtenerNombreParada(parada),
                icono: parada.tipo === "inicio" ? 'inicio' : 'parada',
                datos: {
                  audio_id: audio,
                  reto_id: reto,
                  retos: parada.retos,
                  tipo: parada.tipo,
                  imagen: coordenadas.imagen,
                  video: coordenadas.video
                }
            });
        }
    });
    return marcadores;
}

/**
 * Busca las coordenadas de una parada por su ID
 * @param {string} paradaId - ID de la parada
 * @returns {Object|null} - Coordenadas {lat, lng} o null
 */
function buscarCoordenadasParada(paradaId) {
    const parada = coordenadasParadas.find(p => p.id === paradaId);
    if (parada && parada.coordenadas) {
      return parada.coordenadas;
    }
    // Fallback: buscar en array del padre
    const paradaPadre = arrayParadasPadre.find(p => p.parada_id === paradaId);
    if (paradaPadre && paradaPadre.coordenadas) {
      return paradaPadre.coordenadas;
    }
    return null;
}

/**
 * Obtiene el nombre de una parada
 * @param {Object} parada - Objeto de parada
 * @returns {string} - Nombre de la parada
 */
function obtenerNombreParada(parada) {
  if (parada && parada.nombre) return parada.nombre;
  // Buscar en array del padre
  const paradaPadre = arrayParadasPadre.find(p => p.parada_id === parada.parada_id);
  if (paradaPadre && paradaPadre.nombre) return paradaPadre.nombre;
  return parada.parada_id || 'Parada';
}

// Variables para la chincheta de destino y el usuario
let marcadorDestino = null;
let marcadorUsuario = null;

// Añade la polyline verde de 6px para los tramos
function prepararRutasTramos(arrayParadas) {
    const rutas = [];
    const tramos = arrayParadas.filter(item => item.tipo === "tramo");
    trmos.forEach(tramo => {
        const coordenadas = buscarCoordenadasTramo(tramo.tramo_id);
        if (coordenadas && coordenadas.puntos && coordenadas.puntos.length > 1) {
            rutas.push({
                id: tramo.tramo_id,
                puntos: coordenadas.puntos,
                color: '#27ae60', // Verde
                grosor: 6,        // 6px
                datos: {
                    audio_id: tramo.audio_id,
                    tipo: tramo.tipo,
                    imagen: coordenadas.imagen,
                    video: coordenadas.video
                }
            });
        }
    });
    return rutas;
}

// Dibuja las polylines en el mapa
function crearMapaConElementos(opciones = {}) {
    console.log('[MAPA] Creando mapa con opciones:', opciones);
    
    // Obtener el contenedor o crearlo si no existe
    let mapContainer = document.getElementById(opciones.containerId || 'mapa');
    
    if (!mapContainer) {
        console.warn(`[MAPA] No se encontró el contenedor con ID '${opciones.containerId}', creando uno nuevo`);
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
        
        // Añadir marcadores de paradas
        if (opciones.marcadores) {
            opciones.marcadores.forEach(marcadorInfo => {
                const marker = L.marker([marcadorInfo.lat, marcadorInfo.lng], {
                    title: marcadorInfo.titulo,
                    icon: L.icon({
                        iconUrl: 'img/chincheta-roja.png', // Chincheta roja por defecto
                        iconSize: [32, 32],
                        iconAnchor: [16, 32]
                    })
                }).addTo(map);
                marcadoresParadas.set(marcadorInfo.id, marker);
            });
        }

        // Añadir polylines de tramos
        if (opciones.rutas) {
            opciones.rutas.forEach(rutaInfo => {
                L.polyline(
                    rutaInfo.puntos.map(p => [p.lat, p.lng]),
                    {
                        color: rutaInfo.color || '#27ae60',
                        weight: rutaInfo.grosor || 6,
                        opacity: 0.9
                    }
                ).addTo(map);
            });
        }
        
        console.log('[MAPA] Mapa creado exitosamente');
        return map;
        
    } catch (error) {
        console.error('[MAPA] Error al crear el mapa:', error);
        throw error;
    }
}

// Actualiza la chincheta de destino según la distancia del usuario
function actualizarChinchetaDestino(paradaId, usuarioCoords) {
    const parada = buscarCoordenadasParada(paradaId);
    if (!parada) return;

    // Si no existe el marcador, créalo
    if (!marcadorDestino) {
        marcadorDestino = L.marker([parada.lat, parada.lng], {
            icon: L.icon({
                iconUrl: 'img/chincheta-roja.png',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            })
        }).addTo(mapa);
    } else {
        marcadorDestino.setLatLng([parada.lat, parada.lng]);
    }

    // Si hay coordenadas del usuario, calcula la distancia
    if (usuarioCoords) {
        const distancia = mapa.distance([parada.lat, parada.lng], [usuarioCoords.lat, usuarioCoords.lng]);
        if (distancia <= 30) {
            marcadorDestino.setIcon(L.icon({
                iconUrl: 'img/chincheta-verde.png',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            }));
        } else {
            marcadorDestino.setIcon(L.icon({
                iconUrl: 'img/chincheta-roja.png',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            }));
        }
    }
}

// Ejemplo de uso: llamar a actualizarChinchetaDestino cada vez que cambie la ubicación del usuario
// actualizarChinchetaDestino(paradaIdActual, { lat: usuarioLat, lng: usuarioLng });

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
                console.log(`[MAPA] Procesando solicitud de cambio a modo: ${modo}` + 
                          (motivo ? ` (Motivo: ${motivo})` : ''));
                
                // Verificar si ya está en el modo solicitado
                const modoActual = document.body.classList.contains('modo-casa') ? 'casa' : 'aventura';
                if (!forzar && modoActual === modo) {
                    console.log(`[MAPA] Ya está en modo ${modo}, ignorando solicitud`);
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
                            console.error('[MAPA] Error al enviar confirmación de cambio de modo:', error);
                            throw new Error('No se pudo confirmar el cambio de modo');
                        });
                }
                
                console.log(`[MAPA] Confirmación de cambio a modo ${modo} enviada`);
                return { 
                    exito: true, 
                    modo, 
                    estado: 'confirmado',
                    timestamp: Date.now() 
                };
                
            } catch (error) {
                console.error(`[MAPA] Error al procesar cambio a modo ${modo}:`, error);
                
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
                        .catch(e => console.error('[MAPA] Error al notificar error de cambio de modo:', e));
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
                console.log(`[MAPA] Estado de modo actualizado a: ${modo} (${new Date(timestamp).toISOString()})`);
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
                console.error(
                    `[MAPA] Error en cambio de modo: ${mensajeError}`,
                    `\nOrigen: ${origen || 'desconocido'}`,
                    `\nHora: ${new Date(timestamp).toISOString()}`
                );
                // Opcional: Restaurar a un estado conocido o mostrar mensaje al usuario
            }
        });
        
        console.log('[MAPA] Manejadores de mensajes registrados correctamente');
    } catch (error) {
        console.error('[MAPA] Error al registrar manejadores de mensajes:', error);
        throw error;
    }
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
        const respuesta = await enviarMensaje(
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
        console.log(`[MAPA] Ya está en modo ${modo}, no se requiere actualización`);
        return { 
            exito: true, 
            modo, 
            estado: 'ya_estaba_en_modo',
            timestamp: Date.now()
        };
    }
    
    try {
        console.log(`[MAPA] Iniciando actualización a modo: ${modo} (${new Date(timestampInicio).toISOString()})`);
        
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
                        console.error('[MAPA] Error al aplicar estilos del mapa:', error);
                        resolve(); // Continuar aunque falle el estilo
                    }
                });
            });
        }
        
        // 3. Actualizar otros elementos de la interfaz
        try {
            await actualizarElementosDeInterfaz(modo);
        } catch (error) {
            console.error('[MAPA] Error al actualizar elementos de interfaz:', error);
            // Continuar aunque falle la actualización de la interfaz
        }
        
        const tiempoTranscurrido = Date.now() - timestampInicio;
        console.log(`[MAPA] Actualización a modo ${modo} completada en ${tiempoTranscurrido}ms`);
        
        return { 
            exito: true, 
            modo, 
            modoAnterior: modoActual,
            timestamp: Date.now(),
            tiempoTranscurrido
        };
        
    } catch (error) {
        console.error(`[MAPA] Error al actualizar al modo ${modo}:`, error);
        
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
            console.error('[MAPA] Error al restaurar estilo por defecto:', recoveryError);
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

// Configuración del módulo
const CONFIG = {
  IFRAME_ID: 'hijo2', // ID único para este iframe (coincide con el ID en padre.html)
  DEBUG: true,
  LOG_LEVEL: 1, // 0: debug, 1: info, 2: warn, 3: error
};

// Añadir referencia global para acceso a datos de hijo2 (coordenadas)
let coordenadasParadas = [];
if (window.hijo2 && window.hijo2.COORDENADAS_PARADAS) {
  coordenadasParadas = window.hijo2.COORDENADAS_PARADAS;
} else if (window.COORDENADAS_PARADAS) {
  coordenadasParadas = window.COORDENADAS_PARADAS;
}

// Añadir referencia global para acceso a datos de hijo3 (audios)
let audiosParadas = [];
if (window.hijo3 && window.hijo3.audioFiles) {
  audiosParadas = window.hijo3.audioFiles;
} else if (window.audioFiles) {
  audiosParadas = window.audioFiles;
}

// Añadir referencia global para acceso a datos de hijo4 (retos/puzzles)
let retosParadas = [];
if (window.hijo4 && window.hijo4.retos) {
  retosParadas = window.hijo4.retos;
} else if (window.retos) {
  retosParadas = window.retos;
}

// Usar el array completo del padre para tramos y paradas
let arrayParadasPadre = [];
if (window.AVENTURA_PARADAS) {
  arrayParadasPadre = window.AVENTURA_PARADAS;
}

/**
 * Notifica un error al padre a través del sistema de mensajería.
 * @param {string} tipo - El tipo de error (p.ej., 'inicializacion', 'cambio_modo').
 * @param {Error} error - El objeto de error.
 */
async function notificarError(tipo, error) {
  console.error(`[${CONFIG.IFRAME_ID}] Error (${tipo}):`, error);
  if (enviarMensaje) {
    try {
      await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.ERROR, {
        tipo,
        mensaje: error.message,
        stack: error.stack,
        origen: CONFIG.IFRAME_ID
      });
    } catch (msgError) {
      console.error(`[${CONFIG.IFRAME_ID}] Fallo al notificar el error original:`, msgError);
    }
  }
}

async function actualizarElementosDeInterfaz(modo) {
    if (modo !== 'casa' && modo !== 'aventura') {
        console.warn(`[MAPA] Intento de actualizar interfaz con modo no válido: ${modo}`);
        return;
    }
    
    console.log(`[MAPA] Actualizando interfaz para modo: ${modo}`);
    
    try {
        document.body.classList.remove('modo-casa', 'modo-aventura');
        document.body.classList.add(`modo-${modo}`);
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const botonesModo = document.querySelectorAll('[data-accion="cambiar-modo"]');
        botonesModo.forEach(boton => {
            const modoBoton = boton.getAttribute('data-modo');
            const esActivo = modoBoton === modo;
            boton.disabled = esActivo;
            boton.classList.toggle('activo', esActivo);
            boton.setAttribute('aria-pressed', esActivo.toString());
            const textoAccesible = boton.querySelector('.sr-only');
            if (textoAccesible) {
                textoAccesible.textContent = esActivo ? `Modo ${modo} activo` : `Cambiar a modo ${modoBoton}`;
            }
        });
        
        const titulo = document.querySelector('h1, .titulo-mapa');
        if (titulo) {
            titulo.textContent = `Mapa - Modo ${modo.charAt(0).toUpperCase() + modo.slice(1)}`;
            titulo.setAttribute('aria-live', 'polite');
        }
    } catch (error) {
        console.error(`[MAPA] Error al actualizar la interfaz para el modo ${modo}:`, error);
    }
}

function limpiarRecursos() {
    console.log('[MAPA] Limpiando recursos del mapa...');
    if (mapa) {
        mapa.remove();
        mapa = null;
    }
    if (marcadorActual) {
        marcadorActual.remove();
        marcadorActual = null;
    }
    // Limpiar referencias a marcadores y capas
    marcadoresParadas = {};
    rutasTramos = [];
    console.log('[MAPA] Recursos del mapa limpiados');
}

function actualizarMarcadorParada(paradaId, datosNuevos) {
    if (!marcadoresParadas.has(paradaId)) {
        console.warn(`[MAPA] Se intentó actualizar un marcador inexistente: ${paradaId}`);
        return;
    }

    const marcador = marcadoresParadas.get(paradaId);
    console.log(`[MAPA] Marcador para ${paradaId} actualizado con:`, datosNuevos);
    if (datosNuevos.visitada) {
        // Suponiendo que crearIconoParada existe
        // marcador.setIcon(crearIconoParada({ visitada: true }));
    }
}

async function inicializar() {
    try {
        console.log(`[${CONFIG.IFRAME_ID}] Inicializando módulo de mapa...`);
        
        await inicializarMensajeria({
            iframeId: CONFIG.IFRAME_ID,
            debug: CONFIG.DEBUG,
            logLevel: CONFIG.LOG_LEVEL
        });
        
        registrarManejadoresMensajes();
        inicializarMapa();
        
        console.log(`[${CONFIG.IFRAME_ID}] Módulo de mapa inicializado correctamente`);
    } catch (error) {
        console.error(`[${CONFIG.IFRAME_ID}] Error al inicializar el módulo de mapa:`, error);
        await notificarError('inicializacion_modulo_mapa', error);
    }
}

document.addEventListener('DOMContentLoaded', inicializar);

window.addEventListener('beforeunload', () => {
    limpiarRecursos();
});

// Función para actualizar el punto actual en el mapa
function actualizarPuntoActual(coordenadas, opciones = {}) {
    try {
        if (!mapa) {
            console.warn('[MAPA] No se puede actualizar el punto: el mapa no está inicializado');
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
        console.error('[MAPA] Error al actualizar el punto actual:', error);
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
