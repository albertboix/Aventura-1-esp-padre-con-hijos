/**
 * Módulo de utilidades para la comunicación entre iframes
 * Proporciona funciones estandarizadas para el envío y recepción de mensajes
 * Versión: 1.0.0
 */

// Códigos de error
const ERRORES = {
    MENSAJE_INVALIDO: 'MENSAJE_INVALIDO',
    DESTINO_NO_DISPONIBLE: 'DESTINO_NO_DISPONIBLE',
    TIEMPO_AGOTADO: 'TIEMPO_AGOTADO',
    ENVIO_FALLIDO: 'ENVIO_FALLIDO',
    DESTINO_INVALIDO: 'DESTINO_INVALIDO',
    TIPO_INVALIDO: 'TIPO_INVALIDO',
    VALIDACION_FALLIDA: 'VALIDACION_FALLIDA',
    MODO_INVALIDO: 'MODO_INVALIDO',
    CONTROL_DESHABILITADO: 'CONTROL_DESHABILITADO',
    GPS_DESHABILITADO: 'GPS_DESHABILITADO',
    AUDIO_NO_DISPONIBLE: 'AUDIO_NO_DISPONIBLE',
    NAVEGACION_NO_DISPONIBLE: 'NAVEGACION_NO_DISPONIBLE',
    RETO_NO_ENCONTRADO: 'RETO_NO_ENCONTRADO',
    RETO_YA_INICIADO: 'RETO_YA_INICIADO',
    RETO_NO_INICIADO: 'RETO_NO_INICIADO',
    RESPUESTA_INVALIDA: 'RESPUESTA_INVALIDA',
    INTENTOS_AGOTADOS: 'INTENTOS_AGOTADOS',
    ELEMENTO_NO_ENCONTRADO: 'ELEMENTO_NO_ENCONTRADO',
    OPERACION_NO_PERMITIDA: 'OPERACION_NO_PERMITIDA',
    SINTAXIS_INVALIDA: 'SINTAXIS_INVALIDA',
    TIPO_MENSAJE_INVALIDO: 'TIPO_MENSAJE_INVALIDO',
    ORIGEN_INVALIDO: 'ORIGEN_INVALIDO',
    DESTINO_INACCESIBLE: 'DESTINO_INACCESIBLE',
    TIEMPO_ESPERA_AGOTADO: 'TIEMPO_ESPERA_AGOTADO',
    SESION_EXPIRADA: 'SESION_EXPIRADA',
    NO_AUTORIZADO: 'NO_AUTORIZADO',
    RECURSO_NO_ENCONTRADO: 'RECURSO_NO_ENCONTRADO',
    METODO_NO_IMPLEMENTADO: 'METODO_NO_IMPLEMENTADO',
    VERSION_NO_SOPORTADA: 'VERSION_NO_SOPORTADA',
    LIMITE_EXCEDIDO: 'LIMITE_EXCEDIDO',
    CONFLICTO_ESTADO: 'CONFLICTO_ESTADO',
    SERVICIO_NO_DISPONIBLE: 'SERVICIO_NO_DISPONIBLE',
    ERROR_INTERNO: 'ERROR_INTERNO'
};

// Niveles de log para el sistema de mensajería
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// Configuración por defecto
let config = {
    logLevel: LOG_LEVELS.INFO,
    iframeId: 'desconocido',
    debug: false,
    maxRetries: 3,
    retryDelay: 1000,
    connectionCheckInterval: 5000,
    messageQueue: [],
    isOnline: true,
    messageHistory: new Map(),
    maxHistorySize: 100,
    dominioPermitido: '*',
    nombre: null,
    version: '1.0.0',
    modo: 'normal',
    controlesHabilitados: true,
    motivoDeshabilitacion: null,
    gpsActivo: true,
    ultimaUbicacion: null,
    precisionUbicacion: null,
    timestamp: Date.now()
};

// Estado de la conexión
let connectionCheckInterval = null;

/**
 * Clase de error personalizada para el sistema de mensajería
 */
class ErrorMensajeria extends Error {
    constructor(mensaje, codigo, detalles = {}) {
        super(mensaje);
        this.name = 'ErrorMensajeria';
        this.codigo = codigo;
        this.detalles = detalles;
        this.fecha = new Date();
    }

    toJSON() {
        return {
            error: this.message,
            codigo: this.codigo,
            detalles: this.detalles,
            fecha: this.fecha.toISOString(),
            stack: config.debug ? this.stack : undefined
        };
    }
}

/**
 * Tipos de mensajes estandarizados para la comunicación entre componentes
 * Cada categoría agrupa mensajes relacionados con una funcionalidad específica
 */
const TIPOS_MENSAJE = {
    // Comandos del sistema
    SISTEMA: {
        PING: 'sistema:ping',
        PONG: 'sistema:pong',
        INICIALIZACION: 'sistema:inicializacion',
        ERROR: 'sistema:error',
        CONFIGURACION: 'sistema:configuracion',
        CAMBIO_MODO: 'sistema:cambio_modo',
        HABILITAR_CONTROLES: 'sistema:habilitar_controles',
        DESHABILITAR_CONTROLES: 'sistema:deshabilitar_controles',
        GPS_ESTADO: 'sistema:gps_estado',
        GPS_ACTUALIZACION: 'sistema:gps_actualizacion',
        REENVIAR_A_HIJO: 'sistema:reenviar_a_hijo',
        BROADCAST: 'sistema:broadcast',
        ESTADO_SOLICITUD: 'sistema:estado_solicitud',
        ESTADO_ACTUALIZACION: 'sistema:estado_actualizacion'
    },
    
    // Navegación
    NAVEGACION: {
        INICIAR: 'navegacion:iniciar',
        DETENER: 'navegacion:detener',
        ACTUALIZAR_UBICACION: 'navegacion:actualizar_ubicacion',
        LLEGADA_PARADA: 'navegacion:llegada_parada',
        SIGUIENTE_PUNTO: 'navegacion:siguiente_punto',
        CAMBIO_PARADA: 'navegacion:cambio_parada',
        CAMBIO_TRAMO: 'navegacion:cambio_tramo',
        CAMBIAR_PUNTO: 'navegacion:cambiar_punto',
        SIMULAR_UBICACION: 'navegacion:simular_ubicacion',
        CAMBIO_MODO: 'navegacion:cambio_modo'
    },
    
    // Control de audio
    AUDIO: {
        REPRODUCIR: 'audio:reproducir',
        PAUSAR: 'audio:pausar',
        DETENER: 'audio:detener',
        ACTUALIZAR_PROGRESO: 'audio:actualizar_progreso',
        TERMINADO: 'audio:terminado',
        CAMBIO_VOLUMEN: 'audio:cambio_volumen',
        MUTEAR: 'audio:mutear',
        DESMUTEAR: 'audio:desmutear'
    },
    
    // Gestión de retos
    RETOS: {
        MOSTRAR: 'retos:mostrar',
        OCULTAR: 'retos:ocultar',
        INICIAR: 'retos:iniciar',
        COMPLETADO: 'retos:completado',
        FALLIDO: 'retos:fallido',
        REINICIAR: 'retos:reiniciar',
        RESULTADO: 'retos:resultado',
        PROGRESO: 'retos:progreso'
    },
    
    // Gestión de estado
    ESTADO: {
        // Operaciones básicas
        OBTENER: 'estado:obtener',
        ESTABLECER: 'estado:establecer',
        ACTUALIZAR: 'estado:actualizar',
        ELIMINAR: 'estado:eliminar',
        LIMPIAR: 'estado:limpiar',
        
        // Sincronización
        SOLICITAR: 'estado:solicitar',
        SINCRONIZAR: 'estado:sincronizar',
        ACTUALIZAR_PARCIAL: 'estado:actualizar_parcial',
        
        // Historial y reversión
        OBTENER_HISTORIAL: 'estado:obtener_historial',
        REVERTIR_CAMBIO: 'estado:revertir_cambio',
        DESHACER: 'estado:deshacer',
        REHACER: 'estado:rehacer',
        
        // Persistencia
        PERSISTIR: 'estado:persistir',
        RESTAURAR: 'estado:restaurar',
        RESPALDAR: 'estado:respaldar',
        RESTAURAR_RESPALDO: 'estado:restaurar_respaldo',
        ELIMINAR_RESPALDO: 'estado:eliminar_respaldo',
        LISTAR_RESPALDOS: 'estado:listar_respaldos',
        
        // Utilidades
        EXPORTAR: 'estado:exportar',
        IMPORTAR: 'estado:importar',
        VALIDAR: 'estado:validar',
        MIGRAR: 'estado:migrar',
        COMPARAR: 'estado:comparar',
        FUSIONAR: 'estado:fusionar',
        CLONAR: 'estado:clonar',
        
        // Control de ciclo de vida
        INICIALIZAR: 'estado:inicializar',
        RESETEAR: 'estado:resetear',
        DESTRUIR: 'estado:destruir',
        SUSPENDER: 'estado:suspender',
        REANUDAR: 'estado:reanudar',
        CONGELAR: 'estado:congelar',
        DESCONGELAR: 'estado:descongelar',
        
        // Suscripción a cambios
        SUSCRIBIRSE: 'estado:suscribirse',
        CANCELAR_SUSCRIPCION: 'estado:cancelar_suscripcion',
        NOTIFICAR_CAMBIO: 'estado:notificar_cambio',
        OBSERVAR: 'estado:observar',
        DEJAR_DE_OBSERVAR: 'estado:dejar_de_observar',
        NOTIFICAR_OBSERVADORES: 'estado:notificar_observadores',
        LIMPIAR_OBSERVADORES: 'estado:limpiar_observadores',
        OBTENER_OBSERVADORES: 'estado:obtener_observadores',
        CAMBIO_MODO: 'estado:cambio_modo',
        ACTUALIZAR_CONTROLES: 'estado:actualizar_controles'
    },
    
    // Interfaz de usuario
    UI: {
        MOSTRAR_MENSAJE: 'ui:mostrar_mensaje',
        OCULTAR_MENSAJE: 'ui:ocultar_mensaje',
        ACTUALIZAR_INTERFAZ: 'ui:actualizar_interfaz',
        CAMBIO_MODO: 'ui:cambio_modo',
        NOTIFICACION: 'ui:notificacion',
        // Acciones adicionales de UI
        ACTUALIZAR_TITULO: 'ui:actualizar_titulo',
        ACTUALIZAR_DESCRIPCION: 'ui:actualizar_descripcion',
        ACTUALIZAR_IMAGEN: 'ui:actualizar_imagen',
        ACTUALIZAR_ESTILO: 'ui:actualizar_estilo',
        ACTUALIZAR_CLASE: 'ui:actualizar_clase',
        ACTUALIZAR_ATRIBUTO: 'ui:actualizar_atributo',
        ACTUALIZAR_PROPIEDAD: 'ui:actualizar_propiedad',
        ACTUALIZAR_ESTADO: 'ui:actualizar_estado',
        ACTUALIZAR_VISIBILIDAD: 'ui:actualizar_visibilidad',
        ACTUALIZAR_OPACIDAD: 'ui:actualizar_opacidad',
        ACTUALIZAR_POSICION: 'ui:actualizar_posicion',
        ACTUALIZAR_TAMANO: 'ui:actualizar_tamano',
        ACTUALIZAR_COLOR: 'ui:actualizar_color',
        ACTUALIZAR_FUENTE: 'ui:actualizar_fuente',
        ACTUALIZAR_BORDE: 'ui:actualizar_borde',
        ACTUALIZAR_MARGEN: 'ui:actualizar_margen',
        ACTUALIZAR_RELLENO: 'ui:actualizar_relleno',
        ACTUALIZAR_ALINEACION: 'ui:actualizar_alineacion',
        ACTUALIZAR_ORDEN: 'ui:actualizar_orden',
        ACTUALIZAR_ZINDEX: 'ui:actualizar_zindex',
        ACTUALIZAR_CURSOR: 'ui:actualizar_cursor',
        ACTUALIZAR_TRANSICION: 'ui:actualizar_transicion',
        ACTUALIZAR_ANIMACION: 'ui:actualizar_animacion',
        ACTUALIZAR_TRANSFORMACION: 'ui:actualizar_transformacion',
        ACTUALIZAR_FILTRO: 'ui:actualizar_filtro',
        ACTUALIZAR_FONDO: 'ui:actualizar_fondo',
        ACTUALIZAR_SOMBRA: 'ui:actualizar_sombra',
        ACTUALIZAR_CONTENIDO: 'ui:actualizar_contenido',
        ACTUALIZAR_TEXTO: 'ui:actualizar_texto',
        ACTUALIZAR_HTML: 'ui:actualizar_html',
        ACTUALIZAR_VALOR: 'ui:actualizar_valor',
        ACTUALIZAR_PLACEHOLDER: 'ui:actualizar_placeholder',
        ACTUALIZAR_DESHABILITADO: 'ui:actualizar_deshabilitado',
        ACTUALIZAR_SOLO_LECTURA: 'ui:actualizar_solo_lectura',
        ACTUALIZAR_REQUERIDO: 'ui:actualizar_requerido',
        ACTUALIZAR_VALIDACION: 'ui:actualizar_validacion',
        ACTUALIZAR_MENSAJE_ERROR: 'ui:actualizar_mensaje_error',
        ACTUALIZAR_ESTADO_VALIDACION: 'ui:actualizar_estado_validacion',
        ACTUALIZAR_ESTADO_CARGA: 'ui:actualizar_estado_carga',
        ACTUALIZAR_ESTADO_EXITO: 'ui:actualizar_estado_exito',
        ACTUALIZAR_ESTADO_ERROR: 'ui:actualizar_estado_error',
        ACTUALIZAR_ESTADO_ADVERTENCIA: 'ui:actualizar_estado_advertencia',
        ACTUALIZAR_ESTADO_INFO: 'ui:actualizar_estado_info',
        ACTUALIZAR_ESTADO_NEUTRO: 'ui:actualizar_estado_neutro',
        ACTUALIZAR_ESTADO_PRIMARIO: 'ui:actualizar_estado_primario',
        ACTUALIZAR_ESTADO_SECUNDARIO: 'ui:actualizar_estado_secundario',
        ACTUALIZAR_ESTADO_TERCIARIO: 'ui:actualizar_estado_terciario',
        ACTUALIZAR_ESTADO_CUATERNARIO: 'ui:actualizar_estado_cuaternario',
        ACTUALIZAR_ESTADO_QUINTENARIO: 'ui:actualizar_estado_quintenario',
        ACTUALIZAR_ESTADO_SENCILLO: 'ui:actualizar_estado_sencillo',
        ACTUALIZAR_ESTADO_COMPLEJO: 'ui:actualizar_estado_complejo',
        ACTUALIZAR_ESTADO_AVANZADO: 'ui:actualizar_estado_avanzado',
        ACTUALIZAR_ESTADO_EXPERTO: 'ui:actualizar_estado_experto',
        ACTUALIZAR_ESTADO_MAESTRO: 'ui:actualizar_estado_maestro',
        ACTUALIZAR_ESTADO_DIOS: 'ui:actualizar_estado_dios',
        ACTUALIZAR_ESTADO_LEGENDARIO: 'ui:actualizar_estado_legendario',
        ACTUALIZAR_ESTADO_EPICO: 'ui:actualizar_estado_epico',
        ACTUALIZAR_ESTADO_RARO: 'ui:actualizar_estado_raro',
        ACTUALIZAR_ESTADO_COMUN: 'ui:actualizar_estado_comun',
        ACTUALIZAR_ESTADO_PERSONALIZADO: 'ui:actualizar_estado_personalizado',
        ACTUALIZAR_ESTADO_DEFAULT: 'ui:actualizar_estado_default',
        ACTUALIZAR_ESTADO_SUCCESS: 'ui:actualizar_estado_success',
        ACTUALIZAR_ESTADO_DANGER: 'ui:actualizar_estado_danger',
        ACTUALIZAR_ESTADO_WARNING: 'ui:actualizar_estado_warning',
        ACTUALIZAR_ESTADO_INFO: 'ui:actualizar_estado_info',
        ACTUALIZAR_ESTADO_LIGHT: 'ui:actualizar_estado_light',
        ACTUALIZAR_ESTADO_DARK: 'ui:actualizar_estado_dark',
        ACTUALIZAR_ESTADO_LINK: 'ui:actualizar_estado_link',
        ACTUALIZAR_ESTADO_PRIMARY: 'ui:actualizar_estado_primary',
        ACTUALIZAR_ESTADO_SECONDARY: 'ui:actualizar_estado_secondary',
        ACTUALIZAR_ESTADO_TERTIARY: 'ui:actualizar_estado_tertiary',
        ACTUALIZAR_ESTADO_QUATERNARY: 'ui:actualizar_estado_quaternary',
        ACTUALIZAR_ESTADO_QUINARY: 'ui:actualizar_estado_quinary',
        ACTUALIZAR_ESTADO_SENARY: 'ui:actualizar_estado_senary',
        ACTUALIZAR_ESTADO_SEPTENARY: 'ui:actualizar_estado_septenary',
        ACTUALIZAR_ESTADO_OCTONARY: 'ui:actualizar_estado_octonary',
        ACTUALIZAR_ESTADO_NONARY: 'ui:actualizar_estado_nonary',
        ACTUALIZAR_ESTADO_DENARY: 'ui:actualizar_estado_denary'
    }
};

// Clase para manejar el registro de mensajes
class Logger {
    constructor() {
        this.logs = [];
        this.logLevel = config.logLevel;
    }

    /**
     * Registra un mensaje de depuración
     * @param {string} mensaje - Mensaje a registrar
     * @param {Object} [datos] - Datos adicionales para registrar
     */
    debug(mensaje, datos = {}) {
        this.registrar(LOG_LEVELS.DEBUG, mensaje, datos);
    }

    /**
     * Registra un mensaje informativo
     * @param {string} mensaje - Mensaje a registrar
     * @param {Object} [datos] - Datos adicionales para registrar
     */
    info(mensaje, datos = {}) {
        this.registrar(LOG_LEVELS.INFO, mensaje, datos);
    }

    /**
     * Registra una advertencia
     * @param {string} mensaje - Mensaje a registrar
     * @param {Object} [datos] - Datos adicionales para registrar
     */
    warn(mensaje, datos = {}) {
        this.registrar(LOG_LEVELS.WARN, mensaje, datos);
    }

    /**
     * Registra un error
     * @param {string} mensaje - Mensaje a registrar
     * @param {Object} [datos] - Datos adicionales para registrar
     */
    error(mensaje, datos = {}) {
        this.registrar(LOG_LEVELS.ERROR, mensaje, datos);
    }

    /**
     * Registra un mensaje con el nivel especificado
     * @param {number} nivel - Nivel de log
     * @param {string} mensaje - Mensaje a registrar
     * @param {Object} [datos] - Datos adicionales para registrar
     * @private
     */
    registrar(nivel, mensaje, datos = {}) {
        if (nivel < this.logLevel) return;

        const entrada = {
            timestamp: new Date().toISOString(),
            nivel: this.obtenerNombreNivel(nivel),
            mensaje,
            datos,
            iframeId: config.iframeId
        };

        this.logs.push(entrada);

        // Limitar el tamaño del historial
        if (this.logs.length > config.maxHistorySize) {
            this.logs.shift();
        }

        // Mostrar en consola según el nivel
        if (config.debug) {
            const estilo = this.obtenerEstiloConsola(nivel);
            console.log(`%c[${entrada.timestamp}] [${entrada.nivel}] ${entrada.mensaje}`, estilo, datos);
        }
    }

    /**
     * Obtiene el nombre del nivel de log
     * @param {number} nivel - Nivel de log
     * @returns {string} Nombre del nivel
     * @private
     */
    obtenerNombreNivel(nivel) {
        return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === nivel) || 'UNKNOWN';
    }

    /**
     * Obtiene el estilo de consola según el nivel de log
     * @param {number} nivel - Nivel de log
     * @returns {string} Estilo CSS para la consola
     * @private
     */
    obtenerEstiloConsola(nivel) {
        const estilos = {
            [LOG_LEVELS.DEBUG]: 'color: #666;',
            [LOG_LEVELS.INFO]: 'color: #2196F3;',
            [LOG_LEVELS.WARN]: 'color: #FF9800;',
            [LOG_LEVELS.ERROR]: 'color: #F44336; font-weight: bold;',
        };
        return estilos[nivel] || '';
    }

    /**
     * Obtiene el historial de logs
     * @returns {Array} Historial de logs
     */
    obtenerHistorial() {
        return [...this.logs];
    }

    /**
     * Limpia el historial de logs
     */
    limpiarHistorial() {
        this.logs = [];
    }
}

// Instancia global del logger
const logger = new Logger();

// Exportar la API pública
export {
    TIPOS_MENSAJE,
    ERRORES,
    LOG_LEVELS,
    ErrorMensajeria,
    logger,
    config
};

