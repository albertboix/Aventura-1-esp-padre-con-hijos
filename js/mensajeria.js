// Import utils
import * as utils from './utils.js';

// Destructure what we need
const { 
  configurarUtils, 
  crearObjetoError,
  TIPOS_MENSAJE,
  LOG_LEVELS
} = utils;

// Initialize logger
configurarUtils({ iframeId: 'mensajeria', debug: true });

// Get logger after initialization
const logger = utils.logger;

// Export for other modules
export { 
  TIPOS_MENSAJE,
  LOG_LEVELS,
  configurarUtils,
  crearObjetoError,
  logger
};

// Estado del módulo
let iframeId = '';
let sistemaInicializado = false;
let manejadores = new Map();
let mensajesPendientes = new Map();
let iframesRegistrados = new Set();
let configuracion = {
  debug: true,
  logLevel: LOG_LEVELS.DEBUG,
  tiempoEsperaRespuesta: 30000, // 30 segundos
  reintentos: 3,
  tiempoEntreReintentos: 1000, // 1 segundo
  iframeId: ''
};

// Alias config to configuracion for backward compatibility
let config = configuracion;
/**
 * Sistema de Mensajería para Comunicación entre Iframes
 * Maneja la comunicación bidireccional entre iframes padre e hijo
 * @version 2.1.0
 */

// Códigos de error estandarizados
export const ERROR_CODES = {
  // Errores de inicialización
  NOT_INITIALIZED: 'MESSAGING_NOT_INITIALIZED',
  ALREADY_INITIALIZED: 'MESSAGING_ALREADY_INITIALIZED',
  INVALID_CONFIG: 'INVALID_CONFIGURATION',
  
  // Errores de mensajes
  INVALID_MESSAGE: 'INVALID_MESSAGE_FORMAT',
  UNKNOWN_MESSAGE_TYPE: 'UNKNOWN_MESSAGE_TYPE',
  MESSAGE_TIMEOUT: 'MESSAGE_TIMEOUT',
  
  // Errores de red/IO
  TARGET_NOT_FOUND: 'TARGET_IFRAME_NOT_FOUND',
  POST_MESSAGE_FAILED: 'POST_MESSAGE_FAILED',
  
  // Errores de validación
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE',
  
  // Errores de autenticación/permisos
  UNAUTHORIZED: 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // Errores del sistema
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

// Niveles de severidad de errores
export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// ================== ERROR HANDLING ==================

// Alias para compatibilidad
export const ERROR_TYPES = ERROR_CODES;

/**
 * Wraps a function with error handling
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context for error messages
 * @returns {Function} Wrapped function with error handling
 */
function withErrorHandling(fn, context) {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            logger.error(`[${context}] Error:`, error);
            throw error;
        }
    };
}

/**
 * Registra un iframe en el sistema para comunicación directa
 * @param {string} id - ID del iframe
 */
export function registrarIframe(id) {
  iframesRegistrados.add(id);
  logger.debug(`Iframe registrado: ${id}`);
}

/**
 * Obtiene la lista de iframes registrados
 * @returns {Array} Lista de IDs de iframes
 */
export function obtenerIframesRegistrados() {
  return Array.from(iframesRegistrados);
}

// ================== VALIDACIÓN DE MENSAJES ==================

/**
 * Esquemas de validación para los mensajes
 * @type {Object.<string, {propiedadesRequeridas: string[], validar?: function(Object): boolean}>}
 */
/**
 * Esquemas de validación para los mensajes
 * @type {Object.<string, {propiedadesRequeridas: string[], validar?: function(Object): boolean}>}
 */
