/**
 * Módulo principal de la aplicación
 * @module App
 * @version 1.0.0
 */

import { TIPOS_MENSAJE, MODOS } from './constants.js';
import { enviarMensaje, registrarControlador, manejarErrorCritico, validarMensajeEntrante } from './mensajeria.js';
import logger, { registrarEvento } from './logger.js';
import { CONFIG } from './config.js';
import { solicitarDatosParadas } from './funciones-mapa.js';

// Estado global de la aplicación
export const estado = {
    modo: { actual: 'casa', anterior: null },
    paradaActual: 0,
    mensajeriaInicializada: false,
    mapaInicializado: false,
    hijosInicializados: new Set(),
    paradas: [],
    
    // Estado del sistema de monitoreo
    monitoreo: {
        metricas: {
            mensajesEnviados: 0,
            mensajesRecibidos: 0,
            errores: 0,
            tiempoRespuestaPromedio: 0,
            tiempoTotalRespuesta: 0,
            solicitudes: 0,
            usoMemoria: 0,
            eventos: [],
            errores: []
        },
        config: {
            habilitado: true,
            nivelLog: 'info',
            rastrearRendimiento: true,
            rastrearErrores: true,
            rastrearEventos: true,
            maxEventos: 1000,
            maxErrores: 100,
            umbralAlerta: {
                tiempoRespuesta: 1000, // ms
                usoMemoria: 80, // %
                tasaError: 0.1 // 10%
            }
        },
        historial: {
            eventos: [],
            metricas: [],
            errores: []
        }
    }
};

// Estado para rastrear mensajes pendientes de confirmación
const mensajesPendientes = new Map();

/**
 * Envía un mensaje a un hijo y espera su confirmación (ACK).
 * @param {string} hijoId - ID del hijo al que se enviará el mensaje.
 * @param {string} tipoMensaje - Tipo de mensaje (definido en TIPOS_MENSAJE).
 * @param {Object} datos - Datos del mensaje.
 * @param {number} [timeout=5000] - Tiempo máximo de espera para el ACK en milisegundos.
 * @returns {Promise<void>} Resolución cuando se reciba el ACK.
 */
export async function enviarMensajeConConfirmacion(hijoId, tipoMensaje, datos, timeout = 5000) {
    try {
        return await enviarMensajeConACK(hijoId, tipoMensaje, datos, timeout);
    } catch (error) {
        logger.error(`Error al enviar mensaje con confirmación a ${hijoId}:`, error);
        throw error;
    }
}

