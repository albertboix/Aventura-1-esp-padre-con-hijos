/**
 * Constantes utilizadas en toda la aplicación
 * @module Constants
 */

/**
 * Tipos de mensajes para la comunicación entre iframes
 */
export const TIPOS_MENSAJE = {
    SISTEMA: {
        INICIALIZACION: 'SISTEMA.INICIALIZACION',
        INICIALIZACION_COMPLETADA: 'SISTEMA.INICIALIZACION_COMPLETADA',
        ERROR: 'SISTEMA.ERROR',
        CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
        CONFIRMACION: 'SISTEMA.CONFIRMACION',
        COMPONENTE_LISTO: 'SISTEMA.COMPONENTE_LISTO'
    },
    CONTROL: {
        HABILITAR: 'CONTROL.HABILITAR',
        DESHABILITAR: 'CONTROL.DESHABILITAR'
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
        SOLICITAR_PARADA: 'DATOS.SOLICITAR_PARADA'
    },
    UI: {
        MODAL: 'UI.MODAL'
    }
};

/**
 * Modos de la aplicación
 */
export const MODOS = {
    CASA: 'casa',
    AVENTURA: 'aventura'
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

export default {
    TIPOS_MENSAJE,
    MODOS,
    ESTADOS,
    CODIGOS_ERROR
};
