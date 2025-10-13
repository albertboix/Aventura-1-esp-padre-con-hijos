/**
 * Módulo para gestionar el modo de la aplicación (casa/aventura)
 * Coordina los cambios de modo entre diferentes componentes
 */

import { MODOS } from './constants.js';
import logger from './logger.js';

/**
 * Clase ModoHandler para gestionar el modo de la aplicación
 */
class ModoHandler {
    #modoActual;
    #suscriptores;
    #ultimoCambio;

    constructor() {
        this.#modoActual = MODOS.CASA; // Default: casa
        this.#suscriptores = new Map();
        this.#ultimoCambio = Date.now();

        // Create a safer public getter/setter for modoActual
        Object.defineProperty(this, 'modoActual', {
            get: () => this.#modoActual,
            configurable: false,
            enumerable: true
        });
    }

    /**
     * Obtiene el modo actual
     * @returns {string} Modo actual ('casa' o 'aventura')
     */
    obtenerModoActual() {
        return this.#modoActual;
    }

    /**
     * Suscribe un componente para recibir notificaciones de cambio de modo
     * @param {string} componenteId - ID del componente
     * @param {Function} callback - Función a llamar cuando cambie el modo
     */
    suscribir(componenteId, callback) {
        if (!componenteId || typeof callback !== 'function') {
            logger.warn('ModoHandler: Intento de suscripción inválido');
            return false;
        }

        this.#suscriptores.set(componenteId, callback);
        logger.debug(`ModoHandler: ${componenteId} suscrito a cambios de modo`);
        return true;
    }

    /**
     * Cambia el modo actual y notifica a los suscriptores
     * @param {string} nuevoModo - Nuevo modo ('casa' o 'aventura')
     * @param {string} [origen='sistema'] - Origen del cambio
     * @returns {Promise<boolean>} True si el cambio fue exitoso
     */
    async cambiarModo(nuevoModo, origen = 'sistema') {
        try {
            // Validar el nuevo modo
            if (nuevoModo !== MODOS.CASA && nuevoModo !== MODOS.AVENTURA) {
                logger.warn(`ModoHandler: Modo inválido: ${nuevoModo}`);
                return false;
            }

            // Si ya estamos en ese modo, no hacer nada
            if (nuevoModo === this.#modoActual) {
                logger.info(`ModoHandler: Ya estamos en modo ${nuevoModo}`);
                return true;
            }

            const modoAnterior = this.#modoActual;
            
            // FIX: Instead of assigning to this.modoActual, use the private field
            this.#modoActual = nuevoModo;
            this.#ultimoCambio = Date.now();

            logger.info({
                modulo: 'ModoHandler',
                accion: 'cambiarModo',
                origen,
                modoAnterior,
                nuevoModo
            });

            // Notificar a los suscriptores
            for (const [id, callback] of this.#suscriptores.entries()) {
                try {
                    await Promise.resolve(callback(nuevoModo, modoAnterior));
                } catch (error) {
                    logger.error(`ModoHandler: Error al notificar a ${id}:`, error);
                }
            }

            return true;
        } catch (error) {
            logger.error('ModoHandler: Error al cambiar modo:', error);
            return false;
        }
    }

    /**
     * Desuscribe un componente
     * @param {string} componenteId - ID del componente
     * @returns {boolean} True si se desuscribió correctamente
     */
    desuscribir(componenteId) {
        if (!componenteId || !this.#suscriptores.has(componenteId)) {
            return false;
        }

        this.#suscriptores.delete(componenteId);
        logger.debug(`ModoHandler: ${componenteId} desuscrito de cambios de modo`);
        return true;
    }

    /**
     * Obtiene estadísticas del gestor de modos
     * @returns {Object} Estadísticas
     */
    obtenerEstadisticas() {
        return {
            modoActual: this.#modoActual,
            suscriptores: Array.from(this.#suscriptores.keys()),
            ultimoCambio: new Date(this.#ultimoCambio).toISOString(),
            totalSuscriptores: this.#suscriptores.size
        };
    }
}

// Crear una instancia única
export const modoHandler = new ModoHandler();

// Exportar tipos para mejor documentación
export const TIPO_MODOS = MODOS;

// Exportar la instancia por defecto
export default modoHandler;
