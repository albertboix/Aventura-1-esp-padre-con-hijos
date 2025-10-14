/**
 * Módulo de mensajería para comunicación entre iframes.
 * Implementa un sistema de mensajería estandarizado para la comunicación entre los
 * componentes de la aplicación Valencia Tour con formato CATEGORIA.ACCION.
 * 
 * @module Mensajeria
 * @version 3.0.0
 * @description
 * Este módulo gestiona toda la comunicación entre componentes de la aplicación,
 * utilizando un sistema de mensajes estandarizados con formato CATEGORIA.ACCION.
 * Incluye un sistema robusto de confirmación (ACK/NACK) para mensajes críticos
 * con reintentos, backoff exponencial y manejo detallado de errores.
 */

// Importamos lo necesario
import logger, { configurarEnvioMensajes } from './logger.js';
import utils, { generarHashContenido, configurarUtils, crearObjetoError, generarIdUnico } from './utils.js';
import { TIPOS_MENSAJE, MENSAJES_CRITICOS } from './constants.js';
import { CONFIG } from './config.js';

// Alias para mejor legibilidad en el código
const configGlobal = CONFIG;

// Lista de tipos de mensajes válidos - Usando las constantes estandarizadas
const TIPOS_MENSAJE_VALIDOS = [
    // SISTEMA
    ...Object.values(TIPOS_MENSAJE.SISTEMA),
    
    // CONTROL
    ...Object.values(TIPOS_MENSAJE.CONTROL),
    
    // DATOS
    ...Object.values(TIPOS_MENSAJE.DATOS),
    
    // NAVEGACION
    ...Object.values(TIPOS_MENSAJE.NAVEGACION),
    
    // AUDIO
    ...Object.values(TIPOS_MENSAJE.AUDIO),
    
    // RETO
    ...Object.values(TIPOS_MENSAJE.RETO),
    
    // UI
    ...Object.values(TIPOS_MENSAJE.UI),
    
    // MEDIOS
    ...Object.values(TIPOS_MENSAJE.MEDIOS),
    TIPOS_MENSAJE.DATOS.PUNTOS,
    TIPOS_MENSAJE.DATOS.PUNTOS_RUTA,
    
    // UI
    TIPOS_MENSAJE.UI.MODAL,
    
    // MEDIOS
    TIPOS_MENSAJE.MEDIOS.EVENTO,
    TIPOS_MENSAJE.MEDIOS.MOSTRAR,
    TIPOS_MENSAJE.MEDIOS.OCULTAR
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

// Definición de códigos de error para mensajería
const ERRORES_MENSAJERIA = {
  // Errores generales de comunicación
  TIMEOUT: 'TIMEOUT',
  TIMEOUT_CONFIRMACION: 'TIMEOUT_CONFIRMACION',
  MAX_REINTENTOS: 'MAX_REINTENTOS',
  
  // Errores relacionados con iframes
  IFRAME_NO_ENCONTRADO: 'IFRAME_NO_ENCONTRADO',
  IFRAME_NO_DISPONIBLE: 'IFRAME_NO_DISPONIBLE',
  IFRAME_ERROR_CARGA: 'IFRAME_ERROR_CARGA',
  DESTINO_NO_DISPONIBLE: 'DESTINO_NO_DISPONIBLE',
  
  // Errores de red y sistema
  RED: 'ERROR_RED',
  NO_INICIALIZADO: 'NO_INICIALIZADO',
  NO_AUTORIZADO: 'NO_AUTORIZADO',
  
  // Errores de respuesta
  NACK_RECIBIDO: 'NACK_RECIBIDO',
  RESPUESTA_INVALIDA: 'RESPUESTA_INVALIDA',
  
  // Errores de validación
  FORMATO_INVALIDO: 'FORMATO_INVALIDO',
  DATOS_INVALIDOS: 'DATOS_INVALIDOS',
  
  // Errores de cola y procesamiento
  ERROR_COLA_LLENA: 'ERROR_COLA_LLENA',
  ERROR_ALMACENAMIENTO: 'ERROR_ALMACENAMIENTO',
  ERROR_ENVIO: 'ERROR_ENVIO',
  
  // Fallback
  DESCONOCIDO: 'ERROR_DESCONOCIDO'
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
  // Cola de mensajes pendientes críticos que requieren reintento persistente
  mensajesPendientes: [],
  procesandoPendientes: false,
  ultimoProcesamiento: null,
  mensajesPendientes: new Map(),
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

// Procesamiento periódico de mensajes pendientes críticos
setInterval(() => {
  if (estado.mensajesPendientes.size > 0) {
    logger.debug(`[Mensajeria] Procesando cola de mensajes pendientes: ${estado.mensajesPendientes.size} mensajes`);
    
    // Obtener hora actual para límite de caducidad (mensajes de hace más de 1 hora)
    const tiempoCaducidad = Date.now() - 60 * 60 * 1000;
    
    // Procesar cada mensaje pendiente
    estado.mensajesPendientes.forEach((mensaje, id) => {
      // Eliminar mensajes caducados
      if (mensaje.timestamp < tiempoCaducidad) {
        estado.mensajesPendientes.delete(id);
        logger.info(`[Mensajeria] Mensaje pendiente ${id} eliminado por caducidad`);
        return;
      }
      
      // Si es momento de reintentar según el backoff exponencial
      if (Date.now() >= mensaje.proximoIntento) {
        const { destino, tipo, datos, opciones } = mensaje;
        
        // Incrementar contador de intentos
        mensaje.intentos += 1;
        
        // Calcular próximo tiempo de reintento con backoff exponencial
        const factorBackoff = opciones.factorBackoff || CONFIG_DEFAULT.reintentos.factor;
        const retrasoBase = opciones.tiempoEspera || CONFIG_DEFAULT.reintentos.tiempoEspera;
        const jitter = 0.75 + (Math.random() * 0.5); // Factor aleatorio entre 0.75 y 1.25
        
        // Calcular retraso con backoff exponencial y jitter
        const retraso = Math.min(
          30 * 60 * 1000, // máximo 30 minutos
          retrasoBase * Math.pow(factorBackoff, mensaje.intentos) * jitter
        );
        
        // Actualizar próximo intento
        mensaje.proximoIntento = Date.now() + retraso;
        
        // Reintentar el envío de forma silenciosa
        enviarMensajeConACK(destino, tipo, datos, { 
          ...opciones, 
          silencioso: true,
          intentoRecuperacion: true
        })
        .then(respuesta => {
          // Si el envío tiene éxito, eliminar de la cola de pendientes
          estado.mensajesPendientes.delete(id);
          logger.info(`[Mensajeria] Mensaje pendiente ${id} entregado exitosamente en el intento ${mensaje.intentos}`);
          
          // Si hay callback de éxito, ejecutarlo
          if (mensaje.onSuccess && typeof mensaje.onSuccess === 'function') {
            try {
              mensaje.onSuccess(respuesta);
            } catch (e) {
              logger.error('[Mensajeria] Error en callback de éxito:', e);
            }
          }
        })
        .catch(() => {
          // Si aún hay reintentos disponibles, se mantiene en la cola
          if (mensaje.intentos >= opciones.reintentosPendientes || mensaje.intentos > 50) {
            estado.mensajesPendientes.delete(id);
            logger.warn(`[Mensajeria] Mensaje pendiente ${id} eliminado después de ${mensaje.intentos} intentos`);
            
            // Si hay callback de error, ejecutarlo
            if (mensaje.onError && typeof mensaje.onError === 'function') {
              try {
                mensaje.onError(new Error(`Mensaje no entregado después de ${mensaje.intentos} intentos`));
              } catch (e) {
                logger.error('[Mensajeria] Error en callback de error:', e);
              }
            }
          }
        });
      }
    });
  }
}, 10000); // Cada 10 segundos

// Usar la configuración centralizada
const CONFIG_DEFAULT = CONFIG.MENSAJERIA;

// Estado de inicialización
let isLoggerInitialized = true; // Set to true since we're importing logger directly

// Problema #8: Implementar limpieza periódica de instancias no utilizadas
setInterval(() => {
  // Eliminar instancias que no se han usado en los últimos 30 minutos
  const tiempoLimite = Date.now() - CONFIG.MENSAJERIA.tiempoInactividad;
  estado.instancias.forEach((instancia, id) => {
    if (instancia.ultimoUso && instancia.ultimoUso < tiempoLimite) {
      estado.instancias.delete(id);
      logger.debug(`[Mensajeria] Instancia eliminada por inactividad: ${id}`);
    }
  });
}, CONFIG.MENSAJERIA.tiempoLimpieza);

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
  // El logger ya está importado estáticamente, no necesitamos inicializarlo dinámicamente
  isLoggerInitialized = true;
  logger.debug('[Mensajeria] Logger inicializado');
  
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
    
    // Configurar la función de envío de mensajes en logger
    configurarEnvioMensajes(enviarMensaje);
    
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
      
      // Cargar mensajes pendientes del almacenamiento local
      try {
        cargarMensajesPendientes();
      } catch (e) {
        logger.warn('[Mensajeria] Error al cargar mensajes pendientes:', e);
      }
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
/**
 * Envía un mensaje a un destino específico siguiendo el formato estándar
 * @param {string} destino - ID del iframe destino o 'padre'/'todos'.
 * @param {string} tipo - Tipo de mensaje (debe estar en formato CATEGORIA.ACCION).
 * @param {Object} [datos={}] - Datos adicionales del mensaje.
 * @returns {Promise<Object|undefined>} - Promesa que se resuelve con la respuesta.
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
    
    // Validar formato del tipo de mensaje (CATEGORIA.ACCION)
    const tipoRegex = /^[A-Z0-9_]+\.[A-Z0-9_]+$/;
    if (!tipoRegex.test(tipo)) {
        const error = new Error(`El tipo de mensaje '${tipo}' no cumple con el formato CATEGORIA.ACCION`);
        logger.error('[Mensajeria] Error en _enviarMensaje:', error.message, { tipo });
        throw error;
    }
    
    // Validar tipo de mensaje contra la lista de tipos válidos
    if (!TIPOS_MENSAJE_VALIDOS.includes(tipo)) {
        logger.warn(`[Mensajeria] El tipo de mensaje '${tipo}' no está en la lista de tipos válidos`);
    }
    
    // Validar si estamos inicializados
    if (!verificarInicializado()) {
        logger.warn('[Mensajeria] Intentando enviar mensaje sin inicializar');
        await inicializarMensajeria();
    }
    
    // Generar ID único para este mensaje
    const mensajeId = generarIdUnico(tipo.split('.')[0].toLowerCase());
    
    // Crear el mensaje en formato estándar v3.0
    const mensaje = {
        origen: window.IFRAME_ID || estado.iframeId || 'padre',
        destino,
        tipo,
        datos: {
            ...datos,
            mensajeId // Incluir ID en cada mensaje para facilitar rastreo
        },
        timestamp: Date.now(),
        version: '3.0', // Actualizado a versión 3.0
        contentHash: generarHashContenido(tipo, datos)
    };
    
    // Si el mensaje requiere confirmación o es un mensaje crítico, usamos enfoque con ACK/NACK
    if (datos.requireConfirmation || MENSAJES_CRITICOS.includes(tipo)) {
        // Usar el nuevo sistema de ACK/NACK para mensajes críticos
        return await enviarMensajeConACK(destino, tipo, datos);
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
 * Determina si un mensaje recibido es externo (por ejemplo, de extensiones como Grammarly)
 * @param {Object} msg - Mensaje recibido
 * @returns {boolean} True si es externo y debe ser ignorado
 */
function esMensajeExterno(msg) {
    // Ignorar mensajes de extensiones conocidas (ejemplo: Grammarly, React DevTools, etc.)
    if (!msg || typeof msg !== 'object') return true;
    // Grammarly
    if (msg.hasOwnProperty('isTrusted') && msg.hasOwnProperty('data') && typeof msg.data === 'string' && msg.data.startsWith('{"event":')) {
        return true;
    }
    // React DevTools
    if (msg.source === 'react-devtools-content-script') {
        return true;
    }
    // Mensajes de postMessage sin los campos esperados
    if (!msg.tipo && !msg.type) return true;
    // Otros casos: puedes añadir más filtros aquí si aparecen más extensiones problemáticas
    return false;
}

/**
 * Valida el formato de un mensaje recibido
 * @param {Object} msg - El mensaje a validar
 * @param {string} source - Origen del mensaje (opcional)
 * @returns {boolean} - True si el mensaje es válido
 */
/**
 * Valida que un mensaje cumpla con el formato estándar
 * @param {Object} msg - Mensaje a validar
 * @param {string} source - Origen de la validación (para logging)
 * @returns {boolean} - True si el mensaje es válido
 */
function validarMensaje(msg, source = 'desconocido') {
    // Verificar que el mensaje es un objeto
    if (!msg || typeof msg !== 'object') {
        logger.warn(`[${source}] [Mensajeria] Mensaje no es un objeto`, { msg });
        return false;
    }
    
    // Filtrar mensajes de extensiones externas como Grammarly
    if (esMensajeExterno(msg)) {
        logger.debug(`[${source}] [Mensajeria] Mensaje externo ignorado`, { type: msg.type });
        return false;
    }
    
    // Verificar campos obligatorios del formato estándar
    const requiredFields = ['tipo', 'origen', 'destino', 'datos', 'timestamp'];
    const missingFields = requiredFields.filter(field => !msg.hasOwnProperty(field));
    
    if (missingFields.length > 0) {
        logger.warn(`[${source}] [Mensajeria] Mensaje inválido: faltan campos requeridos`, { 
            missingFields, 
            msg 
        });
        return false;
    }
    
    // Verificar que el tipo de mensaje sea válido (formato CATEGORIA.ACCION)
    const tipoRegex = /^[A-Z0-9_]+\.[A-Z0-9_]+$/;
    if (!tipoRegex.test(msg.tipo)) {
        logger.warn(`[${source}] [Mensajeria] Formato de tipo de mensaje inválido`, {
            tipo: msg.tipo,
            formatoEsperado: 'CATEGORIA.ACCION'
        });
        return false;
    }
    
    // Verificar que el tipo esté en la lista de tipos válidos
    if (TIPOS_MENSAJE_VALIDOS && !TIPOS_MENSAJE_VALIDOS.includes(msg.tipo)) {
        logger.warn(`[${source}] [Mensajeria] Tipo de mensaje no válido`, { 
            tipo: msg.tipo
        });
        return false;
    }
    
    // Verificar que datos sea un objeto
    if (typeof msg.datos !== 'object' || msg.datos === null) {
        logger.warn(`[${source}] [Mensajeria] Campo 'datos' no es un objeto`, { 
            datos: msg.datos 
        });
        return false;
    }
    
    // Verificar que el timestamp sea un número válido
    if (typeof msg.timestamp !== 'number' || isNaN(msg.timestamp)) {
        logger.warn(`[${source}] [Mensajeria] Timestamp inválido`, { 
            timestamp: msg.timestamp 
        });
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
 * Envía un mensaje crítico con expectativa de ACK/NACK y manejo de reintentos avanzado
 * Implementa un sistema más robusto con backoff exponencial, control de errores detallado y
 * opciones de configuración extensivas para una comunicación más confiable.
 * 
 * @param {string} destino - ID del iframe destino o 'padre'
 * @param {string} tipo - Tipo de mensaje (debe estar en formato CATEGORIA.ACCION)
 * @param {Object} datos - Datos del mensaje
 * @param {Object} [opciones] - Opciones de configuración para el envío
 * @param {number} [opciones.timeout=3000] - Tiempo máximo de espera para la respuesta en ms
 * @param {number} [opciones.reintentos=3] - Número máximo de reintentos
 * @param {boolean} [opciones.silencioso=false] - Si es true, no se mostrarán logs de error en los reintentos
 * @param {Function} [opciones.onRetry] - Función a llamar antes de cada reintento (intento, totalReintentos, error)
 * @param {Function} [opciones.onTimeout] - Función a llamar cuando ocurra un timeout
 * @param {number} [opciones.factorBackoff=2] - Factor para el backoff exponencial entre reintentos
 * @param {number} [opciones.maxRetrasoMs=10000] - Retraso máximo entre reintentos en ms
 * @param {boolean} [opciones.jitter=true] - Añadir variación aleatoria al tiempo de retraso para evitar tormentas de tráfico
 * @returns {Promise<Object>} - Promesa que se resuelve con los datos del ACK o se rechaza con NACK
 * @throws {Error} Si hay un error de comunicación o timeout
 */
async function enviarMensajeConACK(destino, tipo, datos = {}, opciones = {}) {
    // Validar si estamos inicializados
    if (!verificarInicializado()) {
        logger.warn('[Mensajeria] Intentando enviar mensaje con ACK sin inicializar');
        try {
            await inicializarMensajeria();
        } catch (error) {
            error.codigo = ERRORES_MENSAJERIA.NO_INICIALIZADO;
            throw error;
        }
    }
    
    // Verificar formato del tipo de mensaje (CATEGORIA.ACCION)
    const tipoRegex = /^[A-Z0-9_]+\.[A-Z0-9_]+$/;
    if (!tipoRegex.test(tipo)) {
        const error = new Error(`El tipo de mensaje '${tipo}' no cumple con el formato CATEGORIA.ACCION`);
        error.codigo = ERRORES_MENSAJERIA.FORMATO_INVALIDO;
        error.recuperable = false; // No tiene sentido reintentar un formato inválido
        logger.error('[Mensajeria] Error en enviarMensajeConACK:', error.message, { tipo });
        throw error;
    }
    
    // Configuración por defecto con opciones avanzadas
    const config = {
        timeout: opciones.timeout || estado.reintentos.tiempoEspera || 3000,
        reintentos: opciones.reintentos || estado.reintentos.maximos || 3,
        silencioso: opciones.silencioso || false,
        onRetry: opciones.onRetry || null,
        onTimeout: opciones.onTimeout || null,
        factorBackoff: opciones.factorBackoff || estado.reintentos.factor || 2,
        maxRetrasoMs: opciones.maxRetrasoMs || 10000,
        jitter: opciones.jitter !== undefined ? opciones.jitter : true,
        // Nuevas opciones para el sistema mejorado
        guardarEnPendientes: opciones.guardarEnPendientes !== undefined ? opciones.guardarEnPendientes : true,
        reintentosPendientes: opciones.reintentosPendientes || 10,
        intentoRecuperacion: opciones.intentoRecuperacion || false,
        onSuccess: opciones.onSuccess || null,
        onError: opciones.onError || null,
        tipoPendiente: opciones.tipoPendiente || 'normal' // 'normal', 'urgente', 'bajo'
    };
    
    if (!destino || !tipo) {
        const error = new Error('Se requieren destino y tipo de mensaje');
        error.codigo = ERRORES_MENSAJERIA.FORMATO_INVALIDO;
        error.recuperable = false;
        throw error;
    }
    
    // Generar ID único para este mensaje con mayor entropía
    const solicitudId = generarIdUnico(`ack-${tipo.split('.')[0].toLowerCase()}`);
    
    // Preparar datos del mensaje con formato estándar
    const mensajeDatos = {
        ...datos,
        solicitudId,
        requireConfirmation: true,  // Indicador explícito de que requiere confirmación
        timestamp: Date.now()
    };
    
    let ultimoError = null;
    
    // Implementar sistema de reintentos mejorado
    for (let intento = 1; intento <= config.reintentos; intento++) {
        try {
            if (!config.silencioso || intento === 1) {
                logger.debug(`[Mensajeria] Enviando mensaje crítico (${solicitudId}) [${intento}/${config.reintentos}]:`, { 
                    tipo, 
                    destino,
                    timeout: config.timeout
                });
            }
            
            // Crear una promesa que maneja el envío y la espera de respuesta
            const respuesta = await new Promise((resolve, reject) => {
                // Configurar timeout con manejo mejorado
                const timeoutId = setTimeout(() => {
                    window.removeEventListener('message', manejadorRespuesta);
                    const timeoutError = new Error(`Tiempo de espera agotado (${config.timeout}ms)`);
                    timeoutError.codigo = 'TIMEOUT';
                    timeoutError.detalles = { solicitudId, tipo, destino, intento, totalReintentos: config.reintentos };
                    
                    // Ejecutar callback de timeout si existe
                    if (config.onTimeout && typeof config.onTimeout === 'function') {
                        config.onTimeout(timeoutError);
                    }
                    
                    reject(timeoutError);
                }, config.timeout);
                
                // Función que maneja las respuestas con mejor detección
                const manejadorRespuesta = (event) => {
                    const msg = event.data;
                    
                    // Filtrar mensajes que no son objetos o son externos
                    if (!msg || typeof msg !== 'object' || esMensajeExterno(msg)) {
                        return;
                    }
                    
                    // Verificar si es un ACK para este mensaje
                    if (msg.tipo === TIPOS_MENSAJE.SISTEMA.ACK && 
                        msg.datos?.solicitudId === solicitudId) {
                        clearTimeout(timeoutId);
                        window.removeEventListener('message', manejadorRespuesta);
                        resolve(msg);
                    } 
                    // Verificar si es un NACK para este mensaje
                    else if (msg.tipo === TIPOS_MENSAJE.SISTEMA.NACK && 
                             msg.datos?.solicitudId === solicitudId) {
                        clearTimeout(timeoutId);
                        window.removeEventListener('message', manejadorRespuesta);
                        const error = new Error(msg.datos.mensaje || 'Error en el servidor');
                        error.codigo = msg.datos.codigo || 'NACK_RECIBIDO';
                        error.detalles = msg.datos.detalles;
                        error.recuperable = msg.datos.recuperable !== false; // Por defecto se considera recuperable
                        reject(error);
                    }
                };
                
                // Registrar el manejador para escuchar respuestas
                window.addEventListener('message', manejadorRespuesta, false);
                
                // Enviar el mensaje
                try {
                    _enviarMensaje(destino, tipo, mensajeDatos);
                } catch (error) {
                    clearTimeout(timeoutId);
                    window.removeEventListener('message', manejadorRespuesta);
                    reject(error);
                }
            });
            
            logger.debug(`[Mensajeria] ACK recibido para ${solicitudId}`, respuesta);
            return respuesta.datos || {};
            
        } catch (error) {
            ultimoError = error;
            
            // Si el error explícitamente indica que no es recuperable, no reintentar
            if (error.recuperable === false) {
                logger.error(`[Mensajeria] Error no recuperable, abortando reintentos:`, error);
                break;
            }
            
            // Si hay más reintentos pendientes
            if (intento < config.reintentos) {
                if (config.onRetry && typeof config.onRetry === 'function') {
                    config.onRetry(intento, config.reintentos, error);
                }
                
                if (!config.silencioso) {
                    logger.warn(`[Mensajeria] Reintentando envío (${intento}/${config.reintentos}):`, error);
                }
                
                // Calcular retraso con backoff exponencial
                let retrasoMs = Math.min(config.maxRetrasoMs, 
                                         estado.reintentos.tiempoEspera * Math.pow(config.factorBackoff, intento - 1));
                
                // Añadir jitter (variación aleatoria) para evitar tormentas de tráfico si está habilitado
                if (config.jitter) {
                    const jitterFactor = 0.5 + Math.random(); // Entre 0.5 y 1.5
                    retrasoMs = Math.floor(retrasoMs * jitterFactor);
                }
                
                // Esperar antes de reintentar
                await new Promise(resolve => setTimeout(resolve, retrasoMs));
            }
        }
    }
    
    // Si llegamos aquí, todos los reintentos han fallado
    logger.error(`[Mensajeria] Todos los reintentos fallaron para mensaje ${tipo} a ${destino}:`, ultimoError);
    
    // Registrar métricas de fallo de mensajería si tenemos acceso al sistema de monitoreo
    try {
        if (typeof monitoring?.registrarMetrica === 'function') {
            monitoring.registrarMetrica('mensajeria.fallos', 1, 'count');
            monitoring.registrarMetrica(`mensajeria.fallos.${tipo.replace(/\./g, '_')}`, 1, 'count');
        }
        
        if (typeof monitoring?.registrarEvento === 'function') {
            monitoring.registrarEvento('mensajeria.fallo_comunicacion', {
                tipo,
                destino,
                solicitudId: mensajeDatos.solicitudId,
                reintentos: config.reintentos,
                error: ultimoError?.message
            }, 'error');
        }
    } catch (e) {
        // Ignorar errores al registrar métricas
    }
    
    // Si el modo silencioso está activado, devolver un objeto de error detallado
    if (config.silencioso) {
        return {
            error: true,
            mensaje: ultimoError?.message || 'Error desconocido',
            codigo: ultimoError?.codigo || 'ERROR_DESCONOCIDO',
            detalles: {
                tipo,
                destino,
                solicitudId: mensajeDatos.solicitudId,
                reintentos: config.reintentos
            },
            stack: ultimoError?.stack,
            timestamp: Date.now()
        };
    }
    
    // En modo no silencioso, lanzar el error para que sea manejado por el llamador
    throw ultimoError || new Error(`Error de comunicación al enviar mensaje ${tipo} a ${destino}`);
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
 * Guarda un mensaje en la cola de pendientes para reintento posterior
 * @param {string} destino - El destino del mensaje
 * @param {string} tipo - El tipo de mensaje
 * @param {Object} datos - Los datos del mensaje
 * @param {Object} opciones - Opciones para el reintento
 * @returns {Object} - Información sobre el mensaje guardado
 */
async function guardarMensajePendiente(destino, tipo, datos = {}, opciones = {}) {
  try {
    if (!destino || !tipo) {
      logger.error('[Mensajeria] No se puede guardar mensaje pendiente: Faltan destino o tipo');
      return false;
    }
    
    // Comprobar si tenemos demasiados mensajes pendientes (máx 50 por defecto)
    const maxPendientes = configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.MAXIMO || 50;
    if (estado.mensajesPendientes.length >= maxPendientes) {
      const urgentes = estado.mensajesPendientes.filter(m => m.opciones.tipoPendiente === 'urgente').length;
      const maxUrgentes = configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.MAX_URGENTES || 10;
      
      // Si el mensaje es urgente y no hemos superado el límite de urgentes, eliminamos uno normal
      if (opciones.tipoPendiente === 'urgente' && urgentes < maxUrgentes) {
        // Eliminar el mensaje normal más antiguo
        const indexAEliminar = estado.mensajesPendientes.findIndex(m => m.opciones.tipoPendiente !== 'urgente');
        if (indexAEliminar >= 0) {
          estado.mensajesPendientes.splice(indexAEliminar, 1);
          logger.warn('[Mensajeria] Se eliminó un mensaje no urgente para dar espacio a uno urgente');
        } else {
          logger.error('[Mensajeria] Cola de mensajes pendientes llena, no se puede guardar mensaje urgente');
          return false;
        }
      } else {
        logger.error('[Mensajeria] Cola de mensajes pendientes llena, no se pudo guardar el mensaje');
        return false;
      }
    }
    
    // Crear mensaje pendiente
    const mensajePendiente = {
      id: generarIdUnico('pendiente'),
      destino,
      tipo,
      datos: { ...datos }, // Copia para evitar referencias
      opciones: {
        ...opciones,
        intentoRecuperacion: true, // Marcar como intento de recuperación
        silencioso: true,          // Los reintentos automáticos son silenciosos
        timestamp: Date.now(),
        intentos: 0,
        maxIntentos: opciones.reintentos || 10
      }
    };
    
    // Guardar en cola
    estado.mensajesPendientes.push(mensajePendiente);
    
    // Almacenar en localStorage para persistencia si está disponible
    try {
      if (typeof localStorage !== 'undefined') {
        // Obtener mensajes existentes
        let mensajesGuardados = [];
        const mensajesJson = localStorage.getItem('mensajeria_pendientes');
        if (mensajesJson) {
          try {
            mensajesGuardados = JSON.parse(mensajesJson) || [];
          } catch (e) {
            logger.error('[Mensajeria] Error al parsear mensajes pendientes del localStorage', e);
          }
        }
        
        // Añadir nuevo mensaje y guardar
        mensajesGuardados.push({
          id: mensajePendiente.id,
          destino: mensajePendiente.destino,
          tipo: mensajePendiente.tipo,
          datos: mensajePendiente.datos,
          opciones: {
            tipoPendiente: mensajePendiente.opciones.tipoPendiente,
            timestamp: mensajePendiente.opciones.timestamp,
            maxIntentos: mensajePendiente.opciones.maxIntentos
          }
        });
        
        // Limitar tamaño para no exceder límites de localStorage
        if (mensajesGuardados.length > 100) {
          mensajesGuardados = mensajesGuardados.slice(-100);
        }
        
        localStorage.setItem('mensajeria_pendientes', JSON.stringify(mensajesGuardados));
      }
    } catch (e) {
      logger.error('[Mensajeria] Error al guardar mensaje pendiente en localStorage', e);
    }
    
    logger.info(`[Mensajeria] Mensaje guardado en cola de pendientes (ID: ${mensajePendiente.id}): ${tipo} → ${destino}`);
    
    // Iniciar procesamiento de pendientes si no está en curso
    programarProcesamiento();
    
    return {
      id: mensajePendiente.id,
      enCola: true,
      timestamp: mensajePendiente.opciones.timestamp
    };
  } catch (e) {
    logger.error('[Mensajeria] Error al guardar mensaje pendiente', e);
    return false;
  }
}

/**
 * Programa el procesamiento de mensajes pendientes
 * @param {number} retrasoMs - Retraso en milisegundos antes de procesar
 */
function programarProcesamiento(retrasoMs) {
  // Si ya hay un procesamiento programado o en curso, no hacer nada
  if (estado.procesandoPendientes) {
    return;
  }
  
  // Determinar retraso (usar valor predeterminado si no se especifica)
  const retraso = retrasoMs || configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.INTERVALO || 5000;
  
  // Programar procesamiento
  setTimeout(procesarMensajesPendientes, retraso);
}

/**
 * Procesa los mensajes pendientes intentando reenviarlos
 */
async function procesarMensajesPendientes() {
  if (estado.procesandoPendientes || estado.mensajesPendientes.length === 0) {
    return;
  }
  
  estado.procesandoPendientes = true;
  estado.ultimoProcesamiento = Date.now();
  
  try {
    logger.debug(`[Mensajeria] Procesando cola de mensajes pendientes (${estado.mensajesPendientes.length} mensajes)`);
    
    // Ordenar por prioridad (urgente > normal > bajo)
    const prioridades = { 'urgente': 0, 'normal': 1, 'bajo': 2 };
    estado.mensajesPendientes.sort((a, b) => {
      const prioridadA = prioridades[a.opciones.tipoPendiente] || 1;
      const prioridadB = prioridades[b.opciones.tipoPendiente] || 1;
      return prioridadA - prioridadB;
    });
    
    // Tomar solo los primeros N mensajes para no bloquear demasiado tiempo
    const lote = estado.mensajesPendientes.slice(0, configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.LOTE || 5);
    
    // Procesar cada mensaje
    for (const mensaje of lote) {
      try {
        mensaje.opciones.intentos++;
        
        // Si se superó el número máximo de intentos, eliminar de la cola
        if (mensaje.opciones.intentos > mensaje.opciones.maxIntentos) {
          estado.mensajesPendientes = estado.mensajesPendientes.filter(m => m.id !== mensaje.id);
          logger.warn(`[Mensajeria] Mensaje eliminado de la cola tras ${mensaje.opciones.intentos - 1} intentos: ${mensaje.tipo} → ${mensaje.destino}`);
          continue;
        }
        
        // Calcular backoff exponencial con jitter
        const factor = configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.FACTOR_BACKOFF || 1.5;
        const baseRetraso = configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.RETRASO_BASE || 1000;
        const maxRetraso = configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.MAX_RETRASO || 30000;
        
        const retraso = Math.min(baseRetraso * Math.pow(factor, mensaje.opciones.intentos - 1), maxRetraso);
        const jitter = 0.5 + Math.random();
        const retrasoFinal = Math.floor(retraso * jitter);
        
        logger.debug(`[Mensajeria] Reintento ${mensaje.opciones.intentos}/${mensaje.opciones.maxIntentos} para mensaje ${mensaje.tipo} → ${mensaje.destino} (espera: ${retrasoFinal}ms)`);
        
        // Intentar enviar el mensaje
        try {
          await enviarMensajeConACK(
            mensaje.destino,
            mensaje.tipo,
            mensaje.datos,
            mensaje.opciones
          );
          
          // Si llegamos aquí, el mensaje se envió con éxito
          logger.info(`[Mensajeria] Mensaje pendiente enviado con éxito en el intento ${mensaje.opciones.intentos}: ${mensaje.tipo} → ${mensaje.destino}`);
          
          // Eliminar de la cola
          estado.mensajesPendientes = estado.mensajesPendientes.filter(m => m.id !== mensaje.id);
        } catch (error) {
          // Si el error no es recuperable, eliminar de la cola
          if (error.recuperable === false) {
            estado.mensajesPendientes = estado.mensajesPendientes.filter(m => m.id !== mensaje.id);
            logger.warn(`[Mensajeria] Mensaje eliminado de la cola por error no recuperable: ${error.message}`);
          } else {
            logger.debug(`[Mensajeria] Reintento fallido (${mensaje.opciones.intentos}/${mensaje.opciones.maxIntentos}): ${error.message}`);
          }
        }
        
        // Pausa entre mensajes para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        logger.error(`[Mensajeria] Error al procesar mensaje pendiente:`, e);
      }
    }
    
    // Actualizar localStorage con los mensajes restantes
    try {
      if (typeof localStorage !== 'undefined') {
        const mensajesSimplificados = estado.mensajesPendientes.map(m => ({
          id: m.id,
          destino: m.destino,
          tipo: m.tipo,
          datos: m.datos,
          opciones: {
            tipoPendiente: m.opciones.tipoPendiente,
            timestamp: m.opciones.timestamp,
            intentos: m.opciones.intentos,
            maxIntentos: m.opciones.maxIntentos
          }
        }));
        
        localStorage.setItem('mensajeria_pendientes', JSON.stringify(mensajesSimplificados));
      }
    } catch (e) {
      logger.error('[Mensajeria] Error al actualizar mensajes pendientes en localStorage', e);
    }
  } finally {
    estado.procesandoPendientes = false;
    
    // Programar siguiente procesamiento si aún hay mensajes
    if (estado.mensajesPendientes.length > 0) {
      const intervalo = configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.INTERVALO || 5000;
      setTimeout(procesarMensajesPendientes, intervalo);
    }
  }
}

/**
 * Carga los mensajes pendientes del almacenamiento local
 */
function cargarMensajesPendientes() {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    const mensajesJson = localStorage.getItem('mensajeria_pendientes');
    if (!mensajesJson) {
      return;
    }
    
    const mensajesGuardados = JSON.parse(mensajesJson);
    if (!Array.isArray(mensajesGuardados) || mensajesGuardados.length === 0) {
      return;
    }
    
    // Filtrar mensajes muy antiguos (más de 24h por defecto)
    const maxEdadMs = configGlobal?.MENSAJERIA?.COLA_PENDIENTES?.MAX_EDAD_MS || 24 * 60 * 60 * 1000;
    const ahora = Date.now();
    const mensajesValidos = mensajesGuardados.filter(m => {
      return ahora - (m.opciones?.timestamp || 0) < maxEdadMs;
    });
    
    // Restaurar a la cola en memoria
    for (const mensaje of mensajesValidos) {
      estado.mensajesPendientes.push({
        id: mensaje.id || generarIdUnico('pendiente'),
        destino: mensaje.destino,
        tipo: mensaje.tipo,
        datos: mensaje.datos || {},
        opciones: {
          tipoPendiente: mensaje.opciones?.tipoPendiente || 'normal',
          timestamp: mensaje.opciones?.timestamp || Date.now(),
          intentos: mensaje.opciones?.intentos || 0,
          maxIntentos: mensaje.opciones?.maxIntentos || 10,
          intentoRecuperacion: true,
          silencioso: true
        }
      });
    }
    
    if (mensajesValidos.length > 0) {
      logger.info(`[Mensajeria] Se cargaron ${mensajesValidos.length} mensajes pendientes del almacenamiento local`);
      
      // Iniciar procesamiento después de un breve retraso
      setTimeout(procesarMensajesPendientes, 5000);
    }
    
    // Si hubo mensajes inválidos (antiguos), actualizar localStorage
    if (mensajesValidos.length < mensajesGuardados.length) {
      localStorage.setItem('mensajeria_pendientes', JSON.stringify(mensajesValidos));
    }
  } catch (e) {
    logger.error('[Mensajeria] Error al cargar mensajes pendientes', e);
  }
}

/**
 * Envía un mensaje de ACK (confirmación positiva) en respuesta a un mensaje recibido
 * @param {Object} mensajeOriginal - Mensaje original recibido
 * @param {Object} datos - Datos adicionales para la confirmación
 * @returns {Promise<Object>} - Resultado del envío
 */
async function enviarACK(mensajeOriginal, datos = {}) {
  try {
    // Validar si estamos inicializados
    if (!verificarInicializado()) {
      logger.warn('[Mensajeria] Intentando enviar ACK sin inicializar');
      await inicializarMensajeria();
    }
    
    if (!mensajeOriginal || !mensajeOriginal.origen) {
      throw new Error('Mensaje original inválido para ACK');
    }
    
    // Enviar mensaje ACK
    return await _enviarMensaje(
      mensajeOriginal.origen,
      TIPOS_MENSAJE.SISTEMA.ACK,
      {
        ...datos,
        mensajeOriginalId: mensajeOriginal.datos?.mensajeId || mensajeOriginal.mensajeId,
        tipoOriginal: mensajeOriginal.tipo,
        timestampOriginal: mensajeOriginal.timestamp,
        timestampACK: Date.now(),
        estado: datos.estado || 'ok'
      }
    );
  } catch (error) {
    logger.error('Error al enviar ACK:', error);
    throw error;
  }
}

/**
 * Envía un mensaje de NACK (confirmación negativa) en respuesta a un mensaje recibido
 * @param {Object} mensajeOriginal - Mensaje original recibido
 * @param {Object} datos - Datos adicionales para la confirmación negativa
 * @returns {Promise<Object>} - Resultado del envío
 */
async function enviarNACK(mensajeOriginal, datos = {}) {
  try {
    // Validar si estamos inicializados
    if (!verificarInicializado()) {
      logger.warn('[Mensajeria] Intentando enviar NACK sin inicializar');
      await inicializarMensajeria();
    }
    
    if (!mensajeOriginal || !mensajeOriginal.origen) {
      throw new Error('Mensaje original inválido para NACK');
    }
    
    // Enviar mensaje NACK
    return await _enviarMensaje(
      mensajeOriginal.origen,
      TIPOS_MENSAJE.SISTEMA.NACK,
      {
        ...datos,
        mensajeOriginalId: mensajeOriginal.datos?.mensajeId || mensajeOriginal.mensajeId,
        tipoOriginal: mensajeOriginal.tipo,
        timestampOriginal: mensajeOriginal.timestamp,
        timestampNACK: Date.now(),
        estado: datos.estado || 'error',
        motivo: datos.motivo || 'No especificado'
      }
    );
  } catch (error) {
    logger.error('Error al enviar NACK:', error);
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

// Verificar que TIPOS_MENSAJE esté definido antes de registrar controladores
if (!TIPOS_MENSAJE || !TIPOS_MENSAJE.CONTROL || !TIPOS_MENSAJE.CONTROL.CAMBIAR_MODO) {
    console.error('[Mensajeria] TIPOS_MENSAJE no está definido correctamente. No se registrarán controladores.');
} else {
    registrarControlador(TIPOS_MENSAJE.CONTROL.CAMBIAR_MODO, (mensaje) => {
        try {
            const { modo, origen } = mensaje.datos || {};
            if (!modo) {
                logger.warn('[Mensajeria] No se especificó un modo en el mensaje CAMBIAR_MODO');
                return;
            }

            logger.info(`[Mensajeria] Cambiando modo a: ${modo}${origen ? ` (solicitado por: ${origen})` : ''}`);
            
            // Notificar al padre si es necesario
            if (origen !== 'PADRE') {
                enviarMensaje('padre', TIPOS_MENSAJE.CONTROL.CAMBIAR_MODO, {
                    modo: modo,
                    origen: 'HIJO',
                    timestamp: new Date().toISOString()
                }).catch(error => {
                    logger.error('[Mensajeria] Error al notificar cambio de modo:', error);
                });
            }
        } catch (error) {
            logger.error('[Mensajeria] Error en el manejador de CAMBIAR_MODO:', error);
        }
    });
}

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

// Evitamos re-exportar TIPOS_MENSAJE para prevenir dependencias circulares
// Los módulos que necesiten TIPOS_MENSAJE deben importarlo directamente de constants.js

export const TIPOS_MENSAJE_BASICOS = {
    SISTEMA: {
        CONFIRMACION: 'SISTEMA.CONFIRMACION',
        ERROR: 'SISTEMA.ERROR',
        PING: 'SISTEMA.PING',
        PONG: 'SISTEMA.PONG',
        SINCRONIZAR_ESTADO: 'SISTEMA.SINCRONIZAR_ESTADO'
    }
};

// Exportar las funciones públicas
export {
    enviarMensajeConConfirmacion,
    enviarMensajeConACK,
    enviarConfirmacion,
    enviarACK,
    enviarNACK,
    enviarError,
    verificarInicializado,
    limpiarMensajeria
};

/**
 * Log seguro para mensajes grandes o complejos.
 * Evita errores por objetos circulares y limita el tamaño del log.
 * @param {string} mensaje - Mensaje a mostrar en el log.
 * @param {*} objeto - Objeto a mostrar.
 */
function logMensajeSeguro(mensaje, objeto) {
    try {
        // Si el objeto es pequeño y no tiene referencias circulares, mostrarlo normalmente
        if (typeof objeto === 'object' && objeto !== null) {
            // Intentar serializar para detectar referencias circulares
            let json = '';
            try {
                json = JSON.stringify(objeto);
            } catch (e) {
                json = '[Objeto con referencias circulares]';
            }
            if (json.length < 2000) {
                console.log(mensaje, objeto);
            } else {
                // Si es muy grande, mostrar solo un resumen
                console.log(mensaje, '[Objeto grande]', json.slice(0, 1000) + '...');
            }
        } else {
            // Para tipos primitivos
            console.log(mensaje, objeto);
        }
    } catch (e) {
        // Si todo falla, mostrar solo el mensaje
        console.log(mensaje, '[No se pudo mostrar el objeto]');
    }
}

/**
 * Inicia la sincronización periódica del estado con el padre
 * @param {number} [intervalo=5000] - Intervalo de sincronización en milisegundos
 */
export function iniciarSincronizacionPeriodica(intervalo = 5000) {
    // Verificar si la mensajería está inicializada
    if (!verificarInicializado()) {
        console.warn('[Mensajería] No se pudo iniciar sincronización: módulo no inicializado');
        // Reintentar después de un segundo
        setTimeout(() => iniciarSincronizacionPeriodica(intervalo), 1000);
        return;
    }

    // Usar setInterval para sincronización periódica
    const intervalId = setInterval(() => {
        try {
            // Solo intentar sincronizar si estamos conectados
            if (verificarInicializado()) {
                enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.SINCRONIZAR_ESTADO, {
                    estadoActual: estado,
                    timestamp: Date.now()
                });
                
                if (config.debug) {
                    console.debug('[Sincronización] Estado sincronizado con el padre');
                }
            }
        } catch (error) {
            console.error('[Sincronización] Error al sincronizar estado:', error);
            // En caso de error, intentar reiniciar la sincronización
            clearInterval(intervalId);
            iniciarSincronizacionPeriodica(intervalo);
        }
    }, intervalo);

    // Devolver función para detener la sincronización
    return () => clearInterval(intervalId);
}

// Function to send events to child iframes
export function enviarEventoAHijos(evento, datos) {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ evento, datos }, '*');
        }
    });
}

