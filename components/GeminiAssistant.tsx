
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, User, Bot, Trash2, Zap, Paperclip, FileText, FileSpreadsheet, ImageIcon as ImageIconLucide } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LocationRule, ChatMessage, LogEntry, ExceptionEntry } from '../types';
import { WarehouseAssistant } from '../services/geminiService';
import * as XLSX from 'xlsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rules: LocationRule[];
  logs: LogEntry[];
  onAddException: (entry: Omit<ExceptionEntry, 'id' | 'time'>) => void;
}

const SimpleMarkdown = ({ text }: { text: string }) => {
    // A simplified markdown renderer for lists and bold text
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^\s*[-•]\s+(.*)$/gm, '<li>$1</li>') // List items
        .replace(/(<li>.*<\/li>)/s, '<ul class="list-disc pl-4 my-1">$1</ul>') // Wrap lists (simplified)
        .replace(/\n/g, '<br />');
        
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

const GeminiAssistant: React.FC<Props> = ({ isOpen, onClose, rules, logs, onAddException }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{data: string, type: string, name: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref to hold the service instance so it persists across renders
  const assistantRef = useRef<WarehouseAssistant | null>(null);

  useEffect(() => {
    if (isOpen) {
        if (!assistantRef.current) {
            // Initialize the assistant
            assistantRef.current = new WarehouseAssistant();
            assistantRef.current.updateContext(rules, logs, { addException: onAddException });
            setMessages([{ role: 'model', content: t('aiGreeting') }]);
        }
    }
  }, [isOpen, rules, logs, onAddException, t]); 

  useEffect(() => {
    // Keep the assistant context fresh with latest rules and logs
    if (assistantRef.current) {
        assistantRef.current.updateContext(rules, logs, { addException: onAddException });
    }
  }, [rules, logs, onAddException]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
          alert("File is too large. Max 10MB allowed.");
          e.target.value = '';
          return;
      }

      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const isCsv = file.name.endsWith('.csv');
      const isText = file.name.endsWith('.txt') || file.name.endsWith('.json');

      if (isExcel) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              try {
                  const data = new Uint8Array(ev.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(data, {type: 'array'});
                  const firstSheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[firstSheetName];
                  const csv = XLSX.utils.sheet_to_csv(worksheet);
                  
                  // Convert CSV to Base64 (handle UTF-8)
                  // Use TextEncoder to ensure proper UTF-8 handling for base64
                  const encoder = new TextEncoder();
                  const utf8Bytes = encoder.encode(csv);
                  let binaryString = '';
                  for (let i = 0; i < utf8Bytes.length; i++) {
                      binaryString += String.fromCharCode(utf8Bytes[i]);
                  }
                  const base64Csv = btoa(binaryString);
                  
                  setSelectedFile({
                      data: base64Csv,
                      type: 'text/csv', 
                      name: file.name
                  });
              } catch (err) {
                  console.error("Excel conversion failed", err);
                  alert("Failed to read Excel file.");
              }
          };
          reader.readAsArrayBuffer(file);
      } else if (isCsv || isText) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const text = ev.target?.result as string;
              // Encode text to base64
              const encoder = new TextEncoder();
              const utf8Bytes = encoder.encode(text);
              let binaryString = '';
              for (let i = 0; i < utf8Bytes.length; i++) {
                  binaryString += String.fromCharCode(utf8Bytes[i]);
              }
              const base64Text = btoa(binaryString);

              setSelectedFile({
                  data: base64Text,
                  type: isCsv ? 'text/csv' : 'text/plain',
                  name: file.name
              });
          };
          reader.readAsText(file);
      } else {
          // Standard handler for Images
          const reader = new FileReader();
          reader.onload = (ev) => {
              setSelectedFile({
                  data: ev.target?.result as string,
                  type: file.type || 'application/octet-stream',
                  name: file.name
              });
          };
          reader.readAsDataURL(file);
      }
      
      // Reset input so same file can be selected again if needed
      e.target.value = '';
  };

  const handleClearFile = () => {
      setSelectedFile(null);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || !assistantRef.current) return;
    
    let contentDisplay = input;
    if (selectedFile) {
        const fileLabel = selectedFile.type.startsWith('image/') ? 'Image' : 'File';
        contentDisplay = `[${fileLabel}: ${selectedFile.name}] ${input}`;
    }

    const userMessage: ChatMessage = { role: 'user', content: contentDisplay };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = input;
    
    // For text files, we already stored base64 in data. For images, data is dataURL (includes mime).
    // We need to clean this up for the service which expects { mimeType, data (base64) }
    let fileDataForService = undefined;
    
    if (selectedFile) {
        let base64Data = selectedFile.data;
        // If it's a data URL, strip the prefix
        if (base64Data.startsWith('data:')) {
            base64Data = base64Data.split(',')[1];
        }
        
        fileDataForService = {
            mimeType: selectedFile.type,
            data: base64Data
        };
    }

    setInput('');
    setSelectedFile(null);
    setIsTyping(true);

    try {
        const responseText = await assistantRef.current.sendMessage(currentInput, fileDataForService);
        setMessages(prev => [...prev, { role: 'model', content: responseText }]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', content: t('aiError') }]);
    } finally {
        setIsTyping(false);
    }
  };

  const handleClear = () => {
      setMessages([{ role: 'model', content: t('aiChatCleared') }]);
      // Reset assistant context
      assistantRef.current = new WarehouseAssistant();
      assistantRef.current.updateContext(rules, logs, { addException: onAddException });
      setSelectedFile(null);
  }

  const getFileIcon = (type: string) => {
      if (type.startsWith('image/')) return <ImageIconLucide size={20} />; 
      if (type.includes('csv') || type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet size={20} />;
      return <FileText size={20} />;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:items-end sm:justify-end sm:p-6" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full h-full sm:w-96 sm:h-[600px] flex flex-col border border-slate-200 animate-fade-in-up" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-500" />
            <div>
                <h3 className="text-lg font-bold text-slate-800">{t('assistantTitle')}</h3>
                <p className="text-[10px] text-slate-400 leading-none flex items-center gap-1">
                    <Zap size={10} className="text-yellow-500" fill="currentColor" />
                    Powered by Gemini 2.0
                </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
             <button onClick={handleClear} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500" title="Clear Chat"><Trash2 size={16} /></button>
             <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500"><X size={20} /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-200 shadow-sm">
                      <Bot size={18} />
                  </div>
              )}
              
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
              }`}>
                  <SimpleMarkdown text={msg.content} />
              </div>

              {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
                      <User size={18} />
                  </div>
              )}
            </div>
          ))}
          
          {isTyping && (
             <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-200">
                      <Bot size={18} />
                  </div>
                  <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                      </div>
                  </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t bg-white rounded-b-2xl">
          {/* File Preview */}
          {selectedFile && (
              <div className="mb-2 relative inline-flex items-center gap-2 bg-slate-100 p-2 rounded-lg border border-slate-200 max-w-full">
                  {selectedFile.type.startsWith('image/') ? (
                      <img src={selectedFile.data} alt="Preview" className="h-12 w-12 rounded object-cover border border-white" />
                  ) : (
                      <div className="h-12 w-12 bg-white rounded border border-slate-200 flex items-center justify-center text-slate-500">
                          {getFileIcon(selectedFile.type)}
                      </div>
                  )}
                  <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-slate-700 truncate max-w-[180px]" title={selectedFile.name}>{selectedFile.name}</span>
                      <span className="text-[9px] text-slate-400 uppercase">{selectedFile.type.split('/')[1] || 'FILE'}</span>
                  </div>
                  <button 
                    onClick={handleClearFile}
                    className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 shadow-md hover:bg-slate-700 z-10"
                  >
                      <X size={12} />
                  </button>
              </div>
          )}

          <div className="flex items-center gap-2 relative">
            <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors flex-shrink-0"
                title="Attach File (Image, PDF, Excel, Text)"
                disabled={isTyping}
            >
                <Paperclip size={20} />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,application/pdf,text/plain,text/csv,.xlsx,.xls,.txt,.json" 
                onChange={handleFileSelect}
            />

            <input 
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isTyping && handleSend()}
              placeholder={selectedFile ? t('aiImageDesc') : t('assistantPlaceholder')}
              className="flex-1 w-full pl-4 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all min-w-0"
              disabled={isTyping}
            />
            <button 
                onClick={handleSend} 
                className={`absolute right-1.5 top-1.5 p-2 rounded-lg transition-all ${
                    (input.trim() || selectedFile) 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                disabled={(!input.trim() && !selectedFile) || isTyping}
            >
              <Send size={16} />
            </button>
          </div>
          <div className="text-center mt-2">
             <span className="text-[10px] text-slate-300">{t('aiDisclaimer')}</span>
          </div>
        </div>
      </div>
       <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(1rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default GeminiAssistant;
