// Provider-agnostic messaging contract (per CLAUDE.md: "Providers are
// swappable by contract, not by config flag"). Sequence processing only
// ever talks to these interfaces — swapping Resend/Twilio for another
// vendor means writing one new class, no changes to sequence logic.

export interface SendResult {
  providerMessageId: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<SendResult>;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<SendResult>;
}
