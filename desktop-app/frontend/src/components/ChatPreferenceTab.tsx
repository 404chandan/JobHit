import React, { useState, useEffect } from 'react';
import { Send, Trash2, Sparkles, Code, CheckCircle } from 'lucide-react';

interface Preference {
  id: string;
  roles: string[];
  experience: string[];
  techStack: string[];
  locations: string[];
  excludeCos: string[];
  excludeRls: string[];
  rawJson: string;
  chatHistory: string;
}

interface ChatPreferenceTabProps {
  preference: Preference | null;
  onSavePreferences: (rawJson: string) => Promise<void>;
  onTriggerChat: (message: string) => Promise<any>;
  onClearChat: () => Promise<void>;
}

export const ChatPreferenceTab: React.FC<ChatPreferenceTabProps> = ({
  preference,
  onSavePreferences,
  onTriggerChat,
  onClearChat
}) => {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [jsonConfig, setJsonConfig] = useState('{}');
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (preference) {
      setJsonConfig(preference.rawJson);
      try {
        setMessages(JSON.parse(preference.chatHistory || '[]'));
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
  }, [preference]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setIsSending(true);

    // Optimistically add user message
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const resData = await onTriggerChat(userMsg);
      // Backend returns the updated history and preference
      if (resData && resData.history) {
        setMessages(resData.history);
      }
      if (resData && resData.preference) {
        setJsonConfig(resData.preference.rawJson);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Failed to reach Career Assistant.' }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveJson = async () => {
    setStatusMsg('Saving configuration...');
    try {
      await onSavePreferences(jsonConfig);
      setStatusMsg('Configuration saved successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg('Failed to save JSON. Verify format.');
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear all chat dialogue history?')) {
      await onClearChat();
      setMessages([]);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', height: 'calc(100vh - 160px)', minHeight: '550px' }}>
      
      {/* 1. Chatbot Assistant Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-secondary)' }} />
              AI Preference Assistant
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Chat with Gemini to configure your target job profile</p>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
            onClick={handleClearHistory}
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>

        {/* Message logs */}
        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', gap: '0.5rem' }}>
              <Sparkles size={32} />
              <p style={{ fontSize: '0.875rem' }}>Say "Hello" or type your job search target roles to start configuring!</p>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div 
                key={idx} 
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  animation: 'fadeIn 0.2s ease'
                }}
              >
                <div 
                  style={{
                    maxWidth: '80%',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    lineHeight: '1.4',
                    background: m.role === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                    color: '#ffffff',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border-light)',
                    borderBottomRightRadius: m.role === 'user' ? '2px' : '12px',
                    borderBottomLeftRadius: m.role === 'user' ? '12px' : '2px'
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.75rem' }}>
          <input 
            type="text" 
            className="form-input" 
            style={{ flex: 1 }}
            placeholder="Type roles, locations, tech stack, or experience..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isSending}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1rem' }} disabled={isSending}>
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* 2. Direct JSON Editor Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Code size={16} />
            JSON Configuration Editor
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Review or edit configurations directly below</p>
        </div>

        <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <textarea
            style={{
              flex: 1,
              width: '100%',
              background: 'rgba(10, 10, 15, 0.9)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              color: '#34d399', // retro-green
              fontFamily: 'monospace',
              padding: '1rem',
              fontSize: '0.875rem',
              resize: 'none',
              outline: 'none'
            }}
            value={jsonConfig}
            onChange={e => setJsonConfig(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: statusMsg.includes('Failed') ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {statusMsg}
            </span>
            <button className="btn btn-teal" onClick={handleSaveJson}>
              <CheckCircle size={14} /> Save Configuration
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
