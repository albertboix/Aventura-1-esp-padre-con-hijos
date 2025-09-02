/**
 * Módulo de utilidades y constantes compartidas para toda la aplicación.
 * @version 2.1.1
 */

// Importar configuración compartida
import { LOG_LEVELS, TIPOS_MENSAJE } from './constants.js';
import logger from './logger.js';

const Utils = (() => {
  // ================== CONSTANTES PÚBLICAS ==================
  const TIPOS_PUNTO = Object.freeze({
    PARADA: 'parada',
    TRAMO: 'tramo',
    INICIO: 'inicio'
  });

  // ================== CONFIGURACIÓN PRIVADA ==================
  let config = {
    iframeId: 'unknown',
    logLevel: LOG_LEVELS.INFO,
    debug: false
  };

  // ================== API PÚBLICA ==================
  return {
    // Constantes
    MODOS,
    TIPOS_PUNTO,
    TIPOS_MENSAJE,

    // Configuración
    configurarUtils: (newConfig = {}) => {
      config = { ...config, ...newConfig };
      
      // Configurar el logger con la nueva configuración
      if (logger && typeof logger.configure === 'function') {
        logger.configure({
          iframeId: config.iframeId,
          logLevel: config.logLevel,
          debug: config.debug
        });
      }
      
      return config;
    },

    // Utilidades de error
    crearObjetoError: (tipo, error, datosAdicionales = {}) => {
      const timestamp = new Date().toISOString();
      
      // Si ya es un objeto de error estándar
      if (error && error.timestamp) {
        return { ...error, ...datosAdicionales };
      }
      
      // Registrar el error en el logger
      if (logger && typeof logger.error === 'function') {
        logger.error(`Error (${tipo}):`, error);
      }
      
      return {
        tipo,
        timestamp,
        mensaje: error?.message || String(error),
        stack: error?.stack,
        ...datosAdicionales
      };
    }
  };
})();

// Exportar la API pública
export const {
  TIPOS_PUNTO,
  TIPOS_MENSAJE,
  configurarUtils,
  logger,
  crearObjetoError
} = Utils;
