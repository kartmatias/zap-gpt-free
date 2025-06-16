import { Whatsapp } from '@wppconnect-team/wppconnect';
// Corrected import path for logger
import { logger } from '../index';

export function splitMessages(text: string): string[] {
  // eslint-disable-next-line sonarjs/slow-regex
  const complexPattern =
    /((?:https?:\/\/|www\.)\S+)|(\S+@\S+\.\S+)|(["'].*?["'])/g;
  const placeholders = text.match(complexPattern) ?? [];

  const placeholder = 'PLACEHOLDER_';
  let currentIndex = 0;
  const textWithPlaceholders = text.replace(
    complexPattern,
    () => `${placeholder}${currentIndex++}`
  );

  // eslint-disable-next-line sonarjs/slow-regex
  const splitPattern = /[^.?!]+(?:[.?!]+["']?|$)/g;
  let parts = textWithPlaceholders.match(splitPattern) ?? ([] as string[]);

  if (placeholders.length > 0) {
    parts = parts.map((part) =>
      placeholders.reduce(
        (acc, val, idx) => acc.replace(`${placeholder}${idx}`, val),
        part
      )
    );
  }

  return parts;
}

export async function sendMessagesWithDelay({
  messages,
  client,
  targetNumber,
}: {
  messages: string[];
  client: Whatsapp;
  targetNumber: string;
}): Promise<void> {
  for (const [, msg] of messages.entries()) {
    const dynamicDelay = msg.length * 100;
    await new Promise((resolve) => setTimeout(resolve, dynamicDelay));
    client
      .sendText(targetNumber, msg.trimStart())
      .then((result) => {
        logger.info('Mensagem enviada para %s: %s', targetNumber, result.body);
      })
      .catch((erro) => {
        logger.error(erro, 'Erro ao enviar mensagem para %s', targetNumber);
      });
  }
}