// Inicialización del sistema de mensajería
const mensajeria = (() => {
    // Estado de la conexión
    let connectionCheckInterval = null;
    
    // Tipos de mensajes estandarizados
    const TIPOS_MENSAJE = {
            // Comandos del sistema
            SISTEMA: {
                PING: 'sistema:ping',
                PONG: 'sistema:pong',
                INICIALIZACION: 'sistema:inicializacion',
                ERROR: 'sistema:error',
                CONFIGURACION: 'sistema:configuracion',
                CAMBIO_MODO: 'sistema:cambio_modo',
                HABILITAR_CONTROLES: 'sistema:habilitar_controles',
                DESHABILITAR_CONTROLES: 'sistema:deshabilitar_controles',
                GPS_ESTADO: 'sistema:gps_estado',
                GPS_ACTUALIZACION: 'sistema:gps_actualizacion',
                REENVIAR_A_HIJO: 'sistema:reenviar_a_hijo',
                BROADCAST: 'sistema:broadcast',
                ESTADO_SOLICITUD: 'sistema:estado_solicitud',
                ESTADO_ACTUALIZACION: 'sistema:estado_actualizacion'
            },
            
            // Navegación
            NAVEGACION: {
                INICIAR: 'navegacion:iniciar',
                DETENER: 'navegacion:detener',
                ACTUALIZAR_UBICACION: 'navegacion:actualizar_ubicacion',
                LLEGADA_PARADA: 'navegacion:llegada_parada',
                SIGUIENTE_PUNTO: 'navegacion:siguiente_punto',
                CAMBIO_PARADA: 'navegacion:cambio_parada',
                CAMBIO_TRAMO: 'navegacion:cambio_tramo'
            },
            
            // Audio
            AUDIO: {
                REPRODUCIR: 'audio:reproducir',
                PAUSAR: 'audio:pausar',
                DETENER: 'audio:detener',
                ACTUALIZAR_PROGRESO: 'audio:actualizar_progreso',
                TERMINADO: 'audio:terminado',
                CAMBIO_VOLUMEN: 'audio:cambio_volumen',
                MUTEAR: 'audio:mutear',
                DESMUTEAR: 'audio:desmutear'
            },
            
            // Retos
            RETOS: {
                MOSTRAR: 'retos:mostrar',
                OCULTAR: 'retos:ocultar',
                INICIAR: 'retos:iniciar',
                COMPLETADO: 'retos:completado',
                FALLIDO: 'retos:fallido',
                REINICIAR: 'retos:reiniciar',
                RESULTADO: 'retos:resultado',
                PROGRESO: 'retos:progreso'
            },
            
            // Estado
            ESTADO: {
                ACTUALIZAR: 'estado:actualizar',
                SOLICITAR: 'estado:solicitar',
                SINCRONIZAR: 'estado:sincronizar',
                CAMBIO_MODO: 'estado:cambio_modo',
                ACTUALIZAR_CONTROLES: 'estado:actualizar_controles'
            },
            
            // Interfaz de usuario
            UI: {
                MOSTRAR_MENSAJE: 'ui:mostrar_mensaje',
                OCULTAR_MENSAJE: 'ui:ocultar_mensaje',
                ACTUALIZAR_INTERFAZ: 'ui:actualizar_interfaz',
                CAMBIO_MODO: 'ui:cambio_modo',
            controlesHabilitados: true,
            motivo: 'Controles activos en modo pruebas'
            motivoDeshabilitacion: null,
            ultimaAccion: null,
            configuracion: {},
            modosDisponibles: {
                normal: { permiteInteraccion: true, descripcion: 'Modo normal' },
                soloLectura: { permiteInteraccion: false, descripcion: 'Modo solo lectura' },
                mantenimiento: { permiteInteraccion: false, descripcion: 'Modo mantenimiento' },
                pruebas: { permiteInteraccion: true, descripcion: 'Modo pruebas' }
            },
            listenersModo: []
        };
        
        // Estado global del GPS
        const estadoGPS = {
            gpsActivo: true,
            ultimaUbicacion: null,
            precisionUbicacion: null,
            ultimaAccion: null,
            timestamp: Date.now(),
            version: '1.0.0'
        };
        
        /**
         * Habilita o configura los controles de la aplicación
         * @param {string} [modo='normal'] - Modo de operación ('normal', 'soloLectura', 'mantenimiento', 'pruebas')
         * @param {Object} [opciones={}] - Opciones adicionales de configuración
         * @returns {Object} Estado actual de los controles
         */
        function enableControls(modo = 'normal', opciones = {}) {
            const modoAnterior = estadoAplicacion.modo;
            const modoValido = estadoAplicacion.modosDisponibles[modo];
            
            if (!modoValido) {
                logger.warn(`Intento de habilitar controles con modo inválido: ${modo}`, { modoAnterior });
                throw new ErrorMensajeria(
                    `Modo '${modo}' no es un modo válido`,
                    'MODO_INVALIDO',
                    { modo, modosDisponibles: Object.keys(estadoAplicacion.modosDisponibles) }
                );
            }
            
            // Actualizar el estado
            estadoAplicacion.modo = modo;
            estadoAplicacion.controlesHabilitados = modoValido.permiteInteraccion;
            estadoAplicacion.motivoDeshabilitacion = null;
            
            // Aplicar configuración adicional si se proporciona
            if (opciones.configuracion) {
                estadoAplicacion.configuracion = { ...estadoAplicacion.configuracion, ...opciones.configuracion };
            }
            
            // Notificar a los oyentes del cambio de modo
            manejarCambioModo(modo, modoAnterior, opciones);
            
            logger.info(`Controles habilitados en modo: ${modo}`, {
                modoAnterior,
                modoNuevo: modo,
                opciones
            });
            
            return {
                modo: estadoAplicacion.modo,
                controlesHabilitados: estadoAplicacion.controlesHabilitados,
                configuracion: { ...estadoAplicacion.configuracion }
            };
        }
        
        /**
         * Deshabilita los controles de la aplicación
         * @param {string} motivo - Razón por la que se deshabilitan los controles
         * @param {Object} [opciones={}] - Opciones adicionales
         * @param {boolean} [opciones.forzar=false] - Si es true, fuerza la deshabilitación incluso en modo de pruebas
         * @returns {Object} Estado actual de los controles
         */
        function disableControls(motivo, opciones = {}) {
            if (estadoAplicacion.modo === 'pruebas' && !opciones.forzar) {
                logger.debug('No se deshabilitan controles en modo pruebas', { motivo });
                return {
                    modo: estadoAplicacion.modo,
                    controlesHabilitados: true,
                    motivo: 'Controles activos en modo pruebas'
                };
            }
            
            const estadoAnterior = {
                modo: estadoAplicacion.modo,
                controlesHabilitados: estadoAplicacion.controlesHabilitados,
                motivo: estadoAplicacion.motivoDeshabilitacion
            };
            
            // Actualizar estado
            estadoAplicacion.controlesHabilitados = false;
            estadoAplicacion.motivoDeshabilitacion = motivo || 'Motivo no especificado';
            
            // Notificar a los oyentes del cambio de estado
            const evento = new CustomEvent('controles:deshabilitados', {
                detail: {
                    motivo,
                    opciones,
                    estadoAnterior,
                    estadoNuevo: {
                        modo: estadoAplicacion.modo,
                        controlesHabilitados: false,
                        motivo: estadoAplicacion.motivoDeshabilitacion
                    }
                }
            });
            
            window.dispatchEvent(evento);
            
            logger.info('Controles deshabilitados', {
                motivo,
                opciones,
                estadoAnterior,
                estadoNuevo: {
                    modo: estadoAplicacion.modo,
                    controlesHabilitados: false,
                    motivo: estadoAplicacion.motivoDeshabilitacion
                }
            });
            
            return {
                modo: estadoAplicacion.modo,
                controlesHabilitados: false,
                motivo: estadoAplicacion.motivoDeshabilitacion
            };
        }
        
        /**
         * Maneja los cambios de modo en la aplicación
         * @param {string} modoNuevo - Nuevo modo de operación
         * @param {string} modoAnterior - Modo de operación anterior
         * @param {Object} [opciones={}] - Opciones adicionales
         */
        function manejarCambioModo(modoNuevo, modoAnterior, opciones = {}) {
            // Verificar si hay un cambio real de modo
            if (modoNuevo === modoAnterior) {
                return;
            }
            
            const modoInfo = estadoAplicacion.modosDisponibles[modoNuevo] || {};
            
            // Crear el evento de cambio de modo
            const evento = new CustomEvent('aplicacion:cambioModo', {
                cancelable: true,
                detail: {
                    modo: modoNuevo,
                    modoAnterior,
                    permiteInteraccion: modoInfo.permiteInteraccion || false,
                    descripcion: modoInfo.descripcion || 'Modo sin descripción',
                    opciones,
                    timestamp: Date.now()
                }
            });
            
            // Disparar el evento y verificar si fue cancelado
            const continuar = window.dispatchEvent(evento);
            
            if (!continuar) {
                // Revertir el cambio si el evento fue cancelado
                logger.warn('Cambio de modo cancelado por un oyente', {
                    modoNuevo,
                    modoAnterior,
                    opciones
                });
                
                // Revertir al modo anterior
                estadoAplicacion.modo = modoAnterior;
                const modoAnteriorInfo = estadoAplicacion.modosDisponibles[modoAnterior] || {};
                estadoAplicacion.controlesHabilitados = modoAnteriorInfo.permiteInteraccion || false;
                
                return false;
            }
            
            // Notificar a los oyentes registrados
            estadoAplicacion.listenersModo.forEach(listener => {
                try {
                    listener(modoNuevo, modoAnterior, opciones);
                } catch (error) {
                    logger.error('Error en listener de cambio de modo', {
                        error: error.message,
                        listener: listener.toString().substring(0, 100) + '...',
                        modoNuevo,
                        modoAnterior
                    });
                }
            });
            
            // Registrar el cambio de modo
            logger.info('Cambio de modo completado', {
                modoAnterior,
                modoNuevo,
                permiteInteraccion: modoInfo.permiteInteraccion || false,
                opciones
            });
            
            return true;
        }
        
        /**
         * Registra un listener para cambios de modo
         * @param {Function} callback - Función a ejecutar cuando cambia el modo
         * @returns {Function} Función para eliminar el listener
         */
        function onCambioModo(callback) {
            if (typeof callback !== 'function') {
                throw new ErrorMensajeria(
                    'Se requiere una función como callback',
                    'TIPO_INVALIDO',
                    { tipo: typeof callback }
                );
            }
            
            estadoAplicacion.listenersModo.push(callback);
            
            // Retornar función para eliminar el listener
            return () => {
                const index = estadoAplicacion.listenersModo.indexOf(callback);
                if (index !== -1) {
                    estadoAplicacion.listenersModo.splice(index, 1);
                }
            };
        }
        
        /**
         * Actualiza el estado del GPS en la aplicación
         * @param {boolean} activo - Estado del GPS
         * @param {Object} ubicacion - Datos de ubicación (opcional)
         */
        function actualizarEstadoGPS(activo, ubicacion = null) {
            estadoGlobal.gpsActivo = activo;
            
            if (ubicacion) {
                estadoGlobal.ultimaUbicacion = {
                    latitud: ubicacion.latitud || null,
                    longitud: ubicacion.longitud || null,
                    precision: ubicacion.precision || null,
                    timestamp: Date.now()
                };
                estadoGlobal.precisionUbicacion = ubicacion.precision || null;
            }
            
            // Notificar a los controladores registrados
            dispararEvento('actualizacionGPS', {
                gpsActivo: activo,
                ubicacion: estadoGlobal.ultimaUbicacion
            });
        }
        
        /**
         * Maneja los mensajes entrantes con validación y registro mejorados
         * @param {MessageEvent} event - Evento de mensaje recibido
         */
        function manejarMensajeEntrante(event) {
            try {
                // Validar el evento
                if (!event || !event.data) {
                    logger.debug('Evento de mensaje sin datos');
                    return;
                }
        
                const mensaje = event.data;
                const origen = event.origin || 'desconocido';
                
                // Crear contexto para logs
                const contexto = {
                    origen,
                    mensajeId: mensaje?.id || 'desconocido',
                    tipo: mensaje?.tipo || 'desconocido',
                    timestamp: new Date().toISOString()
                };
                
                // Validación básica del mensaje
                if (typeof mensaje !== 'object' || mensaje === null) {
                    logger.warn('Mensaje recibido no es un objeto', contexto);
                    return;
                }
        
                // Validar estructura del mensaje
                const validacion = validarMensaje(mensaje);
                if (!validacion.valido) {
                    logger.warn('Mensaje no válido', {
                        ...contexto,
                        error: validacion.error,
                        mensaje
                    });
                    return;
                }
        
                // Actualizar contexto con datos validados
                contexto.mensajeId = mensaje.id;
                contexto.tipo = mensaje.tipo;
                contexto.destino = mensaje.destino || 'todos';
                contexto.origen = mensaje.origen || origen;
        
                // Verificar si el mensaje está destinado a este iframe
                if (mensaje.destino && 
                    mensaje.destino !== config.iframeId && 
                    mensaje.destino !== 'broadcast' && 
                    mensaje.destino !== 'all') {
                    logger.debug('Mensaje no destinado a este iframe', contexto);
                    return;
                }
        
                // Registrar recepción del mensaje
                logger.debug('Mensaje recibido', contexto);
        
                // Procesar según la categoría del mensaje
                const [categoria, accion] = mensaje.tipo.split(':');
                const manejador = obtenerManejadorMensaje(categoria);
                
                if (manejador) {
                    // Ejecutar el manejador en el siguiente ciclo de eventos
                    Promise.resolve().then(() => {
                        try {
                            manejador(accion, mensaje.datos || {}, {
                                origen: mensaje.origen,
                                destino: mensaje.destino,
                                mensajeId: mensaje.id,
                                timestamp: mensaje.timestamp,
                                event
                            });
                        } catch (error) {
                            logger.error('Error en manejador de mensaje', {
                                ...contexto,
                                error: error.message,
                                stack: config.debug ? error.stack : undefined
                            });
                        }
                    });
                } else {
                    // Disparar evento genérico para mensajes sin manejador específico
                    const tipoEvento = mensaje.tipo.split(':').pop();
                    dispararEvento(tipoEvento, {
                        ...(mensaje.datos || {}),
                        origen: mensaje.origen,
                        destino: mensaje.destino,
                        timestamp: mensaje.timestamp
                    });
                }
                
            } catch (error) {
                logger.error('Error al procesar mensaje entrante', {
                    error: error.message,
                    stack: config.debug ? error.stack : undefined
                });
            }
        }
        
        /**
         * Obtiene el manejador adecuado para una categoría de mensaje
         * @param {string} categoria - Categoría del mensaje (ej: 'sistema', 'audio', etc.)
         * @returns {Function|null} Función manejadora o null si no hay manejador
         */
        function obtenerManejadorMensaje(categoria) {
            const manejadores = {
                sistema: manejarMensajeSistema,
                audio: manejarMensajeAudio,
                navegacion: manejarMensajeNavegacion,
                retos: manejarMensajeRetos,
                ui: manejarMensajeUI,
                estado: manejarMensajeEstado
            };
            
            return manejadores[categoria] || null;
        }
        
        /**
         * Maneja los mensajes del sistema
         * @param {string} accion - Acción a realizar (ej: 'ping', 'pong', 'inicializacion', etc.)
         * @param {Object} datos - Datos del mensaje
         * @param {Object} contexto - Contexto del mensaje (origen, destino, mensajeId, etc.)
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarMensajeSistema(accion, datos = {}, contexto = {}) {
            // Manejar mensajes de configuración de modo
            if (accion === 'configuracion' && datos.modo) {
                try {
                    const resultado = enableControls(datos.modo, datos);
                    return {
                        exito: true,
                        modo: resultado.modo,
                        controlesHabilitados: resultado.controlesHabilitados,
                        timestamp: Date.now()
                    };
                } catch (error) {
                    logger.error('Error al configurar modo', {
                        error: error.message,
                        datos,
                        ...contexto
                    });
                    
                    throw new ErrorMensajeria(
                        `Error al configurar modo: ${error.message}`,
                        error.codigo || 'ERROR_CONFIGURACION',
                        { ...error.detalles, modo: datos.modo }
                    );
                }
            }
            
            // Manejar mensajes de habilitación/deshabilitación de controles
            if (accion === 'habilitar_controles') {
                return enableControls(datos.modo || 'normal', datos);
            }
            
            if (accion === 'deshabilitar_controles') {
                return disableControls(datos.motivo || 'Deshabilitado por solicitud', datos);
            }
            const contextoCompleto = {
                ...contexto,
                accion,
                timestamp: Date.now()
            };
        
            try {
                switch (accion) {
                    case 'ping':
                        // Responder al ping con un pong
                        logger.debug('Ping recibido', contextoCompleto);
                        enviarMensajeConReintentos(
                            contexto.origen,
                            'sistema:pong',
                            { timestamp: Date.now() },
                            { maxRetries: 2 }
                        ).catch(error => {
                            logger.error('Error al responder al ping', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    case 'pong':
                        // Actualizar estado de conexión
                        logger.debug('Pong recibido', contextoCompleto);
                        config.isOnline = true;
                        break;
        
                    case 'inicializacion':
                        // Inicializar el iframe con la configuración proporcionada
                        logger.info('Inicialización solicitada', contextoCompleto);
                        if (datos.configuracion) {
                            inicializarMensajeria(datos.configuracion);
                        }
                        break;
        
                    case 'error':
                        // Registrar error reportado por otro iframe
                        logger.error('Error reportado', {
                            ...contextoCompleto,
                            error: datos.mensaje || 'Error desconocido',
                            detalle: datos.detalle,
                            stack: datos.stack
                        });
                        break;
        
                    case 'configuracion':
                        // Actualizar configuración
                        logger.info('Actualizando configuración', contextoCompleto);
                        Object.assign(config, datos);
                        break;
        
                    case 'cambio_modo':
                        // Manejar cambio de modo (casa/aventura)
                        logger.info('Cambio de modo solicitado', {
                            ...contextoCompleto,
                            modo: datos.modo,
                            habilitar: datos.habilitar
                        });
                        manejarCambioModo(datos.modo, datos.habilitar, {
                            motivo: 'solicitud_externa',
                            forzar: datos.forzar
                        });
                        break;
        
                    case 'habilitar_controles':
                        // Habilitar controles
                        logger.info('Habilitando controles', contextoCompleto);
                        enableControls(datos.modo || 'aventura', {
                            motivo: datos.motivo || 'solicitud_externa',
                            forzar: datos.forzar
                        });
                        break;
        
                    case 'deshabilitar_controles':
                        // Deshabilitar controles
                        logger.info('Deshabilitando controles', {
                            ...contextoCompleto,
                            motivo: datos.motivo || 'solicitud_externa'
                        });
                        disableControls(datos.motivo || 'solicitud_externa');
                        break;
        
                    default:
                        logger.warn('Acción de sistema no reconocida', {
                            ...contextoCompleto,
                            accion
                        });
                }
            } catch (error) {
                logger.error('Error al procesar mensaje de sistema', {
                    ...contextoCompleto,
                    error: error.message,
                    stack: config.debug ? error.stack : undefined
                });
            }
        }
        
        /**
         * Maneja los mensajes relacionados con audio
         * @param {string} accion - Acción a realizar (ej: 'reproducir', 'pausar', 'detener', etc.)
         * @param {Object} datos - Datos del mensaje
         * @param {Object} contexto - Contexto del mensaje (origen, destino, mensajeId, etc.)
         */
        function manejarMensajeAudio(accion, datos = {}, contexto = {}) {
            const contextoCompleto = {
                ...contexto,
                accion,
                idAudio: datos.id,
                timestamp: Date.now()
            };
        
            try {
                switch (accion) {
                    case 'reproducir':
                        // Lógica para reproducir audio
                        logger.info('Reproduciendo audio', {
                            ...contextoCompleto,
                            volumen: datos.volumen,
                            loop: datos.loop
                        });
                        // Aquí iría la lógica real para reproducir el audio
                        // Por ejemplo: AudioManager.play(datos.id, { volumen: datos.volumen, loop: datos.loop });
                        break;
        
                    case 'pausar':
                        // Lógica para pausar audio
                        logger.debug('Pausando audio', contextoCompleto);
                        // AudioManager.pause(datos.id);
                        break;
        
                    case 'detener':
                        // Lógica para detener audio
                        logger.debug('Deteniendo audio', contextoCompleto);
                        // AudioManager.stop(datos.id);
                        break;
        
                    case 'cambiar_volumen':
                        // Validar volumen (debe estar entre 0 y 1)
                        if (typeof datos.volumen === 'number' && datos.volumen >= 0 && datos.volumen <= 1) {
                            logger.debug('Cambiando volumen de audio', {
                                ...contextoCompleto,
                                volumen: datos.volumen
                            });
                            // AudioManager.setVolume(datos.id, datos.volumen);
                        } else {
                            throw new ErrorMensajeria(
                                'Volumen no válido. Debe ser un valor entre 0 y 1',
                                ERRORES.VALIDACION_FALLIDA,
                                { volumen: datos.volumen }
                            );
                        }
                        break;
        
                    case 'estado':
                        // Consultar o actualizar estado del audio
                        logger.debug('Consultando estado de audio', contextoCompleto);
                        // const estado = AudioManager.getState(datos.id);
                        // Enviar respuesta con el estado actual
                        enviarMensajeConReintenos(
                            contexto.origen,
                            'audio:estado_actualizado',
                            { 
                                id: datos.id,
                                // ...estado,
                                enReproduccion: false, // estado.playing
                                tiempoActual: 0, // estado.currentTime
                                duracion: 0 // estado.duration
                            },
                            { maxRetries: 2 }
                        ).catch(error => {
                            logger.error('Error al enviar estado de audio', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    case 'estado_actualizado':
                        // Actualizar estado local del audio
                        logger.debug('Estado de audio actualizado', {
                            ...contextoCompleto,
                            enReproduccion: datos.enReproduccion,
                            tiempoActual: datos.tiempoActual,
                            duracion: datos.duracion
                        });
                        // Aquí podrías actualizar la interfaz de usuario
                        break;
        
                    default:
                        logger.warn('Acción de audio no reconocida', {
                            ...contextoCompleto,
                            accion
                        });
                }
            } catch (error) {
                logger.error('Error al procesar mensaje de audio', {
                    ...contextoCompleto,
                    error: error instanceof ErrorMensajeria ? error.toJSON() : {
                        mensaje: error.message,
                        stack: config.debug ? error.stack : undefined
                    }
                });
        
                // Notificar el error al remitente si es posible
                if (contexto.origen && contexto.mensajeId) {
                    enviarMensajeConReintenos(
                        contexto.origen,
                        'sistema:error',
                        {
                            mensaje: 'Error al procesar mensaje de audio',
                            detalle: error.message,
                            mensajeId: contexto.mensajeId,
                            tipo: 'audio',
                            accion,
                            stack: config.debug ? error.stack : undefined
                        },
                        { maxRetries: 2 }
                    ).catch(err => {
                        logger.error('No se pudo notificar el error al remitente', {
                            ...contextoCompleto,
                            error: err.message
                        });
                    });
                }
            }
        }
        
        /**
         * Maneja los mensajes relacionados con la navegación
         * @param {string} accion - Acción de navegación (ej: 'cambiar_vista', 'actualizar_ruta', etc.)
         * @param {Object} datos - Datos del mensaje
         * @param {Object} contexto - Contexto del mensaje (origen, destino, mensajeId, etc.)
         */
        function manejarMensajeNavegacion(accion, datos = {}, contexto = {}) {
            const contextoCompleto = {
                ...contexto,
                accion,
                timestamp: Date.now()
            };
        
            try {
                switch (accion) {
                    case 'cambiar_vista':
                        // Validar datos requeridos
                        if (!datos.vista) {
                            throw new ErrorMensajeria(
                                'Se requiere especificar la vista a la que navegar',
                                ERRORES.VALIDACION_FALLIDA
                            );
                        }
        
                        logger.info('Cambiando a vista', {
                            ...contextoCompleto,
                            vista: datos.vista,
                            parametros: datos.parametros
                        });
        
                        // Aquí iría la lógica para cambiar de vista
                        // Por ejemplo: Navegador.cambiarVista(datos.vista, datos.parametros);
                        
                        // Notificar a otros componentes sobre el cambio de vista
                        broadcast('navegacion:vista_cambiada', {
                            vista: datos.vista,
                            parametros: datos.parametros,
                            origen: config.iframeId
                        }).catch(error => {
                            logger.error('Error al notificar cambio de vista', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    case 'actualizar_ruta':
                        // Actualizar la ruta actual sin cambiar de vista
                        logger.debug('Actualizando ruta de navegación', {
                            ...contextoCompleto,
                            ruta: datos.ruta,
                            parametros: datos.parametros
                        });
                        
                        // Actualizar la URL o el estado de la aplicación
                        // Por ejemplo: Historial.actualizarRuta(datos.ruta, datos.parametros);
                        break;
        
                    case 'ir_atras':
                        // Navegar a la vista anterior
                        logger.debug('Navegando a la vista anterior', contextoCompleto);
                        // Historial.retroceder();
                        break;
        
                    case 'ir_adelante':
                        // Navegar a la siguiente vista en el historial
                        logger.debug('Navegando a la siguiente vista', contextoCompleto);
                        // Historial.avanzar();
                        break;
        
                    case 'vista_cargada':
                        // Notificar que una vista ha terminado de cargar
                        logger.info('Vista cargada', {
                            ...contextoCompleto,
                            vista: datos.vista,
                            tiempoCarga: datos.tiempoCarga
                        });
                        
                        // Aquí podrías actualizar el estado de carga de la aplicación
                        break;
        
                    case 'error_carga':
                        // Manejar errores de carga de vistas
                        logger.error('Error al cargar vista', {
                            ...contextoCompleto,
                            vista: datos.vista,
                            error: datos.error,
                            intentos: datos.intentos
                        });
                        
                        // Intentar recuperación automática o mostrar mensaje de error
                        if (datos.reintentar && datos.intentos < 3) {
                            setTimeout(() => {
                                logger.info('Reintentando cargar vista', {
                                    ...contextoCompleto,
                                    vista: datos.vista,
                                    intento: datos.intentos + 1
                                });
                                // Navegador.cargarVista(datos.vista, datos.parametros, datos.intentos + 1);
                            }, 2000);
                        }
                        break;
        
                    default:
                        logger.warn('Acción de navegación no reconocida', {
                            ...contextoCompleto,
                            accion
                        });
                }
            } catch (error) {
                logger.error('Error al procesar mensaje de navegación', {
                    ...contextoCompleto,
                    error: error instanceof ErrorMensajeria ? error.toJSON() : {
                        mensaje: error.message,
                        stack: config.debug ? error.stack : undefined
                    }
                });
        
                // Notificar el error al remitente si es posible
                if (contexto.origen && contexto.mensajeId) {
                    enviarMensajeConReintenos(
                        contexto.origen,
                        'sistema:error',
                        {
                            mensaje: 'Error al procesar mensaje de navegación',
                            detalle: error.message,
                            mensajeId: contexto.mensajeId,
                            tipo: 'navegacion',
                            accion,
                            stack: config.debug ? error.stack : undefined
                        },
                        { maxRetries: 2 }
                    ).catch(err => {
                        logger.error('No se pudo notificar el error al remitente', {
                            ...contextoCompleto,
                            error: err.message
                        });
                    });
                }
            }
        }
        
        /**
         * Maneja los mensajes relacionados con los retos del juego
         * @param {string} accion - Acción del reto (ej: 'iniciar', 'enviar_respuesta', 'pista', etc.)
         * @param {Object} datos - Datos del mensaje
         * @param {Object} contexto - Contexto del mensaje (origen, destino, mensajeId, etc.)
         */
        function manejarMensajeRetos(accion, datos = {}, contexto = {}) {
            const contextoCompleto = {
                ...contexto,
                accion,
                retoId: datos.retoId,
                timestamp: Date.now()
            };
        
            try {
                switch (accion) {
                    case 'iniciar':
                        // Validar datos requeridos
                        if (!datos.retoId) {
                            throw new ErrorMensajeria(
                                'Se requiere especificar el ID del reto',
                                ERRORES.VALIDACION_FALLIDA
                            );
                        }
        
                        logger.info('Iniciando reto', {
                            ...contextoCompleto,
                            dificultad: datos.dificultad,
                            tiempoLimite: datos.tiempoLimite
                        });
        
                        // Aquí iría la lógica para iniciar el reto
                        // Por ejemplo: RetoManager.iniciarReto(datos.retoId, datos.dificultad);
                        
                        // Notificar a otros componentes sobre el inicio del reto
                        broadcast('retos:reto_iniciado', {
                            retoId: datos.retoId,
                            dificultad: datos.dificultad,
                            tiempoInicio: Date.now(),
                            tiempoLimite: datos.tiempoLimite
                        }).catch(error => {
                            logger.error('Error al notificar inicio de reto', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    case 'enviar_respuesta':
                        // Validar datos requeridos
                        if (!datos.retoId || !datos.respuesta) {
                            throw new ErrorMensajeria(
                                'Se requiere especificar el ID del reto y la respuesta',
                                ERRORES.VALIDACION_FALLIDA
                            );
                        }
        
                        logger.debug('Enviando respuesta a reto', {
                            ...contextoCompleto,
                            respuesta: typeof datos.respuesta === 'string' ? 
                                datos.respuesta.substring(0, 100) + '...' : 
                                datos.respuesta
                        });
        
                        // Aquí iría la lógica para validar la respuesta
                        // const resultado = RetoManager.validarRespuesta(datos.retoId, datos.respuesta);
                        const resultado = {
                            correcta: true, // resultado.correcta,
                            puntuacion: 100, // resultado.puntuacion,
                            mensaje: '¡Respuesta correcta!', // resultado.mensaje
                            siguienteReto: null // resultado.siguienteReto
                        };
        
                        // Notificar el resultado
                        enviarMensajeConReintenos(
                            contexto.origen || 'padre',
                            'retos:resultado_respuesta',
                            {
                                retoId: datos.retoId,
                                ...resultado,
                                timestamp: Date.now()
                            },
                            { maxRetries: 3 }
                        ).catch(error => {
                            logger.error('Error al enviar resultado de respuesta', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    case 'solicitar_pista':
                        logger.info('Solicitando pista para reto', contextoCompleto);
                        
                        // Aquí iría la lógica para obtener una pista
                        // const pista = RetoManager.obtenerPista(datos.retoId, datos.nivelPista);
                        const pista = {
                            texto: 'Esta es una pista de ejemplo', // pista.texto,
                            nivel: 1, // pista.nivel,
                            restantes: 2 // pista.restantes
                        };
        
                        // Enviar pista
                        enviarMensajeConReintenos(
                            contexto.origen || 'padre',
                            'retos:pista_recibida',
                            {
                                retoId: datos.retoId,
                                ...pista,
                                timestamp: Date.now()
                            },
                            { maxRetries: 2 }
                        ).catch(error => {
                            logger.error('Error al enviar pista', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    case 'abandonar':
                        logger.info('Abandonando reto', contextoCompleto);
                        
                        // Aquí iría la lógica para abandonar el reto
                        // RetoManager.abandonarReto(datos.retoId);
                        
                        // Notificar abandono
                        broadcast('retos:reto_abandonado', {
                            retoId: datos.retoId,
                            motivo: datos.motivo || 'usuario',
                            timestamp: Date.now()
                        }).catch(error => {
                            logger.error('Error al notificar abandono de reto', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    case 'completado':
                        logger.info('Reto completado', {
                            ...contextoCompleto,
                            puntuacion: datos.puntuacion,
                            tiempo: datos.tiempo
                        });
                        
                        // Aquí iría la lógica para registrar la finalización del reto
                        // RetoManager.registrarCompletado(datos.retoId, datos.puntuacion, datos.tiempo);
                        
                        // Notificar finalización
                        broadcast('retos:reto_completado', {
                            retoId: datos.retoId,
                            puntuacion: datos.puntuacion,
                            tiempo: datos.tiempo,
                            recompensas: datos.recompensas || {},
                            timestamp: Date.now()
                        }).catch(error => {
                            logger.error('Error al notificar finalización de reto', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    default:
                        logger.warn('Acción de reto no reconocida', {
                            ...contextoCompleto,
                            accion
                        });
                }
            } catch (error) {
                logger.error('Error al procesar mensaje de reto', {
                    ...contextoCompleto,
                    error: error instanceof ErrorMensajeria ? error.toJSON() : {
                        mensaje: error.message,
                        stack: config.debug ? error.stack : undefined
                    }
                });
        
                // Notificar el error al remitente si es posible
                if ((contexto.origen || 'padre') && contexto.mensajeId) {
                    enviarMensajeConReintenos(
                        contexto.origen || 'padre',
                        'sistema:error',
                        {
                            mensaje: 'Error al procesar mensaje de reto',
                            detalle: error.message,
                            mensajeId: contexto.mensajeId,
                            tipo: 'retos',
                            accion,
                            stack: config.debug ? error.stack : undefined
                        },
                        { maxRetries: 2 }
                    ).catch(err => {
                        logger.error('No se pudo notificar el error al remitente', {
                            ...contextoCompleto,
                            error: err.message
                        });
                    });
                }
            }
        }
        
        /**
         * Maneja los mensajes relacionados con actualizaciones de la interfaz de usuario
         * @param {string} accion - Acción de UI (ej: 'actualizar_elemento', 'mostrar_mensaje', etc.)
         * @param {Object} datos - Datos del mensaje
         * @param {Object} contexto - Contexto del mensaje (origen, destino, mensajeId, etc.)
         */
        function manejarMensajeUI(accion, datos = {}, contexto = {}) {
            const contextoCompleto = {
                ...contexto,
                accion,
                elemento: datos.elementoId || datos.selector,
                timestamp: Date.now()
            };
        
            try {
                switch (accion) {
                    case 'actualizar_elemento':
                        // Validar datos requeridos
                        if (!datos.elementoId && !datos.selector) {
                            throw new ErrorMensajeria(
                                'Se requiere especificar un ID de elemento o selector',
                                ERRORES.VALIDACION_FALLIDA
                            );
                        }
        
                        logger.debug('Actualizando elemento de la interfaz', {
                            ...contextoCompleto,
                            tipoActualizacion: datos.tipo || 'contenido'
                        });
        
                        // Aquí iría la lógica para actualizar el elemento
                        // Por ejemplo: UI.actualizarElemento(datos.elementoId || datos.selector, datos.contenido, datos.tipo);
                        
                        // Notificar a otros componentes sobre la actualización
                        if (datos.notificar) {
                            broadcast('ui:elemento_actualizado', {
                                elementoId: datos.elementoId,
                                selector: datos.selector,
                                tipo: datos.tipo,
                                timestamp: Date.now()
                            }).catch(error => {
                                logger.error('Error al notificar actualización de elemento', {
                                    ...contextoCompleto,
                                    error: error.message
                                });
                            });
                        }
                        break;
        
                    case 'mostrar_mensaje':
                        // Validar datos requeridos
                        if (!datos.mensaje) {
                            throw new ErrorMensajeria(
                                'Se requiere especificar el mensaje a mostrar',
                                ERRORES.VALIDACION_FALLIDA
                            );
                        }
        
                        logger.info('Mostrando mensaje en la interfaz', {
                            ...contextoCompleto,
                            tipo: datos.tipo || 'info',
                            duracion: datos.duracion || 5000
                        });
        
                        // Aquí iría la lógica para mostrar el mensaje
                        // UI.mostrarMensaje(datos.mensaje, datos.tipo, datos.duracion);
                        break;
        
                    case 'alternar_visibilidad':
                        // Validar datos requeridos
                        if (!datos.elementoId && !datos.selector) {
                            throw new ErrorMensajeria(
                                'Se requiere especificar un ID de elemento o selector',
                                ERRORES.VALIDACION_FALLIDA
                            );
                        }
        
                        logger.debug('Alternando visibilidad de elemento', contextoCompleto);
                        
                        // Aquí iría la lógica para alternar la visibilidad
                        // UI.alternarVisibilidad(datos.elementoId || datos.selector, datos.visible);
                        break;
        
                    case 'animar_elemento':
                        // Validar datos requeridos
                        if ((!datos.elementoId && !datos.selector) || !datos.animacion) {
                            throw new ErrorMensajeria(
                                'Se requiere especificar un elemento y una animación',
                                ERRORES.VALIDACION_FALLIDA
                            );
                        }
        
                        logger.debug('Aplicando animación a elemento', {
                            ...contextoCompleto,
                            animacion: datos.animacion,
                            duracion: datos.duracion || 300
                        });
        
                        // Aquí iría la lógica para aplicar la animación
                        // UI.animarElemento(datos.elementoId || datos.selector, datos.animacion, datos.duracion);
                        break;
        
                    case 'cambiar_tema':
                        // Validar tema
                        const temasPermitidos = ['claro', 'oscuro', 'accesible'];
                        if (!temasPermitidos.includes(datos.tema)) {
                            throw new ErrorMensajeria(
                                `Tema no válido. Los temas permitidos son: ${temasPermitidos.join(', ')}`,
                                ERRORES.VALIDACION_FALLIDA
                            );
                        }
        
                        logger.info('Cambiando tema de la interfaz', {
                            ...contextoCompleto,
                            tema: datos.tema
                        });
        
                        // Aquí iría la lógica para cambiar el tema
                        // UI.cambiarTema(datos.tema);
                        
                        // Notificar a otros componentes sobre el cambio de tema
                        broadcast('ui:tema_cambiado', {
                            tema: datos.tema,
                            timestamp: Date.now()
                        }).catch(error => {
                            logger.error('Error al notificar cambio de tema', {
                                ...contextoCompleto,
                                error: error.message
                            });
                        });
                        break;
        
                    case 'bloquear_interfaz':
                        logger.info('Bloqueando interfaz de usuario', {
                            ...contextoCompleto,
                            motivo: datos.motivo || 'procesando'
                        });
                        
                        // Aquí iría la lógica para bloquear la interfaz
                        // UI.bloquearInterfaz(datos.mensaje, datos.motivo);
                        break;
        
                    case 'desbloquear_interfaz':
                        logger.info('Desbloqueando interfaz de usuario', contextoCompleto);
                        
                        // Aquí iría la lógica para desbloquear la interfaz
                        // UI.desbloquearInterfaz();
                        break;
        
                    default:
                        logger.warn('Acción de UI no reconocida', {
                            ...contextoCompleto,
                            accion
                        });
                }
            } catch (error) {
                logger.error('Error al procesar mensaje de UI', {
                    ...contextoCompleto,
                    error: error instanceof ErrorMensajeria ? error.toJSON() : {
                        mensaje: error.message,
                        stack: config.debug ? error.stack : undefined
                    }
                });
        
                // Notificar el error al remitente si es posible
                if (contexto.origen && contexto.mensajeId) {
                    enviarMensajeConReintenos(
                        contexto.origen,
                        'sistema:error',
                        {
                            mensaje: 'Error al procesar mensaje de UI',
                            detalle: error.message,
                            mensajeId: contexto.mensajeId,
                            tipo: 'ui',
                            accion,
                            stack: config.debug ? error.stack : undefined
                        },
                        { maxRetries: 2 }
                    ).catch(err => {
                        logger.error('No se pudo notificar el error al remitente', {
                            ...contextoCompleto,
                            error: err.message
                        });
                    });
                }
            }
        }
        
        /**
         * Maneja la lógica de actualización de estado
         * @param {Object} datos - Datos del mensaje
         * @param {Object} contexto - Contexto del mensaje
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarActualizacionEstado(datos = {}, contexto = {}) {
            const contextoCompleto = {
                ...contexto,
                accion: 'actualizar',
                timestamp: Date.now()
            };
        
            // Validar datos requeridos
            if (!datos.entidad || !datos.cambios) {
                throw new ErrorMensajeria(
                    'Se requiere especificar una entidad y los cambios a aplicar',
                    ERRORES.VALIDACION_FALLIDA
                );
            }
        
            logger.debug('Actualizando estado', {
                ...contextoCompleto,
                entidad: datos.entidad,
                cambios: Object.keys(datos.cambios)
            });
            
            // Aplicar cambios al estado global
            if (!estadoAplicacion[datos.entidad]) {
                estadoAplicacion[datos.entidad] = {};
            }
            
            // Guardar el estado anterior para notificaciones
            const estadoAnterior = { ...estadoAplicacion[datos.entidad] };
            
            // Actualizar el estado con los nuevos cambios
            Object.assign(estadoAplicacion[datos.entidad], datos.cambios);
            
            // Notificar a los oyentes del cambio de estado
            const evento = new CustomEvent('estado:actualizado', {
                detail: {
                    entidad: datos.entidad,
                    cambios: datos.cambios,
                    estadoAnterior,
                    estadoNuevo: estadoAplicacion[datos.entidad],
                    timestamp: Date.now()
                }
            });
            window.dispatchEvent(evento);
            
            return {
                exito: true,
                mensaje: 'Estado actualizado correctamente',
                entidad: datos.entidad,
                cambios: datos.cambios,
                mensajeId: contexto.mensajeId,
                timestamp: Date.now()
            };
        }
        
        /**
         * Maneja los mensajes relacionados con el estado de la aplicación
         * @param {string} accion - Acción de estado (ej: 'actualizar', 'sincronizar', 'restaurar')
         * @param {Object} datos - Datos del mensaje
         * @param {Object} contexto - Contexto del mensaje (origen, destino, mensajeId, etc.)
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarMensajeEstado(accion, datos = {}, contexto = {}) {
            const contextoCompleto = {
                ...contexto,
                accion,
                timestamp: Date.now()
            };
        
            // Manejar actualizaciones de estado que incluyan cambios de modo
            if (accion === 'actualizar' && datos.modo && datos.modo !== estadoAplicacion.modo) {
                try {
                    const resultado = enableControls(datos.modo, datos);
                    
                    // Continuar con el procesamiento normal del estado
                    const resultadoEstado = await manejarActualizacionEstado(datos, contexto);
                    
                    return {
                        ...resultadoEstado,
                        modo: resultado.modo,
                        controlesHabilitados: resultado.controlesHabilitados
                    };
                } catch (error) {
                    logger.error('Error al actualizar estado con cambio de modo', {
                        error: error.message,
                        datos,
                        ...contexto
                    });
                    
                    // Revertir al modo anterior en caso de error
                    if (estadoAplicacion.modo !== 'normal') {
                        enableControls('normal');
                    }
                    
                    throw error;
                }
            }
            
            // Procesar acciones de estado
            try {
                switch (accion) {
                    case 'actualizar':
                        return await manejarActualizacionEstado(datos, contexto);
                        
                    case 'obtener':
                        return await manejarObtenerEstado(datos, contexto);
                        
                    case 'sincronizar':
                        return await manejarSincronizarEstado(datos, contexto);
                        
                    case 'reiniciar':
                        return await manejarReiniciarEstado(datos, contexto);
                        
                    default:
                        throw new ErrorMensajeria(
                            `Acción de estado no soportada: ${accion}`,
                            ERRORES.ACCION_NO_SOPORTADA,
                            { 
                                accion, 
                                accionesSoportadas: ['actualizar', 'obtener', 'sincronizar', 'reiniciar'],
                                mensajeId: contexto.mensajeId
                            }
                        );
                }
            } catch (error) {
                logger.error('Error al procesar mensaje de estado', {
                    ...contextoCompleto,
                    error: error.message,
                    stack: error.stack
                });
                
                // Reenviar el error para que sea manejado por el sistema de mensajería
                throw error;
            }
        }
        
        /**
         * Envía un mensaje a un destino específico con reintentos automáticos en caso de fallo
         * @param {string} destino - Destino del mensaje ('padre' o ID del iframe hijo)
         * @param {string} tipo - Tipo de mensaje (formato 'categoria:accion')
         * @param {Object} datos - Datos del mensaje
         * @param {Object} opciones - Opciones de envío
         * @param {number} [opciones.maxRetries=3] - Número máximo de reintentos
         * @param {number} [opciones.timeout=2000] - Tiempo de espera antes de reintentar (ms)
         * @param {string} [opciones.sesionId] - ID de sesión para agrupar mensajes relacionados
         * @returns {Promise<Object>} Promesa que se resuelve cuando el mensaje es enviado correctamente
         */
        async function enviarMensajeConReintentos(destino, tipo, datos = {}, opciones = {}) {
            const id = generarIdUnico();
            const maxReintentos = opciones.maxRetries || 3;
            const timeout = opciones.timeout || 2000;
            const [categoria, accion] = tipo.split(':');
            
            const contexto = {
                mensajeId: id,
                tipo,
                categoria,
                accion,
                destino,
                intento: 0,
                maxReintentos,
                sesionId: opciones.sesionId || generarIdSesion(),
                timestamp: Date.now()
            };
        
            // Validar tipo de mensaje
            if (!categoria || !accion) {
                const error = new ErrorMensajeria(
                    `El tipo de mensaje debe tener el formato 'categoria:accion'`,
                    ERRORES.VALIDACION_FALLIDA,
                    { tipo }
                );
                logger.error('Error de validación al enviar mensaje', {
                    ...contexto,
                    error: error.toJSON()
                });
                throw error;
            }
        
            // Crear el mensaje estructurado
            const mensaje = {
                id,
                tipo,
                origen: config.iframeId,
                destino,
                timestamp: Date.now(),
                sesionId: contexto.sesionId,
                datos
            };
        
            // Función para realizar el envío con reintentos
            const enviarConReintentos = async (intento = 1) => {
                const intentoContexto = { ...contexto, intento };
                
                try {
                    // Validar si el destino está disponible
                    if (destino !== 'padre' && !esIframeHijoValido(destino)) {
                        throw new ErrorMensajeria(
                            `Destino no válido o no disponible: ${destino}`,
                            ERRORES.DESTINO_NO_DISPONIBLE,
                            { destino }
                        );
                    }
        
                    logger.debug(`Enviando mensaje (intento ${intento}/${maxReintentos})`, {
                        ...intentoContexto,
                        tipoMensaje: tipo,
                        tamañoDatos: JSON.stringify(datos).length
                    });
        
                    // Determinar el objetivo del postMessage
                    const objetivo = destino === 'padre' ? 
                        window.parent : 
                        document.getElementById(destino)?.contentWindow;
        
                    if (!objetivo) {
                        throw new ErrorMensajeria(
                            `No se pudo encontrar el destino del mensaje: ${destino}`,
                            ERRORES.DESTINO_NO_ENCONTRADO,
                            { destino }
                        );
                    }
        
                    // Crear una promesa que se resuelva cuando se reciba confirmación
                    return new Promise((resolve, reject) => {
                        // Configurar temporizador de espera
                        const tiempoEspera = setTimeout(() => {
                            limpiarManejador();
                            const error = new ErrorMensajeria(
                                `Tiempo de espera agotado al enviar mensaje a ${destino}`,
                                ERRORES.TIMEOUT,
                                { intento, maxReintentos, timeout, tipo }
                            );
                            
                            if (intento < maxReintentos) {
                                logger.warn('Tiempo de espera agotado, reintentando...', {
                                    ...intentoContexto,
                                    error: error.toJSON()
                                });
                                // Reintentar después de un tiempo de espera con backoff exponencial
                                setTimeout(
                                    () => enviarConReintentos(intento + 1).then(resolve).catch(reject),
                                    Math.min(timeout * Math.pow(2, intento - 1), 30000) // Backoff exponencial con máximo 30s
                                );
                            } else {
                                logger.error('Número máximo de reintentos alcanzado', {
                                    ...intentoContexto,
                                    error: error.toJSON()
                                });
                                reject(error);
                            }
                        }, timeout);
        
                        // Manejador para confirmación de recepción
                        const manejadorConfirmacion = (evento) => {
                            // Verificar que el mensaje sea una confirmación para este mensaje
                            const { data } = evento;
                            if (data?.tipo === 'sistema:confirmacion' && data?.mensajeOriginalId === id) {
                                limpiarManejador();
                                clearTimeout(tiempoEspera);
                                
                                logger.debug('Mensaje confirmado por el destinatario', {
                                    ...intentoContexto,
                                    timestampConfirmacion: Date.now(),
                                    latencia: Date.now() - contexto.timestamp
                                });
                                
                                resolve({
                                    ...mensaje,
                                    confirmado: true,
                                    timestampConfirmacion: Date.now(),
                                    intentos: intento
                                });
                            }
                        };
        
                        // Función para limpiar el manejador de eventos
                        const limpiarManejador = () => {
                            window.removeEventListener('message', manejadorConfirmacion);
                        };
        
                        // Configurar el manejador para la confirmación
                        window.addEventListener('message', manejadorConfirmacion);
        
                        // Enviar el mensaje
                        try {
                            // Asegurarse de que el mensaje se envía al dominio correcto
                            const targetOrigin = config.dominioPermitido || '*';
                            objetivo.postMessage(mensaje, targetOrigin);
                            
                            logger.debug('Mensaje enviado, esperando confirmación...', {
                                ...intentoContexto,
                                targetOrigin
                            });
                        } catch (error) {
                            limpiarManejador();
                            clearTimeout(tiempoEspera);
                            throw error;
                        }
                    });
                } catch (error) {
                    logger.error('Error al enviar mensaje', {
                        ...intentoContexto,
                        error: error instanceof ErrorMensajeria ? error.toJSON() : {
                            mensaje: error.message,
                            stack: config.debug ? error.stack : undefined
                        }
                    });
        
                    if (intento < maxReintentos) {
                        // Esperar antes de reintentar con backoff exponencial
                        const tiempoEspera = Math.min(timeout * Math.pow(2, intento - 1), 30000);
                        logger.warn(`Reintentando en ${tiempoEspera}ms...`, {
                            ...intentoContexto,
                            proximoIntentoEn: tiempoEspera
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, tiempoEspera));
                        return enviarConReintentos(intento + 1);
                    }
        
                    // Si se agotaron los reintentos, lanzar el error
                    throw error;
                }
            };
        
            // Iniciar el proceso de envío con reintentos
            return enviarConReintenos(1);
        }
        
        /**
         * Verifica si un iframe hijo es válido y está disponible
         * @param {string} iframeId - ID del iframe a verificar
         * @returns {boolean} true si el iframe es válido y está disponible
         */
        function esIframeHijoValido(iframeId) {
            try {
                const iframe = document.getElementById(iframeId);
                return iframe && iframe.contentWindow && iframe.tagName === 'IFRAME';
            } catch (error) {
                logger.warn('Error al verificar iframe hijo', {
                    iframeId,
                    error: error.message
                });
                return false;
            }
        }
        
        /**
         * Genera un ID de sesión único
         * @returns {string} ID de sesión único
         */
        function generarIdSesion() {
            return `sesion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        /**
         * Envía un mensaje a múltiples destinos de manera eficiente
         * @param {string} tipo - Tipo de mensaje (formato 'categoria:accion')
         * @param {Object} datos - Datos del mensaje
         * @param {Object} opciones - Opciones de difusión
         * @param {string[]} [opciones.exclude=[]] - IDs de iframes a excluir
         * @param {boolean} [opciones.includeParent=true] - Incluir al padre en la difusión
         * @param {string[]} [opciones.includeOnly] - Si se especifica, solo se enviará a estos IDs
         * @returns {Promise<Array>} Promesa que se resuelve con los resultados de los envíos
         */
        async function broadcast(tipo, datos = {}, opciones = {}) {
            const {
                exclude = [],
                includeParent = true,
                includeOnly
            } = opciones;
        
            const id = generarIdUnico();
            const [categoria, accion] = tipo.split(':');
            const timestamp = Date.now();
            
            // Validar tipo de mensaje
            if (!categoria || !accion) {
                const error = new ErrorMensajeria(
                    `El tipo de mensaje debe tener el formato 'categoria:accion'`,
                    ERRORES.VALIDACION_FALLIDA,
                    { tipo }
                );
                logger.error('Error de validación en broadcast', {
                    mensajeId: id,
                    tipo,
                    error: error.toJSON()
                });
                throw error;
            }
        
            // Crear el mensaje base
            const mensajeBase = {
                id,
                tipo,
                origen: config.iframeId,
                timestamp,
                datos,
                esBroadcast: true
            };
        
            // Obtener los destinos a los que enviar el mensaje
            let destinos = [];
            
            // Si se especificó includeOnly, usamos solo esos destinos
            if (Array.isArray(includeOnly) && includeOnly.length > 0) {
                destinos = includeOnly.filter(id => !exclude.includes(id));
            } else {
                // Obtener todos los iframes hijos disponibles
                const iframes = Array.from(document.getElementsByTagName('iframe'))
                    .map(iframe => iframe.id)
                    .filter(id => id && !exclude.includes(id));
                
                destinos = [...iframes];
                
                // Incluir al padre si es necesario
                if (includeParent && !exclude.includes('padre')) {
                    destinos.push('padre');
                }
            }
        
            // Si no hay destinos, retornar temprano
            if (destinos.length === 0) {
                logger.debug('No hay destinos disponibles para el broadcast', {
                    mensajeId: id,
                    tipo,
                    exclude,
                    includeParent,
                    includeOnly
                });
                return [];
            }
        
            logger.info(`Iniciando broadcast a ${destinos.length} destinos`, {
                mensajeId: id,
                tipo,
                destinos,
                exclude,
                includeParent
            });
        
            // Enviar mensajes a todos los destinos en paralelo
            const envios = destinos.map(async (destino) => {
                const intentoContexto = {
                    mensajeId: id,
                    tipo,
                    categoria,
                    accion,
                    destino,
                    timestamp
                };
        
                try {
                    const resultado = await enviarMensajeConReintenos(
                        destino,
                        tipo,
                        datos,
                        { 
                            maxRetries: 1, // Menos reintentos para broadcast
                            timeout: 1000, // Timeout más corto
                            sesionId: `bcast_${id}`
                        }
                    );
        
                    logger.debug('Mensaje de broadcast enviado con éxito', {
                        ...intentoContexto,
                        timestampConfirmacion: resultado.timestampConfirmacion,
                        latencia: resultado.timestampConfirmacion - timestamp
                    });
        
                    return {
                        destino,
                        exito: true,
                        latencia: resultado.timestampConfirmacion - timestamp,
                        timestamp: resultado.timestampConfirmacion
                    };
                } catch (error) {
                    logger.warn('Error al enviar mensaje de broadcast', {
                        ...intentoContexto,
                        error: error instanceof ErrorMensajeria ? error.toJSON() : {
                            mensaje: error.message,
                            stack: config.debug ? error.stack : undefined
                        }
                    });
        
                    return {
                        destino,
                        exito: false,
                        error: error.message,
                        codigo: error.codigo || 'ERROR_DESCONOCIDO',
                        timestamp: Date.now()
                    };
                }
            });
        
            // Esperar a que todos los envíos terminen
            const resultados = await Promise.allSettled(envios);
            
            // Procesar resultados
            const resumen = {
                total: resultados.length,
                exitosos: 0,
                fallidos: 0,
                destinos: {}
            };
        
            resultados.forEach((resultado, index) => {
                const destino = destinos[index];
                
                if (resultado.status === 'fulfilled') {
                    resumen.exitosos++;
                    resumen.destinos[destino] = {
                        exito: true,
                        ...resultado.value
                    };
                } else {
                    resumen.fallidos++;
                    resumen.destinos[destino] = {
                        exito: false,
                        error: resultado.reason?.message || 'Error desconocido',
                        codigo: resultado.reason?.codigo || 'ERROR_DESCONOCIDO'
                    };
                }
            });
        
            // Registrar resumen del broadcast
            if (resumen.fallidos > 0) {
                logger.warn(`Broadcast completado con ${resumen.fallidos} fallos`, {
                    mensajeId: id,
                    tipo,
                    ...resumen,
                    porcentajeExito: (resumen.exitosos / resumen.total) * 100
                });
            } else {
                logger.info('Broadcast completado con éxito', {
                    mensajeId: id,
                    tipo,
                    ...resumen,
                    latenciaPromedio: Object.values(resumen.destinos)
                        .filter(d => d.exito && d.latencia)
                        .reduce((sum, d) => sum + d.latencia, 0) / resumen.exitosos || 0
                });
            }
        
            return resumen;
        }
        
        /**
         * Maneja los mensajes entrantes, los valida y los deriva al manejador correspondiente
         * @param {MessageEvent} event - Evento de mensaje recibido
         */
        function manejarMensajeEntrante(event) {
            // Ignorar mensajes del mismo origen o sin datos
            if (event.source === window || !event.data) {
                return;
            }
        
            const mensaje = event.data;
            const origen = event.origin || 'desconocido';
            const timestamp = Date.now();
            
            // Crear contexto para el mensaje
            const contexto = {
                origen,
                mensajeId: mensaje.id || 'desconocido',
                tipo: mensaje.tipo || 'desconocido',
                timestamp,
                esBroadcast: mensaje.esBroadcast || false
            };
        
            // Validar el mensaje
            try {
                // Validar estructura básica del mensaje
                if (!mensaje.tipo || typeof mensaje.tipo !== 'string') {
                    throw new ErrorMensajeria(
                        'El mensaje debe tener un tipo válido',
                        ERRORES.ESTRUCTURA_INVALIDA,
                        { tipo: mensaje.tipo }
                    );
                }
        
                // Verificar el origen del mensaje si se ha configurado un dominio permitido
                if (config.dominioPermitido && config.dominioPermitido !== '*' && 
                    !origen.includes(config.dominioPermitido)) {
                    throw new ErrorMensajeria(
                        `Origen no permitido: ${origen}`,
                        ERRORES.ORIGEN_NO_PERMITIDO,
                        { origen, dominioPermitido: config.dominioPermitido }
                    );
                }
        
                // Extraer categoría y acción del tipo de mensaje
                const [categoria, accion] = mensaje.tipo.split(':');
                if (!categoria || !accion) {
                    throw new ErrorMensajeria(
                        'El tipo de mensaje debe tener el formato "categoria:accion"',
                        ERRORES.FORMATO_INVALIDO,
                        { tipo: mensaje.tipo }
                    );
                }
        
                // Actualizar contexto con categoría y acción
                contexto.categoria = categoria;
                contexto.accion = accion;
        
                // Registrar recepción del mensaje
                logger.debug('Mensaje recibido', {
                    ...contexto,
                    origen,
                    destino: mensaje.destino || 'todos',
                    tamañoDatos: JSON.stringify(mensaje.datos || {}).length
                });
        
                // Verificar si el mensaje está destinado a este iframe
                if (mensaje.destino && mensaje.destino !== config.iframeId && mensaje.destino !== 'todos') {
                    logger.debug('Mensaje ignorado (destino diferente)', {
                        ...contexto,
                        destinoEsperado: mensaje.destino,
                        iframeActual: config.iframeId
                    });
                    return;
                }
        
                // Confirmar recepción si es necesario (solo para mensajes directos, no broadcasts)
                if (!contexto.esBroadcast && mensaje.id && event.source.postMessage) {
                    try {
                        event.source.postMessage({
                            tipo: 'sistema:confirmacion',
                            mensajeOriginalId: mensaje.id,
                            origen: config.iframeId,
                            timestamp: Date.now()
                        }, event.origin);
                    } catch (error) {
                        logger.error('Error al confirmar recepción', {
                            ...contexto,
                            error: error.message
                        });
                    }
                }
        
                // Procesar el mensaje en el siguiente ciclo de evento para no bloquear
                Promise.resolve().then(() => {
                    try {
                        // Obtener el manejador correspondiente a la categoría del mensaje
                        const manejador = obtenerManejadorMensaje(categoria);
                        
                        if (manejador) {
                            // Ejecutar el manejador con la acción y los datos
                            const resultado = manejador(accion, mensaje.datos || {}, {
                                ...contexto,
                                origen: mensaje.origen,
                                destino: mensaje.destino,
                                mensajeId: mensaje.id,
                                timestamp: mensaje.timestamp
                            });
        
                            // Si el manejador devuelve una promesa, manejar errores no capturados
                            if (resultado && typeof resultado.catch === 'function') {
                                resultado.catch(error => {
                                    logger.error('Error no capturado en el manejador de mensajes', {
                                        ...contexto,
                                        error: error instanceof ErrorMensajeria ? error.toJSON() : {
                                            mensaje: error.message,
                                            stack: config.debug ? error.stack : undefined
                                        }
                                    });
                                });
                            }
                        } else if (categoria !== 'sistema') {
                            // Si no hay manejador y no es un mensaje del sistema, lanzar un evento genérico
                            logger.debug('No se encontró un manejador específico, lanzando evento genérico', contexto);
                            
                            const evento = new CustomEvent(`mensaje:${categoria}:${accion}`, {
                                detail: {
                                    datos: mensaje.datos,
                                    origen: mensaje.origen,
                                    timestamp: mensaje.timestamp,
                                    mensajeOriginal: mensaje
                                },
                                bubbles: true,
                                cancelable: true
                            });
                            
                            window.dispatchEvent(evento);
                        }
                    } catch (error) {
                        logger.error('Error al procesar mensaje', {
                            ...contexto,
                            error: error instanceof ErrorMensajeria ? error.toJSON() : {
                                mensaje: error.message,
                                stack: config.debug ? error.stack : undefined
                            }
                        });
        
                        // Notificar al remitente sobre el error si es posible
                        if (mensaje.origen && mensaje.origen !== config.iframeId && event.source.postMessage) {
                            try {
                                const mensajeError = {
                                    tipo: 'sistema:error',
                                    origen: config.iframeId,
                                    destino: mensaje.origen,
                                    timestamp: Date.now(),
                                    datos: {
                                        mensaje: 'Error al procesar el mensaje',
                                        detalle: error.message,
                                        mensajeOriginalId: mensaje.id,
                                        tipoMensajeOriginal: mensaje.tipo,
                                        codigo: error.codigo || 'ERROR_PROCESAMIENTO',
                                        stack: config.debug ? error.stack : undefined
                                    }
                                };
                                
                                event.source.postMessage(mensajeError, event.origin);
                            } catch (errorEnvio) {
                                logger.error('No se pudo notificar el error al remitente', {
                                    ...contexto,
                                    error: errorEnvio.message
                                });
                            }
                        }
                    }
                });
        
            } catch (error) {
                // Manejar errores de validación
                logger.error('Error de validación en mensaje entrante', {
                    ...contexto,
                    error: error instanceof ErrorMensajeria ? error.toJSON() : {
                        mensaje: error.message,
                        stack: config.debug ? error.stack : undefined
                    },
                    mensajeOriginal: mensaje
                });
        
                // Responder con error si es posible
                if (event.source && event.source.postMessage && mensaje.id) {
                    try {
                        event.source.postMessage({
                            tipo: 'sistema:error',
                            mensajeOriginalId: mensaje.id,
                            origen: config.iframeId,
                            timestamp: Date.now(),
                            datos: {
                                mensaje: 'Error de validación en el mensaje',
                                detalle: error.message,
                                codigo: error.codigo || ERRORES.VALIDACION_FALLIDA,
                                detalles: error.detalles
                            }
                        }, event.origin);
                    } catch (errorEnvio) {
                        logger.error('No se pudo notificar el error de validación', {
                            ...contexto,
                            error: errorEnvio.message
                        });
                    }
                }
            }
        }
        
        /**
         * Obtiene el manejador correspondiente a una categoría de mensaje
         * @param {string} categoria - Categoría del mensaje
         * @returns {Function|null} Función manejadora o null si no existe
         */
        function obtenerManejadorMensaje(categoria) {
            const manejadores = {
                sistema: manejarMensajeSistema,
                audio: manejarMensajeAudio,
                navegacion: manejarMensajeNavegacion,
                retos: manejarMensajeRetos,
                ui: manejarMensajeUI,
                estado: manejarMensajeEstado
            };
            
            return manejadores[categoria] || null;
        }
        
        /**
         * Inicializa el sistema de mensajería
         * @param {Object} configuracion - Configuración de inicialización
         * @param {string} configuracion.iframeId - ID único del iframe actual
         * @param {string} [configuracion.dominioPermitido='*'] - Dominio permitido para la comunicación
         * @param {boolean} [configuracion.debug=false] - Habilitar modo depuración
         * @param {string} [configuracion.nombre] - Nombre opcional para identificar este iframe en los logs
         * @returns {Object} Interfaz pública del módulo de mensajería
         */
        function inicializarMensajeria(configuracion = {}) {
            // Validar configuración mínima requerida
            if (!configuracion.iframeId) {
                throw new Error('Se requiere un iframeId para inicializar el sistema de mensajería');
            }
        
            // Configuración por defecto
            config = {
                iframeId: configuracion.iframeId,
                dominioPermitido: configuracion.dominioPermitido || '*',
                debug: !!configuracion.debug,
                nombre: configuracion.nombre || configuracion.iframeId,
                version: '1.0.0',
                inicializado: false,
                tiempoInicio: Date.now()
            };
        
            // Inicializar logger con la configuración
            logger = new Logger({
                nombre: `Mensajería:${config.nombre}`,
                nivel: config.debug ? 'debug' : 'info',
                mostrarFechas: true
            });
        
            // Evitar múltiples inicializaciones
            if (config.inicializado) {
                logger.warn('El sistema de mensajería ya estaba inicializado');
                return apiPublica;
            }
        
            // Configurar manejador de mensajes
            function configurarManejadorMensajes() {
                if (window.addEventListener) {
                    window.addEventListener('message', manejarMensajeEntrante, false);
                } else if (window.attachEvent) {
                    // Soporte para IE8+
                    window.attachEvent('onmessage', manejarMensajeEntrante);
                } else {
                    throw new Error('No se pudo configurar el manejador de mensajes: API no soportada');
                }
            }
        
            // Configurar manejador de errores global
            function configurarManejoErrores() {
                window.addEventListener('error', (event) => {
                    logger.error('Error global no capturado', {
                        mensaje: event.message,
                        archivo: event.filename,
                        linea: event.lineno,
                        columna: event.colno,
                        error: event.error ? {
                            message: event.error.message,
                            stack: event.error.stack
                        } : null
                    });
                });
        
                // Capturar promesas rechazadas no manejadas
                window.addEventListener('unhandledrejection', (event) => {
                    const error = event.reason || new Error('Promesa rechazada sin razón');
                    logger.error('Promesa rechazada no manejada', {
                        mensaje: error.message,
                        stack: error.stack,
                        promesa: event.promise
                    });
                });
            }
        
            // Enviar mensaje de inicialización al padre
            function notificarInicializacion() {
                if (window.parent !== window) {
                    enviarMensajeConReintenos(
                        'padre',
                        'sistema:inicializado',
                        {
                            iframeId: config.iframeId,
                            nombre: config.nombre,
                            version: config.version,
                            timestamp: Date.now()
                        },
                        { maxRetries: 3, timeout: 1000 }
                    ).catch(error => {
                        logger.warn('No se pudo notificar la inicialización al padre', {
                            error: error.message
                        });
                    });
                }
            }
        
            // Inicializar el sistema
            try {
                logger.info('Inicializando sistema de mensajería', {
                    iframeId: config.iframeId,
                    dominioPermitido: config.dominioPermitido,
                    debug: config.debug
                });
        
                // Configurar manejadores
                configurarManejadorMensajes();
                configurarManejoErrores();
                
                // Marcar como inicializado
                config.inicializado = true;
                
                // Notificar al padre si es un iframe
                notificarInicializacion();
                
                logger.info('Sistema de mensajería inicializado correctamente', {
                    tiempoInicializacion: Date.now() - config.tiempoInicio + 'ms'
                });
                
            } catch (error) {
                logger.error('Error al inicializar el sistema de mensajería', {
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                });
                throw error;
            }
        
            // API pública del módulo
            const apiPublica = {
                // Envío de mensajes
                enviar: (destino, tipo, datos = {}, opciones = {}) => 
                    enviarMensajeConReintenos(destino, tipo, datos, opciones),
                    
                broadcast: (tipo, datos = {}, opciones = {}) => 
                    broadcast(tipo, datos, opciones),
                    
                // Suscripción a eventos
                suscribir: (tipo, manejador) => {
                    const [categoria, accion] = tipo.split(':');
                    if (!categoria || !accion) {
                        throw new Error(`Tipo de evento inválido: ${tipo}. Debe ser 'categoria:accion'`);
                    }
                    
                    const evento = `mensaje:${tipo}`;
                    
                    if (!controladores[evento]) {
                        controladores[evento] = [];
                    }
                    
                    controladores[evento].push(manejador);
                    
                    // Retornar función para cancelar la suscripción
                    return () => {
                        controladores[evento] = controladores[evento].filter(h => h !== manejador);
                    };
                },
                
                // Utilidades
                generarId: generarIdUnico,
                
                // Estado
                estaInicializado: () => config.inicializado,
                
                // Configuración
                configurar: (nuevaConfig) => {
                    if (nuevaConfig.debug !== undefined) {
                        config.debug = !!nuevaConfig.debug;
                        logger.setNivel(config.debug ? 'debug' : 'info');
                    }
                    
                    if (nuevaConfig.dominioPermitido) {
                        config.dominioPermitido = nuevaConfig.dominioPermitido;
                    }
                    
                    if (nuevaConfig.nombre) {
                        config.nombre = nuevaConfig.nombre;
                        logger.setNombre(`Mensajería:${config.nombre}`);
                    }
                    
                    logger.info('Configuración actualizada', { ...config });
                    return { ...config }; // Devolver copia de la configuración
                },
                
                // Depuración
                obtenerEstado: () => ({
                    iframeId: config.iframeId,
                    nombre: config.nombre,
                    version: config.version,
                    inicializado: config.inicializado,
                    tiempoActivo: Date.now() - config.tiempoInicio + 'ms',
                    dominioPermitido: config.dominioPermitido,
                    debug: config.debug
                })
            };
            
            // Hacer que la API esté disponible globalmente (opcional)
            if (window.mensajeria === undefined) {
                window.mensajeria = apiPublica;
            }
            
            return apiPublica;
        }
        
        /**
         * Genera un ID único para mensajes
         * @returns {string} ID único
                switch (accion) {
                    case 'ping':
                        // Responder con pong para verificar la conectividad
                        logger.debug('Recibido ping, respondiendo con pong', logContexto);
                        await enviarMensajeConReintenos(
                            origen,
                            'sistema:pong',
                            { 
                                timestamp: Date.now(),
                                origen: config.iframeId,
                                ...(datos.payload || {}) 
                            },
                            { 
                                mensajeOriginalId: mensajeId,
                                timeout: 1000,
                                maxRetries: 2 
                            }
                        );
                        break;
                        
                    case 'pong':
                        // Actualizar estado de latencia
                        const tiempoRespuesta = Date.now() - (datos.timestamp || timestamp);
                        logger.debug(`Pong recibido - Latencia: ${tiempoRespuesta}ms`, logContexto);
                        
                        // Disparar evento de latencia actualizada
                        const evento = new CustomEvent('sistema:latencia-actualizada', {
                            detail: { 
                                latencia: tiempoRespuesta,
                                origen: datos.origen || origen,
                                timestamp: Date.now()
                            },
                            bubbles: true,
                            cancelable: true
                        });
                        window.dispatchEvent(evento);
                        break;
                        
                    case 'inicializacion':
                        // Procesar configuración de inicialización
                        logger.info('Procesando configuración de inicialización', logContexto);
                        
                        if (datos.configuracion) {
                            // Aplicar configuración
                            const { debug, dominioPermitido, nombre } = datos.configuracion;
                            
                            if (debug !== undefined) {
                                config.debug = !!debug;
                                logger.setNivel(config.debug ? 'debug' : 'info');
                            }
                            
                            if (dominioPermitido) {
                                config.dominioPermitido = dominioPermitido;
                            }
                            
                            if (nombre) {
                                config.nombre = nombre;
                                logger.setNombre(`Mensajería:${config.nombre}`);
                            }
                            
                            logger.info('Configuración aplicada', { ...logContexto, config: { ...config } });
                        }
                        
                        // Confirmar inicialización
                        return {
                            estado: 'inicializado',
                            iframeId: config.iframeId,
                            nombre: config.nombre,
                            version: config.version,
                            timestamp: Date.now()
                        };
                        
                    case 'error':
                        // Registrar error reportado por otro iframe
                        logger.error('Error reportado por otro iframe', {
                            ...logContexto,
                            error: {
                                mensaje: datos.mensaje,
                                codigo: datos.codigo,
                                stack: datos.stack,
                                origen: datos.origen || origen
                            }
                        });
                        break;
                        
                    case 'configuracion':
                        // Actualizar configuración dinámicamente
                        logger.info('Actualizando configuración', logContexto);
                        
                        if (!datos.configuracion || typeof datos.configuracion !== 'object') {
                            throw new ErrorMensajeria(
                                'Se requiere un objeto de configuración válido',
                                ERRORES.PARAMETROS_INVALIDOS,
                                { configuracion: datos.configuracion }
                            );
                        }
                        
                        const { debug, dominioPermitido, nombre } = datos.configuracion;
                        const cambios = [];
                        
                        if (debug !== undefined) {
                            cambios.push(`debug: ${debug}`);
                            config.debug = !!debug;
                            logger.setNivel(config.debug ? 'debug' : 'info');
                        }
                        
                        if (dominioPermitido !== undefined) {
                            cambios.push(`dominioPermitido: ${dominioPermitido}`);
                            config.dominioPermitido = dominioPermitido;
                        }
                        
                        if (nombre) {
                            cambios.push(`nombre: ${nombre}`);
                            config.nombre = nombre;
                            logger.setNombre(`Mensajería:${config.nombre}`);
                        }
                        
                        logger.info(`Configuración actualizada: ${cambios.join(', ')}`, logContexto);
                        
                        return {
                            estado: 'configuracion_actualizada',
                            cambios,
                            timestamp: Date.now()
                        };
                        
                    case 'cambio_modo':
                        // Cambiar entre modos de operación (ej: normal, mantenimiento, etc.)
                        const { modo } = datos;
                        
                        if (!modo) {
                            throw new ErrorMensajeria(
                                'Se requiere especificar un modo',
                                ERRORES.PARAMETROS_INVALIDOS
                            );
                        }
                        
                        logger.info(`Cambiando a modo: ${modo}`, logContexto);
                        
                        // Disparar evento de cambio de modo
                        const eventoCambioModo = new CustomEvent('sistema:cambio_modo', {
                            detail: { 
                                modo,
                                anterior: config.modoActual,
                                timestamp: Date.now()
                            },
                            bubbles: true,
                            cancelable: true
                        });
                        
                        // Permitir cancelar el cambio de modo
                        const cambioAceptado = window.dispatchEvent(eventoCambioModo);
                        
                        if (!cambioAceptado) {
                            logger.warn('El cambio de modo fue cancelado por un manejador de eventos', {
                                ...logContexto,
                                modo
                            });
                            
                            throw new ErrorMensajeria(
                                'El cambio de modo fue cancelado',
                                ERRORES.OPERACION_CANCELADA,
                                { modo }
                            );
                        }
                        
                        // Actualizar modo actual
                        const modoAnterior = config.modoActual;
                        config.modoActual = modo;
                        
                        // Notificar a los suscriptores
                        controladores.cambioModo.forEach(manejador => {
                            try {
                                manejador(modo, modoAnterior);
                            } catch (error) {
                                logger.error('Error en manejador de cambio de modo', {
                                    ...logContexto,
                                    error: error.message,
                                    stack: error.stack
                                });
                            }
                        });
                        
                        return {
                            estado: 'modo_cambiado',
                            modo,
                            modoAnterior,
                            timestamp: Date.now()
                        };
                        
                    case 'habilitar_controles':
                        // Habilitar controles de interfaz
                        logger.info('Habilitando controles', logContexto);
                        
                        // Disparar evento de habilitación de controles
                        const eventoHabilitar = new CustomEvent('sistema:habilitar_controles', {
                            detail: { 
                                habilitado: true,
                                timestamp: Date.now()
                            },
                            bubbles: true,
                            cancelable: true
                        });
                        
                        window.dispatchEvent(eventoHabilitar);
                        break;
                        
                    case 'deshabilitar_controles':
                        // Deshabilitar controles de interfaz
                        const { motivo } = datos;
                        logger.info(`Deshabilitando controles${motivo ? ` (${motivo})` : ''}`, logContexto);
                        
                        // Disparar evento de deshabilitación de controles
                        const eventoDeshabilitar = new CustomEvent('sistema:habilitar_controles', {
                            detail: { 
                                habilitado: false,
                                motivo,
                                timestamp: Date.now()
                            },
                            bubbles: true,
                            cancelable: true
                        });
                        
                        window.dispatchEvent(eventoDeshabilitar);
                        break;
                        
                    default:
                        // Acción no reconocida
                        logger.warn(`Acción de sistema no reconocida: ${accion}`, logContexto);
                        throw new ErrorMensajeria(
                            `Acción de sistema no reconocida: ${accion}`,
                            ERRORES.ACCION_NO_SOPORTADA,
                            { accion }
                        );
                }
            } catch (error) {
                logger.error('Error al procesar mensaje de sistema', {
                    ...logContexto,
                    error: error instanceof ErrorMensajeria ? error.toJSON() : {
                        mensaje: error.message,
                        stack: error.stack
                    }
                });
                
                // Re-lanzar el error para que el manejador principal lo gestione
                throw error;
            }
        }
        
        /**
         * Configura los manejadores de eventos para el elemento de audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio a configurar
         */
        function configurarManejadoresAudio(elementoAudio) {
            if (!elementoAudio) return;
            
            // Manejador para cuando el audio comienza a reproducirse
            elementoAudio.addEventListener('play', () => {
                logger.debug('Evento de audio: play');
                notificarEstadoAudio(elementoAudio, 'reproduciendo');
            });
            
            // Manejador para cuando el audio se pausa
            elementoAudio.addEventListener('pause', () => {
                logger.debug('Evento de audio: pause');
                notificarEstadoAudio(elementoAudio, 'pausado');
            });
            
            // Manejador para cuando el audio termina de reproducirse
            elementoAudio.addEventListener('ended', () => {
                logger.debug('Evento de audio: ended');
                notificarEstadoAudio(elementoAudio, 'finalizado');
            });
            
            // Manejador para errores de carga/reproducción
            elementoAudio.addEventListener('error', (event) => {
                const error = {
                    codigo: elementoAudio.error ? elementoAudio.error.code : 'DESCONOCIDO',
                    mensaje: 'Error en el elemento de audio',
                    detalle: elementoAudio.error ? elementoAudio.error.message : 'Error desconocido'
                };
                
                logger.error('Error en el reproductor de audio', { error });
                
                // Notificar a los oyentes
                const eventoError = new CustomEvent('audio:error', {
                    detail: { 
                        error,
                        url: elementoAudio.src,
                        tiempoActual: elementoAudio.currentTime
                    },
                    bubbles: true,
                    cancelable: true
                });
                
                window.dispatchEvent(eventoError);
            });
            
            // Manejador para cambios en el volumen
            elementoAudio.addEventListener('volumechange', () => {
                logger.debug('Evento de audio: volumechange', { 
                    volumen: elementoAudio.volume,
                    muteado: elementoAudio.muted 
                });
                
                const evento = new CustomEvent('audio:volumen_cambiado', {
                    detail: { 
                        volumen: elementoAudio.volume,
                        muteado: elementoAudio.muted,
                        tiempoActual: elementoAudio.currentTime
                    },
                    bubbles: true,
                    cancelable: true
                });
                
                window.dispatchEvent(evento);
            });
            
            // Manejador para actualizaciones de tiempo (para mostrar la barra de progreso)
            elementoAudio.addEventListener('timeupdate', () => {
                // Solo emitir eventos de actualización de tiempo cada 200ms para evitar saturación
                const ahora = Date.now();
                if (!elementoAudio.ultimoTimeUpdate || ahora - elementoAudio.ultimoTimeUpdate > 200) {
                    elementoAudio.ultimoTimeUpdate = ahora;
                    
                    const evento = new CustomEvent('audio:tiempo_actualizado', {
                        detail: { 
                            tiempoActual: elementoAudio.currentTime,
                            duracion: elementoAudio.duration || 0,
                            porcentaje: elementoAudio.duration > 0 ? 
                                (elementoAudio.currentTime / elementoAudio.duration) * 100 : 0
                        },
                        bubbles: true,
                        cancelable: true
                    });
                    
                    window.dispatchEvent(evento);
                }
            });
        }
        
        /**
         * Notifica el estado actual del reproductor de audio a los oyentes
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {string} estado - Estado actual del reproductor
         */
        function notificarEstadoAudio(elementoAudio, estado) {
            if (!elementoAudio) return;
            
            const detalle = {
                estado,
                url: elementoAudio.src || null,
                tiempoActual: elementoAudio.currentTime,
                duracion: elementoAudio.duration || 0,
                volumen: elementoAudio.volume,
                muteado: elementoAudio.muted,
                loop: elementoAudio.loop,
                velocidad: elementoAudio.playbackRate
            };
            
            // Disparar evento genérico de cambio de estado
            const eventoEstado = new CustomEvent('audio:estado_cambiado', {
                detail: detalle,
                bubbles: true,
                cancelable: true
            });
            
            window.dispatchEvent(eventoEstado);
            
            // Disparar evento específico del estado actual
            const eventoTipoEstado = new CustomEvent(`audio:${estado}`, {
                detail: detalle,
                bubbles: true,
                cancelable: true
            });
            
            window.dispatchEvent(eventoTipoEstado);
        }
        
        /**
         * Maneja los mensajes relacionados con la reproducción de audio
         * @param {string} accion - Acción a realizar (play, pause, stop, volume, etc.)
         * @param {Object} datos - Parámetros específicos de la acción
         * @param {Object} contexto - Contexto del mensaje (origen, mensajeId, etc.)
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarMensajeAudio(accion, datos = {}, contexto = {}) {
            const { mensajeId, origen } = contexto;
            const logContexto = { accion, ...contexto };
            
            try {
                // Validar datos de entrada
                if (!accion || typeof accion !== 'string') {
                    throw new ErrorMensajeria(
                        'Se requiere una acción válida',
                        ERRORES.PARAMETROS_INVALIDOS,
                        { accion }
                    );
                }
                
                // Obtener el elemento de audio o crearlo si no existe
                let elementoAudio = document.getElementById('audio-player');
                if (!elementoAudio) {
                    elementoAudio = document.createElement('audio');
                    elementoAudio.id = 'audio-player';
                    elementoAudio.preload = 'auto';
                    document.body.appendChild(elementoAudio);
                    
                    // Configurar manejadores de eventos para el elemento de audio
                    configurarManejadoresAudio(elementoAudio);
                }
                
                // Procesar la acción solicitada
                switch (accion) {
                    case 'play':
                        return await manejarPlayAudio(elementoAudio, datos, logContexto);
                        
                    case 'pause':
                        return await manejarPauseAudio(elementoAudio, logContexto);
                        
                    case 'resume':
                        return await manejarResumeAudio(elementoAudio, logContexto);
                        
                    case 'stop':
                        return await manejarStopAudio(elementoAudio, logContexto);
                        
                    case 'volume':
                        return await manejarVolumeAudio(elementoAudio, datos, logContexto);
                        
                    case 'seek':
                        return await manejarSeekAudio(elementoAudio, datos, logContexto);
                        
                    case 'get_state':
                        return obtenerEstadoAudio(elementoAudio, logContexto);
                        
                    case 'mute':
                        return await manejarMuteAudio(elementoAudio, true, logContexto);
                        
                    case 'unmute':
                        return await manejarMuteAudio(elementoAudio, false, logContexto);
                        
                    case 'toggle_mute':
                        return await manejarMuteAudio(elementoAudio, null, logContexto);
                        
                    case 'set_playback_rate':
                        return await manejarPlaybackRateAudio(elementoAudio, datos, logContexto);
                        
                    default:
                        // Acción no reconocida
                        logger.warn(`Acción de audio no reconocida: ${accion}`, logContexto);
                        throw new ErrorMensajeria(
                            `Acción de audio no reconocida: ${accion}`,
                            ERRORES.ACCION_NO_SOPORTADA,
                            { accion }
                        );
                }
            } catch (error) {
                logger.error('Error al procesar mensaje de audio', {
                    ...logContexto,
                    error: error instanceof ErrorMensajeria ? error.toJSON() : {
                        mensaje: error.message,
                        stack: error.stack
                    }
                });
                
                // Re-lanzar el error para que el manejador principal lo gestione
                throw error;
            }
        }
        
        /**
         * Maneja la acción de reproducir audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {Object} datos - Datos del mensaje
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarPlayAudio(elementoAudio, datos, logContexto) {
            // Reproducir un archivo de audio
            if (!datos.url) {
                throw new ErrorMensajeria(
                    'Se requiere una URL de audio para reproducir',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { datos }
                );
            }
            
            // Si ya se está reproduciendo el mismo audio, no hacer nada
            if (elementoAudio.src === datos.url && !elementoAudio.paused) {
                logger.debug('El audio ya se está reproduciendo', logContexto);
                return { estado: 'ya_reproduciendo', url: datos.url };
            }
            
            // Cargar y reproducir el audio
            elementoAudio.src = datos.url;
            
            // Configurar volumen si se especifica (0-1)
            if (typeof datos.volumen === 'number' && datos.volumen >= 0 && datos.volumen <= 1) {
                elementoAudio.volume = datos.volumen;
            }
            
            // Configurar si se debe repetir
            elementoAudio.loop = !!datos.loop;
            
            // Configurar tiempo de inicio si se especifica (en segundos)
            if (typeof datos.tiempoInicio === 'number' && datos.tiempoInicio >= 0) {
                elementoAudio.currentTime = datos.tiempoInicio;
            }
            
            // Iniciar la reproducción
            try {
                await elementoAudio.play();
                logger.info('Reproducción de audio iniciada', { 
                    ...logContexto, 
                    url: datos.url,
                    volumen: elementoAudio.volume,
                    loop: elementoAudio.loop
                });
                
                // Notificar a los oyentes
                notificarEstadoAudio(elementoAudio, 'reproduciendo');
                
                return { 
                    estado: 'reproduciendo', 
                    url: datos.url,
                    volumen: elementoAudio.volume,
                    tiempoActual: elementoAudio.currentTime,
                    duracion: elementoAudio.duration || 0
                };
            } catch (error) {
                logger.error('Error al reproducir el audio', { 
                    ...logContexto, 
                    error: error.message,
                    url: datos.url 
                });
                
                throw new ErrorMensajeria(
                    `Error al reproducir el audio: ${error.message}`,
                    ERRORES.ERROR_REPRODUCCION,
                    { url: datos.url, error: error.message }
                );
            }
        }
        
        /**
         * Maneja la acción de pausar el audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        function manejarPauseAudio(elementoAudio, logContexto) {
            // Pausar la reproducción actual
            if (elementoAudio.paused) {
                logger.debug('El audio ya está pausado', logContexto);
                return { estado: 'ya_pausado' };
            }
            
            elementoAudio.pause();
            logger.info('Reproducción de audio pausada', logContexto);
            
            // Notificar a los oyentes
            notificarEstadoAudio(elementoAudio, 'pausado');
            
            return { 
                estado: 'pausado',
                url: elementoAudio.src,
                tiempoActual: elementoAudio.currentTime,
                duracion: elementoAudio.duration || 0
            };
        }
        
        /**
         * Maneja la acción de reanudar la reproducción de audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarResumeAudio(elementoAudio, logContexto) {
            // Reanudar la reproducción pausada
            if (!elementoAudio.paused) {
                logger.debug('El audio ya se está reproduciendo', logContexto);
                return { 
                    estado: 'ya_reproduciendo',
                    url: elementoAudio.src,
                    tiempoActual: elementoAudio.currentTime,
                    duracion: elementoAudio.duration || 0
                };
            }
            
            if (!elementoAudio.src) {
                throw new ErrorMensajeria(
                    'No hay audio cargado para reanudar',
                    ERRORES.AUDIO_NO_CARGADO
                );
            }
            
            try {
                await elementoAudio.play();
                logger.info('Reproducción de audio reanudada', logContexto);
                
                // Notificar a los oyentes
                notificarEstadoAudio(elementoAudio, 'reproduciendo');
                
                return { 
                    estado: 'reproduciendo',
                    url: elementoAudio.src,
                    tiempoActual: elementoAudio.currentTime,
                    duracion: elementoAudio.duration || 0
                };
            } catch (error) {
                logger.error('Error al reanudar el audio', { 
                    ...logContexto, 
                    error: error.message 
                });
                
                throw new ErrorMensajeria(
                    `Error al reanudar el audio: ${error.message}`,
                    ERRORES.ERROR_REPRODUCCION,
                    { error: error.message }
                );
            }
        }
        
        /**
         * Maneja la acción de detener la reproducción de audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        function manejarStopAudio(elementoAudio, logContexto) {
            // Detener la reproducción y reiniciar
            if (!elementoAudio.src) {
                logger.debug('No hay audio reproduciéndose para detener', logContexto);
                return { estado: 'ya_detenido' };
            }
            
            const urlDetenida = elementoAudio.src;
            elementoAudio.pause();
            elementoAudio.currentTime = 0;
            
            logger.info('Reproducción de audio detenida', { 
                ...logContexto, 
                url: urlDetenida 
            });
            
            // Notificar a los oyentes
            notificarEstadoAudio(elementoAudio, 'detenido');
            
            return { 
                estado: 'detenido',
                url: urlDetenida,
                tiempoActual: 0,
                duracion: elementoAudio.duration || 0
            };
        }
        
        /**
         * Maneja la acción de ajustar el volumen del audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {Object} datos - Datos del mensaje
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        function manejarVolumeAudio(elementoAudio, datos, logContexto) {
            // Cambiar el volumen (0-1)
            if (typeof datos.nivel !== 'number' || datos.nivel < 0 || datos.nivel > 1) {
                throw new ErrorMensajeria(
                    'El nivel de volumen debe ser un número entre 0 y 1',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { nivel: datos.nivel }
                );
            }
            
            const volumenAnterior = elementoAudio.volume;
            elementoAudio.volume = datos.nivel;
            
            logger.info('Volumen de audio actualizado', { 
                ...logContexto, 
                volumenAnterior, 
                volumenNuevo: datos.nivel 
            });
            
            // Notificar a los oyentes
            notificarEstadoAudio(elementoAudio, 'volumen_cambiado');
            
            return { 
                estado: 'volumen_actualizado',
                volumen: elementoAudio.volume,
                volumenAnterior
            };
        }
        
        /**
         * Maneja la acción de buscar una posición específica en el audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {Object} datos - Datos del mensaje
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        function manejarSeekAudio(elementoAudio, datos, logContexto) {
            // Buscar una posición específica en el audio (en segundos)
            if (typeof datos.tiempo !== 'number' || datos.tiempo < 0) {
                throw new ErrorMensajeria(
                    'Se requiere un tiempo válido (en segundos) para buscar',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { tiempo: datos.tiempo }
                );
            }
            
            if (!elementoAudio.src) {
                throw new ErrorMensajeria(
                    'No hay audio cargado para buscar',
                    ERRORES.AUDIO_NO_CARGADO
                );
            }
            
            const tiempoAnterior = elementoAudio.currentTime;
            elementoAudio.currentTime = Math.min(datos.tiempo, elementoAudio.duration || Infinity);
            
            logger.debug('Posición de audio actualizada', { 
                ...logContexto, 
                tiempoAnterior, 
                tiempoNuevo: elementoAudio.currentTime 
            });
            
            return { 
                estado: 'posicion_actualizada',
                tiempoActual: elementoAudio.currentTime,
                tiempoAnterior,
                duracion: elementoAudio.duration || 0
            };
        }
        
        /**
         * Obtiene el estado actual del reproductor de audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Estado actual del reproductor
         */
        function obtenerEstadoAudio(elementoAudio, logContexto) {
            const estado = {
                estado: elementoAudio.paused ? (elementoAudio.currentTime > 0 ? 'pausado' : 'detenido') : 'reproduciendo',
                url: elementoAudio.src || null,
                volumen: elementoAudio.volume,
                tiempoActual: elementoAudio.currentTime,
                duracion: elementoAudio.duration || 0,
                muteado: elementoAudio.muted,
                loop: elementoAudio.loop,
                velocidad: elementoAudio.playbackRate
            };
            
            logger.debug('Estado del reproductor de audio obtenido', { 
                ...logContexto, 
                ...estado 
            });
            
            return estado;
        }
        
        /**
         * Maneja las acciones de silenciar/activar sonido del audio
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {boolean|null} estado - true para silenciar, false para activar sonido, null para alternar
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        async function manejarMuteAudio(elementoAudio, estado, logContexto) {
            // Si es null, alternar el estado actual
            const nuevoEstado = estado === null ? !elementoAudio.muted : estado;
            elementoAudio.muted = nuevoEstado;
            
            const accionRealizada = nuevoEstado ? 'silenciado' : 'sonido_activado';
            
            logger.info(`Audio ${accionRealizada}`, { 
                ...logContexto, 
                muteado: elementoAudio.muted 
            });
            
            // Notificar a los oyentes
            notificarEstadoAudio(elementoAudio, accionRealizada);
            
            return { 
                estado: accionRealizada,
                muteado: elementoAudio.muted,
                volumen: elementoAudio.volume
            };
        }
        
        /**
         * Maneja la acción de ajustar la velocidad de reproducción
         * @param {HTMLAudioElement} elementoAudio - Elemento de audio
         * @param {Object} datos - Datos del mensaje
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        function manejarPlaybackRateAudio(elementoAudio, datos, logContexto) {
            // Establecer la velocidad de reproducción (ej: 0.5 para más lento, 1.0 para normal, 2.0 para más rápido)
            if (typeof datos.velocidad !== 'number' || datos.velocidad <= 0) {
                throw new ErrorMensajeria(
                    'La velocidad de reproducción debe ser un número mayor que 0',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { velocidad: datos.velocidad }
                );
            }
            
            const velocidadAnterior = elementoAudio.playbackRate;
            elementoAudio.playbackRate = datos.velocidad;
            
            logger.info('Velocidad de reproducción actualizada', { 
                ...logContexto, 
                velocidadAnterior, 
                velocidadNueva: datos.velocidad 
            });
            
            // Notificar a los oyentes
            notificarEstadoAudio(elementoAudio, 'velocidad_cambiada');
            
            return { 
                estado: 'velocidad_actualizada',
                velocidad: elementoAudio.playbackRate,
                velocidadAnterior
            };
        }
        
        /**
         * Maneja los mensajes relacionados con la navegación
         * @param {string} accion - Acción a realizar (cambiar_vista, actualizar_ruta, etc.)
         * @param {Object} datos - Parámetros específicos de la acción
         * @param {Object} contexto - Contexto del mensaje (origen, mensajeId, etc.)
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarMensajeNavegacion(accion, datos = {}, contexto = {}) {
            const { mensajeId, origen } = contexto;
            const logContexto = { accion, ...contexto };
            
            try {
                // Validar datos de entrada
                if (!accion || typeof accion !== 'string') {
                    throw new ErrorMensajeria(
                        'Se requiere una acción válida',
                        ERRORES.PARAMETROS_INVALIDOS,
                        { accion }
                    );
                }
                
                // Inicializar historial si no existe
                if (!window.historialNavegacion) {
                    window.historialNavegacion = {
                        pila: [],
                        indiceActual: -1,
                        maxElementos: 50
                    };
                }
                
                // Procesar la acción solicitada
                switch (accion) {
                    case 'cambiar_vista':
                        return await cambiarVista(datos, logContexto);
                        
                    case 'actualizar_ruta':
                        return await actualizarRuta(datos, logContexto);
                        
                    case 'ir_atras':
                        return await irAtras(datos, logContexto);
                        
                    case 'ir_adelante':
                        return await irAdelante(datos, logContexto);
                        
                    case 'obtener_ruta_actual':
                        return obtenerRutaActual(logContexto);
                        
                    case 'obtener_historial':
                        return obtenerHistorialNavegacion(logContexto);
                        
                    case 'limpiar_historial':
                        return limpiarHistorialNavegacion(logContexto);
                        
                    default:
                        logger.warn(`Acción de navegación no reconocida: ${accion}`, logContexto);
                        throw new ErrorMensajeria(
                            `Acción no reconocida: ${accion}`,
                            ERRORES.ACCION_NO_SOPORTADA,
                            { accion }
                        );
                }
            } catch (error) {
                logger.error('Error en manejo de navegación', {
                    ...logContexto,
                    error: error.message,
                    stack: error.stack
                });
                throw error;
            }
        }
        
        /**
         * Obtiene los parámetros de la URL actual
         * @returns {Object} Parámetros de la URL
         */
        function obtenerParametrosURL() {
            const params = new URLSearchParams(window.location.search);
            const parametros = {};
            
            for (const [key, value] of params.entries()) {
                parametros[key] = value;
            }
            
            return parametros;
        }
        
        /**
         * Cambia a una nueva vista
         * @param {Object} datos - Datos de navegación
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function cambiarVista(datos, logContexto) {
            const { ruta, parametros = {}, reemplazar = false } = datos;
            
            if (!ruta) {
                throw new ErrorMensajeria(
                    'Se requiere una ruta para cambiar de vista',
                    ERRORES.PARAMETROS_INVALIDOS
                );
            }
            
            // Construir URL con parámetros
            const url = new URL(ruta, window.location.origin);
            Object.entries(parametros).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, String(value));
                }
            });
            
            // Disparar evento antes de cambiar
            const eventoAntes = new CustomEvent('navegacion:antes_de_cambiar', {
                detail: { 
                    rutaActual: window.location.pathname,
                    nuevaRuta: url.pathname,
                    parametros,
                    cancelar: false 
                },
                bubbles: true,
                cancelable: true
            });
            
            const continuar = window.dispatchEvent(eventoAntes);
            
            if (!continuar || eventoAntes.detail.cancelar) {
                logger.info('Cambio de vista cancelado', { ...logContexto, razon: 'usuario' });
                return { estado: 'cancelado', razon: 'usuario' };
            }
            
            // Realizar navegación
            try {
                if (reemplazar) {
                    window.history.replaceState({}, '', url);
                } else {
                    window.history.pushState({}, '', url);
                }
                
                // Actualizar título si se proporciona
                if (datos.titulo) {
                    document.title = datos.titulo;
                }
                
                // Disparar evento después de cambiar
                window.dispatchEvent(new CustomEvent('navegacion:cambio_realizado', {
                    detail: { ruta: url.pathname, parametros }
                }));
                
                return { 
                    estado: 'exito', 
                    ruta: url.pathname,
                    parametros,
                    timestamp: Date.now()
                };
                
            } catch (error) {
                logger.error('Error al cambiar de vista', {
                    ...logContexto,
                    error: error.message,
                    ruta
                });
                
                throw new ErrorMensajeria(
                    `Error al cambiar de vista: ${error.message}`,
                    ERRORES.ERROR_NAVEGACION,
                    { ruta, error: error.message }
                );
            }
        }
        
        /**
         * Actualiza la URL actual con nuevos parámetros sin cambiar la vista
         * @param {Object} datos - Datos de navegación
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        async function actualizarRuta(datos, logContexto) {
            const { ruta, parametros = {} } = datos;
            
            // Construir URL con parámetros
            const url = new URL(ruta || window.location.pathname, window.location.origin);
            
            // Limpiar parámetros existentes
            const params = new URLSearchParams();
            
            // Agregar nuevos parámetros
            Object.entries(parametros).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.set(key, String(value));
                }
            });
            
            // Actualizar URL sin recargar
            const nuevaURL = `${url.pathname}?${params.toString()}`;
            window.history.replaceState({}, '', nuevaURL);
            
            // Disparar evento de actualización
            window.dispatchEvent(new CustomEvent('navegacion:ruta_actualizada', {
                detail: { ruta: url.pathname, parametros }
            }));
            
            return {
                estado: 'exito',
                ruta: url.pathname,
                parametros,
                timestamp: Date.now()
            };
        }
        
        /**
         * Navega hacia atrás en el historial
         * @param {Object} datos - Datos de navegación
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function irAtras(datos, logContexto) {
            const { saltos = 1 } = datos;
            
            if (window.historialNavegacion.indiceCurrent - saltos < 0) {
                logger.warn('No hay suficientes entradas en el historial para retroceder', {
                    ...logContexto,
                    saltosSolicitados: saltos,
                    saltosDisponibles: window.historialNavegacion.indiceCurrent
                });
                
                return {
                    estado: 'error',
                    error: 'No hay suficientes entradas en el historial',
                    saltosDisponibles: window.historialNavegacion.indiceCurrent,
                    saltosSolicitados: saltos
                };
            }
            
            // Actualizar índice y obtener entrada del historial
            window.historialNavegacion.indiceCurrent -= saltos;
            const entrada = window.historialNavegacion.pila[window.historialNavegacion.indiceCurrent];
            
            // Navegar a la entrada del historial
            return await cambiarVista({
                ruta: entrada.ruta,
                parametros: entrada.parametros,
                titulo: entrada.titulo,
                reemplazar: true
            }, { ...logContexto, accion: 'ir_atras' });
        }
        
        /**
         * Navega hacia adelante en el historial
         * @param {Object} datos - Datos de navegación
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function irAdelante(datos, logContexto) {
            const { saltos = 1 } = datos;
            const maxIndex = window.historialNavegacion.pila.length - 1;
            
            if (window.historialNavegacion.indiceCurrent + saltos > maxIndex) {
                logger.warn('No hay suficientes entradas hacia adelante', {
                    ...logContexto,
                    saltosSolicitados: saltos,
                    saltosDisponibles: maxIndex - window.historialNavegacion.indiceCurrent
                });
                
                return {
                    estado: 'error',
                    error: 'No hay suficientes entradas hacia adelante',
                    saltosDisponibles: maxIndex - window.historialNavegacion.indiceCurrent,
                    saltosSolicitados: saltos
                };
            }
            
            // Actualizar índice y obtener entrada del historial
            window.historialNavegacion.indiceCurrent += saltos;
            const entrada = window.historialNavegacion.pila[window.historialNavegacion.indiceCurrent];
            
            // Navegar a la entrada del historial
            return await cambiarVista({
                ruta: entrada.ruta,
                parametros: entrada.parametros,
                titulo: entrada.titulo,
                reemplazar: true
            }, { ...logContexto, accion: 'ir_adelante' });
        }
        
        /**
         * Obtiene la ruta y parámetros actuales
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Información de la ruta actual
         */
        function obtenerRutaActual(logContexto) {
            const ruta = window.location.pathname;
            const parametros = obtenerParametrosURL();
            
            return {
                estado: 'exito',
                ruta,
                parametros,
                titulo: document.title,
                timestamp: Date.now()
            };
        }
        
        /**
         * Obtiene el historial de navegación
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Historial de navegación
         */
        function obtenerHistorialNavegacion(logContexto) {
            return {
                estado: 'exito',
                historial: [...window.historialNavegacion.pila],
                indiceActual: window.historialNavegacion.indiceCurrent,
                total: window.historialNavegacion.pila.length,
                timestamp: Date.now()
            };
        }
        
        /**
         * Limpia el historial de navegación
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        function limpiarHistorialNavegacion(logContexto) {
            const totalEliminados = window.historialNavegacion.pila.length - 1;
            
            // Mantener solo la entrada actual
            const entradaActual = window.historialNavegacion.pila[window.historialNavegacion.indiceCurrent] || 
                                 { ruta: window.location.pathname, parametros: obtenerParametrosURL() };
            
            window.historialNavegacion.pila = [entradaActual];
            window.historialNavegacion.indiceCurrent = 0;
            
            logger.info('Historial de navegación limpiado', {
                ...logContexto,
                totalEliminados,
                entradasRestantes: 1
            });
            
            return {
                estado: 'exito',
                totalEliminados,
                timestamp: Date.now()
            };
        }
        
        /**
         * Maneja los mensajes relacionados con retos y desafíos
         * @param {string} accion - Acción a realizar (iniciar, completar, actualizar_progreso, etc.)
         * @param {Object} datos - Parámetros específicos de la acción
         * @param {Object} contexto - Contexto del mensaje (origen, mensajeId, etc.)
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarMensajeRetos(accion, datos = {}, contexto = {}) {
            const { mensajeId, origen } = contexto;
            const logContexto = { accion, ...contexto };
            
            try {
                // Validar datos de entrada
                if (!accion || typeof accion !== 'string') {
                    throw new ErrorMensajeria(
                        'Se requiere una acción válida',
                        ERRORES.PARAMETROS_INVALIDOS,
                        { accion }
                    );
                }
                
                // Inicializar almacenamiento de retos si no existe
                if (!window.estadoRetos) {
                    window.estadoRetos = {
                        retosActivos: new Map(),
                        retosCompletados: new Set(),
                        progreso: {}
                    };
                }
                
                // Procesar la acción solicitada
                switch (accion) {
                    case 'iniciar':
                        return await iniciarReto(datos, logContexto);
                        
                    case 'completar':
                        return await completarReto(datos, logContexto);
                        
                    case 'actualizar_progreso':
                        return await actualizarProgresoReto(datos, logContexto);
                        
                    case 'obtener_estado':
                        return obtenerEstadoReto(datos, logContexto);
                        
                    case 'listar_activos':
                        return listarRetosActivos(logContexto);
                        
                    case 'listar_completados':
                        return listarRetosCompletados(logContexto);
                        
                    case 'reiniciar':
                        return reiniciarReto(datos, logContexto);
                        
                    case 'cancelar':
                        return cancelarReto(datos, logContexto);
                        
                    default:
                        logger.warn(`Acción de reto no reconocida: ${accion}`, logContexto);
                        throw new ErrorMensajeria(
                            `Acción no reconocida: ${accion}`,
                            ERRORES.ACCION_NO_SOPORTADA,
                            { accion }
                        );
                }
            } catch (error) {
                logger.error('Error en manejo de retos', {
                    ...logContexto,
                    error: error.message,
                    stack: error.stack
                });
                
                throw error;
            }
        }
        
        /**
         * Inicia un nuevo reto
         * @param {Object} datos - Datos del reto
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function iniciarReto(datos, logContexto) {
            const { id, tipo, meta, parametros = {} } = datos;
            
            // Validar datos requeridos
            if (!id || !tipo) {
                throw new ErrorMensajeria(
                    'Se requiere un ID y tipo para iniciar un reto',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { id, tipo }
                );
            }
            
            // Verificar si el reto ya está activo
            if (window.estadoRetos.retosActivos.has(id)) {
                logger.warn('Intento de iniciar un reto ya activo', { ...logContexto, id });
                return { 
                    estado: 'ya_activo',
                    id,
                    timestamp: Date.now()
                };
            }
            
            // Crear objeto de reto
            const reto = {
                id,
                tipo,
                meta,
                parametros,
                progreso: 0,
                fechaInicio: new Date().toISOString(),
                fechaUltimaActualizacion: new Date().toISOString(),
                completado: false
            };
            
            // Almacenar reto
            window.estadoRetos.retosActivos.set(id, reto);
            
            // Inicializar progreso si no existe
            if (!window.estadoRetos.progreso[id]) {
                window.estadoRetos.progreso[id] = 0;
            }
            
            logger.info('Reto iniciado', { ...logContexto, id, tipo });
            
            // Disparar evento
            window.dispatchEvent(new CustomEvent('reto:iniciado', { 
                detail: { ...reto } 
            }));
            
            return {
                estado: 'iniciado',
                id,
                timestamp: Date.now(),
                reto
            };
        }
        
        /**
         * Marca un reto como completado
         * @param {Object} datos - Datos del reto
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function completarReto(datos, logContexto) {
            const { id, recompensa } = datos;
            
            // Validar ID
            if (!id) {
                throw new ErrorMensajeria(
                    'Se requiere un ID para completar un reto',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { id }
                );
            }
            
            // Verificar si el reto existe y está activo
            const reto = window.estadoRetos.retosActivos.get(id);
            if (!reto) {
                throw new ErrorMensajeria(
                    `No se encontró un reto activo con ID: ${id}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { id }
                );
            }
            
            // Actualizar estado del reto
            reto.completado = true;
            reto.fechaCompletado = new Date().toISOString();
            reto.fechaUltimaActualizacion = new Date().toISOString();
            
            // Mover a completados y eliminar de activos
            window.estadoRetos.retosActivos.delete(id);
            window.estadoRetos.retosCompletados.add(id);
            
            // Disparar evento
            const evento = new CustomEvent('reto:completado', { 
                detail: { 
                    ...reto,
                    recompensa
                } 
            });
            
            window.dispatchEvent(evento);
            
            logger.info('Reto completado', { 
                ...logContexto, 
                id,
                tipo: reto.tipo,
                recompensa
            });
            
            return {
                estado: 'completado',
                id,
                recompensa,
                timestamp: Date.now(),
                reto
            };
        }
        
        /**
         * Actualiza el progreso de un reto
         * @param {Object} datos - Datos del progreso
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function actualizarProgresoReto(datos, logContexto) {
            const { id, progreso, incremento, forzar } = datos;
            
            // Validar datos
            if (!id) {
                throw new ErrorMensajeria(
                    'Se requiere un ID para actualizar el progreso',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { id }
                );
            }
            
            // Verificar si el reto existe y está activo
            const reto = window.estadoRetos.retosActivos.get(id);
            if (!reto) {
                throw new ErrorMensajeria(
                    `No se encontró un reto activo con ID: ${id}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { id }
                );
            }
            
            // Calcular nuevo progreso
            let nuevoProgreso = reto.progreso;
            
            if (progreso !== undefined) {
                // Establecer progreso absoluto
                nuevoProgreso = forzar ? progreso : Math.max(reto.progreso, progreso);
            } else if (incremento !== undefined) {
                // Incrementar progreso
                nuevoProgreso = reto.progreso + incremento;
            } else {
                throw new ErrorMensajeria(
                    'Se requiere progreso o incremento para actualizar',
                    ERRORES.PARAMETROS_INVALIDOS
                );
            }
            
            // Actualizar progreso
            reto.progreso = nuevoProgreso;
            reto.fechaUltimaActualizacion = new Date().toISOString();
            
            // Actualizar progreso global
            window.estadoRetos.progreso[id] = nuevoProgreso;
            
            // Verificar si se completó el reto
            if (reto.meta !== undefined && nuevoProgreso >= reto.meta) {
                return await completarReto({ id, recompensa: datos.recompensa }, logContexto);
            }
            
            // Disparar evento de progreso
            window.dispatchEvent(new CustomEvent('reto:progreso_actualizado', { 
                detail: { 
                    id,
                    progreso: nuevoProgreso,
                    meta: reto.meta,
                    porcentaje: reto.meta ? (nuevoProgreso / reto.meta) * 100 : null
                } 
            }));
            
            logger.debug('Progreso de reto actualizado', { 
                ...logContexto, 
                id,
                progreso: nuevoProgreso,
                meta: reto.meta 
            });
            
            return {
                estado: 'progreso_actualizado',
                id,
                progreso: nuevoProgreso,
                meta: reto.meta,
                porcentaje: reto.meta ? (nuevoProgreso / reto.meta) * 100 : null,
                timestamp: Date.now()
            };
        }
        
        /**
         * Obtiene el estado actual de un reto
         * @param {Object} datos - Datos del reto
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Estado del reto
         */
        function obtenerEstadoReto(datos, logContexto) {
            const { id } = datos;
            
            if (!id) {
                // Devolver estado de todos los retos si no se especifica ID
                return {
                    estado: 'exito',
                    retosActivos: Array.from(window.estadoRetos.retosActivos.values()),
                    retosCompletados: Array.from(window.estadoRetos.retosCompletados),
                    timestamp: Date.now()
                };
            }
            
            // Buscar en retos activos
            const retoActivo = window.estadoRetos.retosActivos.get(id);
            if (retoActivo) {
                return {
                    estado: 'activo',
                    reto: { ...retoActivo },
                    timestamp: Date.now()
                };
            }
            
            // Buscar en retos completados
            if (window.estadoRetos.retosCompletados.has(id)) {
                return {
                    estado: 'completado',
                    id,
                    timestamp: Date.now()
                };
            }
            
            // Reto no encontrado
            return {
                estado: 'no_encontrado',
                id,
                timestamp: Date.now()
            };
        }
        
        /**
         * Lista todos los retos activos
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Lista de retos activos
         */
        function listarRetosActivos(logContexto) {
            const retos = Array.from(window.estadoRetos.retosActivos.values());
            
            logger.debug('Listando retos activos', { 
                ...logContexto, 
                total: retos.length 
            });
            
            return {
                estado: 'exito',
                retos,
                total: retos.length,
                timestamp: Date.now()
            };
        }
        
        /**
         * Lista todos los retos completados
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Lista de IDs de retos completados
         */
        function listarRetosCompletados(logContexto) {
            const retos = Array.from(window.estadoRetos.retosCompletados);
            
            logger.debug('Listando retos completados', { 
                ...logContexto, 
                total: retos.length 
            });
            
            return {
                estado: 'exito',
                retos,
                total: retos.length,
                timestamp: Date.now()
            };
        }
        
        /**
         * Reinicia un reto existente
         * @param {Object} datos - Datos del reto
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function reiniciarReto(datos, logContexto) {
            const { id, mantenerProgreso = false } = datos;
            
            // Validar ID
            if (!id) {
                throw new ErrorMensajeria(
                    'Se requiere un ID para reiniciar un reto',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { id }
                );
            }
            
            // Verificar si el reto existe
            const retoActivo = window.estadoRetos.retosActivos.get(id);
            const estaCompletado = window.estadoRetos.retosCompletados.has(id);
            
            if (!retoActivo && !estaCompletado) {
                throw new ErrorMensajeria(
                    `No se encontró un reto con ID: ${id}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { id }
                );
            }
            
            // Si está completo, quitarlo de completados
            if (estaCompletado) {
                window.estadoRetos.retosCompletados.delete(id);
            }
            
            // Iniciar el reto de nuevo
            const reto = retoActivo || { id };
            const resultado = await iniciarReto({
                id: reto.id,
                tipo: reto.tipo,
                meta: reto.meta,
                parametros: reto.parametros
            }, { ...logContexto, accion: 'reiniciar' });
            
            // Restaurar progreso si es necesario
            if (mantenerProgreso && reto.progreso) {
                await actualizarProgresoReto({
                    id,
                    progreso: reto.progreso,
                    forzar: true
                }, logContexto);
            }
            
            return {
                estado: 'reto_reiniciado',
                id,
                progresoMantenido: mantenerProgreso,
                progresoAnterior: mantenerProgreso ? reto.progreso : 0,
                timestamp: Date.now()
            };
        }
        
        /**
         * Cancela un reto activo
         * @param {Object} datos - Datos del reto
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        function cancelarReto(datos, logContexto) {
            const { id } = datos;
            
            // Validar ID
            if (!id) {
                throw new ErrorMensajeria(
                    'Se requiere un ID para cancelar un reto',
                    ERRORES.PARAMETROS_INVALIDOS,
                    { id }
                );
            }
            
            // Verificar si el reto existe y está activo
            const reto = window.estadoRetos.retosActivos.get(id);
            if (!reto) {
                throw new ErrorMensajeria(
                    `No se encontró un reto activo con ID: ${id}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { id }
                );
            }
            
            // Eliminar de activos
            window.estadoRetos.retosActivos.delete(id);
            
            // Disparar evento
            window.dispatchEvent(new CustomEvent('reto:cancelado', { 
                detail: { id, motivo: datos.motivo || 'usuario' } 
            }));
            
            logger.info('Reto cancelado', { 
                ...logContexto, 
                id,
                motivo: datos.motodo || 'usuario' 
            });
            
            return {
                estado: 'cancelado',
                id,
                timestamp: Date.now()
            };
        }
        
        /**
         * Maneja los mensajes relacionados con la interfaz de usuario
         * @param {string} accion - Acción a realizar (mostrar, ocultar, toggle, actualizar, etc.)
         * @param {Object} datos - Parámetros específicos de la acción
         * @param {Object} contexto - Contexto del mensaje (origen, mensajeId, etc.)
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function manejarMensajeUI(accion, datos = {}, contexto = {}) {
            const { mensajeId, origen } = contexto;
            const logContexto = { accion, ...contexto };
            
            try {
                // Validar datos de entrada
                if (!accion || typeof accion !== 'string') {
                    throw new ErrorMensajeria(
                        'Se requiere una acción válida',
                        ERRORES.PARAMETROS_INVALIDOS,
                        { accion }
                    );
                }
                
                // Inicializar estado de UI si no existe
                if (!window.estadoUI) {
                    window.estadoUI = {
                        elementos: new Map(),
                        modales: new Map(),
                        notificaciones: [],
                        tema: 'claro',
                        idioma: 'es',
                        ultimoFoco: null
                    };
                }
                
                // Procesar la acción solicitada
                switch (accion) {
                    case 'mostrar':
                        return await mostrarElemento(datos, logContexto);
                        
                    case 'ocultar':
                        return await ocultarElemento(datos, logContexto);
                        
                    case 'toggle':
                        return await alternarElemento(datos, logContexto);
                        
                    case 'actualizar':
                        return await actualizarElemento(datos, logContexto);
                        
                    case 'establecer_tema':
                        return await establecerTema(datos, logContexto);
                        
                    case 'establecer_idioma':
                        return await establecerIdioma(datos, logContexto);
                        
                    case 'mostrar_modal':
                        return await mostrarModal(datos, logContexto);
                        
                    case 'ocultar_modal':
                        return await ocultarModal(datos, logContexto);
                        
                    case 'mostrar_notificacion':
                        return await mostrarNotificacion(datos, logContexto);
                        
                    case 'ocultar_notificacion':
                        return await ocultarNotificacion(datos, logContexto);
                        
                    case 'enfoque':
                        return await manejarEnfoque(datos, logContexto);
                        
                    case 'desplazarse':
                        return await desplazarAElemento(datos, logContexto);
                        
                    case 'obtener_estado':
                        return obtenerEstadoUI(datos, logContexto);
                        
                    default:
                        logger.warn(`Acción de UI no reconocida: ${accion}`, logContexto);
                        throw new ErrorMensajeria(
                            `Acción no reconocida: ${accion}`,
                            ERRORES.ACCION_NO_SOPORTADA,
                            { accion }
                        );
                }
            } catch (error) {
                logger.error('Error en manejo de UI', {
                    ...logContexto,
                    error: error.message,
                    stack: error.stack
                });
                
                throw error;
            }
        }
        
        /**
         * Muestra un elemento en la interfaz
         * @param {Object} datos - Datos del elemento
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function mostrarElemento(datos, logContexto) {
            const { selector, animacion, duracion = 300 } = datos;
            
            // Validar selector
            if (!selector) {
                throw new ErrorMensajeria(
                    'Se requiere un selector para mostrar un elemento',
                    ERRORES.PARAMETROS_INVALIDOS
                );
            }
            
            // Buscar elemento
            const elemento = document.querySelector(selector);
            if (!elemento) {
                throw new ErrorMensajeria(
                    `No se encontró ningún elemento con el selector: ${selector}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { selector }
                );
            }
            
            // Guardar estado anterior
            const estadoAnterior = {
                display: elemento.style.display,
                visibility: elemento.style.visibility,
                opacity: elemento.style.opacity
            };
            
            // Mostrar elemento
            elemento.style.display = '';
            elemento.style.visibility = 'visible';
            
            // Aplicar animación si se especifica
            if (animacion) {
                elemento.style.transition = `${animacion} ${duracion}ms`;
                elemento.style.opacity = '1';
                
                // Esperar a que termine la animación
                await new Promise(resolve => setTimeout(resolve, duracion));
                elemento.style.transition = '';
            }
            
            // Actualizar estado
            window.estadoUI.elementos.set(selector, {
                visible: true,
                estadoAnterior,
                ultimaAccion: 'mostrar',
                timestamp: Date.now()
            });
            
            // Disparar evento
            window.dispatchEvent(new CustomEvent('ui:elemento_mostrado', {
                detail: { selector, elemento }
            }));
            
            logger.debug('Elemento mostrado', { ...logContexto, selector });
            
            return {
                estado: 'mostrado',
                selector,
                timestamp: Date.now()
            };
        }
        
        /**
         * Oculta un elemento en la interfaz
         * @param {Object} datos - Datos del elemento
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function ocultarElemento(datos, logContexto) {
            const { selector, animacion, duracion = 300, mantenerEspacio } = datos;
            
            // Validar selector
            if (!selector) {
                throw new ErrorMensajeria(
                    'Se requiere un selector para ocultar un elemento',
                    ERRORES.PARAMETROS_INVALIDOS
                );
            }
            
            // Buscar elemento
            const elemento = document.querySelector(selector);
            if (!elemento) {
                throw new ErrorMensajeria(
                    `No se encontró ningún elemento con el selector: ${selector}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { selector }
                );
            }
            
            // Guardar estado actual
            const estadoAnterior = {
                display: elemento.style.display,
                visibility: elemento.style.visibility,
                opacity: elemento.style.opacity
            };
            
            // Aplicar animación si se especifica
            if (animacion) {
                elemento.style.transition = `${animacion} ${duracion}ms`;
                elemento.style.opacity = '0';
                
                // Esperar a que termine la animación
                await new Promise(resolve => setTimeout(resolve, duracion));
                elemento.style.transition = '';
            }
            
            // Ocultar elemento
            if (mantenerEspacio) {
                elemento.style.visibility = 'hidden';
            } else {
                elemento.style.display = 'none';
            }
            
            // Actualizar estado
            window.estadoUI.elementos.set(selector, {
                visible: false,
                estadoAnterior,
                ultimaAccion: 'ocultar',
                timestamp: Date.now()
            });
            
            // Disparar evento
            window.dispatchEvent(new CustomEvent('ui:elemento_oculto', {
                detail: { selector, elemento }
            }));
            
            logger.debug('Elemento ocultado', { ...logContexto, selector });
            
            return {
                estado: 'oculto',
                selector,
                mantenerEspacio,
                timestamp: Date.now()
            };
        }
        
        /**
         * Alterna la visibilidad de un elemento
         * @param {Object} datos - Datos del elemento
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function alternarElemento(datos, logContexto) {
            const { selector } = datos;
            const estadoActual = window.estadoUI.elementos.get(selector);
            
            // Si no hay estado o estaba oculto, mostrarlo; de lo contrario, ocultarlo
            if (!estadoActual || !estadoActual.visible) {
                return await mostrarElemento(datos, logContexto);
            } else {
                return await ocultarElemento(datos, logContexto);
            }
        }
        
        /**
         * Actualiza el contenido o atributos de un elemento
         * @param {Object} datos - Datos del elemento
         * @param {Object} logContexto - Contexto para logs
         * @returns {Promise<Object>} Resultado de la operación
         */
        async function actualizarElemento(datos, logContexto) {
            const { selector, contenido, atributos, html } = datos;
            
            // Validar selector
            if (!selector) {
                throw new ErrorMensajeria(
                    'Se requiere un selector para actualizar un elemento',
                    ERRORES.PARAMETROS_INVALIDOS
                );
            }
            
            // Buscar elemento
            const elemento = document.querySelector(selector);
            if (!elemento) {
                throw new ErrorMensajeria(
                    `No se encontró ningún elemento con el selector: ${selector}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { selector }
                );
            }
            
            // Guardar estado anterior
            const estadoAnterior = {
                contenido: elemento.textContent,
                html: elemento.innerHTML,
                atributos: {}
            };
            
            // Guardar atributos actuales
            Array.from(elemento.attributes).forEach(attr => {
                estadoAnterior.atributos[attr.name] = attr.value;
            });
            
            // Actualizar contenido si se especifica
            if (contenido !== undefined) {
                elemento.textContent = contenido;
            }
            
            // Actualizar HTML si se especifica
            if (html !== undefined) {
                elemento.innerHTML = html;
            }
            
            // Actualizar atributos si se especifican
            if (atributos && typeof atributos === 'object') {
                Object.entries(atributos).forEach(([nombre, valor]) => {
                    if (valor === null || valor === false) {
                        elemento.removeAttribute(nombre);
                    } else {
                        elemento.setAttribute(nombre, valor);
                    }
                });
            }
            
            // Actualizar estado
            window.estadoUI.elementos.set(selector, {
                ...window.estadoUI.elementos.get(selector),
                estadoAnterior,
                ultimaAccion: 'actualizar',
                timestamp: Date.now()
            });
            
            // Disparar evento
            window.dispatchEvent(new CustomEvent('ui:elemento_actualizado', {
                detail: { selector, elemento, cambios: datos }
            }));
            
            logger.debug('Elemento actualizado', { 
                ...logContexto, 
                selector,
                cambios: Object.keys(datos).filter(k => k !== 'selector')
            });
            
            return {
                estado: 'actualizado',
                selector,
                cambios: Object.keys(datos).filter(k => k !== 'selector'),
                timestamp: Date.now()
            };
        }
        
        /**
         * Establece el tema de la interfaz
         * @param {Object} datos - Datos del tema
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        async function establecerTema(datos, logContexto) {
            const { tema } = datos;
            const temasDisponibles = ['claro', 'oscuro', 'alto_contraste', 'modo_noche'];
            const temaAnterior = window.estadoUI.tema;
            
            // Validar tema
            if (!tema || !temasDisponibles.includes(tema)) {
                throw new ErrorMensajeria(
                    `Tema no válido. Temas disponibles: ${temasDisponibles.join(', ')}`,
                    ERRORES.PARAMETROS_INVALIDOS,
                    { tema, temasDisponibles }
                );
            }
            
            // No hacer nada si el tema es el mismo
            if (tema === temaAnterior) {
                logger.debug('El tema ya está establecido', { ...logContexto, tema });
                return { 
                    tema, 
                    temaAnterior,
                    cambiado: false,
                    timestamp: Date.now()
                };
            }
            
            // Crear evento de cambio de tema (cancelable)
            const eventoCambioTema = new CustomEvent('ui:antes_cambio_tema', {
                cancelable: true,
                detail: { tema, temaAnterior }
            });
            
            // Disparar evento y verificar si se cancela
            const continuar = window.dispatchEvent(eventoCambioTema);
            if (!continuar) {
                logger.debug('Cambio de tema cancelado', { ...logContexto, tema, temaAnterior });
                return { 
                    tema: temaAnterior, 
                    temaAnterior,
                    cancelado: true,
                    timestamp: Date.now()
                };
            }
            
            // Actualizar estado
            window.estadoUI.tema = tema;
            
            // Actualizar atributo en el documento
            document.documentElement.setAttribute('data-tema', tema);
            
            // Disparar evento de cambio completado
            window.dispatchEvent(new CustomEvent('ui:tema_cambiado', {
                detail: { tema, temaAnterior }
            }));
            
            logger.debug('Tema cambiado', { ...logContexto, tema, temaAnterior });
            
            return {
                tema,
                temaAnterior,
                cambiado: true,
                timestamp: Date.now()
            };
        }
        
        /**
         * Establece el idioma de la interfaz
         * @param {Object} datos - Datos del idioma
         * @param {Object} logContexto - Contexto para logs
         * @returns {Object} Resultado de la operación
         */
        async function establecerIdioma(datos, logContexto) {
            const { idioma } = datos;
            const idiomasDisponibles = ['es', 'en', 'ca', 'fr', 'de'];
            const idiomaAnterior = window.estadoUI.idioma;
            
            // Validar idioma
            if (!idioma || !idiomasDisponibles.includes(idioma)) {
                throw new ErrorMensajeria(
                    `Idioma no válido. Idiomas disponibles: ${idiomasDisponibles.join(', ')}`,
                    ERRORES.PARAMETROS_INVALIDOS,
                    { idioma, idiomasDisponibles }
                );
            }
            
            // No hacer nada si el idioma es el mismo
            if (idioma === idiomaAnterior) {
                logger.debug('El idioma ya está establecido', { ...logContexto, idioma });
                return { 
                    idioma, 
                    idiomaAnterior,
                    cambiado: false,
                    timestamp: Date.now()
                };
            }
            
            // Crear evento de cambio de idioma (cancelable)
            const eventoCambioIdioma = new CustomEvent('ui:antes_cambio_idioma', {
                cancelable: true,
                detail: { idioma, idiomaAnterior }
            });
            
            // Disparar evento y verificar si se cancela
            const continuar = window.dispatchEvent(eventoCambioIdioma);
            if (!continuar) {
                logger.debug('Cambio de idioma cancelado', { ...logContexto, idioma, idiomaAnterior });
                return { 
                    idioma: idiomaAnterior, 
                    idiomaAnterior,
                    cancelado: true,
                    timestamp: Date.now()
                };
            }
            
            // Actualizar estado
            window.estadoUI.idioma = idioma;
            
            // Actualizar atributo en el documento
            document.documentElement.setAttribute('lang', idioma);
            
            // Disparar evento de cambio completado
            window.dispatchEvent(new CustomEvent('ui:idioma_cambiado', {
                detail: { idioma, idiomaAnterior }
            }));
            
            logger.debug('Idioma cambiado', { ...logContexto, idioma, idiomaAnterior });
            
            return {
                idioma,
                idiomaAnterior,
                cambiado: true,
                timestamp: Date.now()
            };
        }
        
        /**
         * Muestra un modal en la interfaz
         */
        async function mostrarModal(datos, logContexto) {
            const { 
                id, 
                titulo, 
                contenido, 
                acciones = [],
                cerrarAlHacerClickEnFondo = true
            } = datos;
            
            if (!id) throw new ErrorMensajeria('Se requiere un ID para mostrar un modal', ERRORES.PARAMETROS_INVALIDOS);
            
            if (window.estadoUI.modales.has(id)) {
                logger.debug('El modal ya está abierto', { ...logContexto, id });
                return { id, estado: 'ya_abierto', timestamp: Date.now() };
            }
            
            const modal = document.createElement('div');
            modal.id = `modal-${id}`;
            modal.className = 'modal';
            
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            
            const contenidoModal = document.createElement('div');
            contenidoModal.className = 'modal-contenido';
            
            if (titulo) {
                const tituloElemento = document.createElement('h2');
                tituloElemento.className = 'modal-titulo';
                tituloElemento.textContent = titulo;
                contenidoModal.appendChild(tituloElemento);
            }
            
            if (contenido) {
                const contenidoElemento = document.createElement('div');
                contenidoElemento.className = 'modal-cuerpo';
                contenidoElemento.innerHTML = contenido;
                contenidoModal.appendChild(contenidoElemento);
            }
            
            // Añadir acciones si se proporcionan
            if (acciones.length > 0) {
                const contenedorAcciones = document.createElement('div');
                contenedorAcciones.className = 'modal-acciones';
                
                acciones.forEach(accion => {
                    const boton = document.createElement('button');
                    boton.className = `boton ${accion.estilo || 'secundario'}`;
                    boton.textContent = accion.texto;
                    
                    if (accion.manejador) {
                        boton.addEventListener('click', async (e) => {
                            try {
                                await accion.manejador(e);
                                if (accion.cerrarAlHacerClick !== false) {
                                    await ocultarModal({ id }, logContexto);
                                }
                            } catch (error) {
                                logger.error('Error en manejador de acción del modal', {
                                    ...logContexto,
                                    id,
                                    accion: accion.texto,
                                    error: error.message
                                });
                            }
                        });
                    } else if (accion.cerrarAlHacerClick !== false) {
                        boton.addEventListener('click', () => ocultarModal({ id }, logContexto));
                    }
                    
                    contenedorAcciones.appendChild(boton);
                });
                
                contenidoModal.appendChild(contenedorAcciones);
            }
            
            const manejarTecla = (e) => {
                if (e.key === 'Escape') ocultarModal({ id }, logContexto);
            };
            
            // Configurar cierre del modal
            if (cerrarAlHacerClickEnFondo) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        ocultarModal({ id }, logContexto);
                    }
                });
                document.addEventListener('keydown', manejarTecla);
            }
            
            modal.appendChild(overlay);
            modal.appendChild(contenidoModal);
            document.body.appendChild(modal);
            
            // Forzar reflujo para la animación
            void modal.offsetWidth;
            modal.classList.add('visible');
            
            window.estadoUI.modales.set(id, {
                elemento: modal,
                abierto: true,
                manejadorTeclado: manejarTecla,
                timestamp: Date.now()
            });
            
            return { id, estado: 'mostrado', timestamp: Date.now() };
        }
        
        /**
         * Oculta un modal
         */
        async function ocultarModal(datos, logContexto) {
            const { id } = datos;
            if (!id) throw new ErrorMensajeria('Se requiere un ID para ocultar un modal', ERRORES.PARAMETROS_INVALIDOS);
            
            const modalInfo = window.estadoUI.modales.get(id);
            if (!modalInfo || !modalInfo.abierto) {
                return { id, estado: 'no_abierto', timestamp: Date.now() };
            }
            
            document.removeEventListener('keydown', modalInfo.manejadorTeclado);
            
            if (modalInfo.elemento) {
                // Eliminar con animación
                modalInfo.elemento.classList.remove('visible');
                
                // Esperar a que termine la animación antes de eliminar
                await new Promise(resolve => {
                    const manejarTransicion = () => {
                        modalInfo.elemento.removeEventListener('transitionend', manejarTransicion);
                        modalInfo.elemento.remove();
                        resolve();
                    };
                    
                    modalInfo.elemento.addEventListener('transitionend', manejarTransicion);
                    
                    // Timeout por si la transición falla
                    setTimeout(() => {
                        modalInfo.elemento.removeEventListener('transitionend', manejarTransicion);
                        if (modalInfo.elemento.parentNode) {
                            modalInfo.elemento.remove();
                        }
                        resolve();
                    }, 300);
                });
            }
            
            window.estadoUI.modales.delete(id);
            
            return { id, estado: 'cerrado', timestamp: Date.now() };
        }
        
        /**
         * Gets or creates the notifications container
         * @returns {HTMLElement} The notifications container
         */
        function obtenerContenedorNotificaciones() {
            let contenedor = document.getElementById('notificaciones');
            
            if (!contenedor) {
                contenedor = document.createElement('div');
                contenedor.id = 'notificaciones';
                contenedor.className = 'notificaciones';
                document.body.appendChild(contenedor);
            }
            
            return contenedor;
        }
        
        /**
         * Shows a notification
         */
        async function mostrarNotificacion(datos, logContexto) {
            const {
                id = `notif-${Date.now()}`,
                tipo = 'info',
                titulo,
                mensaje,
                duracion = 5000,
                cerrarAutomaticamente = true,
                acciones = []
            } = datos;
            
            // Create notification element
            const notificacion = document.createElement('div');
            notificacion.id = id;
            notificacion.className = `notificacion notificacion-${tipo}`;
            
            // Notification content
            const contenido = document.createElement('div');
            contenido.className = 'notificacion-contenido';
            
            if (titulo) {
                const tituloElemento = document.createElement('h4');
                tituloElemento.className = 'notificacion-titulo';
                tituloElemento.textContent = titulo;
                contenido.appendChild(tituloElemento);
            }
            
            if (mensaje) {
                const mensajeElemento = document.createElement('div');
                mensajeElemento.className = 'notificacion-mensaje';
                mensajeElemento.innerHTML = mensaje;
                contenido.appendChild(mensajeElemento);
            }
            
            // Add actions if provided
            if (acciones && acciones.length > 0) {
                const contenedorAcciones = document.createElement('div');
                contenedorAcciones.className = 'notificacion-acciones';
                
                acciones.forEach(accion => {
                    const boton = document.createElement('button');
                    boton.className = `boton boton-pequeno ${accion.estilo || 'secundario'}`;
                    boton.textContent = accion.texto;
                    
                    if (accion.manejador) {
                        boton.addEventListener('click', async (e) => {
                            try {
                                await accion.manejador(e);
                                if (accion.cerrarAlHacerClick !== false) {
                                    await ocultarNotificacion({ id }, logContexto);
                                }
                            } catch (error) {
                                logger.error('Error en manejador de acción de notificación', {
                                    ...logContexto,
                                    id,
                                    accion: accion.texto,
                                    error: error.message
                                });
                            }
                        });
                    } else if (accion.cerrarAlHacerClick !== false) {
                        boton.addEventListener('click', () => ocultarNotificacion({ id }, logContexto));
                    }
                    
                    contenedorAcciones.appendChild(boton);
                });
                
                contenido.appendChild(contenedorAcciones);
            }
            
            // Close button
            const botonCerrar = document.createElement('button');
            botonCerrar.className = 'notificacion-cerrar';
            botonCerrar.innerHTML = '&times;';
            botonCerrar.addEventListener('click', () => ocultarNotificacion({ id }, logContexto));
            
            // Assemble notification
            notificacion.appendChild(contenido);
            notificacion.appendChild(botonCerrar);
            
            // Add to container
            const contenedor = obtenerContenedorNotificaciones();
            contenedor.appendChild(notificacion);
            
            // Fire event before showing
            const eventoMostrar = new CustomEvent('ui:antes_mostrar_notificacion', {
                cancelable: true,
                detail: { id, notificacion, datos }
            });
            
            const continuar = window.dispatchEvent(eventoMostrar);
            if (!continuar) {
                notificacion.remove();
                return { id, estado: 'mostrar_cancelado', timestamp: Date.now() };
            }
            
            // Trigger animation
            void notificacion.offsetWidth;
            notificacion.classList.add('visible');
            
            // Fire shown event
            window.dispatchEvent(new CustomEvent('ui:notificacion_mostrada', {
                detail: { id, notificacion, datos }
            }));
            
            // Set auto-close timeout
            let timeoutId;
            if (cerrarAutomaticamente && duracion > 0) {
                timeoutId = setTimeout(() => {
                    ocultarNotificacion({ id }, logContexto);
                }, duracion);
            }
            
            // Update state
            window.estadoUI.notificaciones.push({
                id,
                elemento: notificacion,
                timeoutId,
                timestamp: Date.now()
            });
            
            logger.debug('Notificación mostrada', { ...logContexto, id, tipo });
            
            return {
                id,
                estado: 'mostrada',
                timestamp: Date.now()
            };
        }
        
        /**
         * Hides a notification
         */
        async function ocultarNotificacion(datos, logContexto) {
            const { id } = datos;
            
            if (!id) {
                throw new ErrorMensajeria(
                    'Se requiere un ID para ocultar una notificación',
                    ERRORES.PARAMETROS_INVALIDOS
                );
            }
            
            // Find the notification in the state
            const index = window.estadoUI.notificaciones.findIndex(n => n.id === id);
            
            if (index === -1) {
                logger.debug('La notificación no existe o ya fue cerrada', { ...logContexto, id });
                return { id, estado: 'no_encontrada', timestamp: Date.now() };
            }
            
            const notificacion = window.estadoUI.notificaciones[index];
            
            // Clear auto-close timeout if it exists
            if (notificacion.timeoutId) {
                clearTimeout(notificacion.timeoutId);
            }
            
            // Remove with animation
            if (notificacion.elemento) {
                notificacion.elemento.classList.remove('visible');
                
                // Wait for animation to complete before removing the element
                await new Promise(resolve => {
                    const manejarTransicion = () => {
                        notificacion.elemento.removeEventListener('transitionend', manejarTransicion);
                        if (notificacion.elemento.parentNode) {
                            notificacion.elemento.remove();
                        }
                        resolve();
                    };
                    
                    notificacion.elemento.addEventListener('transitionend', manejarTransicion);
                    
                    // Fallback in case transition events don't fire
                    setTimeout(() => {
                        notificacion.elemento.removeEventListener('transitionend', manejarTransicion);
                        if (notificacion.elemento.parentNode) {
                            notificacion.elemento.remove();
                        }
                        resolve();
                    }, 300);
                });
            }
            
            // Remove from state
            window.estadoUI.notificaciones.splice(index, 1);
            
            // Remove notifications container if empty
            const contenedor = document.getElementById('notificaciones');
            if (contenedor && contenedor.children.length === 0) {
                contenedor.remove();
            }
            
            logger.debug('Notificación ocultada', { ...logContexto, id });
            
            return {
                id,
                estado: 'ocultada',
                timestamp: Date.now()
            };
        }
        
        /**
         * Handles focus management
         */
        async function manejarEnfoque(datos, logContexto) {
            const { selector, guardarAnterior = true } = datos;
            
            if (!selector) {
                throw new ErrorMensajeria(
                    'Se requiere un selector para manejar el enfoque',
                    ERRORES.PARAMETROS_INVALIDOS
                );
            }
            
            const elemento = document.querySelector(selector);
            if (!elemento) {
                throw new ErrorMensajeria(
                    `No se encontró ningún elemento con el selector: ${selector}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { selector }
                );
            }
            
            // Save current focused element if needed
            if (guardarAnterior && document.activeElement) {
                window.estadoUI.ultimoFoco = document.activeElement;
            }
            
            // Set focus to the element
            elemento.focus({ preventScroll: true });
            
            logger.debug('Enfoque manejado', { ...logContexto, selector });
            
            return {
                selector,
                elementoFocalizado: selector,
                elementoAnterior: window.estadoUI.ultimoFoco ? 
                    `#${window.estadoUI.ultimoFoco.id}` : null,
                timestamp: Date.now()
            };
        }
        
        /**
         * Scrolls to an element
         */
        async function desplazarAElemento(datos, logContexto) {
            const { selector, comportamiento = 'smooth', alineacion = 'start', desplazamiento = 0 } = datos;
            
            if (!selector) {
                throw new ErrorMensajeria(
                    'Se requiere un selector para desplazarse',
                    ERRORES.PARAMETROS_INVALIDOS
                );
            }
            
            const elemento = document.querySelector(selector);
            if (!elemento) {
                throw new ErrorMensajeria(
                    `No se encontró ningún elemento con el selector: ${selector}`,
                    ERRORES.RECURSO_NO_ENCONTRADO,
                    { selector }
                );
            }
            
            // Scroll to element
            elemento.scrollIntoView({
                behavior: comportamiento,
                block: alineacion,
                inline: 'nearest'
            });
            
            // Apply additional offset if needed
            if (desplazamiento !== 0) {
                const rect = elemento.getBoundingClientRect();
                window.scrollBy({
                    top: rect.top + window.pageYOffset - desplazamiento,
                    behavior: comportamiento
                });
            }
            
            logger.debug('Desplazamiento realizado', { 
                ...logContexto, 
                selector,
                comportamiento,
                alineacion,
                desplazamiento
            });
            
            return {
                selector,
                comportamiento,
                alineacion,
                desplazamiento,
                timestamp: Date.now()
            };
        }
        
        /**
         * Returns the current UI state
         */
        function obtenerEstadoUI() {
            return {
                tema: window.estadoUI.tema,
                idioma: window.estadoUI.idioma,
                elementosVisibles: Array.from(window.estadoUI.elementos.entries())
                    .filter(([_, estado]) => estado.visible)
                    .map(([selector, _]) => selector),
                modalesAbiertos: Array.from(window.estadoUI.modales.entries())
                    .filter(([_, estado]) => estado.abierto)
                    .map(([id, _]) => id),
                notificacionesActivas: window.estadoUI.notificaciones
                    .map(n => n.id),
                ultimoFoco: window.estadoUI.ultimoFoco ? 
                    `#${window.estadoUI.ultimoFoco.id}` : null,
                timestamp: Date.now()
            };
        }
        
        // Controladores de eventos
        const controladores = {
            cambioModo: [],
            habilitarControles: [],
            deshabilitarControles: [],
            actualizarEstado: []
        };
        
        /**
         * Registra un controlador para un tipo de evento
         * @param {string} tipo - Tipo de evento ('cambioModo', 'habilitarControles', 'deshabilitarControles', 'actualizarEstado')
         * @param {Function} controlador - Función que manejará el evento
         * @returns {Function} Función para eliminar el controlador
         */
        function registrarControlador(tipo, controlador) {
            if (!controladores[tipo]) {
                logger.warn(`Tipo de controlador no válido: ${tipo}`);
                return () => {};
            }
            
            controladores[tipo].push(controlador);
            
            // Retorna una función para eliminar el controlador
            return () => {
                const index = controladores[tipo].indexOf(controlador);
                if (index !== -1) {
                    controladores[tipo].splice(index, 1);
                }
            };
        }
        
        /**
         * Dispara un evento a todos los controladores registrados
         * @param {string} tipo - Tipo de evento
         * @param {*} datos - Datos a enviar a los controladores
         */
        function dispararEvento(tipo, datos) {
            if (!controladores[tipo]) {
                logger.warn(`No hay controladores para el tipo: ${tipo}`);
                return;
            }
            
            controladores[tipo].forEach(controlador => {
                try {
                    controlador(datos);
                } catch (error) {
                    logger.error(`Error en el controlador de ${tipo}:`, error);
                }
            });
        }
        
        /**
         * Crea un mensaje estandarizado
         * @param {string} tipo - Tipo de mensaje (usar TIPOS_MENSAJE)
         * @param {Object} datos - Datos del mensaje
         * @param {string} destino - Destinatario del mensaje
         * @param {string} origen - Origen del mensaje (se autocompleta si no se especifica)
         * @returns {Object} Mensaje estandarizado
         */
        function crearMensaje(tipo, datos = {}, destino = null, origen = null) {
            const mensaje = {
                version: '1.0',
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                tipo,
                origen: origen || config.iframeId,
                destino,
                datos
            };
        
            logger.debug(`Mensaje creado:`, mensaje);
            return mensaje;
        }
        
        /**
         * Valida la estructura de un mensaje
         * @param {Object} mensaje - Mensaje a validar
         * @returns {Object} { valido: boolean, error: string }
         */
        function validarMensaje(mensaje) {
            if (!mensaje) {
                return { valido: false, error: 'Mensaje nulo o indefinido' };
            }
        
            const camposRequeridos = ['version', 'id', 'timestamp', 'tipo', 'origen'];
            const faltantes = camposRequeridos.filter(campo => !(campo in mensaje));
        
            if (faltantes.length > 0) {
                return { 
                    valido: false, 
                    error: `Campos requeridos faltantes: ${faltantes.join(', ')}` 
                };
            }
        
            // Validar tipo de mensaje
            const tipoValido = Object.values(TIPOS_MENSAJE).some(
                categoria => Object.values(categoria).includes(mensaje.tipo)
            );
        
            if (!tipoValido) {
                return {
                    valido: false,
                    error: `Tipo de mensaje no válido: ${mensaje.tipo}`
                };
            }
        
            return { valido: true };
        }
        
        /**
         * Inicializa el sistema de mensajería
         * @param {Object} opciones - Opciones de configuración
         * @param {string} opciones.iframeId - Identificador del iframe
         * @param {number} opciones.logLevel - Nivel de log (0-4)
         * @param {boolean} opciones.debug - Modo depuración
         */
        function inicializarMensajeria({ 
            iframeId, 
            logLevel = LOG_LEVELS.INFO, 
            debug = false,
            maxRetries = 3,
            retryDelay = 1000,
            connectionCheckInterval = 5000,
            maxHistorySize = 100
        } = {}) {
            // Actualizar configuración
            Object.assign(config, {
                iframeId: iframeId || config.iframeId,
                logLevel: logLevel in LOG_LEVELS ? logLevel : LOG_LEVELS.INFO,
                debug: Boolean(debug),
                maxRetries: Math.max(1, parseInt(maxRetries) || 3),
                retryDelay: Math.max(100, parseInt(retryDelay) || 1000),
                connectionCheckInterval: Math.max(1000, parseInt(connectionCheckInterval) || 5000),
                maxHistorySize: Math.max(10, parseInt(maxHistorySize) || 100)
            });
            
            // Iniciar monitoreo de conexión
            iniciarMonitoreoConexion();
            
            // Configurar manejador de mensajes entrantes
            window.addEventListener('message', manejarMensajeEntrante);
            
            // Configurar evento beforeunload para limpieza
            window.addEventListener('beforeunload', () => {
                detenerMonitoreoConexion();
                window.removeEventListener('message', manejarMensajeEntrante);
            });
            if (iframeId) {
                config.iframeId = iframeId;
                logger.prefix = `[${iframeId}]`;
            }
            
            if (logLevel !== undefined) {
                config.logLevel = logLevel;
            }
            
            config.debug = debug;
            
            if (debug) {
                config.logLevel = LOG_LEVELS.DEBUG;
                logger.debug('Modo depuración activado');
            }
            
            logger.log('Sistema de mensajería inicializado', config);
        }
        
        /**
         * Habilita o deshabilita los controles según el modo especificado
         * @param {string} modo - Modo de operación ('casa' o 'aventura')
         * @param {Object} opciones - Opciones adicionales
         * @param {string} [opciones.motivo] - Razón del cambio de estado
         * @param {boolean} [opciones.forzar] - Forzar el cambio aunque ya esté en ese estado
         * @returns {boolean} true si se realizó el cambio, false en caso contrario
         */
        function enableControls(modo = 'casa', { motivo = 'sin_especificar', forzar = false } = {}) {
            if (!['casa', 'aventura'].includes(modo)) {
                logger.warn(`Modo no válido: ${modo}. Usando 'casa' por defecto.`);
                modo = 'casa';
            }
            
            // No hacer nada si el modo es el mismo y no se fuerza
            if (estadoGlobal.modo === modo && !forzar) {
                logger.debug(`Los controles ya están en modo '${modo}'. No se realizan cambios.`);
                return false;
            }
            
            const estadoAnterior = { ...estadoGlobal };
            
            // Actualizar estado
            estadoGlobal.modo = modo;
            estadoGlobal.controlesHabilitados = true;
            estadoGlobal.motivoDeshabilitacion = null;
            estadoGlobal.ultimaAccion = 'enableControls';
            estadoGlobal.timestamp = Date.now();
            
            logger.info(`Controles habilitados en modo '${modo}'. Motivo: ${motivo}`);
            
            // Notificar a los controladores
            dispararEvento('cambioModo', { 
                modo, 
                motivo,
                estadoAnterior,
                estadoActual: { ...estadoGlobal }
            });
            
            return true;
        }
        
        /**
         * Deshabilita los controles con un motivo específico
         * @param {string} motivo - Razón por la que se deshabilitan los controles
         * @returns {boolean} true si se deshabilitaron los controles, false si ya estaban deshabilitados
         */
        function disableControls(motivo = 'sin_especificar') {
            if (!estadoGlobal.controlesHabilitados) {
                logger.debug(`Los controles ya están deshabilitados. Motivo anterior: ${estadoGlobal.motivoDeshabilitacion || 'sin_especificar'}`);
                return false;
            }
            
            const estadoAnterior = { ...estadoGlobal };
            
            // Actualizar estado
            estadoGlobal.controlesHabilitados = false;
            estadoGlobal.motivoDeshabilitacion = motivo;
            estadoGlobal.ultimaAccion = 'disableControls';
            estadoGlobal.timestamp = Date.now();
            
            logger.info(`Controles deshabilitados. Motivo: ${motivo}`);
            
            // Notificar a los controladores
            dispararEvento('deshabilitarControles', {
                motivo,
                estadoAnterior,
                estadoActual: { ...estadoGlobal }
            });
            
            return true;
        }
        
        /**
         * Maneja el cambio de modo de la aplicación
         * @param {string} modo - Nuevo modo ('casa' o 'aventura')
         * @param {boolean} habilitar - Si es true, habilita los controles
         * @param {Object} opciones - Opciones adicionales
         * @param {string} [opciones.motivo] - Razón del cambio de modo
         * @param {boolean} [opciones.forzar] - Forzar el cambio aunque ya esté en ese modo
         * @returns {boolean} true si se realizó el cambio, false en caso contrario
         */
        function manejarCambioModo(modo, habilitar = false, { motivo = 'cambio_modo', forzar = false } = {}) {
            if (!['casa', 'aventura'].includes(modo)) {
                logger.warn(`Modo no válido: ${modo}. No se realizan cambios.`);
                return false;
            }
            
            const estadoAnterior = { ...estadoGlobal };
            let cambioRealizado = false;
            
            // Cambiar el modo si es diferente o si se fuerza
            if (estadoGlobal.modo !== modo || forzar) {
                estadoGlobal.modo = modo;
                cambioRealizado = true;
                
                // Notificar a los controladores del cambio de modo
                dispararEvento('cambioModo', {
                    modo,
                    motivo,
                    estadoAnterior,
                    estadoActual: { ...estadoGlobal, modo }
                });
            }
            
            // Habilitar/deshabilitar controles según corresponda
            if (habilitar) {
                cambioRealizado = enableControls(modo, { motivo, forzar }) || cambioRealizado;
            } else {
                cambioRealizado = disableControls(motivo) || cambioRealizado;
            }
            
            // Notificar a todos los controladores del estado actual
            if (cambioRealizado) {
                dispararEvento('actualizarEstado', {
                    motivo,
                    estadoAnterior,
                    estadoActual: { ...estadoGlobal }
                });
            }
            
            return cambioRealizado;
        }
        
        // Cola de mensajes pendientes
        const messageQueue = [];
        const pendingMessages = new Map();
        let messageIdCounter = 0;
        
        /**
         * Envía un mensaje con reintentos automáticos
         * @param {string} destino - Destinatario del mensaje (debe ser 'padre', 'hijo2', 'hijo3', 'hijo4' o 'hijo5-casa')
         * @param {string} tipo - Tipo de mensaje (debe ser uno de TIPOS_MENSAJE)
         * @param {Object} [datos={}] - Datos del mensaje
         * @param {Object} [opciones={}] - Opciones adicionales
         * @param {number} [opciones.maxRetries=3] - Número máximo de reintentos
         * @param {number} [opciones.timeout=5000] - Tiempo de espera para reintentos (ms)
         * @param {boolean} [opciones.important=false] - Si es true, se reintentará incluso en modo offline
         * @returns {Promise<Object>} Respuesta del mensaje con estructura { success: boolean, messageId: string, error?: string }
         * @throws {Error} Si los parámetros no son válidos
         */
        async function enviarMensajeConReintentos(destino, tipo, datos = {}, {
            maxRetries = config.maxRetries,
            timeout = 5000,
            important = false
        } = {}) {
            // Validar parámetros de entrada
            if (typeof destino !== 'string' || !destino.trim()) {
                const error = new Error('El destino es requerido y debe ser una cadena no vacía');
                logger.error(error.message);
                throw error;
            }
            
            // Validar que el destino sea válido
            const destinosValidos = ['padre', 'hijo2', 'hijo3', 'hijo4', 'hijo5-casa'];
            if (!destinosValidos.includes(destino)) {
                const error = new Error(`Destino no válido: '${destino}'. Debe ser uno de: ${destinosValidos.join(', ')}`);
                logger.error(error.message);
                throw error;
            }
            
            if (typeof tipo !== 'string' || !tipo.trim()) {
                const error = new Error('El tipo de mensaje es requerido y debe ser una cadena no vacía');
                logger.error(error.message);
                throw error;
            }
            
            // Validar que el tipo de mensaje sea válido (advertencia, no error)
            const tipoValido = Object.values(TIPOS_MENSAJE).some(
                categoria => Object.values(categoria).includes(tipo)
            );
            
            if (!tipoValido) {
                logger.warn(`Tipo de mensaje no reconocido: '${tipo}'. Se enviará de todos modos.`);
            }
            
            // Validar que los datos sean un objeto
            if (datos && (typeof datos !== 'object' || Array.isArray(datos))) {
                const error = new Error('Los datos del mensaje deben ser un objeto');
                logger.error(error.message);
                throw error;
            }
            
            const messageId = `msg_${Date.now()}_${messageIdCounter++}`;
            const message = crearMensaje(tipo, datos, destino, config.iframeId);
            
            // Añadir a la cola si estamos offline y no es importante
            if (!config.isOnline && !important) {
                logger.debug(`Modo offline. Mensaje encolado (${messageId}):`, { destino, tipo });
                messageQueue.push({ 
                    message, 
                    options: { 
                        maxRetries: Math.max(1, maxRetries || 3),
                        timeout: Math.max(1000, timeout || 5000),
                        important: Boolean(important)
                    },
                    timestamp: Date.now(),
                    queuedAt: new Date().toISOString()
                });
                return { 
                    success: false, 
                    queued: true, 
                    messageId,
                    status: 'queued_offline',
                    timestamp: Date.now()
                };
            }
        
            let attempts = 0;
            const startTime = Date.now();
            
            const sendAttempt = async () => {
                const attemptStart = Date.now();
                attempts++;
                
                try {
                    // Validar que el destino esté listo para recibir mensajes
                    if (destino !== 'padre' && !document.getElementById(destino)?.contentWindow) {
                        throw new Error(`Destino '${destino}' no disponible`);
                    }
                    
                    logger.debug(`Enviando mensaje (${attempts}/${maxRetries}):`, {
                        id: messageId,
                        tipo,
                        destino,
                        size: JSON.stringify(message).length,
                        attempt: attempts,
                        maxAttempts: maxRetries
                    });
                    
                    // Usar el método de envío existente con timeout
                    const result = await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => {
                            reject(new Error(`Tiempo de espera agotado (${timeout}ms)`));
                        }, timeout);
        
                        enviarMensaje(destino, tipo, datos)
                            .then(result => {
                                clearTimeout(timer);
                                resolve(result);
                            })
                            .catch(error => {
                                clearTimeout(timer);
                                reject(error);
                            });
                    });
        
                    // Mensaje enviado con éxito
                    const deliveryTime = Date.now() - attemptStart;
                    const totalTime = Date.now() - startTime;
                    
                    const messageInfo = { 
                        ...message, 
                        status: 'delivered',
                        timestamp: new Date().toISOString(),
                        attempts,
                        deliveryTime: `${deliveryTime}ms`,
                        totalTime: `${totalTime}ms`
                    };
                    
                    config.messageHistory.set(messageId, messageInfo);
                    
                    // Limpiar el historial si es necesario
                    if (config.messageHistory.size > config.maxHistorySize) {
                        const oldestKey = config.messageHistory.keys().next().value;
                        config.messageHistory.delete(oldestKey);
                    }
        
                    logger.debug(`Mensaje entregado (${messageId}) en ${deliveryTime}ms`);
                    
                    return { 
                        success: true, 
                        messageId, 
                        ...result,
                        status: 'delivered',
                        attempts,
                        deliveryTime,
                        totalTime
                    };
                    
                } catch (error) {
                    const errorTime = Date.now() - attemptStart;
                    const errorObj = error instanceof Error ? error : new Error(String(error));
                    
                    logger.warn(`Error al enviar mensaje (${messageId}, intento ${attempts}/${maxRetries}):`, {
                        error: errorObj.message,
                        errorType: errorObj.name,
                        stack: config.debug ? errorObj.stack : undefined,
                        time: `${errorTime}ms`
                    });
                    
                    // Decidir si reintentar o no
                    const shouldRetry = attempts < maxRetries && 
                                      (config.isOnline || important) &&
                                      !errorObj.message.includes('no válido');
                    
                    if (shouldRetry) {
                        const retryDelay = Math.min(1000 * Math.pow(2, attempts - 1), 30000); // Backoff exponencial, máximo 30s
                        logger.debug(`Reintentando envío en ${retryDelay}ms (${attempts + 1}/${maxRetries})...`);
                        
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        return sendAttempt();
                    }
                    
                    // Si no se va a reintentar, registrar el error
                    const messageInfo = {
                        ...message,
                        status: 'failed',
                        error: errorObj.message,
                        errorType: errorObj.name,
                        timestamp: new Date().toISOString(),
                        attempts,
                        lastAttempt: Date.now()
                    };
                    
                    config.messageHistory.set(messageId, messageInfo);
                    
                    // Si es importante, agregar a la cola para reintentar más tarde
                    if (important) {
                        logger.warn(`Mensaje importante fallido, encolando para reintento posterior: ${messageId}`);
                        messageQueue.unshift({ 
                            message, 
                            options: { 
                                maxRetries: Math.max(0, maxRetries - attempts),
                                timeout: Math.min(timeout * 1.5, 30000), // Aumentar el timeout para el próximo intento
                                important: true
                            },
                            timestamp: Date.now(),
                            attempts,
                            lastError: errorObj.message
                        });
                        
                        return { 
                            success: false, 
                            queued: true, 
                            messageId, 
                            error: errorObj.message,
                            status: 'queued_for_retry',
                            attempts,
                            nextRetry: Date.now() + 5000 // Reintentar en 5 segundos
                        };
                    }
                    
                    return { 
                        success: false, 
                        messageId, 
                        error: errorObj.message,
                        status: 'failed',
                        attempts,
                        fatal: !shouldRetry
                    };
                }
            };
        
            return sendAttempt();
        }
        
        /**
         * Envía un mensaje a un hijo específico a través del padre
         * @param {string} childId - ID del iframe hijo
         * @param {string} tipo - Tipo de mensaje
         * @param {Object} datos - Datos del mensaje
         * @returns {Promise<Object>} Resultado del envío
         */
        async function enviarAHijo(childId, tipo, datos = {}) {
            return enviarMensajeConReintentos('padre', TIPOS_MENSAJE.SISTEMA.REENVIAR_A_HIJO, {
                destino: childId,
                tipo,
                datos,
                timestamp: Date.now()
            }, { important: true });
        }
        
        /**
         * Envía un mensaje a todos los hijos a través del padre
         * @param {string} tipo - Tipo de mensaje
         * @param {Object} datos - Datos del mensaje
         * @returns {Promise<Array>} Resultados del envío
         */
        async function broadcast(tipo, datos = {}) {
            return enviarMensajeConReintentos('padre', TIPOS_MENSAJE.SISTEMA.BROADCAST, {
                tipo,
                datos,
                timestamp: Date.now()
            }, { important: true });
        }
        
        /**
         * Procesa la cola de mensajes pendientes con manejo de reintentos
         * @returns {Promise<void>}
         */
        async function procesarColaMensajes() {
            const MAX_ATTEMPTS = config.maxRetries || 3;
            const RETRY_DELAY = config.retryDelay || 1000;
            
            while (messageQueue.length > 0 && config.isOnline) {
                const item = messageQueue[0]; // Mira el primer elemento sin quitarlo
                const { message, options = {}, attempts = 0 } = item;
                
                // Verificar si se excedió el número máximo de reintentos
                if (attempts >= MAX_ATTEMPTS) {
                    logger.warn(`Mensaje ${message.id} excedió el máximo de reintentos (${MAX_ATTEMPTS})`);
                    messageQueue.shift(); // Eliminar de la cola
                    continue;
                }
                
                try {
                    logger.debug(`Procesando mensaje de la cola (${attempts + 1}/${MAX_ATTEMPTS}):`, {
                        id: message.id,
                        tipo: message.tipo,
                        destino: message.destino
                    });
                    
                    // Intentar enviar el mensaje (usando 1 solo reintento ya que estamos en un bucle)
                    await enviarMensajeConReintentos(
                        message.destino,
                        message.tipo,
                        message.datos,
                        { ...options, maxRetries: 1, important: true }
                    );
                    
                    // Si tiene éxito, eliminar de la cola
                    messageQueue.shift();
                    
                } catch (error) {
                    // Incrementar el contador de intentos
                    item.attempts = attempts + 1;
                    item.lastError = error.message;
                    item.nextRetry = Date.now() + RETRY_DELAY;
                    
                    logger.warn(`Error al procesar mensaje (${item.attempts}/${MAX_ATTEMPTS}):`, {
                        id: message.id,
                        error: error.message,
                        nextRetry: new Date(item.nextRetry).toISOString()
                    });
                    
                    // Mover al final de la cola para reintentar más tarde
                    messageQueue.shift();
                    messageQueue.push(item);
                    
                    // Esperar antes del próximo intento
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }
        
        /**
         * Verifica el estado de la conexión
         */
        async function verificarConexion() {
            try {
                await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.PING);
                if (!config.isOnline) {
                    config.isOnline = true;
                    logger.info('Conexión restablecida');
                    await procesarColaMensajes();
                }
            } catch (error) {
                if (config.isOnline) {
                    config.isOnline = false;
                    logger.warn('Sin conexión, poniendo mensajes en cola');
                }
            }
        }
        
        // Iniciar el monitoreo de conexión
        function iniciarMonitoreoConexion() {
            if (connectionCheckInterval) {
                clearInterval(connectionCheckInterval);
            }
            
            connectionCheckInterval = setInterval(() => {
                verificarConexion();
            }, config.connectionCheckInterval);
        }
        
        // Detener el monitoreo de conexión
        function detenerMonitoreoConexion() {
            if (connectionCheckInterval) {
                clearInterval(connectionCheckInterval);
                connectionCheckInterval = null;
            }
        }

        // Exportar la API pública
        const Mensajeria = {
            TIPOS_MENSAJE,
            LOG_LEVELS,
            ERRORES,
            logger,
            crearMensaje,
            validarMensaje,
            inicializarMensajeria,
            enableControls,
            disableControls,
            manejarCambioModo,
            registrarControlador,
            dispararEvento,
            estadoGlobal,
            config: config,
            enviarMensajeConReintentos,
            enviarMensaje,
            enviarAHijo,
            broadcast,
            procesarColaMensajes,
            verificarConexion,
            iniciarMonitoreoConexion,
            detenerMonitoreoConexion
        };

        // Exportar para diferentes entornos
        if (typeof module !== 'undefined' && module.exports) {
            // Node.js/CommonJS
            module.exports = Mensajeria;
        } else if (typeof define === 'function' && define.amd) {
            // AMD/Require.js
            define([], function() { return Mensajeria; });
        } else if (typeof window !== 'undefined') {
            // Navegador global
            window.Mensajeria = Mensajeria;
        }

        return Mensajeria;
    })();
