/**
 * Manejador centralizado de cambios de modo
 * Mantiene el estado del modo y notifica a los componentes suscritos
 */
class ModoHandler {
    constructor() {
        this.modoActual = 'casa'; // Valor por defecto
        this.suscriptores = new Map(); // Mapa de suscriptores por componente
    }

    /**
     * Cambia el modo actual y notifica a los suscriptores
     * @param {string} nuevoModo - Nuevo modo ('casa' o 'aventura')
     * @param {string} origen - Nombre del componente que originó el cambio
     */
    cambiarModo(nuevoModo, origen) {
        if (this.modoActual === nuevoModo) return;

        console.log(`🔄 [ModoHandler] Cambiando a modo: ${nuevoModo} (solicitado por ${origen})`);
        this.modoActual = nuevoModo;
        
        // Notificar a todos los suscriptores
        this.notificarSuscriptores(nuevoModo);
    }

    /**
     * Registra un componente para recibir notificaciones de cambio de modo
     * @param {string} componente - Nombre único del componente
     * @param {Function} callback - Función a ejecutar cuando cambie el modo
     */
    suscribir(componente, callback) {
        if (typeof callback === 'function') {
            this.suscriptores.set(componente, callback);
            console.log(`[ModoHandler] ${componente} se ha suscrito a cambios de modo`);
            
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
        console.log(`[ModoHandler] ${componente} se ha dado de baja de cambios de modo`);
    }

    /**
     * Notifica a todos los suscriptores del cambio de modo
     * @param {string} modo - Nuevo modo
     */
    notificarSuscriptores(modo) {
        this.suscriptores.forEach((callback, componente) => {
            try {
                callback(modo);
            } catch (error) {
                console.error(`[ModoHandler] Error al notificar a ${componente}:`, error);
            }
        });
    }

    /**
     * Obtiene el modo actual
     * @returns {string} Modo actual
     */
    obtenerModoActual() {
        return this.modoActual;
    }
}

// Exportar una instancia única
export const modoHandler = new ModoHandler();
