"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

const STARTERS = [
  "What are the nine policy pillars?",
  "What should happen in the first 1–3 years?",
  "How does the report address the skills gap?",
  "What are Jamaica's main A.I. opportunities and threats?",
];

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    const history: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(history);
    setInput("");
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "The assistant is unavailable right now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
    } catch (err) {
      // Drop the empty assistant placeholder and surface the error.
      setMessages((m) => {
        const next = [...m];
        if (next.length && next[next.length - 1].content === "") next.pop();
        return next;
      });
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-jm-line bg-jm-ink">
      <div
        ref={scrollRef}
        className="h-[min(60vh,520px)] overflow-y-auto px-5 py-6 sm:px-6"
      >
        {empty ? (
          <div className="mx-auto max-w-xl py-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-jm-line bg-jm-black text-jm-gold">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 8V4M8 8h8a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6a2 2 0 012-2zM9 14h.01M15 14h.01M2 13h2M20 13h2" />
              </svg>
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
              Ask about the recommendations
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-jm-muted">
              Ask a question about Jamaica&apos;s National A.I. Policy
              Recommendations — the nine pillars, the action plan, the SWOT
              analysis, or the ethical foundations.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-lg border border-jm-line bg-jm-black px-4 py-3 text-left text-sm text-jm-muted transition-colors hover:border-jm-gold/40 hover:text-jm-text"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m, i) => (
              <ChatBubble
                key={i}
                role={m.role}
                content={m.content}
                pending={
                  streaming &&
                  i === messages.length - 1 &&
                  m.role === "assistant" &&
                  m.content === ""
                }
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-jm-line/70 bg-jm-black/40 px-5 py-3 text-sm text-jm-gold-soft sm:px-6">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-jm-line/70 bg-jm-black/40 p-3 sm:p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask a question about the report…"
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-lg border border-jm-line bg-jm-ink px-3 py-2.5 text-sm text-jm-text placeholder:text-jm-muted/60 focus:border-jm-gold/50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-jm-gold text-jm-black transition-colors hover:bg-jm-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
      <p className="border-t border-jm-line/70 px-4 py-2 text-center text-[11px] text-jm-muted">
        A.I. responses are generated from the report and may contain mistakes —
        verify important details against the full document.
      </p>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  pending,
}: {
  role: Role;
  content: string;
  pending: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "whitespace-pre-wrap bg-jm-gold text-jm-black"
            : "border border-jm-line bg-jm-black text-jm-text"
        }`}
      >
        {pending ? (
          <span className="inline-flex items-center gap-2 py-1 text-jm-muted" aria-label="Thinking">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jm-muted [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jm-muted [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jm-muted" />
            </span>
            <span className="text-xs">Thinking…</span>
          </span>
        ) : isUser ? (
          content
        ) : (
          <Markdown>{content}</Markdown>
        )}
      </div>
    </div>
  );
}
