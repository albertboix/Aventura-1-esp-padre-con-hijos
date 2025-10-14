/**
 * Constantes utilizadas en toda la aplicación
 * @module Constants
 * @version 3.0.0
 * @description
 * Este módulo contiene todas las constantes utilizadas en la aplicación Valencia Tour,
 * incluyendo los tipos de mensajes estandarizados para la comunicación entre componentes,
 * niveles de log, modos de aplicación y códigos de error.
 * 
 * Los tipos de mensajes siguen el formato estandarizado CATEGORIA.ACCION y están agrupados
 * por categoría para mejor organización y mantenimiento.
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
 * 
 * Todos los tipos de mensajes siguen el formato CATEGORIA.ACCION
 * donde CATEGORIA define el ámbito o subsistema y ACCION define la operación específica
 * 
 * Ejemplos:
 * - SISTEMA.INICIALIZACION: Mensaje de inicialización del sistema
 * - NAVEGACION.CAMBIO_PARADA: Mensaje para cambiar a una parada específica
 * - AUDIO.REPRODUCIR: Mensaje para reproducir un audio
 */
export const TIPOS_MENSAJE = {
    SISTEMA: {
        INICIALIZACION: 'SISTEMA.INICIALIZACION',
        ESTADO: 'SISTEMA.ESTADO',
        CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
        COMPONENTE_LISTO: 'SISTEMA.COMPONENTE_LISTO',
        APLICACION_INICIALIZADA: 'SISTEMA.APLICACION_INICIALIZADA',
        COMPONENTE_INICIALIZADO: 'SISTEMA.COMPONENTE_INICIALIZADO', // Nuevo tipo detectado en uso
        INICIALIZACION_FINALIZADA: 'SISTEMA.INICIALIZACION_FINALIZADA', // Nuevo tipo detectado en uso
        SINCRONIZAR_ESTADO: 'SISTEMA.SINCRONIZAR_ESTADO', // Nuevo tipo detectado en uso
        PING: 'SISTEMA.PING', // Para verificar conectividad entre componentes
        PONG: 'SISTEMA.PONG', // Respuesta a un ping
        ACK: 'SISTEMA.ACK', // Confirmación positiva
        NACK: 'SISTEMA.NACK', // Confirmación negativa
        CONFIRMACION: 'SISTEMA.CONFIRMACION', // Tipo general de confirmación
        ERROR: 'SISTEMA.ERROR',
        DIAGNOSTICO: 'SISTEMA.DIAGNOSTICO' // Información de diagnóstico
    },
    NAVEGACION: {
        CAMBIO_PARADA: 'NAVEGACION.CAMBIO_PARADA',
        ESTABLECER_DESTINO: 'NAVEGACION.ESTABLECER_DESTINO',
        ACTUALIZAR_POSICION: 'NAVEGACION.ACTUALIZAR_POSICION',
        PARADAS: 'NAVEGACION.PARADAS', // Lista completa de paradas
        SIGUIENTE_PARADA: 'NAVEGACION.SIGUIENTE_PARADA', // Avanzar a siguiente parada
        PARADA_ANTERIOR: 'NAVEGACION.PARADA_ANTERIOR', // Volver a parada anterior
        CENTRAR_EN_UBICACION: 'NAVEGACION.CENTRAR_EN_UBICACION', // Centrar mapa en la ubicación actual
        MOSTRAR_MAPA_COMPLETO: 'NAVEGACION.MOSTRAR_MAPA_COMPLETO', // Mostrar vista completa del mapa
        MOSTRAR_MAPA_JPG: 'NAVEGACION.MOSTRAR_MAPA_JPG', // Mostrar imagen JPG del mapa
        ESTADO_MAPA: 'NAVEGACION.ESTADO_MAPA' // Informar sobre estado del mapa
    },
    DATOS: {
        SOLICITAR_PARADAS: 'DATOS.SOLICITAR_PARADAS',
        RESPUESTA_PARADAS: 'DATOS.RESPUESTA_PARADAS',
        ENVIAR_PARADAS: 'DATOS.ENVIAR_PARADAS',
        COORDENADAS_PARADAS: 'DATOS.COORDENADAS_PARADAS',
        PUNTOS: 'DATOS.PUNTOS',
        PUNTOS_RUTA: 'DATOS.PUNTOS_RUTA',
        PARADAS_ACTUALIZADAS: 'DATOS.PARADAS_ACTUALIZADAS', // Paradas actualizadas correctamente
        ERROR_ACTUALIZACION_PARADAS: 'DATOS.ERROR_ACTUALIZACION_PARADAS', // Error al actualizar paradas
        RESPUESTA_PARADA: 'DATOS.RESPUESTA_PARADA', // Respuesta a solicitud de parada específica
        ERROR: 'DATOS.ERROR' // Error general de datos
    },
    AUDIO: {
        REPRODUCIR: 'AUDIO.REPRODUCIR', // Iniciar reproducción
        CONTROL: 'AUDIO.CONTROL', // Comando general de control de audio
        PAUSAR: 'AUDIO.PAUSAR', // Pausar reproducción
        DETENER: 'AUDIO.DETENER', // Detener reproducción
        FIN_REPRODUCCION: 'AUDIO.FIN_REPRODUCCION', // Audio ha terminado
        ERROR: 'AUDIO.ERROR' // Error en reproducción
    },
    CONTROL: {
        MENU: 'CONTROL.MENU', // Control de menús
        CAMBIAR_MODO: 'CONTROL.CAMBIAR_MODO', // Cambio de modo
        CERRAR_TODOS: 'CONTROL.CERRAR_TODOS' // Cerrar todos los componentes
    },
    RETO: {
        MOSTRAR: 'RETO.MOSTRAR', // Mostrar un reto
        OCULTAR: 'RETO.OCULTAR', // Ocultar un reto
        COMPLETADO: 'RETO.COMPLETADO', // Reto completado
        FALLIDO: 'RETO.FALLIDO', // Reto fallido
        RESPUESTA: 'RETO.RESPUESTA', // Respuesta a un reto
        ACTIVAR: 'RETO.ACTIVAR' // Activar un reto específico
    },
    UI: {
        MODAL: 'UI.MODAL', // Mostrar/ocultar ventana modal
        NOTIFICACION: 'UI.NOTIFICACION', // Mostrar notificación
        ACTUALIZAR_VISTA: 'UI.ACTUALIZAR_VISTA', // Actualizar vista de un componente
        ACTUALIZACION: 'UI.ACTUALIZACION' // Actualización general de UI
    },
    MONITOREO: {
        EVENTO: 'MONITOREO.EVENTO',
        METRICA: 'MONITOREO.METRICA',
        LOG: 'MONITOREO.LOG'
    },
    // Nuevos tipos detectados en uso pero no definidos previamente
    USUARIO: {
        ACCION: 'USUARIO.ACCION',
        PREFERENCIAS: 'USUARIO.PREFERENCIAS',
        AUTENTICACION: 'USUARIO.AUTENTICACION'
    },
    // Añadir categoría MEDIOS que se usa en el código pero no estaba definida
    MEDIOS: {
        EVENTO: 'MEDIOS.EVENTO',
        MOSTRAR: 'MEDIOS.MOSTRAR',
        OCULTAR: 'MEDIOS.OCULTAR'
    }
};

