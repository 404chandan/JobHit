import React, { useState, useEffect } from 'react';
import { Save, Upload, CheckCircle2 } from 'lucide-react';

interface SettingsPanelProps {
  settings: { [key: string]: string };
  onSaveSetting: (key: string, value: string) => Promise<void>;
  onUploadResume: (file: File) => Promise<string>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSaveSetting,
  onUploadResume
}) => {
  const [resumeText, setResumeText] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [location, setLocation] = useState('Bengaluru');
  const [geminiKey, setGeminiKey] = useState('');
  const [cookies, setCookies] = useState('');
  
  // SMTP states
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');

  const [maxJobsScraped, setMaxJobsScraped] = useState('20');
  const [uploadStatus, setUploadStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    // Populate form states from settings values
    if (settings['user_resume']) setResumeText(settings['user_resume']);
    if (settings['search_location']) setLocation(settings['search_location']);
    if (settings['gemini_api_key']) setGeminiKey(settings['gemini_api_key']);
    if (settings['linkedin_cookies']) setCookies(settings['linkedin_cookies']);
    if (settings['max_jobs_scraped']) setMaxJobsScraped(settings['max_jobs_scraped']);
    
    if (settings['search_keywords']) {
      try {
        setKeywords(JSON.parse(settings['search_keywords']));
      } catch (e) {
        console.error('Failed to parse search keywords JSON', e);
      }
    }

    if (settings['smtp_config']) {
      try {
        const smtp = JSON.parse(settings['smtp_config']);
        setSmtpHost(smtp.host || 'smtp.gmail.com');
        setSmtpPort(smtp.port || '587');
        setSmtpSecure(smtp.secure === 'true' || smtp.secure === true);
        setSmtpUser(smtp.user || '');
        setSmtpPass(smtp.pass || '');
        setSmtpFrom(smtp.from || '');
      } catch (e) {
        console.error('Failed to parse SMTP config JSON', e);
      }
    }
  }, [settings]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Uploading & parsing PDF resume...');
    try {
      const extractedText = await onUploadResume(file);
      setResumeText(extractedText);
      setUploadStatus('Resume PDF parsed and updated successfully!');
    } catch (err) {
      setUploadStatus('Failed to upload/parse resume PDF.');
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      const updated = [...keywords, newKeyword.trim()];
      setKeywords(updated);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };

  const handleSaveAllSettings = async () => {
    setSaveStatus('Saving settings...');
    try {
      // 1. Save Resume Text
      await onSaveSetting('user_resume', resumeText);
      
      // 2. Save Keywords
      await onSaveSetting('search_keywords', JSON.stringify(keywords));

      // 3. Save Location
      await onSaveSetting('search_location', location);

      // 4. Save Gemini Key
      if (geminiKey) {
        await onSaveSetting('gemini_api_key', geminiKey);
      }

      // 5. Save Cookies
      await onSaveSetting('linkedin_cookies', cookies);

      // 5.5. Save Scraper Max Jobs Cap
      await onSaveSetting('max_jobs_scraped', maxJobsScraped);

      // 6. Save SMTP config
      const smtpConfig = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        pass: smtpPass,
        from: smtpFrom
      };
      await onSaveSetting('smtp_config', JSON.stringify(smtpConfig));

      setSaveStatus('All settings saved successfully!');
    } catch (err) {
      setSaveStatus('Failed to save settings.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. Resume Settings */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Resume Configuration
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Upload your resume PDF to automatically extract details for Gemini evaluation.
        </p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} />
            Upload PDF Resume
            <input 
              type="file" 
              accept=".pdf" 
              style={{ display: 'none' }}
              onChange={handleResumeUpload}
            />
          </label>
          {uploadStatus && (
            <span style={{ fontSize: '0.875rem', color: uploadStatus.includes('failed') ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {uploadStatus}
            </span>
          )}
        </div>

        <div className="form-group">
          <label>Parsed Resume Text Content</label>
          <textarea 
            className="form-textarea"
            style={{ fontFamily: 'monospace', minHeight: '200px' }}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Parsed resume text will appear here. You can also paste it manually."
          />
        </div>
      </div>

      {/* 2. Scraper Configuration */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Scraper Configuration</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Configure keywords and location targets for the Playwright scraper.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Target Location</label>
            <input 
              type="text" 
              className="form-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bengaluru"
            />
          </div>
          <div className="form-group">
            <label>Max Jobs to Scrape Per Run</label>
            <input 
              type="number" 
              className="form-input"
              value={maxJobsScraped}
              onChange={(e) => setMaxJobsScraped(e.target.value)}
              placeholder="e.g. 20"
              min="1"
              max="100"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Search Keywords</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              className="form-input"
              style={{ flex: 1 }}
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g. Node.js Developer"
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
            />
            <button className="btn btn-secondary" onClick={handleAddKeyword}>Add</button>
          </div>

          <div className="tag-container" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
            {keywords.length === 0 ? (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No keywords configured.</span>
            ) : (
              keywords.map(kw => (
                <span 
                  key={kw} 
                  className="skill-tag match" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
                  onClick={() => handleRemoveKeyword(kw)}
                >
                  {kw} <span>&times;</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Credentials & LinkedIn Sessions */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>APIs & Sessions</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Configure API keys and LinkedIn credentials.
        </p>

        <div className="form-group">
          <label>Gemini API Key</label>
          <input 
            type="password" 
            className="form-input"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Paste your Gemini API Key here (or leave empty if configured in .env)"
          />
        </div>

        <div className="form-group">
          <label>LinkedIn Cookies (JSON format)</label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Pasting active LinkedIn session cookies avoids rate limits. Retrieve cookies using chrome extensions like 'EditThisCookie' in JSON format.
          </p>
          <textarea 
            className="form-textarea"
            style={{ fontFamily: 'monospace', minHeight: '120px' }}
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            placeholder='[{"name": "li_at", "value": "AQED...", "domain": ".linkedin.com"}, ...]'
          />
        </div>
      </div>

      {/* 4. SMTP Email Configuration */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          SMTP Cold Email Configuration
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Configure SMTP credentials to automate morning cold emails at 9:00 AM.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>SMTP Host</label>
            <input 
              type="text" 
              className="form-input" 
              value={smtpHost} 
              onChange={e => setSmtpHost(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label>SMTP Port</label>
            <input 
              type="text" 
              className="form-input" 
              value={smtpPort} 
              onChange={e => setSmtpPort(e.target.value)} 
            />
          </div>
        </div>

        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0' }}>
          <input 
            type="checkbox" 
            id="smtpSecure" 
            checked={smtpSecure} 
            onChange={e => setSmtpSecure(e.target.checked)} 
          />
          <label htmlFor="smtpSecure" style={{ cursor: 'pointer' }}>Use SSL/TLS (Secure Connection)</label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>SMTP Username (Email)</label>
            <input 
              type="email" 
              className="form-input" 
              value={smtpUser} 
              onChange={e => setSmtpUser(e.target.value)} 
              placeholder="e.g. you@gmail.com"
            />
          </div>
          <div className="form-group">
            <label>SMTP Password / App Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={smtpPass} 
              onChange={e => setSmtpPass(e.target.value)} 
              placeholder="e.g. abcd efgh ijkl mnop"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Sender Address ("From" name or email)</label>
          <input 
            type="text" 
            className="form-input" 
            value={smtpFrom} 
            onChange={e => setSmtpFrom(e.target.value)} 
            placeholder="e.g. Chandan Pandey <chandan.works.91@gmail.com>"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {saveStatus && (
          <span style={{ fontSize: '0.875rem', color: saveStatus.includes('Failed') ? 'var(--color-danger)' : 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={16} /> {saveStatus}
          </span>
        )}
        <button 
          className="btn btn-primary" 
          style={{ marginLeft: 'auto' }}
          onClick={handleSaveAllSettings}
        >
          <Save size={16} /> Save All Settings
        </button>
      </div>

    </div>
  );
};
