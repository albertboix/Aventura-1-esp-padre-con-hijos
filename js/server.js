const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para agregar headers de seguridad
app.use((req, res, next) => {
    // Configurar Permissions-Policy para permitir geolocalización y NO incluir 'unload'
    res.setHeader('Permissions-Policy', 'geolocation=(self), interest-cohort=()');
    
    // Agregar headers de seguridad adicionales
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
});

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, '../')));

// Ruta principal para servir el archivo HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../codigo-padre.html'));
});

// Endpoint para manejar mensajes centralizados
app.post('/mensajeria', express.json(), (req, res) => {
    const { tipoMensaje, datos } = req.body;

    // Lógica para manejar los mensajes
    console.log(`[Mensajería] Tipo: ${tipoMensaje}`, datos);

    // Respuesta genérica
    res.json({ exito: true, mensaje: 'Mensaje procesado correctamente' });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
