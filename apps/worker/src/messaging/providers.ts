import { ResendEmailProvider } from "./resend";
import { TwilioSmsProvider } from "./twilio";
import type { EmailProvider, SmsProvider } from "./types";

// Constructed lazily on first send, not at import time, so a worker
// without real Resend/Twilio credentials can still boot and process
// non-messaging jobs — only actually sending requires the keys.
let emailProvider: EmailProvider | undefined;
export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
    emailProvider = new ResendEmailProvider(apiKey);
  }
  return emailProvider;
}

let smsProvider: SmsProvider | undefined;
export function getSmsProvider(): SmsProvider {
  if (!smsProvider) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not set.");
    }
    smsProvider = new TwilioSmsProvider(accountSid, authToken);
  }
  return smsProvider;
}
