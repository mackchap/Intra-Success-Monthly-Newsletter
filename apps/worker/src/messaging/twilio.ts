import twilio from "twilio";
import type { SendResult, SmsMessage, SmsProvider } from "./types";

export class TwilioSmsProvider implements SmsProvider {
  private client: ReturnType<typeof twilio>;

  constructor(accountSid: string, authToken: string) {
    this.client = twilio(accountSid, authToken);
  }

  async send(message: SmsMessage): Promise<SendResult> {
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!from) {
      throw new Error("TWILIO_FROM_NUMBER is not set.");
    }

    const result = await this.client.messages.create({
      from,
      to: message.to,
      body: message.body,
    });

    return { providerMessageId: result.sid };
  }
}
