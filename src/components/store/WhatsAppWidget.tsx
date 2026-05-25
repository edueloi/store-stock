import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, ChevronRight, MessageCircle, Check, CheckCheck } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface FAQ {
  question: string;
  answer: string;
  whatsappText?: string;
}

interface WhatsAppWidgetProps {
  whatsapp: string;
  storeName: string;
  primaryColor?: string;
  faqs?: FAQ[];
}

// ── Default FAQs ───────────────────────────────────────────────────────────

const DEFAULT_FAQS: FAQ[] = [
  {
    question: "Como faço um pedido?",
    answer: "É simples! Adicione os produtos ao carrinho, clique em 'Fechar via WhatsApp' e enviaremos sua lista direto para nosso atendimento.",
    whatsappText: "Olá! Gostaria de saber como fazer um pedido.",
  },
  {
    question: "Quais formas de pagamento?",
    answer: "Aceitamos Pix, transferência, dinheiro e cartão — dependendo da modalidade de entrega. Consulte nosso atendimento para mais detalhes.",
    whatsappText: "Olá! Quais são as formas de pagamento disponíveis?",
  },
  {
    question: "Vocês fazem entrega?",
    answer: "Sim! Trabalhamos com entrega local e envio por transportadora. O frete é calculado conforme seu endereço.",
    whatsappText: "Olá! Gostaria de saber sobre entrega e frete.",
  },
  {
    question: "Como verificar disponibilidade de estoque?",
    answer: "Todos os produtos listados estão disponíveis. Para grades/variações específicas, confirme pelo WhatsApp antes de finalizar.",
    whatsappText: "Olá! Gostaria de verificar a disponibilidade de um produto.",
  },
  {
    question: "Política de troca e devolução",
    answer: "Aceitamos trocas em até 7 dias após o recebimento, desde que o produto esteja em perfeitas condições e na embalagem original.",
    whatsappText: "Olá! Gostaria de saber sobre a política de trocas e devoluções.",
  },
  {
    question: "Falar com atendente",
    answer: "",
    whatsappText: "Olá! Gostaria de falar com um atendente.",
  },
];

