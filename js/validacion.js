/**
 * Módulo para validar formularios y entradas de usuario.
 * @module Validacion
 */

import logger from './logger.js';

/**
 * Valida un campo de texto.
 * @param {HTMLInputElement} campo - Campo de texto a validar.
 * @param {RegExp} regex - Expresión regular para validar el campo.
 * @param {string} mensajeError - Mensaje de error en caso de validación fallida.
 * @returns {boolean} - True si el campo es válido, false en caso contrario.
 */
export function validarCampoTexto(campo, regex, mensajeError) {
    if (!campo || !(campo instanceof HTMLInputElement)) {
        logger.error('El campo proporcionado no es válido.');
        return false;
    }

    if (!regex.test(campo.value)) {
        logger.warn(mensajeError);
        campo.setCustomValidity(mensajeError);
        campo.reportValidity(); // Mostrar el mensaje de error al usuario
        return false;
    }

    campo.setCustomValidity('');
    return true;
}

/**
 * Valida un formulario completo.
 * @param {HTMLFormElement} formulario - Formulario a validar.
 * @param {Array<{ campo: HTMLInputElement, regex: RegExp, mensajeError: string }>} validaciones - Reglas de validación.
 * @returns {boolean} - True si el formulario es válido, false en caso contrario.
 */
export function validarFormulario(formulario, validaciones) {
    if (!formulario || !(formulario instanceof HTMLFormElement)) {
        logger.error('El formulario proporcionado no es válido.');
        return false;
    }

    if (!Array.isArray(validaciones)) {
        logger.error('Las validaciones deben ser un array.');
        return false;
    }

    let esValido = true;

    validaciones.forEach(({ campo, regex, mensajeError }) => {
        if (!validarCampoTexto(campo, regex, mensajeError)) {
            esValido = false;
        }
    });

    return esValido;
}

/**
 * Valida las coordenadas proporcionadas.
 * @param {Object} coordenadas - Coordenadas a validar.
 * @returns {boolean} - True si las coordenadas son válidas, lanza un error si no lo son.
 */
export function validarCoordenadas(coordenadas) {
    if (!coordenadas || typeof coordenadas !== 'object') {
        throw new Error('Coordenadas no válidas: deben ser un objeto.');
    }

    const { lat, lng } = coordenadas;

    if (lat === undefined || lng === undefined) {
        throw new Error('Coordenadas no válidas: faltan propiedades lat o lng.');
    }

    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        throw new Error('Coordenadas no válidas: latitud fuera de rango.');
    }

    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
        throw new Error('Coordenadas no válidas: longitud fuera de rango.');
    }

    return true;
}

/**
 * Registra validaciones en un formulario existente.
 * @param {HTMLFormElement} formulario - Formulario a validar.
 * @param {Array<{ campoId: string, regex: RegExp, mensajeError: string }>} validaciones - Reglas de validación.
 * @returns {boolean} - True si las validaciones se registraron correctamente, false en caso contrario.
 */
export function registrarValidacionesFormulario(formulario, validaciones) {
    if (!formulario || !(formulario instanceof HTMLFormElement)) {
        logger.error('El formulario proporcionado no es válido.');
        return false;
    }

    if (!Array.isArray(validaciones)) {
        logger.error('Las validaciones deben ser un array.');
        return false;
    }

    validaciones.forEach(({ campoId, regex, mensajeError }) => {
        const campo = formulario.querySelector(`#${campoId}`);
        if (campo) {
            campo.addEventListener('input', () => validarCampoTexto(campo, regex, mensajeError));
        } else {
            logger.warn(`Campo con ID "${campoId}" no encontrado en el formulario.`);
        }
    });

    return true;
}

/**
 * Centraliza la validación de formularios en toda la aplicación.
 * @param {Array<{ formularioId: string, validaciones: Array<{ campoId: string, regex: RegExp, mensajeError: string }> }>} formularios - Formularios a validar.
 */
export function centralizarValidacionFormularios(formularios) {
    if (!Array.isArray(formularios)) {
        logger.error('El parámetro formularios debe ser un array.');
        return;
    }

    const formulariosProcesados = new Set();

    formularios.forEach(({ formularioId, validaciones }) => {
        if (formulariosProcesados.has(formularioId)) {
            logger.warn(`El formulario con ID "${formularioId}" ya fue procesado.`);
            return;
        }

        const formulario = document.getElementById(formularioId);
        if (formulario) {
            registrarValidacionesFormulario(formulario, validaciones);
            formulariosProcesados.add(formularioId);
        } else {
            logger.warn(`Formulario con ID "${formularioId}" no encontrado.`);
        }
    });
}
