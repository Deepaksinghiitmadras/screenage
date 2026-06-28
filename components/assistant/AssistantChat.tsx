"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
    Sparkles,
    Send,
    Plus,
    Loader2,
    MessageSquare,
    Bot,
    User,
    Pencil,
    Trash2,
    Check,
    X,
} from "lucide-react";
import {
    sendAssistantMessage,
    getConversation,
    listConversations,
    deleteConversation,
    renameConversation,
} from "@/lib/actions/assistant.actions";
import MarkdownLite from "@/components/ui/MarkdownLite";

type Msg = { role: "user" | "assistant"; content: string };
type ConvoSummary = { _id: string; title: string; updatedAt: string };

const LANGUAGES = [
    "English",
    "Hindi",
    "Bengali",
    "Tamil",
    "Telugu",
    "Marathi",
    "Gujarati",
    "Kannada",
    "Malayalam",
    "Punjabi",
];

const SUGGESTIONS = [
    "Analyse TCS — fundamentals and technicals",
    "Compare HDFC Bank vs ICICI Bank",
    "Find undervalued large caps with high ROE",
    "Is NIFTY put-heavy right now? What's the max pain?",
];

export default function AssistantChat({
    userId,
    initialConversations,
    embedded = false,
}: {
    userId: string;
    initialConversations: ConvoSummary[];
    embedded?: boolean;
}) {
    const [conversations, setConversations] = useState<ConvoSummary[]>(initialConversations);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [followups, setFollowups] = useState<string[]>([]);
    const [input, setInput] = useState("");
    const [language, setLanguage] = useState("English");
    const [isPending, startTransition] = useTransition();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, isPending]);

    const openConversation = (id: string) => {
        setActiveId(id);
        setFollowups([]);
        startTransition(async () => {
            const c = await getConversation(id, userId);
            setMessages(c ? c.messages.map((m) => ({ role: m.role, content: m.content })) : []);
        });
    };

    const newChat = () => {
        setActiveId(null);
        setMessages([]);
        setFollowups([]);
        setInput("");
    };

    const send = (text: string) => {
        const content = text.trim();
        if (!content || isPending) return;
        setInput("");
        setFollowups([]);
        setMessages((prev) => [...prev, { role: "user", content }]);
        startTransition(async () => {
            const res = await sendAssistantMessage(activeId, userId, content, language);
            setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
            setFollowups(res.followups ?? []);
            if (!activeId) {
                setActiveId(res.conversationId);
                const list = await listConversations(userId);
                setConversations(list as ConvoSummary[]);
            }
        });
    };

    const onDelete = (id: string) => {
        startTransition(async () => {
            await deleteConversation(id, userId);
            setConversations((prev) => prev.filter((c) => c._id !== id));
            if (activeId === id) newChat();
        });
    };

    const startRename = (c: ConvoSummary) => {
        setEditingId(c._id);
        setEditTitle(c.title);
    };

    const commitRename = (id: string) => {
        const title = editTitle.trim();
        setEditingId(null);
        if (!title) return;
        setConversations((prev) => prev.map((c) => (c._id === id ? { ...c, title } : c)));
        startTransition(async () => {
            await renameConversation(id, userId, title);
        });
    };

    return (
        <div className={`flex w-full gap-4 ${embedded ? "h-[calc(100vh-220px)]" : "mx-auto h-[calc(100vh-120px)] max-w-6xl p-4 md:p-6"}`}>
            {/* Sidebar */}
            <aside className="hidden w-60 shrink-0 flex-col rounded-lg border border-gray-700/60 bg-gray-800/40 p-3 md:flex">
                <button
                    onClick={newChat}
                    className="mb-3 flex items-center justify-center gap-2 rounded-md bg-teal-500/20 px-3 py-2 text-sm font-medium text-teal-300 hover:bg-teal-500/30"
                >
                    <Plus className="h-4 w-4" /> New chat
                </button>
                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 && <p className="px-1 text-xs text-gray-500">No conversations yet.</p>}
                    {conversations.map((c) => (
                        <div
                            key={c._id}
                            className={`group mb-1 flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                                activeId === c._id ? "bg-gray-700/60 text-gray-100" : "text-gray-400 hover:bg-gray-700/40"
                            }`}
                        >
                            {editingId === c._id ? (
                                <>
                                    <input
                                        autoFocus
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") commitRename(c._id);
                                            if (e.key === "Escape") setEditingId(null);
                                        }}
                                        className="min-w-0 flex-1 rounded bg-gray-900/80 px-1.5 py-1 text-xs text-gray-100 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                                    />
                                    <button onClick={() => commitRename(c._id)} className="text-teal-400 hover:text-teal-300">
                                        <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => openConversation(c._id)}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    >
                                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                        <span className="line-clamp-1">{c.title}</span>
                                    </button>
                                    <button
                                        onClick={() => startRename(c)}
                                        className="shrink-0 text-gray-500 opacity-0 hover:text-teal-300 group-hover:opacity-100"
                                        title="Rename"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(c._id)}
                                        className="shrink-0 text-gray-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Chat panel */}
            <div className="flex flex-1 flex-col rounded-lg border border-gray-700/60 bg-gray-800/40">
                <div className="flex items-center gap-2 border-b border-gray-700/60 px-4 py-3">
                    <Sparkles className="h-5 w-5 text-teal-400" />
                    <h2 className="text-base font-semibold text-gray-100">Research Assistant</h2>
                    <div className="ml-auto flex items-center gap-3">
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            title="Reply language"
                            className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                        >
                            {LANGUAGES.map((l) => (
                                <option key={l} value={l}>{l}</option>
                            ))}
                        </select>
                        <span className="hidden text-[11px] text-gray-500 lg:block">Grounded in delayed data · not investment advice</span>
                    </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
                    {messages.length === 0 && !isPending && (
                        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                            <Bot className="h-10 w-10 text-teal-400/70" />
                            <p className="max-w-sm text-sm text-gray-400">
                                Ask me to analyse a stock, compare peers, screen the market, or read the option chain.
                            </p>
                            <div className="flex max-w-lg flex-wrap justify-center gap-2">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => send(s)}
                                        className="rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-xs text-gray-300 hover:border-teal-500/40 hover:text-teal-300"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-gray-600" : "bg-teal-500/20"}`}>
                                    {m.role === "user" ? <User className="h-4 w-4 text-gray-200" /> : <Bot className="h-4 w-4 text-teal-300" />}
                                </div>
                                <div
                                    className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                                        m.role === "user"
                                            ? "whitespace-pre-wrap bg-gray-700 text-gray-100"
                                            : "bg-gray-900/60 text-gray-200"
                                    }`}
                                >
                                    {m.role === "user" ? m.content : <MarkdownLite content={m.content} />}
                                </div>
                            </div>
                        ))}

                        {/* Follow-up suggestions after the latest assistant reply */}
                        {!isPending && followups.length > 0 && (
                            <div className="ml-10 flex flex-wrap gap-2">
                                {followups.map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => send(q)}
                                        className="rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-xs text-gray-300 hover:border-teal-500/40 hover:text-teal-300"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}
                        {isPending && (
                            <div className="flex gap-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/20">
                                    <Bot className="h-4 w-4 text-teal-300" />
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-gray-900/60 px-3.5 py-2.5 text-sm text-gray-400">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Input */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        send(input);
                    }}
                    className="flex items-center gap-2 border-t border-gray-700/60 p-3"
                >
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about a stock, screen the market, or check options…"
                        className="flex-1 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                    />
                    <button
                        type="submit"
                        disabled={isPending || !input.trim()}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 disabled:opacity-50"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
