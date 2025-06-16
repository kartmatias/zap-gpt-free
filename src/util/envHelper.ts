import fs from 'fs';
import dotenv from 'dotenv';

const ENV_FILE_PATH = '.env';

/**
 * Reads the .env file and returns its content as a Record.
 * If the file doesn't exist, returns an empty object.
 */
export function readEnvFile(): Record<string, string> {
  if (fs.existsSync(ENV_FILE_PATH)) {
    return dotenv.parse(fs.readFileSync(ENV_FILE_PATH, { encoding: 'utf8' }));
  }
  return {};
}

/**
 * Serializes a configuration object into a .env file string.
 * Values are quoted if they contain spaces, newlines, '#', or '='.
 * @param config The configuration object to serialize.
 * @returns A string formatted for .env file.
 */
export function serializeEnv(config: Record<string, string>): string {
  let envString = '';
  for (const key in config) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      const value = config[key] || ''; // Ensure value is not undefined/null
      // Quote if value contains spaces, newlines, '#', '=', or is already quoted
      // and we want to preserve those quotes (e.g. empty string should be GEMINI_PROMPT="")
      // Also ensure that boolean true/false and numbers are not quoted unless they have to be.
      if (typeof value === 'string' && (value.includes(' ') || value.includes('\n') || value.includes('#') || value.includes('=') || value.startsWith('"') || value.endsWith('"'))) {
        envString += `${key}="${value.replace(/"/g, '\\"')}"\n`;
      } else {
        envString += `${key}=${value}\n`;
      }
    }
  }
  return envString;
}

/**
 * Writes a configuration object to the .env file.
 * @param config The configuration object to write.
 */
export function writeEnvFile(config: Record<string, string>): void {
  const envString = serializeEnv(config);
  fs.writeFileSync(ENV_FILE_PATH, envString, { encoding: 'utf8' });
}

// Define the keys that are managed by the setup/API for frontend configuration
export const MANAGED_ENV_KEYS = [
  'AI_SELECTED',
  'OPENAI_KEY',
  'OPENAI_ASSISTANT',
  'GEMINI_KEY',
  'GEMINI_PROMPT',
  'MAX_RETRIES',
  'MESSAGE_BUFFER_TIMEOUT_MS',
  'API_PORT',
];

export const MASKED_VALUE_PLACEHOLDER = '********'; // Using a simpler placeholder

/**
 * Masks sensitive values in a configuration object.
 * @param config The configuration object.
 * @returns A new configuration object with sensitive values masked.
 */
export function maskSensitiveValues(config: Record<string, string>): Record<string, string> {
  const maskedConfig = { ...config };
  const sensitiveKeys = ['OPENAI_KEY', 'GEMINI_KEY', 'OPENAI_ASSISTANT'];

  for (const key of sensitiveKeys) {
    if (maskedConfig[key] && maskedConfig[key].length > 0 && maskedConfig[key] !== MASKED_VALUE_PLACEHOLDER) {
      // Mask if it's set and not already the placeholder itself (e.g. from a previous masking)
      maskedConfig[key] = MASKED_VALUE_PLACEHOLDER;
    }
  }
  return maskedConfig;
}