// Inicializa la aplicación
export async function inicializar() {
    try {
        logger.info('Inicializando aplicación...');
        
        // Esperar a que el DOM esté completamente cargado
        if (document.readyState !== 'complete') {
            await new Promise(resolve => window.addEventListener('load', resolve));
        }
        
        // IMPORTANTE: Comprobar que no haya instancias de mapa duplicadas
        if (typeof document !== 'undefined') {
            const mapContainers = document.querySelectorAll('.leaflet-container');
            if (mapContainers.length > 1) {
                logger.warn(`⚠️ Se detectaron ${mapContainers.length} contenedores de mapa en el DOM. Debería haber solo uno.`);
                console.warn(`⚠️ Detectadas ${mapContainers.length} instancias de mapa. Puede causar problemas de rendimiento.`);
            }
        }
        
        // Asegurarse de que el contenedor del mapa esté visible
        if (typeof document !== 'undefined') {
            const mapaContainer = document.getElementById('mapa');
            if (mapaContainer) {
                mapaContainer.style.visibility = 'visible';
                mapaContainer.style.opacity = '1';
                
                // Eliminar cualquier estilo de debug previo
                mapaContainer.style.border = ''; 
                mapaContainer.classList.remove('debug-map', 'test-map');
            }
            
            // Ocultar cualquier mapa de prueba adicional que pudiera existir
            const testMaps = document.querySelectorAll('.test-map, .debug-map, .prueba-mapa');
            testMaps.forEach(el => {
                el.style.display = 'none';
                logger.info('Ocultando mapa de prueba detectado:', el.id || 'sin ID');
            });
        }
        
        // El mapa se inicializa desde codigo-padre.html, no necesitamos inicializarlo aquí
        
        // Actualizar el tamaño del mapa después de un breve retraso para asegurar que el contenedor tenga dimensiones
        setTimeout(() => {
            if (window.mapa && typeof window.mapa.invalidateSize === 'function') {
                window.mapa.invalidateSize(true);
                logger.info('Tamaño del mapa actualizado');
            }
            // Solo ejecutar diagnóstico si el mapa está disponible
            if (window.mapa) {
                diagnosticarMapa().then(result => {
                    console.log('Diagnóstico del mapa completado con resultado:', result);
                });
            } else {
                console.log('⏳ Mapa aún no disponible, omitiendo diagnóstico desde app.js');
            }
        }, 500);
        
        // Manejar respuesta ACK de hijo4
        registrarControlador(TIPOS_MENSAJE.SISTEMA.ACK, (mensaje) => {
            if (mensaje.origen === 'hijo4') {
                logger.info(`ACK recibido de hijo4 para mensaje ${mensaje.mensajeId}`);
            }
        });
        
        // Enviar confirmación a hijo4 durante la inicialización
        await enviarConfirmacionAHijo4(); // Enviar confirmación al hijo4
        
        // Manejar SISTEMA.CONFIRMACION en el padre
        registrarControlador(TIPOS_MENSAJE.SISTEMA.CONFIRMACION, async (mensaje) => {
            try {
                // Responder con ACK
                await enviarMensaje(mensaje.origen, TIPOS_MENSAJE.SISTEMA.ACK, {
                    mensajeId: mensaje.mensajeId,
                    timestamp: new Date().toISOString(),
                    origen: 'padre'
                });
                logger.info(`ACK enviado a ${mensaje.origen} para mensaje ${mensaje.mensajeId}`);
            } catch (error) {
                logger.error('Error al manejar SISTEMA.CONFIRMACION en el padre:', error);
            }
        });
        
        // Manejar SISTEMA.COMPONENTE_LISTO para registrar hijos inicializados
        registrarControlador(TIPOS_MENSAJE.SISTEMA.COMPONENTE_LISTO, (mensaje) => {
            const { origen } = mensaje;
            if (!origen) {
                logger.warn('Mensaje COMPONENTE_LISTO recibido sin origen');
                return;
            }

            estado.hijosInicializados.add(origen);
            logger.info(`Hijo ${origen} registrado como inicializado`);
        });
        
        // Marcar como inicializada
        logger.info('Aplicación inicializada correctamente');
        return true;
    } catch (error) {
        logger.error('Error al inicializar aplicación:', error);
        return false;
    }
}

/**
 * Notifica un error al sistema.
 * @param {string} codigo - Código de error.
 * @param {Error} error - Objeto de error.
 * @param {Object} [contexto] - Contexto adicional del error.
 */
export async function notificarError(codigo, error, contexto = {}) {
    try {
        manejarError(error, 'padre', { codigo, ...contexto });
    } catch (e) {
        logger.error('Error crítico en notificarError:', e);
    }
}

/**
 * Envía un mensaje para cambiar el modo de la aplicación
 * @param {string} nuevoModo - Nuevo modo ('casa' o 'aventura')
 * @param {string} origen - Origen del cambio
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function enviarCambioModo(nuevoModo, origen = 'app') {
    if (nuevoModo !== 'casa' && nuevoModo !== 'aventura') {
        throw new Error(`Modo inválido: ${nuevoModo}`);
    }
    
    return await enviarMensaje('padre', TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, { 
        modo: nuevoModo,
        origen,
        timestamp: new Date().toISOString()
    });
}

/**
 * Valida el mensaje de cambio de modo.
 * @param {Object} mensaje - Mensaje recibido.
 * @returns {boolean} - True si el mensaje es válido, lanza un error si no lo es.
 */
function validarCambioModoMensaje(mensaje) {
    if (!mensaje || typeof mensaje !== 'object') {
        throw new Error('Mensaje de cambio de modo no válido: debe ser un objeto.');
    }

    const { modo } = mensaje.datos || {};

    if (!modo || (modo !== MODOS.CASA && modo !== MODOS.AVENTURA)) {
        throw new Error(`Modo no válido: ${modo}`);
    }

    return true;
}

