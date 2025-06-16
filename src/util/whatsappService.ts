// Using util directory as it seems more appropriate for a helper service
import { Whatsapp } from '@wppconnect-team/wppconnect';
import { logger } from '../index'; // Assuming logger is exported from index.ts

export interface WhatsAppState {
  status: string;
  qrCode: string | null;
  message: string | null;
  sessionName?: string;
  error?: any; // To store error details if any
}

class WhatsAppService {
  private static clientInstance: Whatsapp | null = null;
  private static currentState: WhatsAppState = {
    status: 'initializing',
    qrCode: null,
    message: 'Service is starting...',
  };

  static updateStatus(newState: Partial<WhatsAppState>): void {
    this.currentState = { ...this.currentState, ...newState };
    logger.info({ whatsappStatus: this.currentState }, 'WhatsApp status updated');
  }

  static getStatus(): WhatsAppState {
    return this.currentState;
  }

  static setClient(client: Whatsapp): void {
    this.clientInstance = client;
    // You might want to update status here as well, e.g., to 'client_ready'
    // For now, keeping it simple as per requirements.
  }

  static getClient(): Whatsapp | null {
    return this.clientInstance;
  }
}

export default WhatsAppService;
