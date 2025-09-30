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
    // Mensajes del sistema
    SISTEMA: {
        // Inicialización
        INICIALIZACION: 'SISTEMA.INICIALIZACION',
        INICIALIZACION_COMPLETADA: 'SISTEMA.INICIALIZACION_COMPLETADA',
        COMPONENTE_INICIALIZADO: 'SISTEMA.COMPONENTE_INICIALIZADO',
        INICIALIZACION_FINALIZADA: 'SISTEMA.INICIALIZACION_FINALIZADA',
        
        // Estado y control
        ESTADO: 'SISTEMA.ESTADO',
        CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
        
        // Comunicación
        PING: 'SISTEMA.PING',
        PONG: 'SISTEMA.PONG',
        LISTO: 'SISTEMA.LISTO',
        CONFIRMACION: 'SISTEMA.CONFIRMACION',
        COMPONENTE_LISTO: 'SISTEMA.COMPONENTE_LISTO',
        
        // Errores
        ERROR: 'SISTEMA.ERROR'
    },
    
    // Mensajes de control
    CONTROL: {
        HABILITAR: 'CONTROL.HABILITAR',
        DESHABILITAR: 'CONTROL.DESHABILITAR',
        GPS: 'CONTROL.GPS',
        CAMBIAR_MODO: 'CONTROL.CAMBIAR_MODO'
    },
    
    // Mensajes de datos
    DATOS: {
        // Paradas
        SOLICITAR_PARADA: 'DATOS.SOLICITAR_PARADA',
        SOLICITAR_PARADAS: 'DATOS.SOLICITAR_PARADAS',
        ENVIAR_PARADAS: 'DATOS.ENVIAR_PARADAS',
        RESPUESTA_PARADA: 'DATOS.RESPUESTA_PARADA',
        RESPUESTA_PARADAS: 'DATOS.RESPUESTA_PARADAS',
        COORDENADAS_PARADAS: 'DATOS.COORDENADAS_PARADAS',
        
        // Puntos de ruta
        PUNTOS: 'DATOS.PUNTOS',
        PUNTOS_RUTA: 'DATOS.PUNTOS_RUTA',
        PARADAS: 'DATOS.PARADAS'
    },
    
    // Mensajes de navegación
    NAVEGACION: {
        // Control de navegación
        CAMBIO_PARADA: 'NAVEGACION.CAMBIO_PARADA',
        SOLICITAR_DESTINO: 'NAVEGACION.SOLICITAR_DESTINO',
        ESTABLECER_DESTINO: 'NAVEGACION.ESTABLECER_DESTINO',
        ACTUALIZAR_POSICION: 'NAVEGACION.ACTUALIZAR_POSICION',
        
        // Estado del mapa
        SOLICITAR_ESTADO_MAPA: 'NAVEGACION.SOLICITAR_ESTADO_MAPA',
        ESTADO_MAPA: 'NAVEGACION.ESTADO_MAPA',
        
        // Rutas
        MOSTRAR_RUTA: 'NAVEGACION.MOSTRAR_RUTA',
        ACTUALIZAR_ESTADO: 'NAVEGACION.ACTUALIZAR_ESTADO',
        
        // Gestión de paradas
        PARADAS: 'NAVEGACION.PARADAS'
    },
    
    // Mensajes de audio
    AUDIO: {
        REPRODUCIR: 'AUDIO.REPRODUCIR',
        PAUSAR: 'AUDIO.PAUSAR',
        FIN_REPRODUCCION: 'AUDIO.FIN_REPRODUCCION',
        FINALIZADO: 'AUDIO.FINALIZADO'
    },
    
    // Mensajes de retos
    RETO: {
        MOSTRAR: 'RETO.MOSTRAR',
        OCULTAR: 'RETO.OCULTAR',
        COMPLETADO: 'RETO.COMPLETADO'
    },
    
    // Interfaz de usuario
    UI: {
        MODAL: 'UI.MODAL',
        NOTIFICACION: 'UI.NOTIFICACION'
    },
    
    // Medios y multimedia
    MEDIOS: {
        EVENTO: 'MEDIOS.EVENTO',
        MOSTRAR: 'MEDIOS.MOSTRAR',
        OCULTAR: 'MEDIOS.OCULTAR'
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
export const CODIGOS_ERROR = {
    INICIALIZACION: 'ERROR_INICIALIZACION',
    MENSAJERIA: 'ERROR_MENSAJERIA',
    MAPA: 'ERROR_MAPA',
    AUDIO: 'ERROR_AUDIO',
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
