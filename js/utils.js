/**
 * Módulo de utilidades y constantes compartidas para toda la aplicación.
 * @version 2.1.0
 */

// Importar el logger centralizado
import { logger, LOG_LEVELS } from './logger.js';

const Utils = (() => {

  const MODOS = {
    CASA: 'casa',
    AVENTURA: 'aventura'
  };

  // ================== CONSTANTES PÚBLICAS ==================
  const TIPOS_PUNTO = {
    PARADA: 'parada',
    TRAMO: 'tramo',
    INICIO: 'inicio'
  };

  const TIPOS_MENSAJE = {
    // Mensajes de sistema
    SISTEMA: {
      INICIALIZAR: 'sistema:inicializar',
      LISTO: 'sistema:listo',
      ERROR: 'sistema:error',
      CONFIGURACION: 'sistema:configuracion'
    },
    
    // Mensajes de navegación
    NAVEGACION: {
      INICIAR: 'navegacion:iniciar',
      DETENER: 'navegacion:detener',
      ACTUALIZAR: 'navegacion:actualizar',
      INICIADA: 'navegacion:iniciada',
      CANCELADA: 'navegacion:cancelada',
      DESTINO_ESTABLECIDO: 'navegacion:destino_establecido',
      LLEGADA_DETECTADA: 'navegacion:llegada_detectada',
      SOLICITAR_DESTINO: 'navegacion:solicitar_destino',
      ESTADO: 'navegacion:estado'
    },
    
    // Mensajes de control
    CONTROL: {
      ESTADO: 'control:estado',
      HABILITAR: 'control:habilitar',
      DESHABILITAR: 'control:deshabilitar'
    },
    
    // Mensajes de GPS
    GPS: {
      ACTUALIZAR: 'gps:actualizar',
      POSICION_ACTUALIZADA: 'gps:posicion_actualizada',
      COMANDO: 'gps:comando'
    },
    
    // Mensajes de audio
    AUDIO: {
      COMANDO: 'audio:comando',
      REPRODUCIR: 'audio:reproducir'
    },
    
    // Mensajes de retos
    RETO: {
      NUEVO: 'reto:nuevo',
      MOSTRAR: 'reto:mostrar'
    },
    
    // Mensajes de interfaz de usuario
    UI: {
      ACTUALIZAR: 'ui:actualizar',
      MOSTRAR: 'ui:mostrar',
      OCULTAR: 'ui:ocultar',
      HABILITAR: 'ui:habilitar',
      DESHABILITAR: 'ui:deshabilitar'
    }
  };

  // ================== CONFIGURACIÓN PRIVADA ==================
  let config = {
    iframeId: 'unknown',
    logLevel: LOG_LEVELS.INFO,
    debug: false
  };

  // ================== API PÚBLICA ==================
  return {
    // Constantes
    LOG_LEVELS,
    MODOS,
    TIPOS_PUNTO,
    TIPOS_MENSAJE,

    // Configuración
    configurarUtils(newConfig = {}) {
      config = { ...config, ...newConfig };
      
      // Configurar el logger
      logger.configurarLogger({
        iframeId: config.iframeId,
        logLevel: config.logLevel,
        debug: config.debug
      });
      
      return config;
    },

    // Logger - Usando el módulo logger.js
    logger,

    // Utilidades de error
    crearObjetoError(tipo, error, datosAdicionales = {}) {
      const timestamp = new Date().toISOString();
      
      // Si el error ya es un objeto estandarizado, devolverlo tal cual
      if (error && typeof error === 'object' && error.tipo && error.timestamp) {
        return { ...error, ...datosAdicionales };
      }
      
      // Crear un nuevo objeto de error estandarizado
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
  LOG_LEVELS,
  MODOS,
  TIPOS_PUNTO,
  TIPOS_MENSAJE,
  configurarUtils,
  logger,
  crearObjetoError
} = Utils;
