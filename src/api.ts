```typescript
import express, { Request, Response, Router } from 'express';
import cors from 'cors';
import { logger } from './index.js'; // Corrected import path
import { readEnvFile, writeEnvFile, MANAGED_ENV_KEYS, MASKED_VALUE_PLACEHOLDER } from './util/envHelper.js';
import WhatsAppService from './util/whatsappService.js';

const app: Express = express();
const router = Router();

// Middleware
app.use(cors());
app.use(express.json());

// Status endpoint
router.get('/status/service', (req: Request, res: Response) => {
  // For now, in dev mode, if the API is running, the service is conceptually running.
  // This will be enhanced later to check actual PM2 status.
  res.json({ status: 'running_dev_mode', message: 'Zap-GPT service is active (development mode).' });
});

// WhatsApp Status endpoint
router.get('/status/whatsapp', (req: Request, res: Response) => {
  const status = WhatsAppService.getStatus();
  res.json(status);
});

// Config endpoints
router.get('/config', (req: Request, res: Response) => {
  try {
    const currentEnv = readEnvFile();
    const configToSend: Record<string, string> = {};
    MANAGED_ENV_KEYS.forEach(key => {
      if (currentEnv[key] !== undefined) {
        configToSend[key] = currentEnv[key];
      }
    });
    res.json(maskSensitiveValues(configToSend));
  } catch (error) {
    logger.error(error, 'Error reading config file');
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

router.post('/config', (req: Request, res: Response) => {
  try {
    const currentEnv = readEnvFile();
    const newConfigData = { ...currentEnv }; // Start with all existing values
    let changesMade = false;

    for (const key of MANAGED_ENV_KEYS) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) { // Check if key is in request body
        const newValue = String(req.body[key]); // Ensure value is string

        // Security: Do not update API keys if placeholder value is sent
        if (
          (key === 'OPENAI_KEY' || key === 'GEMINI_KEY' || key === 'OPENAI_ASSISTANT') &&
          newValue === MASKED_VALUE_PLACEHOLDER
        ) {
          // If placeholder is sent, it means "do not change this key"
          // So, we ensure the existing value from currentEnv is preserved if it exists
          // or it remains unset if it wasn't in currentEnv.
          // newConfigData will already have currentEnv[key] due to {...currentEnv}
          // so no action needed here to preserve it.
          continue;
        }

        // Basic validation example (can be expanded)
        if (key === 'AI_SELECTED' && !['GPT', 'GEMINI'].includes(newValue)) {
          return res.status(400).json({ error: `Invalid value for ${key}` });
        }
        if ((key === 'MAX_RETRIES' || key === 'MESSAGE_BUFFER_TIMEOUT_MS' || key === 'API_PORT')) {
            const numValue = parseInt(newValue, 10);
            if (isNaN(numValue) || numValue < 0) {
                 return res.status(400).json({ error: `${key} must be a non-negative number` });
            }
        }

        if (newConfigData[key] !== newValue) {
            newConfigData[key] = newValue;
            changesMade = true;
        }
      }
    }

    if (changesMade) {
      writeEnvFile(newConfigData);
      // Re-read and mask for response, ensuring consistency
      const updatedEnv = readEnvFile();
      const configToSend: Record<string, string> = {};
      MANAGED_ENV_KEYS.forEach(key => {
        if (updatedEnv[key] !== undefined) {
          configToSend[key] = updatedEnv[key];
        }
      });
      // Ensure that keys not present in updatedEnv but were in MANAGED_ENV_KEYS are not sent
      // Or, if they were deleted by the logic (e.g., switching AI type), they should not be present
      const finalConfigToSend = Object.keys(configToSend).reduce((acc, key) => {
        if (MANAGED_ENV_KEYS.includes(key) && updatedEnv[key] !== undefined) {
            acc[key] = updatedEnv[key];
        }
        return acc;
      }, {} as Record<string, string>);

      res.json({ message: 'Configuration updated successfully', config: maskSensitiveValues(finalConfigToSend) });
    } else {
      // Even if no changes, return the current masked config
      const configToSend: Record<string, string> = {};
       for (const key of MANAGED_ENV_KEYS) {
        if (currentEnv[key] !== undefined) {
          configToSend[key] = currentEnv[key];
        }
      }
      res.json({ message: 'No changes applied to configuration', config: maskSensitiveValues(configToSend) });
    }
  } catch (error) {
    logger.error(error, 'Error writing config file');
    res.status(500).json({ error: 'Failed to write configuration' });
  }
});

app.use('/api', router);

export const startApiServer = (port: number) => {
  app.listen(port, () => {
    logger.info(`API Server listening on port ${port}`);
  });
  return app; // Return app for testing or other uses
};
```
This will recreate `src/api.ts` with the correct imports and endpoint definitions.

Next, I'll recreate `src/index.ts` to ensure it's also correct.