// Integrar validación en el manejador de cambio de modo
export async function manejarCambioModo(mensaje) {
    try {
        validarCambioModoMensaje(mensaje);

        const { modo, origen } = mensaje.datos || {};
        
        // Validar el mensaje recibido
        if (!modo) {
            const errorMsg = 'Mensaje de cambio de modo inválido: falta modo';
            logger.error(errorMsg, mensaje);
            return { exito: false, error: errorMsg };
        }
        
        // Verificar si ya estamos en el modo solicitado
        if (modo === estado.modo.actual) {
            logger.info(`Ya estamos en modo ${modo}, no se requiere cambio`);
            return { exito: true, modo: estado.modo.actual, cambiado: false };
        }
        
        try {
            // Actualizar el estado local
            estado.modo.anterior = estado.modo.actual;
            estado.modo.actual = modo;
            
            logger.info(`Modo cambiado a ${modo} desde ${estado.modo.anterior}`);
            
            return { 
                exito: true, 
                modo: estado.modo.actual,
                modoAnterior: estado.modo.anterior,
                cambiado: true
            };
        } catch (error) {
            logger.error(`Error al cambiar a modo ${modo}:`, error);
            
            // Revertir cambios si es necesario
            estado.modo.actual = estado.modo.anterior;
            
            return { exito: false, error: error.message };
        }
    } catch (error) {
        logger.error('Error al manejar cambio de modo:', error);
        return { exito: false, error: error.message };
    }
}

/**
 * Diagnóstico del mapa para verificar su visibilidad
 */
export async function diagnosticarMapa() {
    let mapa = document.getElementById('mapa');

    // Solo proceder si el mapa ya existe (no crearlo desde aquí)
    if (!mapa) {
        console.warn('⚠️ Contenedor del mapa no encontrado en app.js - esto es normal ya que se crea desde codigo-padre.html');
        return false;
    }

    console.log('DIAGNÓSTICO DEL MAPA (desde app.js):');
    console.log('- Elemento mapa:', mapa);
    console.log('- Display:', window.getComputedStyle(mapa).display);
    console.log('- Visibility:', window.getComputedStyle(mapa).visibility);
    console.log('- Z-index:', window.getComputedStyle(mapa).zIndex);
    console.log('- Dimensiones:', mapa.offsetWidth + 'x' + mapa.offsetHeight);
    console.log('- Position:', window.getComputedStyle(mapa).position);
    
    // Revisar si hay contenedores de mapa duplicados
    const leafletContainers = document.querySelectorAll('.leaflet-container');
    console.log(`- Total de contenedores Leaflet: ${leafletContainers.length} (debería ser 1)`);
    if (leafletContainers.length > 1) {
        console.warn('⚠️ PROBLEMA DETECTADO: Hay múltiples contenedores de mapa');
        leafletContainers.forEach((container, index) => {
            console.log(`  Contenedor #${index + 1}: ID="${container.id}", clases="${container.className}", visible=${window.getComputedStyle(container).display !== 'none'}`);
        });
    }

    // Verificar si la instancia de Leaflet existe
    if (window.L) {
        console.log('- Leaflet está disponible (window.L):', window.L.version);
    } else {
        console.error('❌ Leaflet NO está disponible (window.L undefined)');
    }

    // Verificar si el mapa de Leaflet está instanciado
    if (window.mapa) {
        if (window.mapa instanceof window.L.Map) {
            try {
                console.log('✅ Instancia de mapa existe y es válida (window.mapa)');
                console.log('- Centro del mapa:', window.mapa.getCenter());
                console.log('- Zoom del mapa:', window.mapa.getZoom());

                // Forzar actualización del mapa
                window.mapa.invalidateSize(true);
                console.log('✅ Mapa actualizado con invalidateSize()');

                // Verificar capas base y superpuestas
                const capas = Object.keys(window.mapa._layers);
                console.log('- Número de capas del mapa:', capas.length);
                if (capas.length === 0) {
                    console.warn('⚠️ No hay capas cargadas en el mapa');
                } else {
                    console.log('✅ Capas cargadas:', capas);
                }

                // Validar eventos del mapa
                const eventosRequeridos = ['click', 'moveend'];
                eventosRequeridos.forEach(evento => {
                    if (window.mapa.listens(evento)) {
                        console.log(`✅ Evento '${evento}' está registrado en el mapa`);
                    } else {
                        console.warn(`⚠️ Evento '${evento}' NO está registrado en el mapa`);
                    }
                });
            } catch (e) {
                console.error('❌ Error al acceder a métodos del mapa:', e);
                return false;
            }
        } else {
            console.error('❌ window.mapa existe pero NO es una instancia válida de L.Map');
            console.log('Tipo actual:', typeof window.mapa);
            return false;
        }
    } else {
        console.log('⏳ No hay instancia de mapa aún (window.mapa undefined)');
        console.log('ℹ️ Esto es normal durante la inicialización - el mapa se crea desde codigo-padre.html');
        return false;
    }

    return leafletContainers.length > 0 && window.mapa instanceof window.L.Map;
}

