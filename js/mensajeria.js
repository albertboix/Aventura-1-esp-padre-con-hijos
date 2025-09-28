/**
 * Módulo de mensajería para comunicación entre iframes.
 * @module Mensajeria
 * @version 2.6.0
 */

// Importar dependencias
import { TIPOS_MENSAJE } from './constants.js';
import { configurarUtils, crearObjetoError, generarIdUnico } from './utils.js';
import logger from './logger.js';

// Lista de tipos de mensajes válidos - Actualizada para incluir todos los tipos definidos en constants.js
const TIPOS_MENSAJE_VALIDOS = [
    // SISTEMA
    'SISTEMA.INICIALIZACION',
    'SISTEMA.INICIALIZACION_COMPLETADA',
    'SISTEMA.ESTADO',
    'SISTEMA.ERROR',
    'SISTEMA.CAMBIO_MODO',
    'SISTEMA.CONFIRMACION',
    'SISTEMA.COMPONENTE_LISTO',
    'SISTEMA.PING',
    'SISTEMA.PONG',
    'SISTEMA.LISTO',
    'SISTEMA.COMPONENTE_INICIALIZADO',
    'SISTEMA.INICIALIZACION_FINALIZADA',
    
    // CONTROL
    'CONTROL.HABILITAR',
    'CONTROL.DESHABILITAR',
    'CONTROL.GPS',
    'CONTROL.CAMBIAR_MODO',
    
    // NAVEGACION
    'NAVEGACION.CAMBIO_PARADA',
    'NAVEGACION.SOLICITAR_DESTINO',
    'NAVEGACION.ESTABLECER_DESTINO',
    'NAVEGACION.ACTUALIZAR_POSICION',
    'NAVEGACION.SOLICITAR_ESTADO_MAPA',
    'NAVEGACION.ESTADO_MAPA',
    
    // AUDIO
    'AUDIO.REPRODUCIR',
    'AUDIO.PAUSAR',
    'AUDIO.FIN_REPRODUCCION',
    'AUDIO.FINALIZADO',
    
    // RETO
    'RETO.MOSTRAR',
    'RETO.OCULTAR',
    'RETO.COMPLETADO',
    
    // DATOS
    'DATOS.SOLICITAR_PARADAS',
    'DATOS.SOLICITAR_PARADA',
    'DATOS.RESPUESTA_PARADAS',
    'DATOS.RESPUESTA_PARADA',
    
    // UI
    'UI.MODAL',
    
    // MEDIOS
    'MEDIOS.EVENTO',
    'MEDIOS.MOSTRAR',
    'MEDIOS.OCULTAR'
];

// Función auxiliar para validar el formato del tipo de mensaje
const validarFormatoTipoMensaje = (tipo) => {
    if (typeof tipo !== 'string') {
        return { valido: false, error: 'El tipo de mensaje debe ser una cadena' };
    }
    
    const tipoLimpio = tipo.trim();
    if (tipoLimpio === '') {
        return { valido: false, error: 'El tipo de mensaje no puede estar vacío' };
    }
    
    // Verificar el formato: DEBERIA.SER_ASI
    if (!/^[A-Z0-9_]+(\.[A-Z0-9_]+)*$/.test(tipoLimpio)) {
        return { 
            valido: false, 
            error: `Formato de tipo de mensaje inválido: '${tipo}'. Debe ser en formato 'MODULO.ACCION'` 
        };
    }
    
    return { valido: true };
};

// Estado interno de la mensajería
const estado = {
  iframeId: null,
  logLevel: 1,
  debug: false,
  manejadores: new Map(),
  iframes: [],
  inicializado: false,
  inicializando: false,
  reintentos: { 
    maximos: 3, 
    tiempoEspera: 1000, 
    factor: 2 
  },
  // Cache de instancias para evitar duplicados
  instancias: new Map(),
  // Problema #10: Agregar registro de mensajes procesados para evitar duplicados
  mensajesProcesados: new Set()
};

// Limpiar mensajes procesados periódicamente para evitar crecimiento excesivo
// Problema #10: Implementar limpieza de mensajes procesados
setInterval(() => {
  // Mantener solo los últimos 100 mensajes
  if (estado.mensajesProcesados.size > 100) {
    const mensajesArray = Array.from(estado.mensajesProcesados);
    // Eliminar los mensajes más antiguos
    const mensajesAEliminar = mensajesArray.slice(0, mensajesArray.length - 100);
    mensajesAEliminar.forEach(id => estado.mensajesProcesados.delete(id));
  }
}, 60000); // Cada minuto

