/**
 * SISTEMA DE MENSAJERÍA CENTRALIZADA
 * Versión 3.0 - Comunicación bidireccional padre-hijos unificada
 * Soporta múltiples iframes y manejo de errores robusto
 */

// ================== TIPOS DE MENSAJE UNIFICADOS EXTENDIDOS ==================
export const TIPOS_MENSAJE = {
    // Sistema
    SISTEMA: {
        INICIALIZACION: 'sistema:inicializacion',
        CAMBIO_MODO: 'sistema:cambio_modo',
        LISTO: 'sistema:listo',
        ERROR: 'sistema:error',
        CONFIRMACION: 'sistema:confirmacion',
        SINCRONIZAR: 'sistema:sincronizar',
        CONTROLES_HABILITADOS: 'sistema:controles_habilitados',
        CONTROLES_DESHABILITADOS: 'sistema:controles_deshabilitados'
    },
    // Datos (NUEVO - Para comunicación bidireccional)
    DATOS: {
        SOLICITAR_CONSTANTES: 'datos:solicitar_constantes',
        CONSTANTES: 'datos:constantes',
        SOLICITAR_PARADA: 'datos:solicitar_parada',
        RESPUESTA_PARADA: 'datos:respuesta_parada',
        SOLICITAR_COORDENADAS: 'datos:solicitar_coordenadas',
        RESPUESTA_COORDENADAS: 'datos:respuesta_coordenadas',
        SOLICITAR_ESTADO: 'datos:solicitar_estado',
        RESPUESTA_ESTADO: 'datos:respuesta_estado'
    },
    // Navegación
    NAVEGACION: {
        CAMBIO_PARADA: 'navegacion:cambio_parada',
        CAMBIO_TRAMO: 'navegacion:cambio_tramo',
        GPS_ESTADO: 'navegacion:gps_estado',
        ESTADO: 'navegacion:estado',
        SOLICITAR_DESTINO: 'navegacion:solicitar_destino',
        ESTABLECER_DESTINO: 'navegacion:establecer_destino',
        LLEGADA_DETECTADA: 'navegacion:llegada_detectada'
    },
    // Audio
    AUDIO: {
        REPRODUCIR: 'audio:reproducir',
        PAUSAR: 'audio:pausar',
        DETENER: 'audio:detener',
        FINALIZADO: 'audio:finalizado',
        COMANDO: 'audio:comando',
        ESTADO: 'audio:estado'
    },
    // Retos
    RETOS: {
        ABRIR: 'retos:abrir',
        CERRAR: 'retos:cerrar',
        MOSTRAR: 'retos:mostrar',
        COMPLETADO: 'retos:completado',
        VALIDAR: 'retos:validar',
        ESTADO: 'retos:estado'
    },
    // GPS
    GPS: {
        ACTUALIZAR: 'gps:actualizar',
        COMANDO: 'gps:comando',
        ESTADO: 'gps:estado'
    },
    // UI
    UI: {
        ACTUALIZAR: 'ui:actualizar',
        MOSTRAR_IMAGEN: 'ui:mostrar_imagen',
        MOSTRAR_VIDEO: 'ui:mostrar_video',
        CERRAR_MEDIA: 'ui:cerrar_media'
    },
    // Modo específicos
    MODO: {
        CAMBIAR: 'modo:cambiar',
        HABILITAR_CONTROLES: 'modo:habilitar_controles',
        DESHABILITAR_CONTROLES: 'modo:deshabilitar_controles'
    }
};

// ================== CONFIGURACIÓN GLOBAL ==================
const CONFIG = {
    DEBUG: true,
    TIMEOUT: 5000,
    MAX_RETRIES: 3,
    LOG_LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    }
};

// ================== ESTADO GLOBAL ==================
let sistemaInicializado = false;
let manejadores = new Map();
let configuracionActual = { ...CONFIG };
let mensajesPendientes = new Map();
let timeouts = new Map();

/**
 * Inicializa el sistema de mensajería
 */
export async function inicializarMensajeria(config = {}) {
    if (sistemaInicializado) {
        console.warn('Sistema de mensajería ya inicializado');
        return;
    }
    
    configuracionActual = { ...CONFIG, ...config };
    sistemaInicializado = true;
    
    // Configurar manejador global de mensajes
    window.addEventListener('message', manejarMensajeEntrante);
    
    log('INFO', '✅ Sistema de mensajería inicializado', configuracionActual);
    return true;
}

/**
 * Registra un controlador para un tipo de mensaje
 */
