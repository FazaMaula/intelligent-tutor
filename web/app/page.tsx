"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string;
};

// ─── Logging ──────────────────────────────────────────────────────────────────

function logTurn(sessionId: string, turn: number, role: "user" | "assistant", content: string) {
  fetch("/api/log/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, turn_number: turn, role, content }),
  }).catch(() => {});
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const turnNumberRef = useRef(0);
  const [studentInfo, setStudentInfo] = useState<{ nama: string; nomorInduk: string } | null>(null);

  // Auto-scroll to bottom whenever messages or streaming content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function startLoggingSession(nama: string, nomorInduk: string) {
    fetch("/api/log/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "web", client_type: "web", nama_lengkap: nama, nomor_induk: nomorInduk }),
    })
      .then((r) => r.json())
      .then((d) => { sessionIdRef.current = d.session_id; })
      .catch(() => {});
  }

  function handleStudentInfoSubmit(nama: string, nomorInduk: string) {
    setStudentInfo({ nama, nomorInduk });
    startLoggingSession(nama, nomorInduk);
  }

  // End the session when the tab/window closes
  useEffect(() => {
    function onUnload() {
      if (!sessionIdRef.current) return;
      navigator.sendBeacon(
        "/api/log/session/end",
        new Blob(
          [JSON.stringify({ session_id: sessionIdRef.current })],
          { type: "application/json" }
        )
      );
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

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

    const sid = sessionIdRef.current;
    const userTurn = ++turnNumberRef.current;
    if (sid) logTurn(sid, userTurn, "user", text);

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
      if (sid) logTurn(sid, ++turnNumberRef.current, "assistant", full);
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

  function handleReset() {
    if (sessionIdRef.current) {
      fetch("/api/log/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionIdRef.current }),
      }).catch(() => {});
    }
    if (studentInfo) startLoggingSession(studentInfo.nama, studentInfo.nomorInduk);
    turnNumberRef.current = 0;
    setMessages([]);
    setStreamingContent("");
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      {studentInfo === null && (
        <StudentInfoModal onSubmit={handleStudentInfoSubmit} />
      )}
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
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 px-4 py-3"
        >
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

function StudentInfoModal({ onSubmit }: { onSubmit: (nama: string, nomorInduk: string) => void }) {
  const [nama, setNama] = useState("");
  const [nomorInduk, setNomorInduk] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = nama.trim();
    const ni = nomorInduk.trim();
    if (!n || !ni) return;
    onSubmit(n, ni);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">📚</div>
          <h2 className="text-base font-bold text-gray-800">Selamat Datang!</h2>
          <p className="text-sm text-gray-500 mt-1">
            Masukkan identitasmu sebelum mulai belajar.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Nama Lengkap
            </label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Nomor Induk Siswa
            </label>
            <input
              type="text"
              value={nomorInduk}
              onChange={(e) => setNomorInduk(e.target.value)}
              placeholder="Contoh: 1234567890"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <button
            type="submit"
            disabled={!nama.trim() || !nomorInduk.trim()}
            className="w-full mt-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Mulai Belajar
          </button>
        </form>
      </div>
    </div>
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
