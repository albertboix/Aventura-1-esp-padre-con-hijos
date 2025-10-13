/**
 * Módulo para gestionar eventos de usuario en la aplicación.
 * @module EventosUsuario
 */

import logger from './logger.js';

/**
 * Registra un evento de clic en un botón.
 * @param {string} botonId - ID del botón.
 * @param {Function} callback - Función a ejecutar al hacer clic.
 */
export function registrarEventoClic(botonId, callback) {
    const boton = document.getElementById(botonId);
    if (!boton) {
        logger.warn(`Botón con ID "${botonId}" no encontrado.`);
        return;
    }

    boton.addEventListener('click', (event) => {
        logger.info(`Clic en botón "${botonId}"`);
        callback(event);
    });

    logger.info(`Evento de clic registrado para botón "${botonId}"`);
}

/**
 * Registra múltiples eventos de clic en botones.
 * @param {Array<{ botonId: string, callback: Function }>} eventos - Lista de eventos a registrar.
 */
export function registrarEventosClic(eventos) {
    eventos.forEach(({ botonId, callback }) => registrarEventoClic(botonId, callback));
}

/**
 * Habilita un botón.
 * @param {string} botonId - ID del botón.
 */
export function habilitarBoton(botonId) {
    const boton = document.getElementById(botonId);
    if (!boton) {
        logger.warn(`Botón con ID "${botonId}" no encontrado.`);
        return;
    }

    boton.disabled = false;
    logger.info(`Botón "${botonId}" habilitado.`);
}

/**
 * Deshabilita un botón.
 * @param {string} botonId - ID del botón.
 */
export function deshabilitarBoton(botonId) {
    const boton = document.getElementById(botonId);
    if (!boton) {
        logger.warn(`Botón con ID "${botonId}" no encontrado.`);
        return;
    }

    boton.disabled = true;
    logger.info(`Botón "${botonId}" deshabilitado.`);
}






/**
 * Registra múltiples eventos de clic de forma centralizada para evitar duplicidades.
 * @param {Array<{ botonId: string, callback: Function }>} eventos - Lista de eventos a registrar.
 */
export function registrarEventosClicCentralizados(eventos) {
    eventos.forEach(({ botonId, callback }) => registrarEventoClicGlobal(botonId, callback));
}

/**
 * Configura múltiples botones de manera centralizada.
 * @param {Array<{ botonId: string, habilitar: boolean }>} configuraciones - Configuración de botones.
 */
export function configurarBotones(configuraciones) {
    configuraciones.forEach(({ botonId, habilitar }) => {
        if (habilitar) {
            habilitarBoton(botonId);
        } else {
            deshabilitarBoton(botonId);
        }
    });
}

/**
 * Registra un evento de clic global para evitar duplicidades.
 * @param {string} botonId - ID del botón.
 * @param {Function} callback - Función a ejecutar al hacer clic.
 */
export function registrarEventoClicGlobal(botonId, callback) {
    if (!window.__eventosClicRegistrados) {
        window.__eventosClicRegistrados = new Set();
    }

    if (window.__eventosClicRegistrados.has(botonId)) {
        logger.warn(`El evento de clic para el botón "${botonId}" ya está registrado.`);
        return;
    }

    registrarEventoClic(botonId, callback);
    window.__eventosClicRegistrados.add(botonId);
}