// Configuración por defecto
const CONFIG_DEFAULT = {
  iframeId: 'unknown',
  logLevel: 1,  // INFO por defecto
  debug: false,
  reintentos: {
    maximos: 3,
    tiempoEspera: 1000,
    factor: 2
  }
};

// Estado de inicialización
let isLoggerInitialized = true; // Set to true since we're importing logger directly

// Problema #8: Implementar limpieza periódica de instancias no utilizadas
setInterval(() => {
  // Eliminar instancias que no se han usado en los últimos 30 minutos
  const tiempoLimite = Date.now() - 30 * 60 * 1000;
  estado.instancias.forEach((instancia, id) => {
    if (instancia.ultimoUso && instancia.ultimoUso < tiempoLimite) {
      estado.instancias.delete(id);
      logger.debug(`[Mensajeria] Instancia eliminada por inactividad: ${id}`);
    }
  });
}, 15 * 60 * 1000); // Cada 15 minutos

/**
 * Obtiene o crea una instancia de mensajería
 * @param {Object} config - Configuración de la instancia
 * @returns {Object} Instancia de mensajería
 */
function obtenerInstancia(config = {}) {
  const id = config.iframeId || 'default';
  
  // Si ya existe una instancia para este ID, devolverla
  if (estado.instancias.has(id)) {
    const instancia = estado.instancias.get(id);
    // Problema #8: Actualizar timestamp de último uso
    instancia.ultimoUso = Date.now();
    return instancia;
  }
  
  // Crear nueva instancia
  const instancia = {
    id,
    config: { ...CONFIG_DEFAULT, ...config },
    manejadores: new Map(),
    inicializado: false,
    inicializando: false,
    // Problema #8: Agregar timestamp de creación y último uso
    creado: Date.now(),
    ultimoUso: Date.now()
  };
  
  estado.instancias.set(id, instancia);
  return instancia;
}

/**
 * Verifica si el sistema de mensajería está inicializado
 * @param {boolean} throwError - Si es true, lanza un error si no está inicializado
 * @returns {boolean} - True si está inicializado
 */
// Problema #9: Agregar función para verificar estado de inicialización
function verificarInicializado(throwError = false) {
  if (!estado.inicializado) {
    if (throwError) {
      throw new Error('El sistema de mensajería no está inicializado');
    }
    return false;
  }
  return true;
}

/**
 * Inicializa el sistema de mensajería.
 * @param {Object} config - Configuración de mensajería
 * @returns {Promise<Object>} Instancia de mensajería inicializada
 */
// Función interna de inicialización
async function _inicializarMensajeria(config = {}) {
  // Inicializar logger si es necesario
  if (!isLoggerInitialized && typeof window !== 'undefined') {
    try {
      const loggerModule = await import('./logger.js');
      logger = loggerModule.default || loggerModule;
      isLoggerInitialized = true;
      logger.debug('[Mensajeria] Logger inicializado');
    } catch (error) {
      console.warn('No se pudo inicializar el logger:', error);
    }
  }
  
  const instancia = obtenerInstancia(config);
  
  // Si ya está inicializado o en proceso de inicialización
  if (instancia.inicializado) {
    logger.info(`[Mensajeria] Ya inicializado para iframe: ${instancia.id}`);
    return instancia;
  }
  
  if (instancia.inicializando) {
    logger.warn(`[Mensajeria] Inicialización ya en curso para iframe: ${instancia.id}`);
    return new Promise(resolve => {
      const checkInitialized = setInterval(() => {
        if (instancia.inicializado) {
          clearInterval(checkInitialized);
          resolve(instancia);
        }
      }, 100);
    });
  }
  
  // Marcar como inicializando
  instancia.inicializando = true;
  
  try {
    // Configurar estado global
    estado.iframeId = instancia.id;
    estado.logLevel = instancia.config.logLevel;
    estado.debug = instancia.config.debug;
    estado.iframes = instancia.config.iframes || [];
    estado.reintentos = { ...estado.reintentos, ...(instancia.config.reintentos || {}) };
    
    // Configurar utilidades
    configurarUtils({ 
      iframeId: instancia.id, 
      logLevel: instancia.config.logLevel, 
      debug: instancia.config.debug 
    });
    
    // Configurar logger
    if (logger.configure) {
      logger.configure({
        iframeId: instancia.id,
        logLevel: instancia.config.logLevel,
        debug: instancia.config.debug
      });
    }
    
    // Registrar manejador de mensajes una sola vez
    if (!estado.inicializado) {
      window.addEventListener('message', recibirMensaje, false);
      estado.inicializado = true;
    }
    
    // Marcar como inicializado
    instancia.inicializado = true;
    logger.info(`[Mensajeria] Inicializado para iframe: ${instancia.id}`);
    
    return instancia;
  } catch (error) {
    instancia.inicializando = false;
    logger.error(`[Mensajeria] Error al inicializar:`, error);
    throw error;
  }
}

