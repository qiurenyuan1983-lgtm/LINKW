import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, User, Bot } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
// FIX: Import ChatMessage type
import { LocationRule, ChatMessage } from '../types';
import { runChatQuery } from '../services/geminiService';
import { assignLocationsForUnload } from '../services/excelService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rules: LocationRule[];
}

// Simple markdown-to-HTML converter
const SimpleMarkdown = ({ text }: { text: string }) => {
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\n/g, '<br />'); // Newlines
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
};


const GeminiAssistant: React.FC<Props> = ({ isOpen, onClose, rules }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([{ role: 'model', content: "Hello! I'm Linky, your warehouse assistant. How can I help you today? You can ask me things like 'Where should I put 10 pallets for XLX7?' or 'Which locations are almost full?'" }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage, { role: 'loading', content: '' }]);
    setInput('');

    let prompt = input;
    // Check if the query is about finding a location to inject system-calculated suggestions
    const locationQueryRegex = /put|place|find a spot for|where should (\d+) pallets for (.*)/i;
    const match = input.match(locationQueryRegex);
    if (match) {
        const pallets = parseInt(match[1], 10);
        const dest = match[2];
        if (!isNaN(pallets) && dest) {
            const bestLocation = assignLocationsForUnload([{ dest, pallets, raw: [], rowIndex: 0, containerNo: 'AI_QUERY' }], rules);
            if (bestLocation[0]?.location) {
                prompt += `\n\n[System Note: The optimal location calculated by the warehouse algorithm is ${bestLocation[0].location}. Please use this information in your recommendation.]`;
            }
        }
    }
    
    const response = await runChatQuery(prompt, rules);
    setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'model', content: response };
        return newMessages;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:items-end sm:justify-end sm:p-6" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full h-full sm:w-96 sm:h-[600px] flex flex-col border border-slate-200" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-500" />
            <h3 className="text-lg font-bold text-slate-800">{t('assistantTitle')}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0"><Bot size={20} /></div>}
              
              <div className={`max-w-xs md:max-w-sm rounded-2xl px-4 py-2 text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : msg.role === 'model'
                  ? 'bg-slate-100 text-slate-800 rounded-bl-none'
                  : ''
              }`}>
                {msg.role === 'loading' ? (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-0"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-300"></span>
                  </div>
                ) : (
                  <SimpleMarkdown text={msg.content} />
                )}
              </div>

              {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0"><User size={20} /></div>}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t bg-slate-50 rounded-b-2xl">
          <div className="flex items-center gap-2">
            <input 
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={t('assistantPlaceholder')}
              className="flex-1 w-full px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={handleSend} className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={!input.trim()}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiAssistant;