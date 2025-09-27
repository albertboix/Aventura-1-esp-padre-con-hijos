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
 */
export const TIPOS_MENSAJE = {
    SISTEMA: {
        INICIALIZACION: 'SISTEMA.INICIALIZACION',
        INICIALIZACION_COMPLETADA: 'SISTEMA.INICIALIZACION_COMPLETADA',
        ESTADO: 'SISTEMA.ESTADO',
        ERROR: 'SISTEMA.ERROR',
        CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
        CONFIRMACION: 'SISTEMA.CONFIRMACION',
        COMPONENTE_LISTO: 'SISTEMA.COMPONENTE_LISTO',
        PING: 'SISTEMA.PING',
        PONG: 'SISTEMA.PONG',
        LISTO: 'SISTEMA.LISTO',
        COMPONENTE_INICIALIZADO: 'SISTEMA.COMPONENTE_INICIALIZADO',
        INICIALIZACION_FINALIZADA: 'SISTEMA.INICIALIZACION_FINALIZADA'
    },
    CONTROL: {
        HABILITAR: 'CONTROL.HABILITAR',
        DESHABILITAR: 'CONTROL.DESHABILITAR',
        GPS: 'CONTROL.GPS',
        CAMBIAR_MODO: 'CONTROL.CAMBIAR_MODO'
    },
    NAVEGACION: {
        CAMBIO_PARADA: 'NAVEGACION.CAMBIO_PARADA',
        SOLICITAR_DESTINO: 'NAVEGACION.SOLICITAR_DESTINO',
        ESTABLECER_DESTINO: 'NAVEGACION.ESTABLECER_DESTINO',
        ACTUALIZAR_POSICION: 'NAVEGACION.ACTUALIZAR_POSICION'
    },
    AUDIO: {
        REPRODUCIR: 'AUDIO.REPRODUCIR',
        PAUSAR: 'AUDIO.PAUSAR',
        FIN_REPRODUCCION: 'AUDIO.FIN_REPRODUCCION',
        FINALIZADO: 'AUDIO.FINALIZADO'
    },
    RETO: {
        MOSTRAR: 'RETO.MOSTRAR',
        OCULTAR: 'RETO.OCULTAR',
        COMPLETADO: 'RETO.COMPLETADO'
    },
    DATOS: {
        SOLICITAR_PARADAS: 'DATOS.SOLICITAR_PARADAS',
        SOLICITAR_PARADA: 'DATOS.SOLICITAR_PARADA',
        RESPUESTA_PARADAS: 'DATOS.RESPUESTA_PARADAS',
        RESPUESTA_PARADA: 'DATOS.RESPUESTA_PARADA'
    },
    UI: {
        MODAL: 'UI.MODAL'
    },
    MEDIOS: {
        EVENTO: 'MEDIOS.EVENTO',
        MOSTRAR: 'MEDIOS.MOSTRAR',
        OCULTAR: 'MEDIOS.OCULTAR'
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