/**
 * Registra un controlador para un tipo de mensaje.
 * @param {string} tipo - Tipo de mensaje.
 * @param {Function} manejador - Función manejadora.
 */
// Función interna para registrar controladores
function _registrarControlador(tipo, manejador) {
  // Problema #4: Verificar que el manejador sea una función válida
  if (typeof manejador !== 'function') {
    logger.error(`[Mensajeria] Intento de registrar manejador inválido para tipo: ${tipo}`);
    throw new Error(`Manejador inválido para tipo: ${tipo}`);
  }

  estado.manejadores.set(tipo, manejador);
  logger.debug(`[Mensajeria] Controlador registrado para tipo: ${tipo}`);
}

/**
 * Envía un mensaje a un destino (iframe o 'padre').
 * @param {string} destino - ID del iframe destino o 'padre'/'todos'.
 * @param {string} tipo - Tipo de mensaje.
 * @param {Object} datos - Datos del mensaje.
 * @returns {Promise<Object>|undefined}
 */
// Función interna para enviar mensajes
/**
 * Envía un mensaje a un destino específico
 * @param {string} destino - ID del iframe destino o 'padre'/'todos'.
 * @param {string} tipo - Tipo de mensaje (debe estar en TIPOS_MENSAJE_VALIDOS).
 * @param {Object} [datos={}] - Datos adicionales del mensaje.
 * @returns {Promise<Object|undefined>} - Promesa que se resuelve con la respuesta o undefined en caso de error.
 * @throws {Error} Si los parámetros no son válidos.
 */
async function _enviarMensaje(destino, tipo, datos = {}) {
    // Validar parámetros de entrada
    if (typeof destino !== 'string' || destino.trim() === '') {
        const error = new Error('El parámetro "destino" es requerido y debe ser una cadena no vacía');
        logger.error('[Mensajeria] Error en _enviarMensaje:', error.message, { destino, tipo });
        throw error;
    }
    
    if (typeof tipo !== 'string' || tipo.trim() === '') {
        const error = new Error('El parámetro "tipo" es requerido y debe ser una cadena no vacía');
        logger.error('[Mensajeria] Error en _enviarMensaje:', error.message, { destino, tipo });
        throw error;
    }
    
    // Validar tipo de mensaje contra la lista de tipos válidos
    if (!TIPOS_MENSAJE_VALIDOS.includes(tipo)) {
        console.warn(`⚠️ Advertencia: El tipo de mensaje '${tipo}' no está en la lista de tipos válidos`);
    }
    
    // Problema #9: Validar si estamos inicializados usando la nueva función
    if (!verificarInicializado()) {
        logger.warn('[Mensajeria] Intentando enviar mensaje sin inicializar');
        await inicializarMensajeria();
    }
    
    // Generar ID único para este mensaje con mayor entropía
    const mensajeId = generarIdUnico(tipo.split('.')[0].toLowerCase());
    
    const mensaje = {
        origen: window.IFRAME_ID || 'padre', // Añadir origen al mensaje
        destino,
        tipo,
        datos: {
            ...datos,
            mensajeId // Incluir ID en cada mensaje para facilitar rastreo
        },
        timestamp: Date.now(),
        version: '2.0',
        // Nuevo: hash para verificar contenido
        contentHash: generarHashContenido(tipo, datos)
    };
    
    // Si el mensaje requiere confirmación, usamos un enfoque diferente
    if (datos.requireConfirmation) {
        return await enviarMensajeConConfirmacion(destino, tipo, datos);
    }
    
    try {
        // Validar mensaje
        if (!validarMensaje(mensaje)) {
            throw new Error('Mensaje no válido');
        }
        
        // Enviar mensaje
        if (destino === 'padre') {
            // Enviar al padre
            window.parent.postMessage(mensaje, '*');
        } else if (destino === 'todos') {
            // Enviar a todos los iframes
            estado.iframes.forEach(iframe => {
                const frame = document.getElementById(iframe.id);
                if (frame && frame.contentWindow) {
                    frame.contentWindow.postMessage(mensaje, '*');
                }
            });
        } else {
            // Enviar a un iframe específico
            const frame = document.getElementById(destino);
            if (frame && frame.contentWindow) {
                frame.contentWindow.postMessage(mensaje, '*');
            } else {
                throw new Error(`Destino no encontrado: ${destino}`);
            }
        }
        
        // Problema #6: Usar una función segura para logs de objetos grandes/complejos
        logMensajeSeguro(`[Mensajeria] Mensaje enviado a ${destino}:`, mensaje);
        return mensaje;
    } catch (error) {
        logger.error(`[Mensajeria] Error al enviar mensaje a ${destino}:`, error);
        throw error;
    }
}

/**
 * Genera un hash simple del contenido para comparaciones rápidas
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @returns {string} Hash del contenido
 */
function generarHashContenido(tipo, datos) {
    try {
        // Extraer solo propiedades relevantes según el tipo de mensaje para el hash
        let contenidoRelevante = {};
        
        // Para mensajes de navegación, las propiedades relevantes dependen del subtipo
        if (tipo.startsWith('NAVEGACION.')) {
            if (datos.punto) {
                // Para cambios de parada, el punto es lo relevante
                contenidoRelevante = { 
                    punto: datos.punto,
                    timestamp: Math.floor(Date.now() / 10000) // Agrupar por bloques de 10s
                };
            } else if (datos.coordenadas) {
                // Para actualizaciones de posición, redondear coordenadas para evitar microcambios
                const { lat, lng } = datos.coordenadas;
                contenidoRelevante = {
                    lat: lat ? parseFloat(lat.toFixed(5)) : null,
                    lng: lng ? parseFloat(lng.toFixed(5)) : null,
                    timestamp: Math.floor(Date.now() / 10000) // Agrupar por bloques de 10s
                };
            }
        } else {
            // Para otros tipos, usar todo el objeto excepto campos que cambian constantemente
            contenidoRelevante = { ...datos };
            delete contenidoRelevante.timestamp; // Ignorar timestamp para comparación
            delete contenidoRelevante.mensajeId; // Ignorar mensajeId para comparación
        }
        
        // Convertir a string para hash
        const str = JSON.stringify(contenidoRelevante);
        
        // Crear un hash simple para comparación rápida
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0; // Convertir a entero de 32 bits
        }
        
        return hash.toString(36);
    } catch (e) {
        // En caso de error, devolver timestamp como fallback
        return Date.now().toString(36);
    }
}

/**
 * Registra un mensaje en el log de manera segura, evitando problemas con referencias circulares
 * @param {string} texto - Texto descriptivo
 * @param {Object} objeto - Objeto a registrar
 */
// Problema #6: Implementar función para logging seguro de objetos
function logMensajeSeguro(texto, objeto) {
    try {
        // Intentar usar el logger directamente para objetos simples
        logger.debug(texto, objeto);
    } catch (error) {
        // Si hay error (posible referencia circular), usar un enfoque más seguro
        try {
            const objetoSimplificado = JSON.parse(JSON.stringify(objeto));
            logger.debug(texto, objetoSimplificado);
        } catch (e) {
            // Si también falla, registrar solo información básica
            logger.debug(`${texto} [Objeto complejo - no serializable]`, {
                tipo: objeto?.tipo,
                origen: objeto?.origen,
                destino: objeto?.destino,
                timestamp: objeto?.timestamp
            });
        }
    }
}

// Función para filtrar mensajes externos (como Grammarly) que no siguen nuestro formato
function esMensajeExterno(msg) {
  // Detectar mensajes de Grammarly que contienen esta propiedad
  if (msg && msg.__grammarly) {
    console.debug('[Mensajería] Ignorando mensaje de Grammarly');
    return true;
  }
  
  // Otras extensiones o herramientas externas que pueden enviar mensajes
  if (msg && (
    msg.hasOwnProperty('_grammarly') || 
    msg.hasOwnProperty('grammarly_report') ||
    msg.hasOwnProperty('ext_id') ||
    msg.hasOwnProperty('extension_id')
  )) {
    console.debug('[Mensajería] Ignorando mensaje de extensión externa');
    return true;
  }
  
  return false;
}

// Función para validar el formato del mensaje
function validarMensaje(msg, source) {
  // Filtrar mensajes de extensiones externas como Grammarly
  if (esMensajeExterno(msg)) {
    return false;
  }
  
  // Verificar que sea un objeto
  if (!msg || typeof msg !== 'object') {
    logger.warn(`[${source || 'desconocido'}] [Mensajeria] Mensaje inválido: no es un objeto`, msg);
    return false;
  }
  
  // Verificar campos requeridos
  const requiredFields = ['tipo', 'datos'];
  const missingFields = requiredFields.filter(field => !msg.hasOwnProperty(field));
  
  if (missingFields.length > 0) {
    logger.warn(`[${source || 'desconocido'}] [Mensajeria] Mensaje inválido: faltan campos requeridos`, msg);
    return false;
  }
  
  return true;
}

/**
 * Recibe y procesa mensajes entrantes.
 * @param {MessageEvent} event - Evento de mensaje.
 */
function recibirMensaje(event) {
    const mensaje = event.data;
    
    try {
        // Validar mensaje
        if (!validarMensaje(mensaje)) {
            return;
        }
        
        // Verificar si el mensaje es para este iframe
        if (mensaje.destino !== 'todos' && 
            mensaje.destino !== estado.iframeId && 
            mensaje.destino !== 'padre') {
            return;
        }
        
        // Problema #10: Verificar si el mensaje ya se ha procesado (evitar duplicados)
        if (mensaje.datos?.mensajeId || mensaje.contentHash) {
            const mensajeId = mensaje.datos?.mensajeId;
            const contentHash = mensaje.contentHash;
            
            // Control de duplicados por ID
            if (mensajeId && estado.mensajesProcesados.has(mensajeId)) {
                logger.debug(`[Mensajeria] Ignorando mensaje duplicado por ID: ${mensajeId}`);
                return;
            }
            
            // Mejorado: Control de duplicados por contenido
            if (contentHash) {
                // Solo para mensajes de navegación, que son los más propensos a duplicarse
                if (mensaje.tipo.startsWith('NAVEGACION.') && 
                    estado.hashesContenidoProcesados && 
                    estado.hashesContenidoProcesados.has(contentHash)) {
                    logger.debug(`[Mensajeria] Ignorando mensaje duplicado por contenido: ${contentHash}`);
                    return;
                }
                
                // Registrar hash para futuras comparaciones
                if (!estado.hashesContenidoProcesados) {
                    estado.hashesContenidoProcesados = new Set();
                }
                estado.hashesContenidoProcesados.add(contentHash);
                
                // Limpieza de hashes antiguos
                if (estado.hashesContenidoProcesados.size > 100) {
                    const hashesArray = Array.from(estado.hashesContenidoProcesados);
                    // Eliminar los hashes más antiguos
                    const hashesAEliminar = hashesArray.slice(0, hashesArray.length - 100);
                    hashesAEliminar.forEach(hash => estado.hashesContenidoProcesados.delete(hash));
                }
            }
            
            // Registrar ID procesado
            if (mensajeId) {
                estado.mensajesProcesados.add(mensajeId);
            }
        }
        
        logger.debug(`[Mensajeria] Mensaje recibido de ${mensaje.origen}:`, mensaje);
        
        // Manejar ping directamente para optimizar tiempo de respuesta
        if (mensaje.tipo === 'SISTEMA.PING') {
            const respuesta = manejarPing(mensaje);
            enviarMensaje(mensaje.origen, 'SISTEMA.PONG', respuesta).catch(error => {
                // Problema #3: Estandarizar el nombre de la variable de error
                logger.error('Error al enviar respuesta de ping:', error);
            });
            return;
        }
        
        // Buscar manejador para este tipo de mensaje
        const manejador = estado.manejadores.get(mensaje.tipo);
        if (manejador) {
            // Ejecutar manejador y enviar respuesta al origen si hay datos
            try {
                const resultado = manejador(mensaje);
                // Si el manejador devuelve un valor (no undefined), enviar respuesta al origen
                if (resultado !== undefined && mensaje.datos?.mensajeId) {
                    // Solo enviar respuesta si hay un ID de mensaje para referenciar
                    enviarMensaje(mensaje.origen, TIPOS_MENSAJE.SISTEMA.CONFIRMACION, {
                        mensajeOriginalId: mensaje.datos.mensajeId,
                        tipoOriginal: mensaje.tipo,
                        resultado,
                        timestamp: Date.now()
                    }).catch(error => {
                        // Problema #3: Estandarizar el nombre de la variable de error
                        logger.error('Error al enviar confirmación de mensaje:', error);
                    });
                }
            } catch (error) {
                // Problema #3: Estandarizar el nombre de la variable de error
                logger.error(`[Mensajeria] Error en manejador para ${mensaje.tipo}:`, error);
                // Enviar error al origen si hay un ID de mensaje
                if (mensaje.datos?.mensajeId) {
                    enviarMensaje(mensaje.origen, TIPOS_MENSAJE.SISTEMA.ERROR, {
                        mensajeOriginalId: mensaje.datos.mensajeId,
                        tipoOriginal: mensaje.tipo,
                        error: error.message,
                        stack: error.stack,
                        timestamp: Date.now()
                    }).catch(error => {
                        // Problema #3: Estandarizar el nombre de la variable de error
                        logger.error('Error al enviar notificación de error:', error);
                    });
                }
            }
        } else {
            logger.warn(`[Mensajeria] No hay manejador para el tipo: ${mensaje.tipo}`);
        }
    } catch (error) {
        // Problema #3: Estandarizar el nombre de la variable de error
        logger.error('[Mensajeria] Error al procesar mensaje:', error);
    }
}

/**
 * Limpia los recursos de mensajería.
 */
function limpiarMensajeria() {
  if (estado.inicializado) {
    window.removeEventListener('message', recibirMensaje);
    estado.manejadores.clear();
    estado.iframes = [];
    estado.inicializado = false;
    estado.instancias.clear();
    // Problema #10: Limpiar también los mensajes procesados
    estado.mensajesProcesados.clear();
    logger.debug(`[Mensajeria] Recursos liberados para ${estado.iframeId}`);
  }
}

/**
 * Envía un mensaje y espera confirmación de recepción
 * @param {string} destino - ID del iframe destino o 'padre'/'todos'
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @param {Object} opciones - Opciones adicionales
 * @param {number} opciones.timeout - Timeout en ms para la confirmación (default: 5000)
 * @param {boolean} opciones.silencioso - No lanzar error si no hay confirmación (default: false)
 * @returns {Promise<Object>} - Confirmación recibida
 */
async function enviarMensajeConConfirmacion(destino, tipo, datos = {}, opciones = {}) {
  const timeout = opciones.timeout || 5000;
  const silencioso = opciones.silencioso || false;
  
  // Problema #9: Validar si estamos inicializados
  if (!verificarInicializado()) {
    logger.warn('[Mensajeria] Intentando enviar mensaje con confirmación sin inicializar');
    await inicializarMensajeria();
  }
  
  // Generar un ID único para este mensaje
  const mensajeId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Problema #7: Usar una variable para seguimiento del manejador temporal
  const manejadorKey = `${TIPOS_MENSAJE.SISTEMA.CONFIRMACION}_${mensajeId}`;
  let timeoutId = null;
  
  try {
    // Crear una promesa para esperar la confirmación
    const confirmacionPromise = new Promise((resolve, reject) => {
      // Manejador temporal para la confirmación
      const manejadorConfirmacion = (mensaje) => {
        if (mensaje.datos && mensaje.datos.mensajeOriginalId === mensajeId) {
          // Quitar el manejador temporal y cancelar el timeout
          estado.manejadores.delete(manejadorKey);
          if (timeoutId) clearTimeout(timeoutId);
          resolve(mensaje);
        }
      };
      
      // Registrar el manejador temporal
      estado.manejadores.set(manejadorKey, manejadorConfirmacion);
      
      // Configurar timeout
      timeoutId = setTimeout(() => {
        // Quitar el manejador temporal
        estado.manejadores.delete(manejadorKey);
        
        // Problema #5: Manejar mejor el caso silencioso
        if (silencioso) {
          // Resolver con un objeto que indica timeout, pero no es error
          resolve({
            timeout: true,
            mensaje: `Timeout esperando confirmación para mensaje ${tipo} a ${destino}`,
            timestamp: Date.now()
          });
        } else {
          reject(new Error(`Timeout esperando confirmación para mensaje ${tipo} a ${destino}`));
        }
      }, timeout);
    });
    
    // Enviar el mensaje con el ID único
    await _enviarMensaje(destino, tipo, {
      ...datos,
      mensajeId
    });
    
    // Esperar confirmación
    return await confirmacionPromise;
    
  } catch (error) {
    // Problema #7: Limpiar manejador y timeout en caso de error
    estado.manejadores.delete(manejadorKey);
    if (timeoutId) clearTimeout(timeoutId);
    
    logger.error(`Error en enviarMensajeConConfirmacion (${tipo} a ${destino}):`, error);
    
    // Problema #5: Manejar mejor el caso silencioso
    if (silencioso) {
      return {
        error: true,
        mensaje: error.message,
        timestamp: Date.now()
      };
    }
    
    // Problema #2: Eliminar código inalcanzable
    throw error;
  }
}

/**
 * Envía una confirmación de recepción de mensaje
 * @param {Object} mensajeOriginal - Mensaje original recibido
 * @param {Object} datos - Datos adicionales para la confirmación
 * @returns {Promise<Object>} - Resultado del envío
 */
