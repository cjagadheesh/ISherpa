import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, X, Check,
  MessageSquare, FileText, ArrowRight,
  Search, AlertTriangle, Shield, Scale, Building2, Info
} from 'lucide-react';

const FIELD_LABELS = {
  promoter_experience: 'Promoter Experience Summary',
  products_services_description: 'Key Products & Services',
  business_model: 'Business Model Description',
  internal_risks: 'Internal Risk Factors',
  external_risks: 'External Risk Factors',
  risk_narrative_text: 'Consolidated Risk Factor Narrative',
  litigations_company: 'Litigations Against Company',
  litigations_promoters: 'Litigations Against Promoters',
  rpt_declared: 'Related Party Transactions',
  material_contracts_desc: 'Material Contracts for Inspection',
  industry_growth_narrative: 'Industry Growth Narrative',
  esop_details: 'ESOP Details',
  auditor_qualifications: 'Auditor Qualifications',
  summary_business_note: 'Summary Business Note'
};

// Helper to format inline bold text **like this**
const formatBoldText = (text) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// Formats assistant messages dynamically into structured cards for scans
const renderMessageContent = (text) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  const renderedElements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      renderedElements.push(<div key={`empty-${i}`} className="h-1.5" />);
      continue;
    }

    // Match bold headers like **Header:** or **Header**
    const headerMatch = line.match(/^\*\*(.*?)\*\*$/) || line.match(/^\*\*(.*?):\*\*$/);
    if (headerMatch) {
      const headerText = headerMatch[1];
      renderedElements.push(
        <div key={`header-${i}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-3 mb-1.5 first:mt-0 select-none">
          {headerText}
        </div>
      );
      continue;
    }

    // Match bullet points starting with *, -, or •
    const bulletMatch = line.match(/^[*\-•]\s*(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[1];
      const lowerContent = content.toLowerCase();

      let icon = <Info className="w-3.5 h-3.5" />;
      let bgClass = 'bg-slate-50 border-slate-205 text-slate-750';
      let iconColor = 'text-slate-400 bg-slate-50 border-slate-200';

      if (lowerContent.includes('conflict') || lowerContent.includes('mismatch') || lowerContent.includes('inconsistency') || lowerContent.includes('error')) {
        icon = <AlertTriangle className="w-3.5 h-3.5" />;
        bgClass = 'bg-red-50/50 border-red-100 text-slate-700';
        iconColor = 'text-red-500 bg-red-50 border-red-100';
      } else if (lowerContent.includes('missing') || lowerContent.includes('incomplete') || lowerContent.includes('required')) {
        icon = <AlertTriangle className="w-3.5 h-3.5" />;
        bgClass = 'bg-amber-50/50 border-amber-100 text-slate-700';
        iconColor = 'text-amber-500 bg-amber-50 border-amber-100';
      } else if (lowerContent.includes('suggestion') || lowerContent.includes('suggest') || lowerContent.includes('recommend')) {
        icon = <Sparkles className="w-3.5 h-3.5" />;
        bgClass = 'bg-accent-50/20 border-accent-100/50 text-slate-700';
        iconColor = 'text-accent-500 bg-accent-50 border-accent-100/50';
      }

      renderedElements.push(
        <div key={`card-${i}`} className={`border rounded-lg p-3 flex gap-2.5 shadow-sm my-1.5 ${bgClass}`}>
          <div className={`p-1 rounded-lg h-fit shrink-0 border flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
            {formatBoldText(content)}
          </div>
        </div>
      );
      continue;
    }

    // Standard text line
    renderedElements.push(
      <p key={`text-${i}`} className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600 my-1">
        {formatBoldText(line)}
      </p>
    );
  }

  return <div className="space-y-0.5">{renderedElements}</div>;
};

