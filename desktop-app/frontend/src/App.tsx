import { useState, useEffect } from 'react';
import { LayoutDashboard, Briefcase, Mail, Settings, Zap, MessageSquare, Send } from 'lucide-react';
import { DashboardStats } from './components/DashboardStats';
import { JobList } from './components/JobList';
import { JobDetailsModal } from './components/JobDetailsModal';
import { StartupContacts } from './components/StartupContacts';
import { SettingsPanel } from './components/SettingsPanel';
import { ChatPreferenceTab } from './components/ChatPreferenceTab';
import { CampaignTab } from './components/CampaignTab';

export default function App() {
  const [token] = useState<string | null>('local_token');
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'startups' | 'preferences' | 'campaigns' | 'settings'>('dashboard');
  const [jobs, setJobs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [preference, setPreference] = useState<any | null>(null);
  const [settings, setSettings] = useState<{ [key: string]: string }>({});
  
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [isScrapingLeads, setIsScrapingLeads] = useState(false);

  // Load resources if token is present
  useEffect(() => {
    if (token) {
      loadJobs();
      loadContacts();
      loadCampaigns();
      loadPreferences();
      loadSettings();
    }
  }, [token]);

  // Authenticated fetch wrapper
  const authedFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    };
    const finalUrl = url.startsWith('/api') ? `/jobhit${url}` : url;
    return fetch(finalUrl, { ...options, headers });
  };

  const loadJobs = async () => {
    try {
      const res = await authedFetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (e) {
      console.error('Failed to load jobs', e);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await authedFetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (e) {
      console.error('Failed to load contacts', e);
    }
  };

  const loadCampaigns = async () => {
    try {
      const res = await authedFetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (e) {
      console.error('Failed to load campaigns', e);
    }
  };

  const loadPreferences = async () => {
    try {
      const res = await authedFetch('/api/preferences');
      if (res.ok) {
        const data = await res.json();
        setPreference(data);
      }
    } catch (e) {
      console.error('Failed to load preferences', e);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await authedFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      const res = await authedFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        await loadSettings();
      }
    } catch (e) {
      console.error('Failed to save setting', e);
      throw e;
    }
  };

  const handleSavePreferences = async (rawJson: string) => {
    try {
      const res = await authedFetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawJson })
      });
      if (res.ok) {
        await loadPreferences();
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleTriggerChat = async (message: string): Promise<any> => {
    try {
      const res = await authedFetch('/api/preferences/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (res.ok) {
        const data = await res.json();
        setPreference(data.preference);
        return data;
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleClearChat = async () => {
    try {
      await authedFetch('/api/preferences/chat/clear', { method: 'POST' });
      await loadPreferences();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadCampaign = async (formData: FormData): Promise<any> => {
    try {
      const res = await authedFetch('/api/campaigns/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        await loadContacts();
        await loadCampaigns();
        return data;
      }
      throw new Error('Failed campaign creation');
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleUploadResume = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await authedFetch('/api/settings/resume', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        await loadSettings();
        return data.resumeText;
      }
      throw new Error('Upload failed');
    } catch (e) {
      console.error('Resume upload failed', e);
      throw e;
    }
  };

  const handleTriggerScrape = async () => {
    setIsScraping(true);
    try {
      const res = await authedFetch('/api/jobs/scrape', { method: 'POST' });
      if (res.ok) {
        setTimeout(async () => {
          await loadJobs();
          setIsScraping(false);
        }, 5000);
      } else {
        setIsScraping(false);
      }
    } catch (e) {
      setIsScraping(false);
    }
  };

  const handleTriggerLeadScrape = async (query: string) => {
    setIsScrapingLeads(true);
    try {
      const res = await authedFetch('/api/contacts/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (res.ok) {
        setTimeout(async () => {
          await loadContacts();
          setIsScrapingLeads(false);
        }, 6000);
      } else {
        setIsScrapingLeads(false);
      }
    } catch (e) {
      setIsScrapingLeads(false);
    }
  };

  const handleSendEmail = async (id: string) => {
    try {
      const res = await authedFetch(`/api/contacts/${id}/send`, { method: 'POST' });
      if (!res.ok) throw new Error('Send failed');
      await loadContacts();
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleUpdateDraft = async (id: string, emailDraft: string) => {
    try {
      await authedFetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailDraft })
      });
      await loadContacts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRegenerateDraft = async (id: string): Promise<string> => {
    try {
      const res = await authedFetch(`/api/contacts/${id}/regenerate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await loadContacts();
        return data.draft;
      }
      return '';
    } catch (e) {
      console.error(e);
      return '';
    }
  };


  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo">
          <Zap size={24} style={{ color: 'var(--accent-secondary)' }} />
          <span>JobHit</span>
        </div>
        
        <nav className="nav-links">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>

          <button 
            className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <MessageSquare size={18} />
            AI Preferences
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            <Briefcase size={18} />
            Jobs Board
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'startups' ? 'active' : ''}`}
            onClick={() => setActiveTab('startups')}
          >
            <Mail size={18} />
            Startup Discovery
          </button>

          <button 
            className={`nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
          >
            <Send size={18} />
            Bulk Campaigns
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            Settings
          </button>
        </nav>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 'auto' }}>
          Running locally on Desktop
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="main-content">
        
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>JobHit Analytics</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Overview of automated job search and email outreach funnels</p>
            </div>
            
            <DashboardStats jobs={jobs} contacts={contacts} />
            <JobList 
              jobs={jobs} 
              onSelectJob={setSelectedJob} 
              onTriggerScrape={handleTriggerScrape} 
              isScraping={isScraping} 
            />
          </div>
        )}

        {activeTab === 'preferences' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Career Preferences</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Configure targets using dialogue or direct JSON configs</p>
            </div>

            <ChatPreferenceTab 
              preference={preference}
              onSavePreferences={handleSavePreferences}
              onTriggerChat={handleTriggerChat}
              onClearChat={handleClearChat}
            />
          </div>
        )}

        {activeTab === 'jobs' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Applications Board</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Monitor search matching profiles, auto-applications, and skipped duplicates</p>
            </div>
            
            <JobList 
              jobs={jobs} 
              onSelectJob={setSelectedJob} 
              onTriggerScrape={handleTriggerScrape} 
              isScraping={isScraping} 
            />
          </div>
        )}

        {activeTab === 'startups' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Startup Discovery</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Discover locations specific startups and contact recruitment leads</p>
            </div>

            <StartupContacts 
              contacts={contacts.filter(c => c.campaignId === null)}
              onTriggerLeadScrape={handleTriggerLeadScrape}
              onSendEmail={handleSendEmail}
              onUpdateDraft={handleUpdateDraft}
              onRegenerateDraft={handleRegenerateDraft}
              isScrapingLeads={isScrapingLeads}
            />
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Bulk Email Outreach</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Upload CSV contact lists, construct templates, and manage bulk campaigns</p>
            </div>

            <CampaignTab 
              campaigns={campaigns}
              contacts={contacts}
              onUploadCampaign={handleUploadCampaign}
              onSendEmail={handleSendEmail}
              onRefreshCampaigns={loadCampaigns}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>System Settings</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Manage credentials, SMTP config, and target profiles</p>
            </div>

            <SettingsPanel 
              settings={settings}
              onSaveSetting={handleSaveSetting}
              onUploadResume={handleUploadResume}
            />
          </div>
        )}

      </main>

      {/* Details Side Drawer Modal */}
      {selectedJob && (
        <JobDetailsModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
          onRefresh={async () => {
            await loadJobs();
            const freshJob = jobs.find(j => j.id === selectedJob.id);
            if (freshJob) setSelectedJob(freshJob);
          }}
        />
      )}

    </div>
  );
}
