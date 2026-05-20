import React, { useEffect, useRef, useState } from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import { chatWithNouri } from '../../utils/api';
import './bot.css';

// Convert **bold** markdown to <strong> tags
function formatText(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export default function BotScreen() {
  const navigate = useStore((s) => s.navigate);
  const previousScreen = useStore((s) => s.previousScreen);
  const activeKid = useStore((s) => s.getActiveKid());
  const scan = useStore((s) => s.selectedProduct);
  const messages = useStore((s) => s.botMessages);
  const addMessage = useStore((s) => s.addBotMessage);

  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [chips, setChips] = useState([
    'How was this scored?',
    'Why was it flagged?',
    "How much sugar is okay for my child?",
    'Better alternatives at Walmart?',
  ]);
  const scrollRef = useRef(null);

  // Initial greet — once
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = scan?.product
        ? `Hi! I'm Nouri 🤖 — I see you just scanned **${scan.product.name}**. Ask me anything about the score, ingredients, or flags for ${activeKid?.name || 'your child'}.`
        : `Hi! I'm Nouri 🤖 — your nutrition guide for ${activeKid?.name || 'your child'}. Ask me about a scan, ingredients, or how the score works.`;
      addMessage({ id: 'welcome', role: 'bot', text: greeting });
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { id: 'msg-' + Date.now(), role: 'user', text: text.trim() };
    addMessage(userMsg);
    setInput('');
    setTyping(true);

    try {
      const history = messages.map((m) => ({
        role: m.role === 'bot' ? 'nouri' : 'user',
        content: m.text,
      }));
      const r = await chatWithNouri({
        message: text.trim(),
        context: scan ? 'result' : 'home',
        childId: activeKid?.id,
        scanData: scan,
        history,
      });
      addMessage({ id: 'msg-' + Date.now() + '-bot', role: 'bot', text: r.text });
      if (Array.isArray(r.chips) && r.chips.length > 0) setChips(r.chips);
    } catch (err) {
      addMessage({
        id: 'msg-' + Date.now() + '-err',
        role: 'bot',
        text: `Sorry — I couldn't reach the assistant right now. (${err.message || 'network error'})`,
      });
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="screen bot-screen animate-fade-in">
      <StatusBar />
      <div className="bot-header">
        <button className="nav-back" onClick={() => navigate(previousScreen || 'home')}>←</button>
        <div className="bot-avatar">🤖</div>
        <div style={{ flex: 1 }}>
          <div className="bot-title">Nouri</div>
          <div className="bot-subtitle">Nutrition guide · educational only</div>
        </div>
      </div>

      <div ref={scrollRef} className="bot-messages">
        {messages.map((m) => (
          <div key={m.id} className={`bot-msg ${m.role}`}>
            {m.role === 'bot' ? formatText(m.text) : m.text}
          </div>
        ))}
        {typing && (
          <div className="bot-typing">
            <span /><span /><span />
          </div>
        )}
      </div>

      {chips.length > 0 && !typing && (
        <div className="bot-chips">
          {chips.map((c, i) => (
            <button key={i} className="bot-chip" onClick={() => sendMessage(c)}>{c}</button>
          ))}
        </div>
      )}

      <div className="bot-input-row">
        <input
          className="bot-input"
          placeholder="Ask Nouri…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
          disabled={typing}
        />
        <button
          className="bot-send"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || typing}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
