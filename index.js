// index.js

// 1. Importar las librerías necesarias
const express = require('express');
const axios = require('axios');

// 2. Obtener el token del bot de las variables de entorno
// Es una mala práctica poner el token directamente en el código.
// Render nos permitirá configurar esta variable de forma segura.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 3. Crear nuestra aplicación de Express
const app = express();
// Telegram envía los datos en formato JSON, necesitamos que Express lo entienda.
app.use(express.json());

// 4. Crear la ruta para el webhook
// Esta es la URL que Telegram llamará cada vez que alguien envíe un mensaje al bot.
app.post('/webhook', async (req, res) => {
  console.log('Mensaje recibido:', req.body);

  // Extraemos la información importante del mensaje que nos envía Telegram
  const message = req.body.message;

  // A veces, Telegram puede enviar otras actualizaciones, nos aseguramos de que sea un mensaje.
  if (message) {
    const chatId = message.chat.id;
    const text = message.text;

    console.log(`Mensaje de ${chatId}: "${text}"`);

    // Aquí va la lógica de nuestro bot.
    // Por ahora, simplemente responde con "Hola".
    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: 'Hola',
      });
      console.log('Respuesta enviada');
    } catch (error) {
      console.error('Error al enviar respuesta:', error);
    }
  }

  // Respondemos a Telegram para confirmar que recibimos el mensaje correctamente.
  res.sendStatus(200);
});

// 5. Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});