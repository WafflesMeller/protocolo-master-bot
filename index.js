// index.js

// 1. Cargar variables de entorno
require('dotenv').config();

// 2. Importar librerías necesarias
const express = require('express');
const axios = require('axios');

// 3. Token y endpoint de Telegram
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 4. Crear aplicación de Express
const app = express();
app.use(express.json());

// 5. Webhook para recibir actualizaciones
app.post('/webhook', async (req, res) => {
  console.log('Update recibido:', req.body);
  // Confirmar recepción de la actualización
  res.sendStatus(200);

  const update = req.body;

  // 5.1. Manejar callback queries (botones)
  if (update.callback_query) {
    const { id: callbackQueryId, data } = update.callback_query;
    const chatId = update.callback_query.message.chat.id;

    // Responder al callback para quitar el spinner
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId
    });

    // Acciones según el botón presionado
    if (data === 'GENERATE') {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: '📂 Por favor, envía un archivo Excel (.xlsx) con dos columnas: "nombre" y "cargo".'
      });
    } else if (data === 'HELP') {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: '📖 *Ayuda*: Presiona "Generar precedencias" o envía /generar para empezar.',
        parse_mode: 'Markdown'
      });
    }
    return;
  }

  // 5.2. Manejar mensajes de texto
  const message = update.message;
  if (message && message.text) {
    const chatId = message.chat.id;
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
  }
});

// 6. Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
