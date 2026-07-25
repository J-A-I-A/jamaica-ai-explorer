import OpenAI from "openai";
import { ASSISTANT_SYSTEM_PROMPT } from "@/data/documentContext";

// Needs the Node.js runtime for the OpenAI SDK.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "user" | "assistant";
type IncomingMessage = { role: Role; content: string };

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

function sanitize(messages: unknown): IncomingMessage[] | null {
  if (!Array.isArray(messages)) return null;
  const cleaned: IncomingMessage[] = [];
  for (const m of messages) {
    if (
      !m ||
      typeof m !== "object" ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string"
    ) {
      return null;
    }
    const content = m.content.trim().slice(0, MAX_CONTENT_CHARS);
    if (content.length === 0) continue;
    cleaned.push({ role: m.role, content });
  }
  const trimmed = cleaned.slice(-MAX_MESSAGES);
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  if (trimmed.length === 0) return null;
  return trimmed;
}

export async function POST(req: Request) {
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
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
    },
  });
}