export default function Copilot({ isOpen, onClose, onApplySuggestion, apiFetch }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your SEBI Compliance Copilot. I can audit your current checklist data, review document conflicts, or help draft legal sections like Risk Factors or Business Overview based on your parameters. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedField, setAppliedField] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    if (!textToSend) {
      setInput('');
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Conversation so far (not including this new turn) — /api/copilot appends
    // it before the new user message, giving the model real multi-turn memory.
    const historyPayload = messages.map(m => ({ role: m.role, content: m.content }));
    const newMessages = [...messages, { role: 'user', content: text, timestamp }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // /api/copilot (not /api/rag/query) — it's the session-aware endpoint that
      // sees live company data, missing fields, and active compliance conflicts,
      // supports multi-turn history, and is the only one whose prompt actually
      // emits the [SUGGESTION:field_key] tags parseMessageContent() below looks
      // for. /api/rag/query is a narrower single-shot regulation citation
      // lookup with no session context or suggestion support — calling it here
      // meant every question got a near-identical canned/citation-only answer
      // and "Apply Draft" could never appear.
      const res = await apiFetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyPayload })
      });

      const replyTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          timestamp: replyTimestamp
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error connecting to the SEBI Compliance Copilot. Please check if the backend is running.',
          timestamp: replyTimestamp
        }]);
      }
    } catch (err) {
      console.error(err);
      const replyTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Could not reach the SEBI Compliance Copilot. Ensure the backend server is operational.',
        timestamp: replyTimestamp
      }]);
    } finally {
      setLoading(false);
    }
  };

  const parseMessageContent = (text) => {
    const suggestionRegex = /\[SUGGESTION:([a-zA-Z_]+)\]([\s\S]*?)\[\/SUGGESTION\]/g;
    const matches = [...text.matchAll(suggestionRegex)];
    
    if (matches.length === 0) {
      return { cleanText: text, suggestion: null };
    }
    
    const fieldKey = matches[0][1];
    const suggestionContent = matches[0][2].trim();
    const cleanText = text.replace(suggestionRegex, '').trim();
    
    return {
      cleanText,
      suggestion: {
        key: fieldKey,
        content: suggestionContent
      }
    };
  };

  const handleApply = (key, content) => {
    onApplySuggestion(key, content);
    setAppliedField(key);
    setTimeout(() => setAppliedField(null), 2500);
  };

  const getPromptIcon = (iconName) => {
    switch (iconName) {
      case 'search': return <Search className="w-4 h-4 text-slate-400 shrink-0" />;
      case 'shield': return <Shield className="w-4 h-4 text-slate-400 shrink-0" />;
      case 'building': return <Building2 className="w-4 h-4 text-slate-400 shrink-0" />;
      case 'scale': return <Scale className="w-4 h-4 text-slate-400 shrink-0" />;
      default: return <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  const quickPrompts = [
    { label: 'Audit Compliance Gaps', query: 'Audit my current data for SEBI gaps and errors.', icon: 'search' },
    { label: 'Draft Risk Factors', query: 'Draft a professional risk factors narrative section based on my inputs.', icon: 'shield' },
    { label: 'Draft Business Overview', query: 'Help me draft a professional Business Overview narrative.', icon: 'building' },
    { label: 'Promoter Shareholding', query: 'What are the SEBI rules for promoter shareholding in an SME IPO?', icon: 'scale' }
  ];

  if (!isOpen) return null;

  return (
    <div className="w-96 border-l border-slate-200 bg-gray-50 shrink-0 flex flex-col justify-between h-screen sticky top-0 z-40 shadow-card-lg relative animate-fade-in-up">
      {/* Top accent bar - Light Blue Accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent-500" />
      
      {/* Header */}
      <div className="pt-2.5 px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white text-slate-800 select-none">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-500 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-bold text-[13px] text-gray-900 tracking-tight leading-tight">AI Compliance Copilot</h3>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">SEBI SME Auditor</span>
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message Feed */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-[#EDF3F9]/50 flex flex-col">
        {/* Placeholder Standby State for Idle Panel */}
        {messages.length === 1 && (
          <div className="flex-1 flex flex-col justify-center items-center p-6 text-center select-none animate-fade-in-up">
            <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-3.5 text-slate-400 shadow-sm">
              <Shield className="w-5.5 h-5.5" />
            </div>
            <h4 className="font-bold text-[12.5px] text-slate-800">Compliance Audit Standby</h4>
            <p className="text-[11.5px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
              Ready to scan for data inconsistencies or draft narrative sections under SEBI ICDR regulations.
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const { cleanText, suggestion } = isUser ? { cleanText: msg.content, suggestion: null } : parseMessageContent(msg.content);

          return (
            <div key={index} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in-up shrink-0`}>
              <div 
                className={`max-w-[88%] rounded-lg px-3.5 py-2.5 text-[12.5px] shadow-sm leading-relaxed ${
                  isUser 
                    ? 'bg-accent-50/70 border border-accent-200 text-slate-800 rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                }`}
              >
                {/* RAG Confidence Badge */}
                {!isUser && msg.confidence && (
                  <div className="mb-2 pb-2 border-b border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[9.5px] font-extrabold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>{msg.confidence}% Vector RAG Confidence</span>
                    </span>
                    <span className="text-[9px] font-bold font-mono text-slate-400">SEBI ICDR Regulations 2018</span>
                  </div>
                )}

                {/* Clean formatted text */}
                <div className="whitespace-pre-line">
                  {isUser ? cleanText : renderMessageContent(cleanText)}
                </div>

                {/* SEBI Statutory Citation Cards */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-purple-100 space-y-2">
                    <p className="text-[10px] uppercase font-bold text-purple-900 tracking-wider flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-purple-600" /> Retrieved SEBI Statutory Regulations ({msg.citations.length}):
                    </p>
                    <div className="space-y-1.5">
                      {msg.citations.map((cit, cIdx) => (
                        <div key={cIdx} className="bg-purple-50/70 border border-purple-200 rounded-lg p-2.5 text-xs text-purple-950 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-purple-900 font-mono text-[11px]">{cit.regulation_no} — {cit.title}</span>
                            <span className="text-[9px] font-bold font-mono bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded">
                              {cit.confidence_score}% Match
                            </span>
                          </div>
                          <p className="text-[10.5px] text-purple-900 leading-relaxed font-mono bg-white/80 p-2 rounded border border-purple-100">
                            "{cit.text}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestion Card */}
                {suggestion && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-gray-900 font-bold text-[9.5px] uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5" /> Suggestion Draft
                      {FIELD_LABELS[suggestion.key] && (
                        <span className="text-slate-400 font-normal normal-case">· {FIELD_LABELS[suggestion.key]}</span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-slate-500 italic line-clamp-3 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                      "{suggestion.content}"
                    </p>
                    <button
                      onClick={() => handleApply(suggestion.key, suggestion.content)}
                      className={`w-full py-2 px-3 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        appliedField === suggestion.key
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-gray-900 hover:bg-gray-800 text-white shadow-sm'
                      }`}
                    >
                      {appliedField === suggestion.key ? (
                        <><Check className="w-3.5 h-3.5" /> Applied to Form!</>
                      ) : (
                        <><ArrowRight className="w-3.5 h-3.5" /><span>Apply to Form</span></>
                      )}
                    </button>
                  </div>
                )}

                {/* Timestamp */}
                {msg.timestamp && (
                  <div className="flex justify-end mt-1 text-[8px] text-slate-400 select-none">
                    {msg.timestamp}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-start gap-2 animate-fade-in-up shrink-0">
            <div className="bg-white border border-slate-200 rounded-lg rounded-tl-none px-3.5 py-2.5 shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[11px] text-slate-400 font-semibold select-none">Auditing compliance…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Panel */}
      {showQuickActions && messages.length === 1 && (
        <div className="px-4 pb-3.5 pt-2 bg-gray-50 border-t border-gray-100 select-none">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9.5px] uppercase font-bold tracking-widest text-slate-400">Quick Actions</p>
            <button 
              onClick={() => setShowQuickActions(false)}
              className="text-[9px] font-bold text-slate-400 hover:text-slate-650 hover:bg-slate-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p.query)}
                className="text-left text-[11px] p-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 transition-all flex flex-col justify-between h-[76px] shadow-sm hover:shadow-md cursor-pointer text-slate-600 hover:text-slate-800 font-semibold"
              >
                <div className="mb-2">
                  {getPromptIcon(p.icon)}
                </div>
                <span className="leading-tight">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 select-none"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about SEBI compliance or draft…"
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-[12.5px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:bg-white transition-all shadow-sm"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3.5 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 active:bg-black text-white transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center border border-gray-900 hover:border-gray-800 shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