/**
 * Diagnóstico de la comunicación con hijo5-casa
 * Ver js/comunicacion-componentes.md para más información sobre el flujo completo
 * @param {boolean} detallado - Si es true, muestra información detallada
 * @returns {Promise<Object>} Resultado del diagnóstico
 */
export async function diagnosticarComunicacionCasa(detallado = false) {
    console.log('DIAGNÓSTICO DE COMUNICACIÓN CASA-PADRE:');
    
    // 1. Verificar que el iframe existe
    const iframeCasa = document.getElementById('hijo5-casa');
    if (!iframeCasa) {
        console.error('❌ El iframe hijo5-casa no existe en el DOM');
        return { exito: false, error: 'iframe_no_encontrado' };
    }
    
    console.log('- iframe hijo5-casa encontrado:', iframeCasa);
    console.log('- iframe visible:', window.getComputedStyle(iframeCasa).display !== 'none');
    console.log('- iframe dimensiones:', iframeCasa.offsetWidth + 'x' + iframeCasa.offsetHeight);
    
    // 2. Verificar estado de la mensajería
    if (!estado.mensajeriaInicializada) {
        console.warn('⚠️ Sistema de mensajería no inicializado');
    }
    
    console.log('- Sistema mensajeria inicializado:', estado.mensajeriaInicializada);
    console.log('- Hijos inicializados:', Array.from(estado.hijosInicializados));
    console.log('- Hijo casa inicializado:', estado.hijosInicializados.has('hijo5-casa'));
    
    // 3. Verificar modo actual
    console.log('- Modo actual:', estado.modo.actual);
    console.log('- Modo anterior:', estado.modo.anterior);
    
    // 4. Prueba de envío de mensaje si está en modo detallado
    if (detallado && typeof enviarMensaje === 'function') {
        try {
            console.log('📤 Enviando mensaje de prueba a hijo5-casa...');
            const respuesta = await enviarMensaje('hijo5-casa', 'SISTEMA.PING', { 
                timestamp: Date.now(),
                origen: 'diagnostico'
            });
            console.log('📥 Respuesta recibida:', respuesta);
        } catch (error) {
            console.error('❌ Error al enviar mensaje de prueba:', error);
        }
    }
    
    return { 
        exito: true,
        iframeCasa: iframeCasa ? true : false,
        mensajeria: estado.mensajeriaInicializada,
        hijoCasaInicializado: estado.hijosInicializados.has('hijo5-casa'),
        modo: estado.modo.actual
    };
}

/**
 * Prueba la orquestación de componentes con una parada específica
 * Ver js/comunicacion-componentes.md para más información sobre el proceso de orquestación
 * @param {string} paradaId - ID de la parada a probar (ej: 'P-1', 'TR-2')
 * @returns {Promise<Object>} Resultado de la prueba
 */
