"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import katex from "katex";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrDraft, setOcrDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom whenever messages or streaming content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      // Read the stream chunk by chunk and update UI in real-time
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamingContent(full);
      }

      setMessages([...updatedMessages, { role: "assistant", content: full }]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: "Maaf, terjadi kesalahan. Coba lagi ya!" },
      ]);
    } finally {
      setStreamingContent("");
      setIsLoading(false);
      // Return focus to input after response completes
      inputRef.current?.focus();
    }
  }

  // Allow Shift+Enter for newline, Enter alone to send
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsOcrLoading(true);
    setOcrError("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "OCR gagal");
      setOcrDraft(data.latex as string);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "OCR gagal");
    } finally {
      setIsOcrLoading(false);
    }
  }

  function confirmOcr() {
    setInput((prev) => prev ? `${prev}\n\n$$${ocrDraft}$$` : `$$${ocrDraft}$$`);
    setOcrDraft("");
    inputRef.current?.focus();
  }

  function handleReset() {
    setMessages([]);
    setStreamingContent("");
    setInput("");
    setOcrDraft("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-green-700 leading-tight">
            Tutor Cerdas
          </h1>
          <p className="text-xs text-gray-500">Kak Ajar · Matematika &amp; IPA SMA</p>
        </div>
        <button
          onClick={handleReset}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          Sesi Baru
        </button>
      </header>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 pb-8">
            <div className="text-5xl">📚</div>
            <p className="text-base font-semibold text-gray-700">
              Hai! Aku Kak Ajar.
            </p>
            <p className="text-sm text-gray-500 max-w-xs">
              Ceritakan soal atau topik yang ingin kamu pelajari hari ini.
              Aku di sini untuk membantu kamu berpikir, bukan mengerjakan untukmu!
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Live streaming response */}
        {isLoading && streamingContent && (
          <AssistantBubble content={streamingContent} streaming />
        )}

        {/* Typing indicator before first token arrives */}
        {isLoading && !streamingContent && <TypingIndicator />}

        <div ref={bottomRef} />
      </main>

      {/* ── Input ── */}
      <div className="bg-white border-t border-gray-200 flex-shrink-0">
        {ocrError && (
          <p className="px-4 pt-2 text-xs text-red-500">{ocrError}</p>
        )}
        {ocrDraft && (
          <OcrReviewPanel
            draft={ocrDraft}
            onChange={setOcrDraft}
            onConfirm={confirmOcr}
            onRetake={() => fileInputRef.current?.click()}
            onCancel={() => setOcrDraft("")}
          />
        )}
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 px-4 py-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ketik pertanyaan atau soal di sini… (Enter untuk kirim)"
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-100 resize-none leading-relaxed"
            style={{ maxHeight: "8rem", overflowY: "auto" }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isOcrLoading}
            title="Unggah foto soal"
            className="px-3 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
          >
            {isOcrLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <CameraIcon />
            )}
          </button>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
          >
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-green-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }
  return <AssistantBubble content={message.content} />;
}

function AssistantBubble({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold select-none">
        KA
      </div>
      <div className="max-w-[80%] bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm text-sm leading-relaxed text-gray-800 break-words">
        <MarkdownContent content={content} />
        {streaming && (
          <span className="inline-block w-0.5 h-4 bg-green-500 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold select-none">
        KA
      </div>
      <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
        <div className="flex gap-1 items-center">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OcrReviewPanel({
  draft,
  onChange,
  onConfirm,
  onRetake,
  onCancel,
}: {
  draft: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onRetake: () => void;
  onCancel: () => void;
}) {
  const [showEdit, setShowEdit] = useState(false);

  let renderedHtml = "";
  let renderError = false;
  try {
    renderedHtml = katex.renderToString(draft, { displayMode: true, throwOnError: true });
  } catch {
    renderError = true;
  }

  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
      <p className="text-xs font-medium text-blue-700">Apakah formula ini sudah benar?</p>

      <div className="rounded-lg bg-white border border-blue-100 px-4 py-3 text-center overflow-x-auto">
        {renderError ? (
          <span className="text-xs text-red-500 font-mono">{draft}</span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowEdit((v) => !v)}
        className="text-xs text-blue-600 underline underline-offset-2"
      >
        {showEdit ? "Sembunyikan kode" : "Edit kode LaTeX"}
      </button>

      {showEdit && (
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="text-xs px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-100 transition-colors"
        >
          Foto ulang
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Gunakan formula ini
        </button>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

// Renders markdown with minimal inline styling — no extra packages needed
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => (
          <ul className="list-disc ml-4 mb-2 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal ml-4 mb-2 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-green-400 pl-3 text-gray-600 italic my-2">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