// ── Message type ───────────────────────────────────────────────────────────

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
  time: string;
  read?: boolean;
}

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WhatsAppWidget({
  whatsapp,
  storeName,
  primaryColor = "#25D366",
  faqs = DEFAULT_FAQS,
}: WhatsAppWidgetProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"greeting" | "name" | "chat">("greeting");
  const [userName, setUserName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showFaqs, setShowFaqs] = useState(true);
  const [pulse, setPulse] = useState(true);
  const [unread, setUnread] = useState(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const msgId = useRef(0);

  // Stop pulsing after 8s
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus name input when step changes
  useEffect(() => {
    if (step === "name") setTimeout(() => nameInputRef.current?.focus(), 100);
  }, [step]);

  const addMsg = (from: "bot" | "user", text: string) => {
    msgId.current += 1;
    setMessages((prev) => [...prev, { id: msgId.current, from, text, time: now() }]);
  };

  const openChat = () => {
    setOpen(true);
    setUnread(0);
    if (step === "greeting") {
      setTimeout(() => {
        addMsg("bot", `Olá! 👋 Seja bem-vindo(a) à *${storeName}*!`);
        setTimeout(() => addMsg("bot", "Antes de começar, qual é o seu nome?"), 800);
        setTimeout(() => setStep("name"), 900);
      }, 300);
    }
  };

  const submitName = () => {
    const name = nameInput.trim();
    if (!name) return;
    setUserName(name);
    setNameInput("");
    addMsg("user", name);
    setTimeout(() => {
      addMsg("bot", `Prazer, *${name}*! 😊 Como posso te ajudar hoje?`);
      setTimeout(() => {
        addMsg("bot", "Escolha uma das opções abaixo ou me conta sua dúvida:");
        setStep("chat");
        setShowFaqs(true);
      }, 600);
    }, 500);
  };

  const handleFaq = (faq: FAQ) => {
    setShowFaqs(false);
    addMsg("user", faq.question);

    if (!faq.answer) {
      // "Falar com atendente" — go straight to WhatsApp
      setTimeout(() => {
        addMsg("bot", "Ótimo! Vou te conectar com nossa equipe agora. 🚀");
        setTimeout(() => {
          const text = encodeURIComponent(
            `Olá! Sou ${userName || "cliente"} e gostaria de falar com um atendente.`
          );
          window.open(`https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${text}`, "_blank");
        }, 800);
      }, 500);
      return;
    }

    setTimeout(() => {
      addMsg("bot", faq.answer);
      setTimeout(() => {
        addMsg("bot", "Isso respondeu sua dúvida? Posso te ajudar com mais alguma coisa?");
        setShowFaqs(true);
      }, 800);
    }, 600);
  };

  const goToWhatsApp = (text?: string) => {
    const greeting = userName ? `Olá! Sou ${userName}.` : "Olá!";
    const msg = text
      ? `${greeting} ${text}`
      : `${greeting} Gostaria de mais informações sobre ${storeName}.`;
    window.open(
      `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3">
        {/* Greeting bubble */}
        <AnimatePresence>
          {!open && pulse && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              className="bg-white border border-slate-200 rounded-2xl rounded-br-sm shadow-xl px-4 py-2.5 max-w-[200px] text-right"
            >
              <p className="text-[11px] font-bold text-slate-800 leading-snug">
                Precisa de ajuda? 👋
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Fale com a gente!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Button */}
        <motion.button
          onClick={open ? () => setOpen(false) : openChat}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.93 }}
          style={{ backgroundColor: open ? "#64748b" : "#25D366" }}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-colors relative"
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                <X size={22} />
              </motion.span>
            ) : (
              <motion.span key="wpp" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </motion.span>
            )}
          </AnimatePresence>

          {/* Unread badge */}
          {!open && unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
              {unread}
            </span>
          )}

          {/* Pulse ring */}
          {!open && pulse && (
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
          )}
        </motion.button>
      </div>

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="fixed bottom-24 right-6 z-[89] w-[340px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            style={{ maxHeight: "min(520px, calc(100vh - 120px))" }}
          >
            {/* Header */}
            <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-black text-lg shrink-0">
                {storeName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-none truncate">{storeName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full" />
                  <p className="text-[10px] text-white/70 font-medium">Online agora</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Background pattern */}
            <div
              className="flex-1 overflow-y-auto px-3 py-4 space-y-2 min-h-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.5'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundColor: "#e5ddd5",
              }}
            >
              {/* Messages */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex", msg.from === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] px-3 py-2 rounded-2xl shadow-sm text-xs leading-relaxed",
                      msg.from === "bot"
                        ? "bg-white text-slate-800 rounded-tl-sm"
                        : "bg-[#dcf8c6] text-slate-800 rounded-tr-sm"
                    )}
                  >
                    <p
                      dangerouslySetInnerHTML={{
                        __html: msg.text.replace(/\*(.*?)\*/g, "<strong>$1</strong>"),
                      }}
                    />
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[9px] text-slate-400">{msg.time}</span>
                      {msg.from === "user" && (
                        <CheckCheck size={11} className="text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* FAQ chips */}
              {step === "chat" && showFaqs && (
                <div className="space-y-1.5 pt-1">
                  {faqs.map((faq, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleFaq(faq)}
                      className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-[#25D366] hover:bg-green-50 transition-all group"
                    >
                      <span className="text-[11px] font-semibold text-slate-700 group-hover:text-[#075E54] leading-snug">
                        {faq.question}
                      </span>
                      <ChevronRight size={13} className="text-slate-400 group-hover:text-[#25D366] shrink-0" />
                    </motion.button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Name Input */}
            {step === "name" && (
              <div className="px-3 py-2.5 bg-white border-t border-slate-100 flex gap-2 shrink-0">
                <input
                  ref={nameInputRef}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitName()}
                  placeholder="Digite seu nome..."
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#25D366] focus:ring-2 focus:ring-green-100 transition-all"
                />
                <button
                  onClick={submitName}
                  disabled={!nameInput.trim()}
                  className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#1db954] transition-colors"
                >
                  <Send size={15} />
                </button>
              </div>
            )}

            {/* Footer CTA */}
            {step === "chat" && (
              <div className="px-3 py-2.5 bg-white border-t border-slate-100 shrink-0">
                <button
                  onClick={() => goToWhatsApp()}
                  className="w-full h-10 bg-[#25D366] hover:bg-[#1db954] text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Continuar no WhatsApp
                </button>
                <p className="text-[9px] text-slate-400 text-center mt-1.5 font-medium">
                  Resposta em até 1 hora · Seg–Sex 9h–18h
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