export async function probarOrquestacionParada(paradaId) {
    if (!paradaId) {
        console.error('❌ Se requiere un ID de parada para la prueba');
        return { exito: false, error: 'id_parada_requerido' };
    }
    
    console.log(`🧪 PRUEBA DE ORQUESTACIÓN para parada ${paradaId}:`);
    
    try {
        // 1. Verificar que estamos en modo casa
        if (estado.modo.actual !== 'casa') {
            console.warn('⚠️ Cambiando a modo casa para la prueba...');
            await enviarCambioModo('casa', 'prueba_orquestacion');
        }
        
        // 2. Crear un mensaje similar al que enviaría hijo5-casa
        const datosMensaje = {
            punto: { parada_id: paradaId },
            origen: 'prueba_orquestacion',
            timestamp: Date.now()
        };
        
        console.log('📤 Enviando mensaje con datos:', datosMensaje);
        
        // 3. Enviar el mensaje al padre
        const respuesta = await enviarMensaje('padre', 'NAVEGACION.CAMBIO_PARADA', datosMensaje);
        console.log('📥 Respuesta recibida:', respuesta);
        
        return {
            exito: true,
            mensaje: `Prueba de orquestación para ${paradaId} completada`,
            respuesta
        };
    } catch (error) {
        console.error(`❌ Error en prueba de orquestación: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

/**
 * Función para registrar un evento personalizado en el sistema de monitoreo
 * @param {string} tipo - Tipo de evento
 * @param {Object} datos - Datos del evento
 * @param {string} [nivel='info'] - Nivel de severidad ('debug', 'info', 'warn', 'error')
 * @returns {string} ID del evento registrado
 */
export function registrarEvento(tipo, datos = {}, nivel = 'info') {
    if (!estado.monitoreo.config.habilitado || !estado.monitoreo.config.rastrearEventos) {
        return null;
    }
    
    try {
        const evento = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tipo,
            nivel,
            datos,
            timestamp: new Date().toISOString(),
            origen: 'app'
        };
        
        // Mantener un historial de eventos limitado
        estado.monitoreo.historial.eventos.unshift(evento);
        if (estado.monitoreo.historial.eventos.length > estado.monitoreo.config.maxEventos) {
            estado.monitoreo.historial.eventos.pop();
        }
        
        // Registrar en el log según el nivel
        const mensaje = `[EVENTO:${tipo}] ${JSON.stringify(datos).substring(0, 200)}`;
        switch(nivel) {
            case 'debug':
                logger.debug(mensaje);
                break;
            case 'warn':
                logger.warn(mensaje);
                break;
            case 'error':
                logger.error(mensaje);
                break;
            case 'info':
            default:
                logger.info(mensaje);
        }
        
        return evento.id;
    } catch (error) {
        console.error('Error al registrar evento:', error);
        return null;
    }
}

/**
 * Registra una métrica de rendimiento
 * @param {string} nombre - Nombre de la métrica
 * @param {number} valor - Valor de la métrica
 * @param {string} [unidad='ms'] - Unidad de medida
 */
export function registrarMetrica(nombre, valor, unidad = 'ms') {
    if (!estado.monitoreo.config.habilitado || !estado.monitoreo.config.rastrearRendimiento) {
        return;
    }
    
    try {
        const metrica = {
            nombre,
            valor,
            unidad,
            timestamp: new Date().toISOString()
        };
        
        // Actualizar métricas específicas
        if (nombre === 'tiempo_respuesta') {
            estado.monitoreo.metricas.solicitudes++;
            estado.monitoreo.metricas.tiempoTotalRespuesta += valor;
            estado.monitoreo.metricas.tiempoRespuestaPromedio = 
                estado.monitoreo.metricas.tiempoTotalRespuesta / estado.monitoreo.metricas.solicitudes;
            
            // Alerta si se supera el umbral
            if (valor > estado.monitoreo.config.umbralAlerta.tiempoRespuesta) {
                registrarEvento('tiempo_respuesta_elevado', {
                    valor,
                    umbral: estado.monitoreo.config.umbralAlerta.tiempoRespuesta,
                    metrica
                }, 'warn');
            }
        } else if (nombre === 'uso_memoria') {
            estado.monitoreo.metricas.usoMemoria = valor;
            
            // Alerta si se supera el umbral de memoria
            if (valor > estado.monitoreo.config.umbralAlerta.usoMemoria) {
                registrarEvento('uso_memoria_elevado', {
                    valor,
                    umbral: estado.monitoreo.config.umbralAlerta.usoMemoria,
                    metrica
                }, 'warn');
            }
        }
        
        // Mantener un historial de métricas
        estado.monitoreo.historial.metricas.push(metrica);
        
    } catch (error) {
        console.error('Error al registrar métrica:', error);
    }
}

/**
 * Obtiene el estado actual del sistema de monitoreo
 * @returns {Object} Estado actual del monitoreo
 */
export function obtenerEstadoMonitoreo() {
    return {
        metricas: { ...estado.monitoreo.metricos },
        config: { ...estado.monitoreo.config },
        totalEventos: estado.monitoreo.historial.eventos.length,
        totalErrores: estado.monitoreo.historial.errores.length,
        timestamp: new Date().toISOString()
    };
}

// Inicializar monitoreo de memoria si está disponible
if (window.performance && window.performance.memory) {
    setInterval(() => {
        const memory = window.performance.memory;
        const usoMemoria = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
        registrarMetrica('uso_memoria', usoMemoria, '%');
    }, 60000); // Cada minuto
}

// Exponer funciones de monitoreo globalmente
if (typeof window !== 'undefined') {
    window.registrarEvento = registrarEvento;
    window.registrarMetrica = registrarMetrica;
    window.notificarError = notificarError;
    window.obtenerEstadoMonitoreo = obtenerEstadoMonitoreo;
    
    // Registrar evento de inicialización
    window.addEventListener('DOMContentLoaded', () => {
        registrarEvento('app_inicializada', { 
            version: '1.0.0',
            userAgent: navigator.userAgent,
            url: window.location.href
        }, 'info');
    });
}

// Inicializar monitoreo de eventos de navegación
if (window.performance) {
    // Registrar métricas de carga de página
    window.addEventListener('load', () => {
        const timing = window.performance.timing;
        const tiempoCarga = timing.loadEventEnd - timing.navigationStart;
        registrarMetrica('tiempo_carga_pagina', tiempoCarga);
        
        // Registrar evento de carga completa
        registrarEvento('pagina_cargada', {
            tiempoCarga,
            url: window.location.href,
            userAgent: navigator.userAgent
        });
    });
}

/**
 * Envía una confirmación a un hijo específico.
 * @param {string} hijoId - ID del hijo al que se enviará la confirmación.
 * @returns {Promise<void>}
 */
export async function enviarConfirmacionAHijo(hijoId) {
    try {
        if (!estado.hijosInicializados.has(hijoId)) {
            throw new Error(`El hijo ${hijoId} no está inicializado`);
        }

        const mensajeId = `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await enviarMensaje(hijoId, TIPOS_MENSAJE.SISTEMA.CONFIRMACION, {
            mensajeId,
            timestamp: new Date().toISOString(),
            origen: 'padre'
        });

        logger.info(`Confirmación enviada a ${hijoId} con ID ${mensajeId}`);
    } catch (error) {
        logger.error(`Error al enviar confirmación a ${hijoId}:`, error);
    }
}

/**
 * Envía el estado global a todos los hijos inicializados y verifica confirmaciones.
 */
export async function enviarEstadoGlobal() {
    try {
        const estadoGlobal = {
            modo: estado.modo,
            paradaActual: estado.paradaActual,
            monitoreo: estado.monitoreo
        };

        const hijosSinConfirmar = new Set(estado.hijosInicializados);

        for (const hijoId of estado.hijosInicializados) {
            try {
                await enviarMensajeEnCola(
                    hijoId,
                    TIPOS_MENSAJE.SISTEMA.ESTADO,
                    estadoGlobal,
                    5000 // Timeout de 5 segundos
                );
                hijosSinConfirmar.delete(hijoId);
                logger.info(`Estado global confirmado por ${hijoId}`);
            } catch (error) {
                logger.error(`Error al enviar estado global a ${hijoId}:`, error);
            }
        }

        if (hijosSinConfirmar.size > 0) {
            logger.warn(`Los siguientes hijos no confirmaron el estado global: ${Array.from(hijosSinConfirmar).join(', ')}`);
        }
    } catch (error) {
        logger.error('Error al enviar estado global a los hijos:', error);
    }
}

/**
 * Actualiza el estado global en el padre y notifica a los hijos.
 * @param {Object} nuevoEstado - Cambios en el estado global.
 */
export function actualizarEstadoGlobal(nuevoEstado) {
    try {
        Object.assign(estado, nuevoEstado);
        logger.info('Estado global actualizado:', nuevoEstado);

        // Enviar el estado global actualizado a los hijos
        enviarEstadoGlobal();
    } catch (error) {
        logger.error('Error al actualizar el estado global:', error);
    }
}

// Enviar el estado global al inicializar
await enviarEstadoGlobal();

// Exportar funciones públicas para que puedan ser usadas por otros módulos
// Nota: inicializarMapa se maneja desde codigo-padre.html, no desde aquí

/**
 * Envía un evento a todos los hijos inicializados.
 * @param {string} tipoEvento - Tipo de evento (definido en TIPOS_MENSAJE).
 * @param {Object} datos - Datos del evento.
 */
export async function enviarEventoAHijos(tipoEvento, datos) {
    try {
        for (const hijoId of estado.hijosInicializados) {
            const mensajeId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await enviarMensaje(hijoId, tipoEvento, { ...datos, mensajeId });
            logger.info(`Evento ${tipoEvento} enviado a ${hijoId} con ID ${mensajeId}`);
        }
    } catch (error) {
        logger.error('Error al enviar evento a los hijos:', error);
    }
}

// Eliminar lógica duplicada para manejar confirmaciones (ACK)
// Esto ya está centralizado en mensajeria.js

// Eliminar lógica duplicada para manejar sincronización de estado global
// Esto ya está centralizado en mensajeria.js

// Eliminar lógica duplicada para diagnóstico del mapa
// Esto ya está centralizado en funciones-mapa.js

// Eliminar lógica duplicada de inicialización del mapa
// El mapa se inicializa desde funciones-mapa.js

// Remover lógica redundante de manejo de errores no capturados
// Esto ya está centralizado en mensajeria.js