async function enviarConfirmacion(mensajeOriginal, datos = {}) {
  try {
    // Problema #9: Validar si estamos inicializados
    if (!verificarInicializado()) {
      logger.warn('[Mensajeria] Intentando enviar confirmación sin inicializar');
      await inicializarMensajeria();
    }
    
    if (!mensajeOriginal || !mensajeOriginal.origen) {
      throw new Error('Mensaje original inválido');
    }
    
    // Usar TIPOS_MENSAJE importado
    return await _enviarMensaje(
      mensajeOriginal.origen,
      TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
      {
        ...datos,
        mensajeOriginalId: mensajeOriginal.datos?.mensajeId,
        tipoOriginal: mensajeOriginal.tipo,
        timestampOriginal: mensajeOriginal.timestamp,
        timestampConfirmacion: Date.now()
      }
    );
  } catch (error) {
    // Problema #3: Estandarizar el nombre de la variable de error
    logger.error('Error al enviar confirmación:', error);
    throw error;
  }
}

/**
 * Envía una notificación de error como respuesta a un mensaje
 * @param {Object} mensajeOriginal - Mensaje original recibido
 * @param {Object} error - Información del error
 * @returns {Promise<Object>} - Resultado del envío
 */
async function enviarError(mensajeOriginal, error = {}) {
  try {
    // Problema #9: Validar si estamos inicializados
    if (!verificarInicializado()) {
      logger.warn('[Mensajeria] Intentando enviar error sin inicializar');
      await inicializarMensajeria();
    }
    
    if (!mensajeOriginal || !mensajeOriginal.origen) {
      throw new Error('Mensaje original inválido');
    }
    
    return await _enviarMensaje(
      mensajeOriginal.origen,
      TIPOS_MENSAJE.SISTEMA.ERROR,
      {
        mensajeOriginalId: mensajeOriginal.datos?.mensajeId,
        tipoOriginal: mensajeOriginal.tipo,
        timestampOriginal: mensajeOriginal.timestamp,
        timestampError: Date.now(),
        error: {
          mensaje: error.mensaje || error.message || 'Error desconocido',
          codigo: error.codigo || 'ERROR_DESCONOCIDO',
          detalles: error.detalles || error.stack || null
        }
      }
    );
  } catch (error) {
    // Problema #3: Estandarizar el nombre de la variable de error
    logger.error('Error al enviar notificación de error:', error);
    throw error;
  }
}

/**
 * Función para manejar mensajes de ping (diagnóstico de comunicación)
 * @param {Object} mensaje - Mensaje recibido
 * @returns {Object} Respuesta con timestamp
 */
// Problema #1: Corregir declaración del comentario JSDoc
function manejarPing(mensaje) {
    logger.debug(`[Mensajeria] Ping recibido de ${mensaje.origen}`);
    return {
        exito: true,
        mensaje: `Pong desde ${estado.iframeId}`,
        timestamp: Date.now(),
        origen: estado.iframeId,
        destino: mensaje.origen,
        timestampOriginal: mensaje.datos?.timestamp
    };
}

// Problema #4: Registrar manejador de ping solo si la función existe
if (typeof manejarPing === 'function') {
    _registrarControlador('SISTEMA.PING', manejarPing);
} else {
    logger.warn('[Mensajeria] No se pudo registrar manejador de ping: función no definida');
}

// Inicializar el objeto controladores
let controladores = {};

// Registrar controlador para TIPOS_MENSAJE.CONTROL.CAMBIAR_MODO
registrarControlador(TIPOS_MENSAJE.CONTROL.CAMBIAR_MODO, (mensaje) => {
    const { modo } = mensaje.datos || {};
    if (!modo) {
        console.warn('⚠️ No se especificó un modo en el mensaje TIPOS_MENSAJE.CONTROL.CAMBIAR_MODO.');
        return;
    }

    console.log(`✅ Modo recibido: ${modo}`);
    // Aquí puedes agregar la lógica para cambiar el modo
});

// Función para cambiar el modo en el iframe hijo5-casa
function cambiarModoEnHijo5Casa(modo) {
    // Implementa la lógica específica para cambiar el modo en el iframe
    console.log(`Cambiando el modo en hijo5-casa a: ${modo}`);
    // Por ejemplo, actualizar el DOM o realizar alguna acción específica
}

// Exportar la API pública
export async function inicializarMensajeria(config) {
    return await _inicializarMensajeria(config);
}

