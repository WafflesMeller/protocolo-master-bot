// index.js

// 1. Cargar variables de entorno
require('dotenv').config();

// 2. Importar librerías necesarias
const express = require('express');
const axios = require('axios');

// 3. Token y endpoint de Telegram
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 4. Crear aplicación de Express\const app = express();
app.use(express.json());

// 5. Webhook para recibir actualizaciones
app.post('/webhook', async (req, res) => {
  console.log('Update recibido:', req.body);
  // Confirmar recepción inmediatamente
  res.sendStatus(200);

  const message = req.body.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  // Cualquier texto desencadena esta respuesta
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: '👋 Soy el Bot de Generador de Precedencias. Puedo ayudarte a convertir tu Excel en un PDF de tarjetas de precedencia.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Generar precedencias', callback_data: 'GENERATE' },
            { text: 'Ayuda', callback_data: 'HELP' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Error al enviar respuesta:', error);
  }
});

// 6. Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
