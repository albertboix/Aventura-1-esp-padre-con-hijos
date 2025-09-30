/**
 * Manejador centralizado de cambios de modo
 * Mantiene el estado del modo y notifica a los componentes suscriptos
 */
import logger from './js/logger.js';

class ModoHandler {
    constructor() {
        this.modoActual = 'casa'; // Valor por defecto
        this.suscriptores = new Map(); // Mapa de suscriptores por componente
        this.modosValidos = new Set(['casa', 'aventura']);
    }

    /**
     * Cambia el modo actual y notifica a los suscriptores
     * @param {string} nuevoModo - Nuevo modo ('casa' o 'aventura')
     * @param {string} [origen='sistema'] - Nombre del componente que originó el cambio
     * @returns {boolean} - true si el cambio fue exitoso, false en caso contrario
     * @throws {Error} Si el modo no es válido
     */
    cambiarModo(nuevoModo, origen = 'sistema') {
        // Validar que el modo sea válido
        if (!this.modosValidos.has(nuevoModo)) {
            const errorMsg = `Modo no válido: ${nuevoModo}. Modos válidos: ${Array.from(this.modosValidos).join(', ')}`;
            logger.warn(errorMsg, { modulo: 'ModoHandler', accion: 'validarModo' });
            return false;
        }

        // No hacer nada si el modo no cambia
        if (this.modoActual === nuevoModo) {
            logger.debug(`El modo ya está establecido a: ${nuevoModo}`, { modulo: 'ModoHandler', accion: 'cambiarModo' });
            return true;
        }

        logger.info(`Cambiando a modo: ${nuevoModo}`, { 
            modulo: 'ModoHandler', 
            accion: 'cambiarModo',
            origen,
            modoAnterior: this.modoActual,
            nuevoModo 
        });
        const modoAnterior = this.modoActual;
        this.modoActual = nuevoModo;
        
        // Notificar a todos los suscriptores
        this.notificarSuscriptores(nuevoModo, modoAnterior);
        
        return true;
    }

    /**
     * Registra un componente para recibir notificaciones de cambio de modo
     * @param {string} componente - Nombre único del componente
     * @param {Function} callback - Función a ejecutar cuando cambie el modo
     */
    suscribir(componente, callback) {
        if (typeof callback === 'function') {
            this.suscriptores.set(componente, callback);
            logger.debug(`${componente} se ha suscrito a cambios de modo`, { 
                modulo: 'ModoHandler', 
                accion: 'suscripcion',
                componente,
                modoActual: this.modoActual
            });
            
            // Notificar inmediatamente con el modo actual
            callback(this.modoActual);
        }
    }

    /**
     * Elimina un componente de los suscriptores
     * @param {string} componente - Nombre del componente a dar de baja
     */
    desuscribir(componente) {
        this.suscriptores.delete(componente);
        logger.debug(`${componente} se ha dado de baja de cambios de modo`, { 
            modulo: 'ModoHandler', 
            accion: 'desuscripcion',
            componente
        });
    }

    /**
     * Notifica a todos los suscriptores del cambio de modo
     * @param {string} nuevoModo - Nuevo modo
     * @param {string} [modoAnterior] - Modo anterior (opcional)
     */
    notificarSuscriptores(nuevoModo, modoAnterior) {
        const notificacion = {
            modo: nuevoModo,
            modoAnterior: modoAnterior || this.obtenerModoActual(),
            timestamp: new Date().toISOString()
        };

        this.suscriptores.forEach((callback, componente) => {
            try {
                callback(notificacion);
            } catch (error) {
                logger.error(`Error al notificar a ${componente}`, { 
                    modulo: 'ModoHandler', 
                    accion: 'notificarSuscriptores',
                    componente,
                    error: error.message,
                    stack: error.stack
                });
                // Opcional: Desuscribir el componente problemático
                // this.desuscribir(componente);
            }
        });
    }

    /**
     * Verifica si el modo actual coincide con el especificado
     * @param {string} modo - Modo a verificar
     * @returns {boolean} - true si el modo actual coincide
     */
    esModo(modo) {
        if (!this.modosValidos.has(modo)) {
            logger.warn(`Modo no válido para verificación: ${modo}`, { 
                modulo: 'ModoHandler', 
                accion: 'esModo',
                modo,
                modosValidos: Array.from(this.modosValidos)
            });
            return false;
        }
        return this.modoActual === modo;
    }

    /**
     * Obtiene el modo actual
     * @returns {string} Modo actual
     */
    obtenerModoActual() {
        return this.modoActual;
    }
    
    /**
     * Obtiene la lista de modos válidos
     * @returns {string[]} Array de modos válidos
     */
    obtenerModosValidos() {
        return Array.from(this.modosValidos);
    }
}

// Implementación del patrón Singleton
let instancia = null;

/**
 * Obtiene la instancia única del manejador de modos
 * @returns {ModoHandler} Instancia única
 */
function obtenerInstancia() {
    if (!instancia) {
        instancia = new ModoHandler();
        // Hacer que la instancia sea inmutable
        Object.freeze(instancia);
    }
    return instancia;
}

// Exportar la instancia única
export const modoHandler = obtenerInstancia();