/**
 * Envía un mensaje con un timeout específico
 * @param {string} destino - ID del iframe destino
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @param {number} timeout - Tiempo de espera en ms (default: 5000)
 * @returns {Promise<Object>} - Promesa con el resultado
 */
export function enviarMensajeConTimeout(destino, tipo, datos = {}, timeout = 5000) {
    return new Promise((resolve, reject) => {
        // Enviar el mensaje normalmente
        enviarMensaje(destino, tipo, datos)
            .then(resultado => {
                // Resolvemos inmediatamente con el resultado
                resolve(resultado);
            })
            .catch(error => {
                // En caso de error, también lo propagamos
                reject(error);
            });

        // Configurar timeout adicional
        setTimeout(() => {
            // Si la promesa no se ha resuelto después del timeout, la rechazamos
            reject(new Error(`Timeout de ${timeout}ms superado para mensaje ${tipo} a ${destino}`));
        }, timeout);
    });
}

// NOTA: Todas las funciones se exportan únicamente a través del export default
// para evitar duplicaciones de exportación

// Exportar la API pública
export default {
    // Funciones principales de mensajería
    inicializarMensajeria,
    enviarMensaje,
    enviarMensajeConConfirmacion,
    enviarConfirmacion,
    enviarACK,
    enviarNACK,
    enviarError,
    verificarInicializado,
    limpiarMensajeria,
    
    // Las siguientes funciones también están exportadas directamente con export function
    registrarControlador,
    enviarMensajeConTimeout,
    enviarEventoAHijos,
    
    // Constantes exportadas también directamente
    TIPOS_MENSAJE_BASICOS
};
