/**
 * Constantes utilizadas en toda la aplicación
 * @module Constants
 */

/**
 * Niveles de log disponibles
 */
export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

/**
 * Modos de la aplicación
 */
export const MODOS = {
    CASA: 'casa',
    AVENTURA: 'aventura'
};

/**
 * Tipos de mensajes para la comunicación entre iframes
 * Organizados por categorías para mejor mantenimiento
 */
export const TIPOS_MENSAJE = {
    SISTEMA: {
        INICIALIZACION: 'SISTEMA.INICIALIZACION',
        ESTADO: 'SISTEMA.ESTADO',
        CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
        COMPONENTE_LISTO: 'SISTEMA.COMPONENTE_LISTO', // Agregado
        ACK: 'SISTEMA.ACK',
        ERROR: 'SISTEMA.ERROR'
    },
    NAVEGACION: {
        CAMBIO_PARADA: 'NAVEGACION.CAMBIO_PARADA',
        ESTABLECER_DESTINO: 'NAVEGACION.ESTABLECER_DESTINO',
        ACTUALIZAR_POSICION: 'NAVEGACION.ACTUALIZAR_POSICION'
    },
    DATOS: {
        SOLICITAR_PARADAS: 'DATOS.SOLICITAR_PARADAS',
        RESPUESTA_PARADAS: 'DATOS.RESPUESTA_PARADAS'
    },
    AUDIO: {
        REPRODUCIR: 'AUDIO.REPRODUCIR'
    },
    RETO: {
        MOSTRAR: 'RETO.MOSTRAR'
    },
    MONITOREO: {
        EVENTO: 'MONITOREO.EVENTO',
        METRICA: 'MONITOREO.METRICA'
    }
};

/**
 * Códigos de error estandarizados
 */
export const ERRORES = {
    // Errores de validación (100-199)
    VALIDACION: {
        DATOS_INVALIDOS: {
            codigo: 100,
            mensaje: 'Los datos proporcionados no son válidos'
        },
        PARAMETROS_FALTANTES: {
            codigo: 101,
            mensaje: 'Faltan parámetros requeridos'
        },
        TIPO_MENSAJE_INVALIDO: {
            codigo: 102,
            mensaje: 'Tipo de mensaje no válido'
        }
    },
    
    // Errores de autenticación/autorización (200-299)
    AUTENTICACION: {
        NO_AUTORIZADO: {
            codigo: 201,
            mensaje: 'No autorizado para realizar esta acción'
        }
    },
    
    // Errores de recursos (300-399)
    RECURSO: {
        NO_ENCONTRADO: {
            codigo: 301,
            mensaje: 'Recurso no encontrado'
        },
        YA_EXISTE: {
            codigo: 302,
            mensaje: 'El recurso ya existe'
        }
    },
    
    // Errores del sistema (500-599)
    SISTEMA: {
        ERROR_INTERNO: {
            codigo: 500,
            mensaje: 'Error interno del servidor'
        },
        NO_IMPLEMENTADO: {
            codigo: 501,
            mensaje: 'Funcionalidad no implementada'
        },
        SERVICIO_NO_DISPONIBLE: {
            codigo: 503,
            mensaje: 'Servicio no disponible temporalmente'
        }
    }
};

/**
 * Estados de la aplicación
 */
export const ESTADOS = {
    INICIALIZANDO: 'inicializando',
    LISTO: 'listo',
    ERROR: 'error'
};

/**
 * Códigos de error
 */
/**
 * Niveles de severidad para eventos de monitoreo
 */
export const NIVELES_SEVERIDAD = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    CRITICO: 'critico'
};

/**
 * Tipos de métricas de rendimiento
 */
export const TIPOS_METRICAS = {
    TIEMPO_RESPUESTA: 'tiempo_respuesta',
    USO_MEMORIA: 'uso_memoria',
    TIEMPO_CARGA: 'tiempo_carga',
    ERRORES: 'errores',
    MENSAJES: 'mensajes'
};

/**
 * Categorías de eventos de monitoreo
 */
export const CATEGORIAS_EVENTOS = {
    SISTEMA: 'sistema',
    RED: 'red',
    RENDIMIENTO: 'rendimiento',
    ERROR: 'error',
    SEGURIDAD: 'seguridad',
    NEGOCIO: 'negocio'
};

export const CODIGOS_ERROR = {
    // Errores existentes
    INICIALIZACION: 'ERROR_INICIALIZACION',
    MENSAJERIA: 'ERROR_MENSAJERIA',
    MAPA: 'ERROR_MAPA',
    AUDIO: 'ERROR_AUDIO',
    
    // Nuevos códigos de error para monitoreo
    MONITOREO: {
        INICIALIZACION: 'ERROR_MONITOREO_INICIALIZACION',
        EVENTO_INVALIDO: 'ERROR_EVENTO_INVALIDO',
        METRICA_INVALIDA: 'ERROR_METRICA_INVALIDA',
        INFORME_FALLIDO: 'ERROR_INFORME_FALLIDO',
        DIAGNOSTICO_FALLIDO: 'ERROR_DIAGNOSTICO_FALLIDO',
        ALTA_LATENCIA: 'ADVERTENCIA_ALTA_LATENCIA',
        ALTA_MEMORIA: 'ADVERTENCIA_ALTA_MEMORIA',
        TASA_ERROR_ELEVADA: 'ADVERTENCIA_TASA_ERROR_ELEVADA'
    },
    RETO: 'ERROR_RETO',
    NAVEGACION: 'ERROR_NAVEGACION'
};

/**
 * Configuración de throttling para diferentes tipos de mensajes
 */
export const THROTTLE_CONFIG = {
    // Navegación GPS: 10 segundos por defecto
    'NAVEGACION.ACTUALIZAR_POSICION': 10000,
    // Cambio de parada: evitar cambios rápidos accidentales
    'NAVEGACION.CAMBIO_PARADA': 1000,
    // Eventos del sistema: permitir más frecuencia
    'SISTEMA.ESTADO': 500
};

export default {
    LOG_LEVELS,
    MODOS,
    TIPOS_MENSAJE,
    ESTADOS,
    CODIGOS_ERROR
};