const ESQUEMAS_MENSAJES = {
  // Navegación
  'NAVEGACION.INICIAR': {
    propiedadesRequeridas: ['destinoId', 'ruta'],
    validar: (datos) => typeof datos.destinoId === 'string' && Array.isArray(datos.ruta)
  },
  'NAVEGACION.INICIADA': {
    propiedadesRequeridas: ['destinoId', 'timestamp', 'origen'],
    propiedades: {
      destinoId: { type: 'string' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      ruta: { type: 'array', optional: true }
    },
    validar: (datos) => {
      if (!datos.destinoId || typeof datos.destinoId !== 'string') {
        return { valido: false, error: 'destinoId debe ser un string válido' };
      }
      return true;
    }
  },
  'NAVEGACION.CANCELADA': {
    propiedadesRequeridas: ['razon', 'timestamp', 'origen'],
    propiedades: {
      razon: { type: 'string' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      codigoError: { type: 'string', optional: true }
    },
    validar: (datos) => {
      if (!datos.razon || typeof datos.razon !== 'string') {
        return { valido: false, error: 'La razón es requerida y debe ser un texto' };
      }
      return true;
    }
  },
  'NAVEGACION.DESTINO_ESTABLECIDO': {
    propiedadesRequeridas: ['destinoId', 'nombre', 'coordenadas', 'timestamp']
  },
  'NAVEGACION.LLEGADA_DETECTADA': {
    propiedadesRequeridas: ['destinoId', 'timestamp']
  },
  'NAVEGACION.ERROR': {
    propiedadesRequeridas: ['codigo', 'mensaje', 'timestamp']
  },
  'NAVEGACION.SOLICITAR_DESTINO': {
    propiedadesRequeridas: ['timestamp']
  },
  'NAVEGACION.ESTADO': {
    propiedadesRequeridas: ['estado', 'timestamp'],
    validar: (datos) => ['activo', 'inactivo', 'pausado'].includes(datos.estado)
  },
  
  // Sistema
  'SISTEMA.ERROR': {
    propiedadesRequeridas: ['codigo', 'mensaje', 'origen', 'timestamp']
  },
  'SISTEMA.ESTADO': {
    propiedadesRequeridas: ['estado', 'timestamp']
  },
  'SISTEMA.INICIALIZACION_COMPLETADA': {
    propiedadesRequeridas: ['idIframe', 'timestamp', 'estado'],
    validar: (datos) => typeof datos.idIframe === 'string' && 
                       ['listo', 'error'].includes(datos.estado)
  },
  'SISTEMA.CAMBIO_MODO': {
    propiedadesRequeridas: ['modo', 'timestamp', 'origen'],
    propiedades: {
      modo: { type: 'string', enum: ['casa', 'aventura'] },
      origen: { type: 'string' },
      razon: { type: 'string', optional: true }
    },
    validar: (datos) => {
      if (!['casa', 'aventura'].includes(datos.modo)) {
        return { valido: false, error: 'Modo no válido. Debe ser "casa" o "aventura"' };
      }
      return true;
    }
  },
  
  // Datos
  'DATOS.SOLICITAR_PARADAS': {
    propiedadesRequeridas: ['timestamp'],
    propiedades: {
      origen: { type: 'string' },
      timestamp: { type: 'number' }
    }
  },
  
  // Navegación
  'NAVEGACION.CAMBIO_PARADA': {
    propiedadesRequeridas: ['punto', 'timestamp'],
    propiedades: {
      punto: { type: 'object' },
      origen: { type: 'string' },
      timestamp: { type: 'number' }
    },
    validar: (datos) => {
      if (!datos.punto || typeof datos.punto !== 'object') {
        return { valido: false, error: 'El punto es requerido y debe ser un objeto' };
      }
      return true;
    }
  },
  
  // Audio
  'AUDIO.FINALIZADO': {
    propiedadesRequeridas: ['audioId', 'origen', 'timestamp', 'exito'],
    propiedades: {
      audioId: { type: 'string' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      exito: { type: 'boolean' },
      error: { type: 'string', optional: true },
      duracion: { type: 'number', optional: true },
      posicion: { type: 'number', optional: true }
    },
    validar: (datos) => {
      if (datos.exito === false && !datos.error) {
        return { valido: false, error: 'Se requiere un mensaje de error cuando exito es falso' };
      }
      if (datos.duracion !== undefined && typeof datos.duracion !== 'number') {
        return { valido: false, error: 'La duración debe ser un número' };
      }
      if (datos.posicion !== undefined && typeof datos.posicion !== 'number') {
        return { valido: false, error: 'La posición debe ser un número' };
      }
      return true;
    }
  },
  
  // Retos
  'RETO.MOSTRAR': {
    propiedadesRequeridas: ['retoId', 'timestamp', 'origen'],
    propiedades: {
      retoId: { type: 'string' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      datos: { type: 'object', optional: true },
      animacion: { type: 'string', optional: true, enum: ['deslizar', 'fade', 'ninguna'], default: 'deslizar' }
    },
    validar: (datos) => {
      if (datos.animacion && !['deslizar', 'fade', 'ninguna'].includes(datos.animacion)) {
        return { valido: false, error: 'Tipo de animación no válido' };
      }
      return true;
    }
  },
  'RETO.OCULTAR': {
    propiedadesRequeridas: ['retoId', 'timestamp', 'origen'],
    propiedades: {
      retoId: { type: 'string' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      motivo: { type: 'string', optional: true },
      animacion: { type: 'string', optional: true, enum: ['deslizar', 'fade', 'ninguna'], default: 'fade' }
    },
    validar: (datos) => {
      if (datos.animacion && !['deslizar', 'fade', 'ninguna'].includes(datos.animacion)) {
        return { valido: false, error: 'Tipo de animación no válido' };
      }
      return true;
    }
  },
  
  'RETO.COMPLETADO': {
    propiedadesRequeridas: ['retoId', 'exito', 'timestamp'],
    propiedades: {
      retoId: { type: 'string' },
      exito: { type: 'boolean' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      puntuacion: { type: 'number', optional: true },
      datos: { type: 'object', optional: true }
    }
  },
  
  // Interfaz de Usuario
  'UI.HABILITAR_CONTROLES': {
    propiedadesRequeridas: ['timestamp'],
    propiedades: {
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      habilitar: { type: 'boolean', optional: true, default: true },
      motivo: { type: 'string', optional: true }
    }
  },
  
  'UI.ACTUALIZAR_ESTADO': {
    propiedadesRequeridas: ['estado', 'timestamp'],
    propiedades: {
      estado: { type: 'string' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      datos: { type: 'object', optional: true }
    }
  },
  
  // Configuración del sistema
  'SISTEMA.CONFIGURACION': {
    propiedadesRequeridas: ['configuracion', 'timestamp'],
    propiedades: {
      configuracion: { type: 'object' },
      origen: { type: 'string' },
      timestamp: { type: 'number' }
    }
  },
  
  'SISTEMA.SINCRONIZAR': {
    propiedadesRequeridas: ['estado', 'timestamp'],
    propiedades: {
      estado: { type: 'string' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      datos: { type: 'object', optional: true }
    }
  },
  
  // Control
  'CONTROL.ESTADO': {
    propiedadesRequeridas: ['habilitado', 'timestamp'],
    propiedades: {
      habilitado: { type: 'boolean' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      motivo: { type: 'string', optional: true }
    }
  },
  'CONTROL.HABILITAR': {
    propiedadesRequeridas: ['timestamp']
  },
  'CONTROL.DESHABILITAR': {
    propiedadesRequeridas: ['razon', 'timestamp']
  },
  
  // GPS
  'GPS.ACTUALIZAR': {
    propiedadesRequeridas: ['lat', 'lng', 'timestamp'],
    validar: (datos) => 
      typeof datos.lat === 'number' && 
      typeof datos.lng === 'number' &&
      (datos.accuracy === undefined || typeof datos.accuracy === 'number')
  },
  'GPS.POSICION_ACTUALIZADA': {
    propiedadesRequeridas: ['coordenadas', 'timestamp'],
    validar: (datos) => 
      typeof datos.coordenadas?.lat === 'number' && 
      typeof datos.coordenadas?.lng === 'number' &&
      (datos.coordenadas.accuracy === undefined || typeof datos.coordenadas.accuracy === 'number')
  },
  'GPS.COMANDO': {
    propiedadesRequeridas: ['accion', 'timestamp'],
    validar: (datos) => ['iniciar', 'detener', 'pausar', 'reanudar'].includes(datos.accion)
  },
  
  // Audio
  'AUDIO.COMANDO': {
    propiedadesRequeridas: ['comando', 'timestamp'],
    validar: (datos) => ['reproducir', 'pausar', 'detener', 'volumen'].includes(datos.comando)
  },
  'AUDIO.REPRODUCIR': {
    propiedadesRequeridas: ['tipo', 'nombre', 'timestamp'],
    validar: (datos) => ['musica', 'efecto', 'voz'].includes(datos.tipo)
  },
  
  // Retos
  'RETO.NUEVO': {
    propiedadesRequeridas: ['retoId', 'tipo', 'timestamp', 'origen'],
    propiedades: {
      retoId: { type: 'string' },
      tipo: { type: 'string', enum: ['pregunta', 'seleccion', 'arrastrar', 'completar'] },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      datos: { type: 'object' },
      tiempoLimite: { type: 'number', optional: true },
      intentosPermitidos: { type: 'number', optional: true, default: 3 }
    },
    validar: (datos) => {
      if (datos.tiempoLimite && datos.tiempoLimite < 0) {
        return { valido: false, error: 'tiempoLimite no puede ser negativo' };
      }
      if (datos.intentosPermitidos && datos.intentosPermitidos < 1) {
        return { valido: false, error: 'intentosPermitidos debe ser al menos 1' };
      }
      return true;
    }
  },
  'RETO.MOSTRAR': {
    propiedadesRequeridas: ['retoId', 'timestamp']
  },
  
  // UI
  'UI.HABILITAR_CONTROLES': {
    propiedadesRequeridas: ['modo', 'timestamp', 'origen'],
    propiedades: {
      modo: { type: 'string', enum: ['casa', 'aventura'] },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      controles: { 
        type: 'array', 
        optional: true,
        items: { type: 'string' }
      }
    },
    validar: (datos) => {
      if (!['casa', 'aventura'].includes(datos.modo)) {
        return { valido: false, error: 'Modo no válido. Debe ser "casa" o "aventura"' };
      }
      if (datos.controles && !Array.isArray(datos.controles)) {
        return { valido: false, error: 'controles debe ser un array' };
      }
      return true;
    }
  },
  'UI.DESHABILITAR_CONTROLES': {
    propiedadesRequeridas: ['motivo', 'timestamp', 'origen'],
    propiedades: {
      motivo: { type: 'string' },
      origen: { type: 'string' },
      timestamp: { type: 'number' },
      codigoError: { type: 'string', optional: true },
      controles: { 
        type: 'array', 
        optional: true,
        items: { type: 'string' }
      }
    },
    validar: (datos) => {
      if (!datos.motivo || typeof datos.motivo !== 'string') {
        return { valido: false, error: 'El motivo es requerido y debe ser un texto' };
      }
      if (datos.controles && !Array.isArray(datos.controles)) {
        return { valido: false, error: 'controles debe ser un array' };
      }
      return true;
    }
  }
};

// ================== FUNCIONES DE UTILIDAD ==================

// Hacer disponible globalmente para compatibilidad con código antiguo
if (typeof window !== 'undefined') {
    window.Mensajeria = {
        TIPOS_MENSAJE,
        inicializarMensajeria: withErrorHandling(inicializarMensajeria, 'mensajeria:inicializar'),
        registrarControlador,
        registrarManejador: registrarControlador,
        enviarMensaje: withErrorHandling(enviarMensaje, 'mensajeria:enviar'),
        enviarMensajeDirecto: withErrorHandling(enviarMensajeDirecto, 'mensajeria:enviarDirecto'),
        enviarATodosLosIframes: withErrorHandling(enviarATodosLosIframes, 'mensajeria:enviarATodos'),
        enviarConfiguracion: withErrorHandling(enviarConfiguracion, 'mensajeria:configuracion'),
        // Agregar otras funciones que necesiten ser accesibles globalmente
    };
}

/**
 * Genera un ID único para mensajes
 * @returns {string} ID único
 */
function generarIdMensaje() {
  return `msg_${Date.now()}_${++contadorMensajes}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Valida la estructura de un mensaje
 * @param {Object} mensaje - Mensaje a validar
 * @param {string} [tipoEsperado] - Tipo de mensaje esperado (opcional)
 * @returns {{valido: boolean, error?: string, codigoError?: string, detalles?: Object}} Resultado de la validación
 */
export function validarMensaje(mensaje, tipoEsperado = null) {
  const logPrefix = '[MENSAJERIA] [validarMensaje]';
  
  // Validación básica de la estructura del mensaje
  if (!mensaje || typeof mensaje !== 'object' || Array.isArray(mensaje)) {
    const error = 'El mensaje debe ser un objeto';
    logger.error(`${logPrefix} ${error}`, { mensaje });
    return { 
      valido: false, 
      error,
      codigoError: ERROR_CODES.INVALID_MESSAGE,
      detalles: { mensaje }
    };
  }
  
  // Validar campos obligatorios del mensaje
  const camposObligatorios = ['tipo', 'origen', 'destino', 'timestamp'];
  const camposFaltantes = camposObligatorios.filter(campo => mensaje[campo] === undefined);
  
  if (camposFaltantes.length > 0) {
    const error = `Campos obligatorios faltantes: ${camposFaltantes.join(', ')}`;
    logger.error(`${logPrefix} ${error}`, { mensaje, camposFaltantes });
    return {
      valido: false,
      error,
      codigoError: ERROR_CODES.MISSING_REQUIRED_FIELD,
      detalles: { camposFaltantes, mensaje }
    };
  }
  
  // Validar tipo de mensaje
  const { tipo } = mensaje;
  
  // Si se especificó un tipo esperado, verificar que coincida
  if (tipoEsperado && tipo !== tipoEsperado) {
    const error = `Tipo de mensaje inesperado: ${tipo}, se esperaba: ${tipoEsperado}`;
    logger.error(`${logPrefix} ${error}`, { mensaje, tipoEsperado });
    return {
      valido: false,
      error,
      codigoError: ERROR_CODES.UNKNOWN_MESSAGE_TYPE,
      detalles: { tipoRecibido: tipo, tipoEsperado, mensaje }
    };
  }
  
  // Obtener el esquema de validación para el tipo de mensaje
  const tipoClave = tipo.split('.').slice(0, 2).join('.'); // Obtener la clave principal (ej: 'NAVEGACION.INICIAR')
  const esquema = ESQUEMAS_MENSAJES[tipoClave];
  
  if (!esquema) {
    logger.warn(`${logPrefix} No se encontró esquema de validación para el tipo: ${tipo}`, { mensaje });
    return { valido: true }; // Si no hay esquema, se considera válido
  }
  
  // Validar propiedades requeridas
  const { propiedadesRequeridas = [], validar } = esquema;
  const propiedadesFaltantes = propiedadesRequeridas.filter(prop => 
    mensaje.datos?.[prop] === undefined
  );
  
  if (propiedadesFaltantes.length > 0) {
    const error = `Propiedades requeridas faltantes: ${propiedadesFaltantes.join(', ')}`;
    logger.error(`${logPrefix} ${error}`, { 
      mensaje, 
      propiedadesFaltantes,
      propiedadesRequeridas 
    });
    return {
      valido: false,
      error,
      codigoError: ERROR_CODES.MISSING_REQUIRED_FIELD,
      detalles: { 
        propiedadesFaltantes, 
        propiedadesRequeridas,
        mensaje 
      }
    };
  }
  
  // Validación personalizada si está definida
  if (validar && !validar(mensaje.datos || {})) {
    const error = 'Validación personalizada fallida';
    logger.error(`${logPrefix} ${error}`, { 
      mensaje,
      esquema: tipoClave,
      datos: mensaje.datos 
    });
    return {
      valido: false,
      error,
      codigoError: ERROR_CODES.VALIDATION_ERROR,
      detalles: { 
        tipoMensaje: tipo,
        datos: mensaje.datos,
        mensaje: 'La validación personalizada del mensaje falló'
      }
    };
  }
  
  // Validar campos comunes del mensaje
  const { datos, timestamp } = mensaje;
  
  // Validar tipos de campos comunes
  const camposRequeridos = [
    { nombre: 'tipo', valor: mensaje.tipo, tipo: 'string', codigo: ERROR_CODES.MISSING_REQUIRED_FIELD },
    { nombre: 'destino', valor: mensaje.destino, tipo: 'string', codigo: ERROR_CODES.MISSING_REQUIRED_FIELD },
    { nombre: 'origen', valor: mensaje.origen, tipo: 'string', codigo: ERROR_CODES.MISSING_REQUIRED_FIELD },
    { nombre: 'timestamp', valor: timestamp, tipo: 'number', codigo: ERROR_CODES.INVALID_FIELD_TYPE },
    { nombre: 'datos', valor: datos, tipo: 'object', codigo: ERROR_CODES.INVALID_FIELD_TYPE, opcional: true }
  ];
  
  // Validar tipos de campos
  for (const { nombre, valor, tipo: tipoEsperado, codigo, opcional } of camposRequeridos) {
    // Si el campo es opcional y no está definido, continuar
    if (opcional && valor === undefined) {
      continue;
    }
    
    // Verificar si el campo está definido
    if (valor === undefined) {
      return {
        valido: false,
        error: `Campo requerido faltante: ${nombre}`,
        codigoError: ERROR_CODES.MISSING_REQUIRED_FIELD,
        detalles: { campo: nombre, valor, tipoEsperado }
      };
    }
    
    // Verificar el tipo del campo
    if (tipoEsperado === 'array' && !Array.isArray(valor)) {
      return {
        valido: false,
        error: `Tipo de campo inválido: ${nombre} debe ser un array`,
        codigoError: ERROR_CODES.INVALID_FIELD_TYPE,
        detalles: { campo: nombre, valor, tipoEsperado, tipoRecibido: typeof valor }
      };
    } else if (tipoEsperado !== 'array' && valor !== null && typeof valor !== tipoEsperado) {
      return {
        valido: false,
        error: `Tipo de campo inválido: ${nombre} debe ser de tipo ${tipoEsperado}`,
        codigoError: ERROR_CODES.INVALID_FIELD_TYPE,
        detalles: { campo: nombre, valor, tipoEsperado, tipoRecibido: typeof valor }
      };
    }
  }
  
  // Validar estructura del campo datos si existe
  if (datos && typeof datos === 'object' && !Array.isArray(datos)) {
    // Validar que los datos no tengan referencias circulares
    try {
      JSON.stringify(datos);
    } catch (error) {
      return {
        valido: false,
        error: 'Los datos del mensaje contienen referencias circulares o valores no serializables',
        codigoError: ERROR_CODES.INVALID_MESSAGE,
        detalles: { error: error.message }
      };
    }
  }
  
  // Si llegamos hasta aquí, el mensaje es válido
  return { 
    valido: true,
    mensaje: 'El mensaje es válido',
    detalles: { 
      tipo: mensaje.tipo,
      origen: mensaje.origen,
      destino: mensaje.destino,
      timestamp: mensaje.timestamp,
      tieneDatos: !!datos
    }
  };
}
  const esquema = ESQUEMAS_MENSAJES[tipo];
  
  if (!esquema) {
    logger.warn(`${logPrefix} No hay esquema de validación para el tipo de mensaje: ${tipo}`, {
      tipo,
      mensajesDisponibles: Object.keys(ESQUEMAS_MENSAJES)
    });
    return { valido: true }; // No fallar si no hay esquema
  }

  // Validar propiedades requeridas
  if (esquema.propiedadesRequeridas) {
    for (const prop of esquema.propiedadesRequeridas) {
      if (mensaje.datos[prop] === undefined || mensaje.datos[prop] === null) {
        return { 
          valido: false, 
          error: `Falta la propiedad requerida '${prop}' en los datos del mensaje` 
        };
      }
    }
  }
  
  // Validar propiedades según el esquema
  if (esquema.propiedades) {
    for (const [prop, reglas] of Object.entries(esquema.propiedades)) {
      // Si el campo es opcional y no está presente, lo saltamos
      if (reglas.optional && mensaje.datos[prop] === undefined) continue;
      
      // Si el campo está presente, lo validamos
      if (mensaje.datos[prop] !== undefined) {
        // Validar tipo
        if (reglas.type) {
          let tipoValido = false;
          const tipoEsperado = reglas.type;
          const tipoReal = typeof mensaje.datos[prop];
          
          if (tipoEsperado === 'array') {
            tipoValido = Array.isArray(mensaje.datos[prop]);
          } else if (tipoEsperado === 'number') {
            tipoValido = !isNaN(mensaje.datos[prop]);
          } else if (tipoEsperado === 'integer') {
            tipoValido = Number.isInteger(mensaje.datos[prop]);
          } else if (tipoEsperado === 'date') {
            tipoValido = !isNaN(new Date(mensaje.datos[prop]).getTime());
          } else {
            tipoValido = tipoReal === tipoEsperado;
          }
          
          if (!tipoValido) {
            return { 
              valido: false, 
              error: `Tipo inválido para '${prop}': se esperaba ${tipoEsperado}, se obtuvo ${tipoReal}` 
            };
          }
        }
        
        // Validar enum
        if (reglas.enum && !reglas.enum.includes(mensaje.datos[prop])) {
          return { 
            valido: false, 
            error: `Valor inválido para '${prop}': ${mensaje.datos[prop]}. Valores permitidos: ${reglas.enum.join(', ')}` 
          };
        }
        
        // Validar rango numérico
        if (typeof mensaje.datos[prop] === 'number') {
          if (reglas.minimum !== undefined && mensaje.datos[prop] < reglas.minimum) {
            return { 
              valido: false, 
              error: `El valor de '${prop}' debe ser mayor o igual a ${reglas.minimum}` 
            };
          }
          
          if (reglas.maximum !== undefined && mensaje.datos[prop] > reglas.maximum) {
            return { 
              valido: false, 
              error: `El valor de '${prop}' debe ser menor o igual a ${reglas.maximum}` 
            };
          }
        }
        
        // Validar longitud de cadenas y arrays
        if (reglas.minLength !== undefined) {
          const longitud = Array.isArray(mensaje.datos[prop]) 
            ? mensaje.datos[prop].length 
            : String(mensaje.datos[prop]).length;
            
          if (longitud < reglas.minLength) {
            return { 
              valido: false, 
              error: `El campo '${prop}' debe tener al menos ${reglas.minLength} caracteres` 
            };
          }
        }
        
        if (reglas.maxLength !== undefined) {
          const longitud = Array.isArray(mensaje.datos[prop]) 
            ? mensaje.datos[prop].length 
            : String(mensaje.datos[prop]).length;
            
          if (longitud > reglas.maxLength) {
            return { 
              valido: false, 
              error: `El campo '${prop}' no debe exceder los ${reglas.maxLength} caracteres` 
            };
          }
        }
        
        // Validar patrón de expresión regular
        if (reglas.pattern && typeof mensaje.datos[prop] === 'string') {
          const regex = new RegExp(reglas.pattern);
          if (!regex.test(mensaje.datos[prop])) {
            return { 
              valido: false, 
              error: `El formato del campo '${prop}' es inválido` 
            };
          }
        }
        
        // Validar objetos anidados
        if (reglas.type === 'object' && reglas.properties) {
          if (typeof mensaje.datos[prop] !== 'object' || mensaje.datos[prop] === null) {
            return { 
              valido: false, 
              error: `El campo '${prop}' debe ser un objeto` 
            };
          }
          
          const resultado = validarMensaje({
            tipo: mensaje.tipo,
            origen: mensaje.origen,
            destino: mensaje.destino,
            datos: mensaje.datos[prop]
          });
          
          if (!resultado.valido) {
            return { 
              valido: false, 
              error: `Error en el campo '${prop}': ${resultado.error}` 
            };
          }
        }
        
        // Validar arrays de objetos
        if (reglas.type === 'array' && reglas.items) {
          if (!Array.isArray(mensaje.datos[prop])) {
            return { 
              valido: false, 
              error: `El campo '${prop}' debe ser un arreglo` 
            };
          }
          
          for (let i = 0; i < mensaje.datos[prop].length; i++) {
            const item = mensaje.datos[prop][i];
            if (reglas.items.type === 'object' && typeof item === 'object' && item !== null) {
              const resultado = validarMensaje({
                tipo: mensaje.tipo,
                origen: mensaje.origen,
                destino: mensaje.destino,
                datos: item
              });
              
              if (!resultado.valido) {
                return { 
                  valido: false, 
                  error: `Error en el elemento ${i} de '${prop}': ${resultado.error}` 
                };
              }
            } else if (typeof item !== reglas.items.type) {
              return { 
                valido: false, 
                error: `Tipo inválido para el elemento ${i} de '${prop}': se esperaba ${reglas.items.type}` 
              };
            }
          }
        }
      }
    }
  }
  
  // Ejecutar validación personalizada si existe
  if (esquema.validar) {
    try {
      const resultado = esquema.validar(mensaje.datos);
      if (resultado === false || (typeof resultado === 'object' && !resultado.valido)) {
        return {
          valido: false,
          error: typeof resultado === 'object' ? resultado.error : 'Validación personalizada fallida'
        };
      }
    } catch (error) {
      return {
        valido: false,
        error: `Error en la validación personalizada: ${error.message}`
      };
    }
  }
  
  return { valido: true };


/**
 * Inicializa el sistema de mensajería
 * @param {Object} config - Configuración del sistema
 * @returns {Promise<void>}
 */
export async function inicializarMensajeria(userConfig = {}) {
  // Merge user config with defaults
  config = {
    debug: true,
    logLevel: LOG_LEVELS.DEBUG,
    tiempoEsperaRespuesta: 30000, // 30 segundos
    reintentos: 3,
    tiempoEntreReintentos: 1000, // 1 segundo
    ...userConfig
  };
  
  // Set iframeId if provided
  if (userConfig.iframeId) {
    iframeId = userConfig.iframeId;
  }
  
  // Update logger configuration
  try {
    configurarUtils({
      iframeId: iframeId || 'mensajeria',
      debug: config.debug,
      logLevel: config.logLevel
    });
  } catch (err) {
    console.error('Error al configurar el logger:', err);
    throw err;
  }
  try {
    // Validar configuración
    if (!userConfig.iframeId) {
      const error = new Error('Se requiere un iframeId para inicializar la mensajería');
      error.code = 'ERR_INVALID_CONFIG';
      throw error;
    }
    
    if (sistemaInicializado) {
      logger.warn('El sistema de mensajería ya estaba inicializado');
      return Promise.resolve();
    }
    
    // Aplicar configuración
    configuracion = { ...configuracion, ...userConfig };
    iframeId = configuracion.iframeId;
    
    // Configurar nivel de log
    logLevel = configuracion.debug ? LOG_LEVELS.DEBUG : 
              configuracion.logLevel || LOG_LEVELS.INFO;
    
    logger.info('Inicializando sistema de mensajería...', {
      iframeId: '***',
      logLevel: Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === logLevel)
    });
    
    // Inicializar manejadores
    manejadores = new Map();
    mensajesPendientes = new Map();
    contadorMensajes = 0;
    
    // Configurar listener de mensajes
    if (typeof window !== 'undefined') {
      // Remover cualquier listener previo para evitar duplicados
      window.removeEventListener('message', manejarMensajeRecibido, false);
      window.addEventListener('message', manejarMensajeRecibido, false);
      logger.debug('Event listener de mensajes configurado');
    }
    
    // Inicialización exitosa
    sistemaInicializado = true;
  
    // Registrar manejadores del sistema
    try {
      registrarControlador(TIPOS_MENSAJE.SISTEMA.CONFIGURACION, manejarConfiguracionSistema);
      logger.debug('Manejadores del sistema registrados');
    } catch (error) {
      logger.error('Error al registrar manejadores del sistema', error);
      throw error;
    }
  
    logger.info('Sistema de mensajería inicializado correctamente');
    return Promise.resolve();
    
  } catch (error) {
    // Use a safe way to log the error without relying on configuracion
    const errorInfo = {
      message: error.message,
      code: error.code,
      stack: (config && config.debug) ? error.stack : undefined
    };
    
    try {
      // Try to use logger if available, otherwise fall back to console
      if (logger && typeof logger.error === 'function') {
        logger.error('Error al inicializar la mensajería', errorInfo);
      } else {
        console.error('Error al inicializar la mensajería', errorInfo);
      }
    } catch (loggingError) {
      console.error('Error al registrar el error:', loggingError);
      console.error('Error original:', error);
    }
    
    // Limpiar en caso de error
    if (sistemaInicializado) {
      try {
        await limpiar();
      } catch (cleanupError) {
        console.error('Error durante la limpieza:', cleanupError);
      }
    }
    
    throw error;
  }
}

/**
 * Registra un manejador para un tipo de mensaje específico
 * @param {string} tipo - Tipo de mensaje
 * @param {Function} manejador - Función manejadora
 */
export function registrarControlador(tipo, manejador) {
  if (!sistemaInicializado) {
    throw new Error('El sistema de mensajería no está inicializado');
  }
  
  if (typeof manejador !== 'function') {
    throw new Error('El manejador debe ser una función');
  }
  
  manejadores.set(tipo, manejador);
  logger.debug(`Manejador registrado para tipo: ${tipo}`);
}

/**
 * Alias para registrarControlador (para compatibilidad)
 */
export const registrarManejador = registrarControlador;

/**
 * Envía un mensaje a otro iframe o al padre
 * @param {string} destino - ID del iframe destino o 'padre'
 * @param {string} tipo - Tipo de mensaje
 * @param {Object} datos - Datos del mensaje
 * @param {Object} opciones - Opciones adicionales
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarMensaje(destino, tipo, datos = {}, opciones = {}) {
  console.log(`[MENSAJERIA] Enviando mensaje a ${destino} (${tipo}):`, datos);
    console.log(`[MENSAJERIA] Enviando mensaje a ${destino} (${tipo}):`, datos);
  // Antes de enviar un mensaje, verifica que el sistema esté inicializado
  if (!sistemaInicializado) {
    throw new Error('El sistema de mensajería no está inicializado');
  }
  
  const opcionesCompletas = {
    timeout: configuracion.timeout,
    esperarRespuesta: true,
    ...opciones
  };
  
  // Si se pasa un objeto como primer parámetro (formato alternativo)
  if (typeof destino === 'object' && destino.tipo) {
    return enviarMensajeDirecto(destino, opcionesCompletas);
  }
  
  // Construir el mensaje
  const mensaje = {
    tipo,
    destino,
    origen: iframeId,
    timestamp: new Date().toISOString(),
    idMensaje: generarIdMensaje(),
    datos: datos || {},
    version: '1.0.0'
  };
  
  return enviarMensajeDirecto(mensaje, opcionesCompletas);
}

/**
 * Envía un mensaje construido directamente
 * @param {Object} mensaje - Mensaje a enviar
 * @param {Object} opciones - Opciones de envío
 * @returns {Promise<Object>} Respuesta del mensaje
 */
async function enviarMensajeDirecto(mensaje, opciones = {}) {
  const {
    timeout = configuracion.timeout,
    esperarRespuesta = true
  } = opciones;
  
  // Validar mensaje
  const validacion = validarMensaje(mensaje);
  if (!validacion.valido) {
    throw new Error('Estructura de mensaje inválida: ' + validacion.error);
  }
  
  logger.debug(`Enviando mensaje tipo: ${mensaje.tipo}`, mensaje);
  
  try {
    // Determinar la ventana destino
    let ventanaDestino = null;
    
    if (mensaje.destino === 'padre' || !mensaje.destino) {
      // Enviar al padre
      if (window.parent && window.parent !== window) {
        ventanaDestino = window.parent;
      } else {
        throw new Error('No se puede acceder a la ventana padre');
      }
    } else if (mensaje.destino === 'todos') {
      // Enviar a todos los iframes registrados
      return enviarATodosLosIframes(mensaje, opciones);
    } else {
      // Enviar a un iframe específico
      const iframe = document.getElementById(mensaje.destino);
      if (iframe && iframe.contentWindow) {
        ventanaDestino = iframe.contentWindow;
      } else {
        throw new Error(`No se encontró el iframe con ID: ${mensaje.destino}`);
      }
    }
    
    // Enviar el mensaje
    ventanaDestino.postMessage(mensaje, '*');
    
    // Si no se espera respuesta, resolver inmediatamente
    if (!esperarRespuesta) {
      logger.debug(`Mensaje enviado sin esperar respuesta: ${mensaje.idMensaje}`);
      return { exito: true, mensaje: 'Mensaje enviado correctamente' };
    }
    
    // Esperar respuesta con timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        mensajesPendientes.delete(mensaje.idMensaje);
        reject(new Error(`Timeout al esperar respuesta del mensaje ${mensaje.idMensaje}`));
      }, timeout);
      
      mensajesPendientes.set(mensaje.idMensaje, {
        resolve,
        reject,
        timeoutId,
        timestamp: Date.now()
      });
      
      logger.debug(`Esperando respuesta para mensaje: ${mensaje.idMensaje}`);
    });
    
  } catch (error) {
    logger.error('Error al enviar mensaje', { mensaje, error: error.message });
    throw error;
  }
}

/**
 * Envía un mensaje a todos los iframes registrados
 * @param {Object} mensaje - Mensaje a enviar
 * @param {Object} opciones - Opciones de envío
 * @returns {Promise<Array>} Array de respuestas
 */
async function enviarATodosLosIframes(mensaje, opciones = {}) {
  const iframes = ['hijo1-hamburguesa', 'hijo1-opciones', 'hijo2', 'hijo3', 'hijo4', 'hijo5-casa'];
  const promesas = [];
  
  for (const iframeId of iframes) {
    const iframe = document.getElementById(iframeId);
    if (iframe && iframe.contentWindow) {
      const mensajeIndividual = {
        ...mensaje,
        destino: iframeId,
        idMensaje: generarIdMensaje()
      };
      
      try {
        iframe.contentWindow.postMessage(mensajeIndividual, '*');
        logger.debug(`Mensaje enviado a ${iframeId}: ${mensajeIndividual.tipo}`);
        
        if (opciones.esperarRespuesta !== false) {
          const promesa = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              mensajesPendientes.delete(mensajeIndividual.idMensaje);
              resolve({ destino: iframeId, error: 'Timeout' });
            }, opciones.timeout || configuracion.timeout);
            
            mensajesPendientes.set(mensajeIndividual.idMensaje, {
              resolve: (datos) => resolve({ destino: iframeId, datos }),
              reject: (error) => resolve({ destino: iframeId, error }),
              timeoutId,
              timestamp: Date.now()
            });
          });
          promesas.push(promesa);
        }
      } catch (error) {
        logger.error(`Error enviando a ${iframeId}`, error);
        promesas.push(Promise.resolve({ destino: iframeId, error: error.message }));
      }
    }
  }
  
  if (promesas.length === 0) {
    return { exito: true, mensaje: 'Mensaje broadcast enviado' };
  }
  
  return Promise.all(promesas);
}

/**
 * Maneja los mensajes recibidos
 * @param {MessageEvent} event - Evento de mensaje
 */
function manejarMensajeRecibido(event) {
  const logPrefix = '[MENSAJERIA] [manejarMensajeRecibido]';
  console.log(`${logPrefix} Evento de mensaje recibido:`, event.origin, event.data);
  
  // Verificar el origen del mensaje para seguridad
  if (origenPermitido && event.origin !== origenPermitido) {
    logger.warn(`${logPrefix} Mensaje recibido de origen no permitido:`, event.origin);
    return;
  }

  let mensaje;
  let validacion;
  
  try {
    // 1. Validar estructura básica del mensaje
    if (typeof event.data !== 'object' || event.data === null || Array.isArray(event.data)) {
      throw crearObjetoError(
        'El mensaje debe ser un objeto',
        { codigo: ERROR_CODES.INVALID_MESSAGE, severidad: 'warn' }
      );
    }
    
    mensaje = event.data;
    
    // 2. Validar el mensaje con nuestro validador mejorado
    validacion = validarMensaje(mensaje);
    if (!validacion.valido) {
      throw crearObjetoError(
        validacion.error || 'Mensaje no válido',
        { 
          codigo: validacion.codigoError || ERROR_CODES.VALIDATION_ERROR,
          datos: { mensaje },
          severidad: 'warn'
        }
      );
    }
    
    // 3. Registrar el mensaje recibido con información detallada
    logger.debug(`${logPrefix} Mensaje recibido:`, {
      tipo: mensaje.tipo,
      origen: mensaje.origen,
      destino: mensaje.destino,
      id: mensaje.id,
      timestamp: mensaje.timestamp || 'no especificado'
    });
    
    // 4. Actualizar estadísticas
    estadisticas.mensajesRecibidos++;
    estadisticas.ultimoMensaje = new Date().toISOString();
    
    // 5. Verificar si es una respuesta a un mensaje pendiente
    if (mensaje.idRespuesta) {
      manejarRespuesta(mensaje);
      return;
    }
    
    // 6. Buscar manejador para este tipo de mensaje
    const manejador = manejadoresMensajes[mensaje.tipo];
    if (!manejador) {
      throw crearObjetoError(
        `No hay manejador para el tipo de mensaje: ${mensaje.tipo}`,
        { 
          codigo: ERROR_CODES.NOT_IMPLEMENTED,
          datos: { tipo: mensaje.tipo },
          severidad: 'warn'
        }
      );
    }
    
    // 7. Ejecutar el manejador con manejo de errores
    const ejecutarManejador = async () => {
      try {
        // Ejecutar el manejador
        const resultado = manejador(mensaje);
        
        // Manejar promesas si el manejador es asíncrono
        if (resultado && typeof resultado.then === 'function') {
          return await resultado;
        }
        return resultado;
      } catch (error) {
        logger.error(`${logPrefix} Error en el manejador para ${mensaje.tipo}:`, error);
        throw error; // Re-lanzar para manejarlo en el catch principal
      }
    };
    
    // 8. Manejar la respuesta del manejador
    const manejarRespuestaManejador = (resultado) => {
      if (mensaje.id) {
        enviarRespuesta(mensaje, resultado);
      }
      return resultado;
    };
    
    // 9. Manejar errores del manejador
    const manejarErrorManejador = (error) => {
      const errorInfo = {
        mensaje: error.message,
        codigo: error.codigo || ERROR_CODES.INTERNAL_ERROR,
        stack: config.debug ? error.stack : undefined,
        datos: error.datos
      };
      
      logger.error(`${logPrefix} Error en el manejador:`, errorInfo);
      
      if (mensaje.id) {
        enviarRespuesta(mensaje, null, {
          mensaje: error.message,
          codigo: error.codigo,
          ...(config.debug && { stack: error.stack })
        });
      }
      
      // Propagar el error para que pueda ser manejado por manejadores globales
      return Promise.reject(error);
    };
    
    // 10. Ejecutar la cadena de manejo
    const resultado = ejecutarManejador();
    
    // Si es una promesa, encadenar manejadores
    if (resultado && typeof resultado.then === 'function') {
      return resultado
        .then(manejarRespuestaManejador)
        .catch(manejarErrorManejador);
    }
    
    // Si no es una promesa, manejar directamente
    return manejarRespuestaManejador(resultado);
    
  } catch (error) {
    // Manejo de errores global
    const errorInfo = {
      mensaje: error.message,
      codigo: error.codigo || ERROR_CODES.INTERNAL_ERROR,
      stack: config.debug ? error.stack : undefined,
      datos: error.datos || { mensaje, validacion }
    };
    
    // Registrar el error con el nivel de severidad apropiado
    const nivelLog = error.severity === 'warn' ? 'warn' : 'error';
    logger[nivelLog](`${logPrefix} Error al procesar mensaje:`, errorInfo);
    
    // Enviar respuesta de error si es posible
    if (mensaje && mensaje.id) {
      enviarRespuesta(mensaje, null, {
        mensaje: error.message,
        codigo: error.codigo,
        ...(config.debug && { stack: error.stack })
      });
    }
    
    // Propagar el error para que pueda ser manejado por manejadores globales
    return Promise.reject(error);
  }
}

/**
 * Envía una respuesta a un mensaje recibido
 * @param {Object} mensajeOriginal - Mensaje original
 * @param {*} datos - Datos de respuesta
 * @param {string} error - Mensaje de error (opcional)
 */
function enviarRespuesta(mensajeOriginal, datos = null, error = null) {
  const respuesta = {
    tipo: `${mensajeOriginal.tipo}_respuesta`,
    destino: mensajeOriginal.origen,
    origen: iframeId,
    timestamp: new Date().toISOString(),
    idMensaje: generarIdMensaje(),
    idMensajeOriginal: mensajeOriginal.idMensaje,
    esRespuesta: true,
    datos,
    error,
    version: '1.0.0'
  };
      
  // Enviar respuesta sin esperar confirmación
  enviarMensajeDirecto(respuesta, { esperarRespuesta: false }).catch(err => {
    logger.error('Error al enviar respuesta', err);
    limpiar();
  });
}

/**
 * Limpia los mensajes expirados de la cola de mensajes pendientes
 */
function limpiarMensajesExpirados() {
  try {
    if (!mensajesPendientes || !(mensajesPendientes instanceof Map)) {
      console.warn('mensajesPendientes no está inicializado correctamente');
      return;
    }
    
    const ahora = Date.now();
    let eliminados = 0;
    
    // Crear un array de IDs a eliminar para evitar modificar el Map durante la iteración
    const idsAEliminar = [];
    
    for (const [id, mensaje] of mensajesPendientes.entries()) {
      if (mensaje && mensaje.tiempoExpiracion && ahora > mensaje.tiempoExpiracion) {
        idsAEliminar.push(id);
      }
    }
    
    // Eliminar los mensajes expirados
    for (const id of idsAEliminar) {
      mensajesPendientes.delete(id);
      eliminados++;
    }
    
    if (eliminados > 0) {
      if (logger && typeof logger.debug === 'function') {
        logger.debug(`Se eliminaron ${eliminados} mensajes expirados`);
      } else {
        console.debug(`[Mensajería] Se eliminaron ${eliminados} mensajes expirados`);
      }
    }
  } catch (error) {
    console.error('Error al limpiar mensajes expirados:', error);
  }
}

/**
 * Obtiene estadísticas del sistema de mensajería
 * @returns {Object} Estadísticas del sistema
 */
export function obtenerEstadisticas() {
  return {
    sistemaInicializado,
    iframeId,
    mensajesPendientes: mensajesPendientes.size,
    manejadoresRegistrados: manejadores.size,
    tiposManejadores: Array.from(manejadores.keys()),
    iframesRegistrados: Array.from(iframesRegistrados),
    configuracion: { ...configuracion }
  };
}

// ================== FUNCIONES ESPECIALIZADAS PARA EL MAPA ==================

/**
 * Envía un comando de navegación
 * @param {string} destino - Iframe destino o 'todos'
 * @param {string} accion - Acción de navegación
 * @param {Object} datos - Datos adicionales
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarComandoNavegacion(destino, accion, datos = {}) {
  return enviarMensaje(destino, TIPOS_MENSAJE.NAVEGACION.ESTADO, {
    accion,
    ...datos,
    timestamp: Date.now()
  });
}

/**
 * Envía un comando GPS
 * @param {string} destino - Iframe destino o 'todos'
 * @param {string} accion - Acción GPS
 * @param {Object} datos - Datos adicionales
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarComandoGPS(destino, accion, datos = {}) {
  return enviarMensaje(destino, TIPOS_MENSAJE.GPS.COMANDO, {
    accion,
    ...datos,
    timestamp: Date.now()
  });
}

/**
 * Actualiza coordenadas GPS
 * @param {string} destino - Iframe destino o 'todos'
 * @param {number} lat - Latitud
 * @param {number} lng - Longitud
 * @param {number} accuracy - Precisión
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function actualizarCoordenadasGPS(destino, lat, lng, accuracy = 0) {
  return enviarMensaje(destino, TIPOS_MENSAJE.GPS.ACTUALIZAR, {
    lat,
    lng,
    accuracy,
    timestamp: Date.now()
  }, { esperarRespuesta: false });
}

/**
 * Envía un comando de audio
 * @param {string} destino - Iframe destino
 * @param {string} comando - Comando de audio
 * @param {Object} datos - Datos adicionales
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarComandoAudio(destino, comando, datos = {}) {
  return enviarMensaje(destino, TIPOS_MENSAJE.AUDIO.COMANDO, {
    comando,
    ...datos,
    timestamp: Date.now()
  });
}

/**
 * Envía un mensaje de reto
 * @param {string} destino - Iframe destino
 * @param {Object} retoData - Datos del reto
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function enviarReto(destino, retoData) {
  return enviarMensaje(destino, TIPOS_MENSAJE.RETO.NUEVO, {
    ...retoData,
    timestamp: Date.now()
  });
}

/**
 * Sincroniza estado del sistema
 * @param {Object} estado - Estado a sincronizar
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function sincronizarEstado(estado) {
  return enviarMensaje('todos', TIPOS_MENSAJE.SISTEMA.SINCRONIZAR, {
    ...estado,
    timestamp: Date.now()
  }, { esperarRespuesta: false });
}

/**
 * Habilita controles en iframes
 * @param {string} modo - Modo de controles
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function habilitarControles(modo = 'casa') {
  return enviarMensaje('todos', TIPOS_MENSAJE.UI.HABILITAR_CONTROLES, {
    modo,
    timestamp: Date.now()
  }, { esperarRespuesta: false });
}

/**
 * Deshabilita controles en iframes
 * @param {string} motivo - Motivo de deshabilitación
 * @returns {Promise<Object>} Respuesta del mensaje
 */
export async function deshabilitarControles(motivo = 'desconocido') {
  return enviarMensaje('todos', TIPOS_MENSAJE.UI.DESHABILITAR_CONTROLES, {
    motivo,
    timestamp: Date.now()
  }, { esperarRespuesta: false });
}

/**
 * Envía un mensaje de cambio de modo
 * @returns {Promise<Object>} Respuesta del mensaje
 * @throws {Error} Si el modo no es válido o hay un error en el envío
 */
export async function enviarCambioModo(destino, nuevoModo, datosExtra = {}, timeout = 5000) {
  // Tipos de modos válidos
  const MODOS_VALIDOS = new Set(['casa', 'aventura']);

  // Validar el modo
  if (!MODOS_VALIDOS.has(nuevoModo)) {
    throw new Error(`Modo no válido: ${nuevoModo}. Debe ser 'casa' o 'aventura'`);
  }

  // Crear mensaje con metadatos
  const mensaje = {
    modo: nuevoModo,
    timestamp: Date.now(),
    origen: window.iframeId || 'sistema',
    ...datosExtra
  };

  // Configurar timeout
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout al cambiar a modo ${nuevoModo} después de ${timeout}ms`));
    }, timeout);
  });

  try {
    // Enviar mensaje con timeout
    const envio = enviarMensaje(destino, TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, mensaje);
    const resultado = await Promise.race([envio, timeoutPromise]);
    
    // Limpiar timeout
    clearTimeout(timeoutId);
    
    // Verificar respuesta
    if (resultado?.error) {
      throw new Error(`Error en la respuesta: ${resultado.error}`);
    }
    
    return resultado;
  } catch (error) {
    // Limpiar timeout en caso de error
    if (timeoutId) clearTimeout(timeoutId);
    
    // Registrar error y relanzar
    logger.error(`Error al cambiar a modo ${nuevoModo}:`, error);
    throw error;
  }
}

/**
 * Limpia todos los recursos del sistema de mensajería
 */
export function limpiar() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', manejarMensajeRecibido, false);
  }
  
  // Limpiar mensajes pendientes
  for (const [id, pendiente] of mensajesPendientes.entries()) {
    clearTimeout(pendiente.timeoutId);
    pendiente.reject(new Error('Sistema de mensajería limpiado'));
  }
  
  mensajesPendientes.clear();
  manejadores.clear();
  sistemaInicializado = false;
  iframeId = null;
  
  logger.info('Sistema de mensajería limpiado');
}

// ================== CONFIGURACIÓN DE LIMPIEZA AUTOMÁTICA ==================

// Limpiar mensajes expirados cada 30 segundos
if (typeof window !== 'undefined') {
  setInterval(limpiarMensajesExpirados, 30000);
}

// ================== EXPORTACIÓN POR DEFECTO ==================

/**
 * Objeto principal del sistema de mensajería
 */
const Mensajeria = {
  // Funciones principales
  inicializarMensajeria,
  enviarMensaje,
  enviarMensajeConReintenos: enviarMensaje, // ✅ ALIAS para compatibilidad
  registrarControlador,
  registrarManejador,
  
  // Funciones especializadas para mapa
  enviarComandoNavegacion,
  enviarComandoGPS,
  actualizarCoordenadasGPS,
  enviarComandoAudio,
  enviarReto,
  sincronizarEstado,
  habilitarControles,
  deshabilitarControles,
  
  // Gestión de iframes
  registrarIframe,
  obtenerIframesRegistrados,
  
  // Constantes
  TIPOS_MENSAJE,
  LOG_LEVELS,
  
  // Utilidades
  obtenerEstadisticas,
  limpiar,
  
  // Configuración
  configuracion: () => ({ ...configuracion }),
  enviarConfiguracion
};

// ================== MANEJADORES DE CONFIGURACIÓN ==================

/**
 * Envía una actualización de configuración a todos los iframes hijos
 * @param {Object} config - Configuración a enviar
 * @param {string} [config.tema] - Tema de la interfaz (claro/oscuro)
 * @param {string} [config.idioma] - Código de idioma (es, en, etc.)
 * @param {Object} [config.opciones] - Opciones adicionales de configuración
 * @returns {Promise<Array>} Respuestas de los iframes
 */
async function enviarConfiguracion(config) {
  const { tema, idioma, opciones } = config;
  
  // Validar que al menos un campo de configuración esté presente
  if (!tema && !idioma && !opciones) {
    throw new Error('Se debe proporcionar al menos un campo de configuración');
  }
  
  const mensaje = {
    tipo: TIPOS_MENSAJE.SISTEMA.CONFIGURACION,
    datos: { tema, idioma, opciones },
    timestamp: Date.now()
  };
  
  try {
    const respuestas = await enviarATodosLosIframes(mensaje, {
      esperarRespuesta: true,
      timeout: 5000
    });
    
    // Verificar si hubo errores en las respuestas
    const errores = respuestas.filter(r => r.error);
    if (errores.length > 0) {
      console.warn('Algunos iframes no aplicaron la configuración correctamente:', errores);
    }
    
    return respuestas;
    
  } catch (error) {
    console.error('Error al enviar configuración:', error);
    throw error;
  }
}

// ================== MANEJADORES DE CONFIGURACIÓN ==================

/**
 * Maneja los mensajes de configuración del sistema
 * @param {Object} mensaje - Mensaje recibido
 * @returns {Promise<void>}
 */
async function manejarConfiguracionSistema(mensaje) {
  const { tema, idioma, opciones } = mensaje.datos || {};
  
  try {
    // Aplicar tema si se especificó
    if (tema) {
      document.documentElement.setAttribute('data-tema', tema);
      localStorage.setItem('tema', tema);
    }
    
    // Aplicar idioma si se especificó
    if (idioma) {
      document.documentElement.lang = idioma;
      localStorage.setItem('idioma', idioma);
    }
    
    // Aplicar opciones adicionales
    if (opciones) {
      // Ejemplo: Actualizar configuración de notificaciones
      if (opciones.notificaciones !== undefined) {
        // Lógica para manejar notificaciones
      }
      
      // Ejemplo: Actualizar configuración de accesibilidad
      if (opciones.accesibilidad) {
        // Aplicar ajustes de accesibilidad
      }
    }
    
    // Notificar que la configuración se aplicó correctamente
    await enviarRespuesta(mensaje, { 
      exito: true, 
      configuracion: { tema, idioma }
    });
    
  } catch (error) {
    console.error('Error al aplicar configuración:', error);
    await enviarRespuesta(mensaje, null, 'Error al aplicar configuración');
  }
}

// ================== COMPATIBILIDAD HACIA ATRÁS ==================
// Hacer las funciones disponibles globalmente con alias
if (typeof window !== 'undefined') {
  window.enviarMensaje = enviarMensaje;
  window.enviarMensajeConReintenos = enviarMensaje;
  window.registrarManejador = registrarManejador;
  window.registrarControlador = registrarControlador;
  window.inicializarMensajeria = inicializarMensajeria;
  window.TIPOS_MENSAJE = TIPOS_MENSAJE;
  
  // Funciones especializadas para el mapa
  window.enviarComandoNavegacion = enviarComandoNavegacion;
  window.enviarComandoGPS = enviarComandoGPS;
  window.actualizarCoordenadasGPS = actualizarCoordenadasGPS;
  window.enviarComandoAudio = enviarComandoAudio;
  window.enviarReto = enviarReto;
  window.sincronizarEstado = sincronizarEstado;
  window.habilitarControles = habilitarControles;
  window.deshabilitarControles = deshabilitarControles;
  
  // Registro de iframes
  window.registrarIframe = registrarIframe;
  window.obtenerIframesRegistrados = obtenerIframesRegistrados;
  
  // Compatibilidad con alias legacy
  window.mensajeria = Mensajeria;
  window.Mensajeria = Mensajeria;
}

export default Mensajeria;

// En tu archivo principal (por ejemplo, en el hijo o el padre)
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await inicializarMensajeria({ iframeId: 'hijo2', logLevel: 1, debug: true });
    // Ahora puedes usar enviarMensaje, registrarControlador, etc.
    registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, tuManejador);
    // ...existing code...
  } catch (error) {
    console.error('Error al inicializar la mensajería:', error);
    // No continúes si falla la inicialización
  }
});

// Ejemplo de manejador real para cambio de modo
function tuManejador(mensaje) {
  // Procesa el cambio de modo recibido
  const { modo } = mensaje.datos || {};
  if (!modo) {
    return { exito: false, error: 'Modo no especificado' };
  }
  // Aquí puedes actualizar el estado de la aplicación según el modo
  console.log('[Mensajeria] Cambio de modo recibido:', modo);
  return { exito: true, modo };
}
