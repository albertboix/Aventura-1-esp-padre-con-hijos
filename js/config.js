/**
 * Configuración centralizada de la aplicación
 * @module Config
 */

// Importar constantes compartidas
import { LOG_LEVELS, TIPOS_MENSAJE } from './constants.js';

export { LOG_LEVELS, TIPOS_MENSAJE };

// Configuración general de la aplicación
export const CONFIG = {
  // Configuración general
  IFRAME_ID: 'padre',
  ES_PADRE: true,
  // Configuración del logger
  DEBUG: true,
  LOG_LEVEL: LOG_LEVELS.DEBUG,
  
  // Configuración de reintentos
  REINTENTOS: {
    MAXIMOS: 3,
    TIEMPO_ESPERA: 1000,
    FACTOR: 2
  },
  
  // Configuración de iframes hijos
  HIJOS: {
    HAMBURGUESA: { 
      id: 'hijo1-hamburguesa', 
      nombre: 'Menú Hamburguesa', 
      src: 'botones-y-subfunciones-hamburguesa.html',
      cargarInmediato: true
    },
    OPCIONES: { 
      id: 'hijo1-opciones', 
      nombre: 'Opciones', 
      src: 'botones-y-subfunciones-opciones.html',
      cargarInmediato: false
    },
    COORDENADAS: {
      id: 'hijo2',
      nombre: 'Mapa y Coordenadas',
      src: 'Av1-botones-coordenadas.html',
      cargarInmediato: true
    },
    AUDIO: {
      id: 'hijo3',
      nombre: 'Reproductor de Audio',
      src: 'Av1_audio_esp.html',
      cargarInmediato: true
    },
    RETOS: {
      id: 'hijo4',
      nombre: 'Retos y Preguntas',
      src: 'Av1-esp-retos-preguntas.html',
      cargarInmediato: false
    },
    CASA: {
      id: 'hijo5',
      nombre: 'Botón de Casa',
      src: 'Av1-boton-casa.html',
      cargarInmediato: true
    }
  },
  
  // Configuración del mapa
  MAPA: {
    ZOOM_INICIAL: 16,
    CENTRO_INICIAL: {
      lat: 39.4699,
      lng: -0.3763
    },
    TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
};

/**
 * Obtiene la configuración de un iframe hijo por su ID
 * @param {string} id - ID del iframe hijo
 * @returns {Object|null} Configuración del iframe o null si no se encuentra
 */
export function getConfigHijo(id) {
  for (const [key, hijo] of Object.entries(CONFIG.HIJOS)) {
    if (hijo.id === id) {
      return { ...hijo };
    }
  }
  return null;
}

/**
 * Verifica si el iframe actual es el padre
 * @returns {boolean} true si es el iframe padre
 */
export function esPadre() {
  return CONFIG.ES_PADRE && window.self === window.top;
}

/**
 * Configura la aplicación según el entorno
 * @param {Object} overrides - Configuraciones personalizadas
 */
export function configurarAplicacion(overrides = {}) {
  // Aplicar configuraciones personalizadas
  Object.assign(CONFIG, overrides);
  
  // Configuración específica para iframes hijos
  if (!esPadre()) {
    const path = window.location.pathname.split('/').pop();
    for (const [key, hijo] of Object.entries(CONFIG.HIJOS)) {
      if (hijo.src === path) {
        CONFIG.IFRAME_ID = hijo.id;
        CONFIG.ES_PADRE = false;
        break;
      }
    }
  }
  
  return CONFIG;
}

// Exportar configuración por defecto
export default {
  // Constantes
  LOG_LEVELS,
  TIPOS_MENSAJE,
  MODOS,
  CONFIG,
  getConfigHijo,
  esPadre,
  configurarAplicacion
};
