import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Proves that an assistant turn sent back by the browser was really written by
 * this server. The chat is stateless — the client resends the whole history on
 * every question — so without this anyone could post a fabricated "assistant"
 * reply that already broke the rules (revealed the prompt, answered off-topic)
 * and nudge the model into carrying on from it.
 *
 * Each reply is signed together with the question it answered, so a genuine
 * reply can't be moved next to a different question either. Turns that don't
 * verify are dropped before the history reaches the model.
 *
 * CHAT_SIGNING_SECRET should be set when more than one instance serves the
 * app. Unset, each process makes its own random key: fine for a single
 * instance, and a restart only means earlier replies stop counting as context.
 */

/** Separates the reply text from its signature at the end of the stream. A
 *  control character, so it never appears in normal model output — and it is
 *  stripped from the model's text anyway before signing. */
export const SIGNATURE_SEPARATOR = "\u001e";

const globalForKey = globalThis as unknown as { jaiaChatSigningKey?: Buffer };

function signingKey(): Buffer {
  const configured = process.env.CHAT_SIGNING_SECRET?.trim();
  if (configured) return Buffer.from(configured, "utf8");
  if (!globalForKey.jaiaChatSigningKey) {
    globalForKey.jaiaChatSigningKey = randomBytes(32);
  }
  return globalForKey.jaiaChatSigningKey;
}

function digest(question: string, reply: string): Buffer {
  return createHmac("sha256", signingKey())
    .update(JSON.stringify([question.trim(), reply.trim()]))
    .digest();
}

export function signReply(question: string, reply: string): string {
  return digest(question, reply).toString("base64url");
}

export function verifyReply(question: string, reply: string, signature: string): boolean {
  const given = Buffer.from(signature, "base64url");
  const expected = digest(question, reply);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