/**
 * Lista de tipos de mensajes críticos que siempre deben usar el sistema ACK/NACK
 */
export const MENSAJES_CRITICOS = [
    // Mensajes del sistema
    'SISTEMA.INICIALIZACION',
    'SISTEMA.COMPONENTE_LISTO',
    'SISTEMA.PING',
    'SISTEMA.CAMBIO_MODO',
    
    // Mensajes de navegación
    'NAVEGACION.CAMBIO_PARADA',
    'NAVEGACION.ESTABLECER_DESTINO',
    
    // Mensajes de datos
    'DATOS.SOLICITAR_PARADAS',
    'DATOS.ENVIAR_PARADAS',
    
    // Mensajes de audio
    'AUDIO.CONTROL',
    'AUDIO.REPRODUCIR',
    'AUDIO.ERROR',
    
    // Mensajes de retos
    'RETO.MOSTRAR',
    'RETO.COMPLETADO',
    'RETO.RESPUESTA',
    
    // Mensajes de UI
    'UI.MODAL',
    'UI.NOTIFICACION',
    
    // Mensajes de control
    'CONTROL.MENU',
    'CONTROL.CAMBIAR_MODO',
    
    // Mensajes de usuario
    'USUARIO.ACCION',
    'USUARIO.PREFERENCIAS',
    'USUARIO.AUTENTICACION',
    
    // Mensajes de medios
    'MEDIOS.EVENTO',
    'MEDIOS.MOSTRAR',
    'MEDIOS.OCULTAR'
];

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