export function registrarControlador(tipoMensaje, controlador) {
    // Validar que se hayan proporcionado los parámetros necesarios
    if (arguments.length < 2) {
        const errorMsg = '❌ Error: Se requieren dos argumentos (tipoMensaje, controlador)';
        console.error(errorMsg);
        logger.error('[Mensajeria] ' + errorMsg);
        return false;
    }
    
    // Validar que el tipo de mensaje no sea undefined o null
    if (tipoMensaje === undefined || tipoMensaje === null) {
        const errorMsg = '❌ Error: El tipo de mensaje no puede ser undefined o null';
        console.error(errorMsg);
        logger.error('[Mensajeria] ' + errorMsg, { tipoMensaje, controlador });
        return false;
    }
    
    try {
        // Validar que el tipo de mensaje sea una cadena no vacía
        const validacion = validarFormatoTipoMensaje(tipoMensaje);
        if (!validacion.valido) {
            const errorMsg = `❌ Error al validar tipo de mensaje: ${validacion.error}`;
            console.error(errorMsg, { tipoMensaje, controlador });
            logger.error('[Mensajeria] ' + errorMsg, { tipoMensaje, controlador });
            throw new Error(validacion.error);
        }
        
        // Validar que el controlador sea una función
        if (typeof controlador !== 'function') {
            const errorMsg = '❌ Error: El controlador debe ser una función';
            console.error(errorMsg, { tipoMensaje, controlador });
            logger.error('[Mensajeria] ' + errorMsg, { tipoMensaje, controlador });
            throw new Error('El controlador debe ser una función');
        }
        
        // Asegurarse de que el tipo de mensaje esté en mayúsculas
        const tipoNormalizado = tipoMensaje.trim().toUpperCase();
        
        // Verificar si el tipo de mensaje está en la lista de válidos
        if (!TIPOS_MENSAJE_VALIDOS.includes(tipoNormalizado)) {
            const warnMsg = `⚠️ Advertencia: El tipo de mensaje '${tipoNormalizado}' no está en la lista de tipos válidos`;
            console.warn(warnMsg);
            logger.warn('[Mensajeria] ' + warnMsg, { 
                tipoMensaje, 
                tipoNormalizado, 
                tiposValidos: TIPOS_MENSAJE_VALIDOS 
            });
        }
        
        // Inicializar el array de controladores para este tipo de mensaje si no existe
        if (!controladores[tipoNormalizado]) {
            controladores[tipoNormalizado] = [];
        }
        
        // Evitar duplicados
        const existeControlador = controladores[tipoNormalizado].some(
            c => c.toString() === controlador.toString()
        );
        
        if (!existeControlador) {
            controladores[tipoNormalizado].push(controlador);
            const successMsg = `✅ Controlador registrado para tipoMensaje: ${tipoNormalizado}`;
            console.log(successMsg);
            logger.debug('[Mensajeria] ' + successMsg, { tipoMensaje, tipoNormalizado });
        } else {
            const infoMsg = `ℹ️ Controlador ya registrado para tipoMensaje: ${tipoNormalizado}`;
            console.log(infoMsg);
            logger.debug('[Mensajeria] ' + infoMsg, { tipoMensaje, tipoNormalizado });
        }
        
        return true;
    } catch (error) {
        const errorMsg = `❌ Error al registrar controlador para '${tipoMensaje}': ${error.message}`;
        console.error(errorMsg, error);
        logger.error('[Mensajeria] ' + errorMsg, { 
            tipoMensaje, 
            error: error.message, 
            stack: error.stack 
        });
        return false;
    }
}

export async function enviarMensaje(destino, tipo, datos = {}) {
    return await _enviarMensaje(destino, tipo, datos);
}

// Problema #11: Evitar re-exportar TIPOS_MENSAJE directamente para evitar dependencia circular
// En lugar de re-exportar, exportamos solo las constantes que necesitamos
export const TIPOS_MENSAJE_BASICOS = {
    SISTEMA: {
        CONFIRMACION: 'SISTEMA.CONFIRMACION',
        ERROR: 'SISTEMA.ERROR',
        PING: 'SISTEMA.PING',
        PONG: 'SISTEMA.PONG'
    }
};

// Exportar las nuevas funciones
export {
    enviarMensajeConConfirmacion,
    enviarConfirmacion,
    enviarError,
    verificarInicializado,
    limpiarMensajeria
};

export default {
    inicializarMensajeria,
    registrarControlador,
    enviarMensaje,
    enviarMensajeConConfirmacion,
    enviarConfirmacion,
    enviarError,
    verificarInicializado,
    limpiarMensajeria
};