export function registrarControlador(tipo, manejador) {
    if (typeof manejador !== 'function') {
        throw new Error(`Manejador para ${tipo} debe ser una función`);
    }
    
    manejadores.set(tipo, manejador);
    log('DEBUG', `📝 Controlador registrado para: ${tipo}`);
}

/**
 * Envía un mensaje centralizado
 */
export async function enviarMensaje(destino, tipo, datos = {}, opciones = {}) {
    const opcionesFinales = {
        timeout: configuracionActual.TIMEOUT,
        maxRetries: configuracionActual.MAX_RETRIES,
        esperarRespuesta: false,
        ...opciones
    };
    
    const mensaje = {
        tipo,
        datos,
        destino,
        origen: configuracionActual.iframeId || 'desconocido',
        timestamp: new Date().toISOString(),
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        opciones: opcionesFinales
    };
    
    try {
        await enviarMensajeInterno(mensaje, opcionesFinales);
        log('DEBUG', `📤 Mensaje enviado: ${tipo} -> ${destino}`, mensaje);
        return mensaje.id;
    } catch (error) {
        log('ERROR', `❌ Error enviando mensaje ${tipo} a ${destino}:`, error);
        throw error;
    }
}

/**
 * Envía mensaje interno con reintentos
 */
async function enviarMensajeInterno(mensaje, opciones, intento = 1) {
    try {
        if (mensaje.destino === 'padre') {
            window.parent.postMessage(mensaje, '*');
        } else {
            // Buscar iframe por ID
            const iframe = document.getElementById(mensaje.destino) || 
                          document.querySelector(`iframe[src*="${mensaje.destino}"]`);
            
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(mensaje, '*');
            } else {
                throw new Error(`Iframe ${mensaje.destino} no encontrado`);
            }
        }
        
        // Configurar timeout si se espera respuesta
        if (opciones.esperarRespuesta) {
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    mensajesPendientes.delete(mensaje.id);
                    reject(new Error(`Timeout esperando respuesta de ${mensaje.destino}`));
                }, opciones.timeout);
                
                mensajesPendientes.set(mensaje.id, { resolve, reject });
                timeouts.set(mensaje.id, timeoutId);
            });
        }
        
        return mensaje.id;
        
    } catch (error) {
        if (intento < opciones.maxRetries) {
            log('WARN', `⚠️ Reintento ${intento}/${opciones.maxRetries} para ${mensaje.tipo}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * intento));
            return enviarMensajeInterno(mensaje, opciones, intento + 1);
        }
        throw error;
    }
}

/**
 * Manejador centralizado de mensajes entrantes
 */
async function manejarMensajeEntrante(event) {
    if (!event.data || typeof event.data !== 'object') return;
    
    const { tipo, datos, origen, id, respuestaA } = event.data;
    
    // Manejar respuestas a mensajes pendientes
    if (respuestaA && mensajesPendientes.has(respuestaA)) {
        const { resolve } = mensajesPendientes.get(respuestaA);
        const timeoutId = timeouts.get(respuestaA);
        
        if (timeoutId) clearTimeout(timeoutId);
        mensajesPendientes.delete(respuestaA);
        timeouts.delete(respuestaA);
        
        resolve(event.data);
        return;
    }
    
    // Procesar mensaje normal
    if (manejadores.has(tipo)) {
        try {
            const resultado = await manejadores.get(tipo)({
                tipo,
                datos,
                origen,
                id,
                evento: event
            });
            
            log('DEBUG', `📥 Mensaje procesado: ${tipo} de ${origen}`, datos);
            
            // Enviar confirmación si se requiere
            if (event.data.opciones?.esperarRespuesta) {
                await enviarConfirmacion(origen, id, true, resultado);
            }
            
        } catch (error) {
            log('ERROR', `❌ Error procesando mensaje ${tipo} de ${origen}:`, error);
            
            // Enviar error como respuesta si se esperaba
            if (event.data.opciones?.esperarRespuesta) {
                await enviarConfirmacion(origen, id, false, { error: error.message });
            }
        }
    } else {
        log('WARN', `⚠️ No hay manejador para mensaje tipo: ${tipo}`);
    }
}

/**
 * Envía confirmación de mensaje
 */
async function enviarConfirmacion(destino, mensajeId, exito, datos = {}) {
    const confirmacion = {
        tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
        datos: { exito, ...datos },
        destino,
        origen: configuracionActual.iframeId || 'desconocido',
        respuestaA: mensajeId,
        timestamp: new Date().toISOString()
    };
    
    if (destino === 'padre') {
        window.parent.postMessage(confirmacion, '*');
    } else {
        const iframe = document.getElementById(destino);
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(confirmacion, '*');
        }
    }
}

/**
 * Funciones de utilidad para logging
 */
function log(nivel, mensaje, datos = null) {
    const nivelNum = configuracionActual.LOG_LEVELS[nivel] || 1;
    const nivelActual = configuracionActual.logLevel || configuracionActual.LOG_LEVELS.INFO;
    
    if (nivelNum < nivelActual) return;
    
    const timestamp = new Date().toISOString();
    const contexto = configuracionActual.iframeId || 'SISTEMA';
    
    if (datos) {
        console[nivel.toLowerCase()](`[${timestamp}] [${contexto}] ${mensaje}`, datos);
    } else {
        console[nivel.toLowerCase()](`[${timestamp}] [${contexto}] ${mensaje}`);
    }
}

/**
 * Funciones de alto nivel para operaciones comunes
 */
export async function cambiarModoGlobal(nuevoModo, opciones = {}) {
    return enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, {
        modo: nuevoModo,
        ...opciones
    }, { esperarRespuesta: true });
}

export async function habilitarControles(modo = 'casa', destinos = ['todos']) {
    if (destinos.includes('todos')) {
        return enviarMensajeATodos(TIPOS_MENSAJE.MODO.HABILITAR_CONTROLES, { modo });
    } else {
        const promesas = destinos.map(destino => 
            enviarMensaje(destino, TIPOS_MENSAJE.MODO.HABILITAR_CONTROLES, { modo })
        );
        return Promise.allSettled(promesas);
    }
}

export async function deshabilitarControles(motivo = 'desconocido', destinos = ['todos']) {
    if (destinos.includes('todos')) {
        return enviarMensajeATodos(TIPOS_MENSAJE.MODO.DESHABILITAR_CONTROLES, { motivo });
    } else {
        const promesas = destinos.map(destino => 
            enviarMensaje(destino, TIPOS_MENSAJE.MODO.DESHABILITAR_CONTROLES, { motivo })
        );
        return Promise.allSettled(promesas);
    }
}

export async function enviarMensajeATodos(tipo, datos = {}, opciones = {}) {
    const destinosComunes = [
        'Av1_audio_esp',
        'Av1-botones-coordenadas', 
        'Av1-esp-retos-preguntas',
        'Av1-boton-casa'
    ];
    
    const promesas = destinosComunes.map(destino => 
        enviarMensaje(destino, tipo, datos, opciones).catch(error => ({
            destino,
            error: error.message
        }))
    );
    
    const resultados = await Promise.allSettled(promesas);
    
    const exitosos = resultados.filter(r => r.status === 'fulfilled').length;
    const fallidos = resultados.length - exitosos;
    
    log('INFO', `📊 Mensaje múltiple: ${exitosos} exitosos, ${fallidos} fallidos`);
    
    return { exitosos, fallidos, resultados };
}

// ================== FUNCIONES DE UTILIDAD PARA HIJOS ==================

/**
 * Solicita las constantes del padre (para usar en hijos)
 */
export async function solicitarConstantesPadre(tiempoEspera = 5000) {
    return new Promise((resolve, reject) => {
        // Enviar solicitud al padre
        window.parent.postMessage({
            tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_CONSTANTES,
            datos: {},
            origen: configuracionActual.iframeId || 'hijo',
            destino: 'padre',
            timestamp: new Date().toISOString()
        }, '*');

        // Configurar listener temporal para la respuesta
        const timeoutId = setTimeout(() => {
            window.removeEventListener('message', manejarRespuestaConstantes);
            reject(new Error('Timeout al solicitar constantes del padre'));
        }, tiempoEspera);

        function manejarRespuestaConstantes(event) {
            if (event.data?.tipo === TIPOS_MENSAJE.DATOS.CONSTANTES) {
                clearTimeout(timeoutId);
                window.removeEventListener('message', manejarRespuestaConstantes);
                resolve(event.data.datos);
            }
        }

        window.addEventListener('message', manejarRespuestaConstantes);
    });
}

/**
 * Solicita datos de una parada específica al padre
 */
export async function solicitarDatosParada(paradaId, tiempoEspera = 3000) {
    return new Promise((resolve, reject) => {
        window.parent.postMessage({
            tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_PARADA,
            datos: { paradaId },
            origen: configuracionActual.iframeId || 'hijo',
            destino: 'padre',
            timestamp: new Date().toISOString()
        }, '*');

        const timeoutId = setTimeout(() => {
            window.removeEventListener('message', manejarRespuestaParada);
            reject(new Error(`Timeout al solicitar datos de parada ${paradaId}`));
        }, tiempoEspera);

        function manejarRespuestaParada(event) {
            if (event.data?.tipo === TIPOS_MENSAJE.DATOS.RESPUESTA_PARADA && 
                event.data?.datos?.paradaId === paradaId) {
                clearTimeout(timeoutId);
                window.removeEventListener('message', manejarRespuestaParada);
                resolve(event.data.datos);
            }
        }

        window.addEventListener('message', manejarRespuestaParada);
    });
}

/**
 * Solicita coordenadas al padre
 */
export async function solicitarCoordenadas(paradaId = null, tiempoEspera = 3000) {
    return new Promise((resolve, reject) => {
        window.parent.postMessage({
            tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_COORDENADAS,
            datos: { paradaId },
            origen: configuracionActual.iframeId || 'hijo',
            destino: 'padre',
            timestamp: new Date().toISOString()
        }, '*');

        const timeoutId = setTimeout(() => {
            window.removeEventListener('message', manejarRespuestaCoordenadas);
            reject(new Error('Timeout al solicitar coordenadas'));
        }, tiempoEspera);

        function manejarRespuestaCoordenadas(event) {
            if (event.data?.tipo === TIPOS_MENSAJE.DATOS.RESPUESTA_COORDENADAS) {
                clearTimeout(timeoutId);
                window.removeEventListener('message', manejarRespuestaCoordenadas);
                resolve(event.data.datos);
            }
        }

        window.addEventListener('message', manejarRespuestaCoordenadas);
    });
}

/**
 * Notifica al padre que el hijo está listo con sus capacidades
 */
export async function notificarHijoListo(componente, capacidades = [], version = '1.0') {
    return enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.LISTO, {
        componente,
        capacidades,
        version,
        timestamp: new Date().toISOString()
    }, { esperarRespuesta: true });
}

// ================== MANEJADORES CENTRALIZADOS PARA SOLICITUDES DE DATOS ==================

/**
 * Manejador centralizado para solicitudes de datos del padre
 */
async function manejarSolicitudDatos(event) {
    if (!event.data || typeof event.data !== 'object') return;
    
    const { tipo, datos, origen, id } = event.data;
    
    // Solo procesar si somos el padre y recibimos solicitudes de datos
    if (window.location !== window.parent.location) return; // Somos iframe, no padre
    
    switch (tipo) {
        case TIPOS_MENSAJE.DATOS.SOLICITAR_CONSTANTES:
            await responderConstantes(origen, id);
            break;
            
        case TIPOS_MENSAJE.DATOS.SOLICITAR_PARADA:
        case 'DATOS.SOLICITAR_PARADA':
            await responderDatosParada(origen, id, datos.paradaId);
            break;
            
        case TIPOS_MENSAJE.DATOS.SOLICITAR_COORDENADAS:
            await responderCoordenadas(origen, id, datos.paradaId);
            break;
            
        case TIPOS_MENSAJE.RETOS.ABRIR:
            await responderReto(origen, id, datos.paradaId);
            break;
    }
}

/**
 * Responde con las constantes del sistema
 */
async function responderConstantes(destino, mensajeId) {
    if (typeof window.AVENTURA_PARADAS === 'undefined' || 
        typeof window.coordenadasParadas === 'undefined') {
        console.warn('⚠️ Constantes del padre no disponibles aún');
        return;
    }
    
    const constantes = {
        AVENTURA_PARADAS: window.AVENTURA_PARADAS,
        COORDENADAS_PARADAS: Array.from(window.coordenadasParadas.entries()),
        paradaActual: window.paradaActual || 0,
        timestamp: new Date().toISOString()
    };
    
    // Enviar directamente al hijo que lo solicita
    const iframe = document.getElementById(destino);
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            tipo: TIPOS_MENSAJE.DATOS.CONSTANTES,
            datos: constantes,
            origen: 'padre',
            destino: destino,
            respuestaA: mensajeId
        }, '*');
    }
}

/**
 * Responde con datos de una parada específica usando las funciones del padre
 */
async function responderDatosParada(destino, mensajeId, paradaId) {
    console.log(`🎯 Padre: Procesando solicitud de datos para parada ${paradaId} de ${destino}`);
    
    if (typeof window.padreFunciones?.obtenerDatosParada !== 'function') {
        console.warn('⚠️ Función obtenerDatosParada del padre no disponible');
        return;
    }
    
    try {
        const datosParada = window.padreFunciones.obtenerDatosParada(paradaId);
        
        // Enviar respuesta directamente al hijo
        const iframe = document.getElementById(destino);
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                tipo: TIPOS_MENSAJE.NAVEGACION.ESTADO,
                datos: { 
                    accion: 'datos_parada',
                    parada: datosParada,
                    paradaId 
                },
                origen: 'padre',
                destino: destino,
                respuestaA: mensajeId
            }, '*');
            
            console.log(`✅ Padre: Datos de parada ${paradaId} enviados a ${destino}`);
        }
    } catch (error) {
        console.error(`❌ Padre: Error enviando datos de parada ${paradaId} a ${destino}:`, error);
    }
}

/**
 * Responde con datos de reto usando las funciones del padre
 */
async function responderReto(destino, mensajeId, paradaId) {
    console.log(`🎯 Padre: Procesando solicitud de reto para parada ${paradaId} de ${destino}`);
    
    if (typeof window.padreFunciones?.obtenerRetoParaParada !== 'function') {
        console.warn('⚠️ Función obtenerRetoParaParada del padre no disponible');
        return;
    }
    
    try {
        const retoData = window.padreFunciones.obtenerRetoParaParada(paradaId);
        
        // Enviar respuesta directamente al hijo
        const iframe = document.getElementById(destino);
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                tipo: TIPOS_MENSAJE.RETOS.MOSTRAR,
                datos: { 
                    reto: retoData,
                    paradaId 
                },
                origen: 'padre',
                destino: destino,
                respuestaA: mensajeId
            }, '*');
            
            console.log(`✅ Padre: Reto de parada ${paradaId} enviado a ${destino}`);
        }
    } catch (error) {
        console.error(`❌ Padre: Error enviando reto de parada ${paradaId} a ${destino}:`, error);
    }
}

/**
 * Responde con coordenadas
 */
async function responderCoordenadas(destino, mensajeId, paradaId = null) {
    if (typeof window.coordenadasParadas === 'undefined') {
        console.warn('⚠️ Coordenadas del padre no disponibles');
        return;
    }
    
    let coordenadas;
    if (paradaId) {
        coordenadas = { [paradaId]: window.coordenadasParadas.get(paradaId) };
    } else {
        coordenadas = Array.from(window.coordenadasParadas.entries());
    }
    
    const iframe = document.getElementById(destino);
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            tipo: TIPOS_MENSAJE.DATOS.RESPUESTA_COORDENADAS,
            datos: { coordenadas, paradaId },
            origen: 'padre',
            destino: destino,
            respuestaA: mensajeId
        }, '*');
    }
}

// Registrar el manejador adicional para solicitudes de datos
if (typeof window !== 'undefined') {
    window.addEventListener('message', manejarSolicitudDatos);
}

// ================== EXPORTACIONES EXTENDIDAS ==================
export default {
    inicializarMensajeria,
    registrarControlador,
    enviarMensaje,
    cambiarModoGlobal,
    habilitarControles,
    deshabilitarControles,
    enviarMensajeATodos,
    // Nuevas funciones para hijos
    solicitarConstantesPadre,
    solicitarDatosParada,
    solicitarCoordenadas,
    notificarHijoListo,
    TIPOS_MENSAJE,
    CONFIG
};

// ================== FALLBACK PARA NAVEGADORES SIN SOPORTE A MÓDULOS ==================
// Crear este archivo para proporcionar una importación consistente para todos los demás archivos
// Este es un archivo de re-exportación que apunta correctamente a la implementación real

export * from './js/mensajeria.js';

// Agregar este mecanismo de fallback para navegadores más antiguos que no soportan módulos
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // Crear un objeto global si la carga del módulo falla
        if (!window.Mensajeria) {
            console.warn('Fallback to global Mensajeria object');
            // Implementación mínima para evitar errores
            window.Mensajeria = {
                enviarMensaje: (destino, tipo, datos) => {
                    console.warn(`[Mensajeria Fallback] Envío a ${destino}: ${tipo}`, datos);
                    return Promise.resolve({ fallback: true });
                },
                inicializarMensajeria: () => Promise.resolve(true),
                TIPOS_MENSAJE: { SISTEMA: {}, NAVEGACION: {}, AUDIO: {}, RETOS: {} }
            };
        }
    });
}
