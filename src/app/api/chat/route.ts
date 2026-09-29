import OpenAI from "openai";
import { ASSISTANT_SYSTEM_PROMPT } from "@/data/documentContext";
import { SIGNATURE_SEPARATOR, signReply, verifyReply } from "@/lib/chatSignature";
import {
  checkRateLimit,
  clientKey,
  describeWait,
  numberFromEnv,
  rateLimitHeaders,
  recordHit,
} from "@/lib/rateLimit";

// Needs the Node.js runtime for the OpenAI SDK.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "user" | "assistant";
type ChatMessage = { role: Role; content: string };

const MAX_MESSAGES = 20;
const MAX_CONTENT_CHARS = 6000;

// Configurable so any OpenAI-compatible endpoint can be used:
//   MODEL_API_KEY / OPENAI_API_KEY  – API key (required for hosted providers; a
//                      keyless local server can be reached via OPENAI_BASE_URL).
//   OPENAI_BASE_URL  – e.g. https://api.openai.com/v1 (default), an Azure
//                      ".../openai/v1" URL, or http://localhost:11434/v1 (Ollama).
//   MODEL / OPENAI_MODEL – model / deployment name understood by that endpoint.
const API_KEY = process.env.MODEL_API_KEY || process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL;
const MODEL = process.env.MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

// Reasoning models (e.g. GLM) spend most of their output budget on hidden
// reasoning before the visible answer, so give a generous ceiling.
const MAX_OUTPUT_TOKENS = Number(process.env.MODEL_MAX_TOKENS) || 4096;

// How many questions one visitor can have answered in a rolling window.
// CHAT_RATE_LIMIT=0 turns the limit off entirely.
// An unset or blank value keeps the default; an explicit 0 disables the limit.
const RATE_LIMIT = numberFromEnv(process.env.CHAT_RATE_LIMIT, 15);
const RATE_WINDOW_HOURS = numberFromEnv(process.env.CHAT_RATE_WINDOW_HOURS, 24) || 24;
const RATE_WINDOW_MS = RATE_WINDOW_HOURS * 60 * 60 * 1000;

function sanitize(messages: unknown): ChatMessage[] | null {
  if (!Array.isArray(messages)) return null;
  const cleaned: ChatMessage[] = [];
  // The question an assistant turn must have been signed against.
  let question: string | null = null;
  for (const m of messages) {
    if (
      !m ||
      typeof m !== "object" ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string" ||
      (m.sig !== undefined && typeof m.sig !== "string")
    ) {
      return null;
    }
    const text = m.content.trim();
    if (text.length === 0) continue;
    if (m.role === "user") {
      const content = text.slice(0, MAX_CONTENT_CHARS);
      question = content;
      cleaned.push({ role: "user", content });
      continue;
    }
    // Only replies this server wrote, for the question just before them, are
    // kept as history; anything else is dropped rather than shown to the model.
    // Verified before truncation, since the full reply is what was signed.
    const genuine =
      question !== null &&
      typeof m.sig === "string" &&
      verifyReply(question, text, m.sig);
    question = null;
    if (genuine) {
      cleaned.push({ role: "assistant", content: text.slice(0, MAX_CONTENT_CHARS) });
    }
  }
  const trimmed = cleaned.slice(-MAX_MESSAGES);
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  // The request has to end with the new question.
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== "user") return null;
  return trimmed;
}

export async function POST(req: Request) {
  // Cap how many answers one visitor can pull from the model per window.
  // Checked (not spent) up front — a question only costs a slot once the
  // model has actually accepted it below.
  const limitKey = clientKey(req, "chat");
  const limited = RATE_LIMIT > 0;
  if (limited) {
    const state = checkRateLimit(limitKey, RATE_LIMIT, RATE_WINDOW_MS);
    if (!state.allowed) {
      return Response.json(
        {
          error: `You've reached the limit of ${RATE_LIMIT} questions per ${RATE_WINDOW_HOURS} hours. Please try again ${describeWait(state.retryAfterSeconds)}.`,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(state),
            "Retry-After": String(state.retryAfterSeconds),
          },
        },
      );
    }
  }

  // A custom base URL (self-hosted / local server) may not need a key.
  if (!API_KEY && !BASE_URL) {
    return Response.json(
      {
        error:
          "The assistant isn't configured yet. Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL / OPENAI_MODEL) to enable it.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messages = sanitize((body as { messages?: unknown })?.messages);
  if (!messages) {
    return Response.json({ error: "No valid messages provided." }, { status: 400 });
  }

  const client = new OpenAI({
    apiKey: API_KEY || "not-needed",
    baseURL: BASE_URL,
  });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
      stream: true,
      messages: [
        { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
        ...messages,
      ],
    });
  } catch (err) {
    console.error("Chat request error:", err);
    return Response.json(
      { error: "The assistant is unavailable right now. Please try again." },
      { status: 502 },
    );
  }

  // The model accepted the request, so this question costs the caller a slot.
  const state = limited
    ? recordHit(limitKey, RATE_LIMIT, RATE_WINDOW_MS)
    : null;

  const question = messages[messages.length - 1].content;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let reply = "";
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content?.replaceAll(SIGNATURE_SEPARATOR, "");
          if (delta) {
            reply += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
        // Only a reply that finished cleanly is signed, so the client can send
        // it back as history on the next question. See lib/chatSignature.
        if (reply.trim()) {
          controller.enqueue(
            encoder.encode(SIGNATURE_SEPARATOR + signReply(question, reply)),
          );
        }
      } catch (err) {
        console.error("Chat stream error:", err);
        controller.enqueue(
          encoder.encode(
            "\n\n[The assistant ran into an error. Please try again.]",
          ),
        );
      } finally {
        controller.close();
      }
    },
    cancel() {
      completion.controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(state ? rateLimitHeaders(state) : {}),
    },
  });
}
