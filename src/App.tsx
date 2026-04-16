import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Send, 
  Code2, 
  Layout, 
  Play, 
  RotateCcw, 
  MessageSquare, 
  ChevronRight, 
  ChevronLeft,
  Terminal,
  Sparkles,
  Github,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { aiService } from './services/aiService';
import { ChatMessage, CodeProject } from './types';

const INITIAL_CODE: CodeProject = {
  html: '<div class="container">\n  <h1>Welcome to AI Coding Bot</h1>\n  <p>Type something in the chat to start building!</p>\n  <button id="btn">Click Me</button>\n</div>',
  css: 'body {\n  font-family: system-ui, sans-serif;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n  margin: 0;\n  background: #f0f2f5;\n}\n.container {\n  background: white;\n  padding: 2rem;\n  border-radius: 12px;\n  box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n  text-align: center;\n}\nbutton {\n  background: #007bff;\n  color: white;\n  border: none;\n  padding: 0.5rem 1rem;\n  border-radius: 6px;\n  cursor: pointer;\n  transition: background 0.2s;\n}\nbutton:hover {\n  background: #0056b3;\n}',
  js: 'document.getElementById("btn").addEventListener("click", () => {\n  alert("Hello from AI Bot!");\n});'
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hello! I am your AI Web Developer Bot. What would you like to build today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html');
  const [code, setCode] = useState<CodeProject>(INITIAL_CODE);
  const [showPreview, setShowPreview] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [consoleLogs, setConsoleLogs] = useState<{ type: 'log' | 'error' | 'warn', message: string }[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    updatePreview(); // Initial update
  }, []);

  useEffect(() => {
    if (showPreview) {
      // Small delay to ensure iframe ref is attached
      const timer = setTimeout(() => updatePreview(), 50);
      return () => clearTimeout(timer);
    }
  }, [showPreview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview();
    }, 500); // Debounce manual edits
    return () => clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'IFRAME_CONSOLE') {
        setConsoleLogs(prev => [...prev, { type: event.data.logType, message: event.data.message }].slice(-50));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updatePreview = () => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    setConsoleLogs([]); // Clear logs on reload

    const consoleScript = `
      (function() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        const sendToParent = (type, args) => {
          window.parent.postMessage({
            type: 'IFRAME_CONSOLE',
            logType: type,
            message: Array.from(args).map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ')
          }, '*');
        };

        console.log = function() { sendToParent('log', arguments); originalLog.apply(console, arguments); };
        console.error = function() { sendToParent('error', arguments); originalError.apply(console, arguments); };
        console.warn = function() { sendToParent('warn', arguments); originalWarn.apply(console, arguments); };

        window.onerror = function(msg, url, lineNo, columnNo, error) {
          sendToParent('error', [msg + ' (line ' + lineNo + ')']);
          return false;
        };
      })();
    `;

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; }
            ${code.css}
          </style>
        </head>
        <body>
          ${code.html}
          <script>${consoleScript}</script>
          <script>
            try {
              ${code.js}
            } catch (err) {
              console.error('Runtime Error:', err.message);
            }
          </script>
        </body>
      </html>
    `;
    doc.open();
    doc.write(content);
    doc.close();
  };

  const handleSend = async (customPrompt?: string) => {
    const userMessage = customPrompt || input.trim();
    if (!userMessage && !customPrompt) return;
    if (isLoading) return;

    if (!customPrompt) setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const result = await aiService.processRequest(userMessage, history);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.explanation,
        code: result.code
      }]);
      
      if (result.code) {
        setCode(result.code);
        setShowPreview(true);
        // Force immediate update for AI generated code
        setTimeout(() => updatePreview(), 0);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while processing your request.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const fixError = (errorMsg: string) => {
    const prompt = `I encountered this error in the generated code: "${errorMsg}". Please fix it and provide the corrected code.`;
    handleSend(prompt);
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-gray-300 font-sans overflow-hidden">
      {/* Sidebar - Chat Interface */}
      <motion.div 
        initial={false}
        animate={{ width: sidebarOpen ? 400 : 0 }}
        className={cn(
          "flex flex-col border-r border-gray-800 bg-[#161b22] transition-all duration-300 relative",
          !sidebarOpen && "border-none"
        )}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white tracking-tight leading-none">AI Dev Bot</span>
              <span className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">Brainstorm & Build</span>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:bg-gray-800 rounded-md transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={cn(
              "flex flex-col max-w-[90%]",
              msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}>
              <div className={cn(
                "p-3 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-900/20" 
                  : "bg-[#21262d] text-gray-200 rounded-tl-none border border-gray-700"
              )}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm animate-pulse ml-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>Brainstorming...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-gray-800 shrink-0 bg-[#161b22]">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your idea or ask for a feature..."
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-3 pr-12 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none h-24 placeholder:text-gray-600"
            />
            <button 
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg transition-all shadow-lg shadow-blue-900/40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['Landing Page', 'Dashboard', 'Login Form', 'Portfolio'].map(idea => (
              <button
                key={idea}
                onClick={() => handleSend(`Build a ${idea}`)}
                className="whitespace-nowrap px-3 py-1 bg-[#21262d] border border-gray-700 rounded-full text-[10px] text-gray-400 hover:text-white hover:border-gray-500 transition-all"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Main Content - Editor & Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-gray-800 bg-[#161b22] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-1 hover:bg-gray-800 rounded-md transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div className="flex bg-[#0d1117] rounded-lg p-1 border border-gray-800">
              {(['html', 'css', 'js'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-medium rounded-md transition-all uppercase",
                    activeTab === tab 
                      ? "bg-[#21262d] text-white shadow-sm" 
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-medium text-green-500 uppercase tracking-wider">Auto-Run Active</span>
            </div>
            <button 
              onClick={() => setShowConsole(!showConsole)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-gray-700",
                showConsole ? "bg-yellow-600/10 text-yellow-400 border-yellow-500/50" : "hover:bg-gray-800",
                consoleLogs.some(l => l.type === 'error') && !showConsole && "animate-pulse border-red-500/50 text-red-400"
              )}
            >
              <Terminal className="w-4 h-4" />
              Console
            </button>
            <button 
              onClick={() => setShowPreview(!showPreview)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-gray-700",
                showPreview ? "bg-blue-600/10 text-blue-400 border-blue-500/50" : "hover:bg-gray-800"
              )}
            >
              <Layout className="w-4 h-4" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
            <button 
              onClick={updatePreview}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium transition-all shadow-lg shadow-green-900/20"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
          </div>
        </div>

        {/* Editor & Preview Split */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Editor */}
          <div className={cn(
            "flex-1 flex flex-col bg-[#0d1117]",
            showPreview ? "border-r border-gray-800" : ""
          )}>
            <Editor
              height="100%"
              language={activeTab === 'js' ? 'javascript' : activeTab}
              theme="vs-dark"
              value={code[activeTab]}
              onChange={(val) => setCode(prev => ({ ...prev, [activeTab]: val || '' }))}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                padding: { top: 20 }
              }}
            />
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="flex-1 bg-white flex flex-col">
              <div className="h-8 bg-gray-100 border-b flex items-center px-4 gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center flex items-center justify-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono">localhost:3000</span>
                  <button 
                    onClick={updatePreview}
                    className="p-0.5 hover:bg-gray-200 rounded transition-colors text-gray-400 hover:text-gray-600"
                    title="Reload Preview"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <iframe
                ref={iframeRef}
                title="Preview"
                className="flex-1 w-full border-none bg-white"
                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
              />
            </div>
          )}

          {/* Console Overlay */}
          <AnimatePresence>
            {showConsole && (
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute bottom-0 left-0 right-0 h-1/3 bg-[#0d1117] border-t border-gray-800 flex flex-col z-20"
              >
                <div className="h-8 border-b border-gray-800 flex items-center justify-between px-4 bg-[#161b22]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Console Output</span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setConsoleLogs([])} className="text-[10px] hover:text-white transition-colors">Clear</button>
                    <button onClick={() => setShowConsole(false)} className="text-[10px] hover:text-white transition-colors">Close</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1 custom-scrollbar">
                  {consoleLogs.length === 0 && <div className="text-gray-600 italic">No logs yet...</div>}
                  {consoleLogs.map((log, i) => (
                    <div key={i} className={cn(
                      "border-l-2 pl-2 py-1 flex items-start justify-between group",
                      log.type === 'error' ? "border-red-500 text-red-400 bg-red-500/5" : 
                      log.type === 'warn' ? "border-yellow-500 text-yellow-400 bg-yellow-500/5" : 
                      "border-blue-500 text-blue-400 bg-blue-500/5"
                    )}>
                      <div className="flex-1">
                        <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log.message}
                      </div>
                      {log.type === 'error' && (
                        <button 
                          onClick={() => fixError(log.message)}
                          className="hidden group-hover:flex items-center gap-1 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded text-[10px] transition-all"
                        >
                          <Sparkles className="w-3 h-3" />
                          Fix with AI
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #484f58;
        }
      `}</style>
    </div>
  );
}
