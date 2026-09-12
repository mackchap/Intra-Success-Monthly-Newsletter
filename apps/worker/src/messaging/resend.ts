import { Resend } from "resend";
import type { EmailMessage, EmailProvider, SendResult } from "./types";

export class ResendEmailProvider implements EmailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const from = process.env.EMAIL_FROM ?? "no-reply@example.com";

    const { data, error } = await this.client.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.body,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "Resend returned no data.");
    }

    return { providerMessageId: data.id };
  }
}
