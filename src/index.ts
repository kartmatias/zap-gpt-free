import wppconnect from '@wppconnect-team/wppconnect';
import pino from 'pino';
import dotenv from 'dotenv';
import { initializeNewAIChatSession, mainOpenAI } from './service/openai.js';
import { splitMessages, sendMessagesWithDelay } from './util/index.js';
import { mainGoogle } from './service/google.js';
import WhatsAppService from './util/whatsappService.js';
import { startApiServer } from './api.js';

dotenv.config();

export const logger = pino(
  process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:HH:MM:ss',
          },
        },
      }
    : {}
);

type AIOption = 'GPT' | 'GEMINI';

const messageBufferPerChatId = new Map();
const messageTimeouts = new Map();
const AI_SELECTED: AIOption = (process.env.AI_SELECTED as AIOption) || 'GPT'; // Default to GPT for testing if not set

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const MESSAGE_BUFFER_TIMEOUT_MS = parseInt(
  process.env.MESSAGE_BUFFER_TIMEOUT_MS || '10000',
  10
);

if (AI_SELECTED === 'GEMINI' && !process.env.GEMINI_KEY) {
  logger.error(
    'Variável de ambiente GEMINI_KEY não informada. Para gerar uma chave acesse: https://aistudio.google.com/app/apikey'
  );
  process.exit(1);
}

if (
  AI_SELECTED === 'GPT' &&
  (!process.env.OPENAI_KEY || !process.env.OPENAI_ASSISTANT)
) {
  logger.error(
    'Variável de ambiente OPENAI_KEY ou OPENAI_ASSISTANT não informada.'
  );
  process.exit(1);
}

// Start API Server
const API_PORT = parseInt(process.env.API_PORT || '3000', 10); // Ensure API_PORT is treated as a number
startApiServer(API_PORT);

WhatsAppService.updateStatus({ status: 'starting_wppconnect', message: 'Attempting to start WhatsApp connection...' });

wppconnect
  .create({
    session: 'sessionName',
    catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
      logger.info('Terminal qrcode: \n%s', asciiQR);
      WhatsAppService.updateStatus({ status: 'qr_code_required', qrCode: base64Qrimg, message: 'Scan QR code to connect.' });
    },
    statusFind: (statusSession, session) => {
      logger.info({ statusSession, session }, 'Status find');
      WhatsAppService.updateStatus({ status: statusSession, sessionName: session, qrCode: null, message: `Status: ${statusSession}` });
    },
    headless: true, // Changed from 'new' as any
    // puppeteerOptions: {
    //   args: ['--no-sandbox']
    // }
  })
  .then((client) => {
    WhatsAppService.updateStatus({ status: 'connected', message: 'WhatsApp client connected successfully.', qrCode: null });
    WhatsAppService.setClient(client as any); // Cast client to any if type mismatch
    start(client);
  })
  .catch((error) => { // Changed 'erro' to 'error' to match the logger call
    logger.error(error, 'Failed to create wppconnect client');
    WhatsAppService.updateStatus({ status: 'error', message: 'Failed to create wppconnect client.', qrCode: null, error: error });
    // process.exit(1); // Keep this commented for now to allow API to run even if WhatsApp fails for testing
  });

async function start(client: wppconnect.Whatsapp): Promise<void> {
  client.onMessage(async (message) => { // Added async here
    await handleMessage(client, message);
  });
}

async function handleMessage(
  client: wppconnect.Whatsapp,
  message: wppconnect.Message
): Promise<void> {
  if (
    message.type === 'chat' &&
    !message.isGroupMsg &&
    message.chatId !== 'status@broadcast'
  ) {
    const chatId = message.chatId;
    logger.info('Mensagem recebida de %s: %s', chatId, message.body);
    if (AI_SELECTED === 'GPT') {
      await initializeNewAIChatSession(chatId);
    }

    if (!messageBufferPerChatId.has(chatId)) {
      messageBufferPerChatId.set(chatId, [message.body]);
    } else {
      messageBufferPerChatId.set(chatId, [
        ...messageBufferPerChatId.get(chatId),
        message.body,
      ]);
    }

    if (messageTimeouts.has(chatId)) {
      clearTimeout(messageTimeouts.get(chatId));
    }
    logger.info('Aguardando novas mensagens...');
    messageTimeouts.set(
      chatId,
      setTimeout(() => {
        (async () => {
          try {
            const currentMessage = !messageBufferPerChatId.has(chatId)
              ? message.body
              : messageBufferPerChatId.get(chatId)!.join(' \n ');
            let answer = '';
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                if (AI_SELECTED === 'GPT') {
                  answer = await mainOpenAI({
                    currentMessage,
                    chatId,
                  });
                } else {
                  answer = await mainGoogle({
                    currentMessage,
                    chatId,
                  });
                }
                break;
              } catch (error) {
                logger.error(
                  error,
                  'AI attempt %d/%d failed for chat %s',
                  attempt,
                  MAX_RETRIES,
                  chatId
                );
                if (attempt === MAX_RETRIES) {
                  // TODO: Send error message to user?
                  return; // Exit to avoid sending empty or old answer, finally will cleanup
                }
              }
            }
            // If answer is empty after all retries (e.g., all attempts failed and returned before break)
            if (!answer) {
              logger.warn('No answer from AI after all retries for chat %s. Not sending messages.', chatId);
              return; // Exit, finally will cleanup
            }
            const messages = splitMessages(answer);
            logger.info('Enviando %d mensagens...', messages.length);
            await sendMessagesWithDelay({
              client,
              messages,
              targetNumber: message.from,
            });
          } finally {
            messageBufferPerChatId.delete(chatId);
            messageTimeouts.delete(chatId);
            logger.info('Buffer and timeout cleared for chat %s', chatId);
          }
        })();
      }, MESSAGE_BUFFER_TIMEOUT_MS)
    );
  }
}