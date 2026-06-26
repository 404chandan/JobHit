import React, { useState } from 'react';
import { Send, RefreshCw, Edit, Sparkles } from 'lucide-react';

interface Contact {
  id: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  email: string;
  emailDraft: string | null;
  status: string;
  sentAt: string | null;
}

interface StartupContactsProps {
  contacts: Contact[];
  onTriggerLeadScrape: (query: string) => Promise<void>;
  onSendEmail: (id: string) => Promise<void>;
  onUpdateDraft: (id: string, newDraft: string) => Promise<void>;
  onRegenerateDraft: (id: string) => Promise<string>;
  isScrapingLeads: boolean;
}

export const StartupContacts: React.FC<StartupContactsProps> = ({
  contacts,
  onTriggerLeadScrape,
  onSendEmail,
  onUpdateDraft,
  onRegenerateDraft,
  isScrapingLeads
}) => {
  const [searchQuery, setSearchQuery] = useState('tech startups Bangalore');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [sendStatusMessage, setSendStatusMessage] = useState<{ [key: string]: string }>({});

  const handleEditClick = (contact: Contact) => {
    setEditingContactId(contact.id);
    setDraftContent(contact.emailDraft || '');
  };

  const handleSaveDraft = async (id: string) => {
    await onUpdateDraft(id, draftContent);
    setEditingContactId(null);
  };

  const handleRegenerate = async (id: string) => {
    setIsRegenerating(true);
    const newDraft = await onRegenerateDraft(id);
    setDraftContent(newDraft);
    setIsRegenerating(false);
  };

  const handleSendMailClick = async (id: string) => {
    setSendStatusMessage(prev => ({ ...prev, [id]: 'Sending...' }));
    try {
      await onSendEmail(id);
      setSendStatusMessage(prev => ({ ...prev, [id]: 'Sent Successfully!' }));
    } catch (e) {
      setSendStatusMessage(prev => ({ ...prev, [id]: 'Failed to send. Configure SMTP.' }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Search Startups Trigger Panel */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Automated Lead Generation</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Discover Bangalore tech startups and find recruiter / founder LinkedIn profiles & email patterns.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            className="form-input" 
            style={{ flex: 1, minWidth: '250px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search query e.g. tech startups Bangalore"
          />
          <button 
            className="btn btn-primary"
            onClick={() => onTriggerLeadScrape(searchQuery)}
            disabled={isScrapingLeads}
          >
            <RefreshCw size={16} className={isScrapingLeads ? 'spin-anim' : ''} />
            {isScrapingLeads ? 'Scraping Google & LinkedIn...' : 'Find New Leads'}
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Startup Recruiters & Cold Email Queue</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Personalized pitches are drafted automatically using Gemini. Cold emails are sent automatically every morning at 9:00 AM.
        </p>

        <div className="table-container">
          {contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No leads found. Click "Find New Leads" above to populate contacts.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact Person</th>
                  <th>Role</th>
                  <th>Target Email</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td style={{ fontWeight: 600 }}>{c.companyName}</td>
                      <td>{c.contactName}</td>
                      <td>{c.contactTitle}</td>
                      <td><code>{c.email}</code></td>
                      <td>
                        <span className={`badge badge-${c.status.toLowerCase()}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                            onClick={() => handleEditClick(c)}
                          >
                            <Edit size={12} />
                            Draft
                          </button>
                          <button 
                            className="btn btn-teal" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                            onClick={() => handleSendMailClick(c.id)}
                            disabled={c.status === 'Sent'}
                          >
                            <Send size={12} />
                            Send Now
                          </button>
                        </div>
                        {sendStatusMessage[c.id] && (
                          <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: sendStatusMessage[c.id].includes('Failed') ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {sendStatusMessage[c.id]}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Editing Area */}
                    {editingContactId === c.id && (
                      <tr>
                        <td colSpan={6} style={{ background: 'rgba(255,255,255,0.01)', padding: '1.5rem' }}>
                          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(10, 10, 15, 0.4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Review Pitch for {c.contactName}
                              </span>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                  onClick={() => handleRegenerate(c.id)}
                                  disabled={isRegenerating}
                                >
                                  <Sparkles size={12} />
                                  {isRegenerating ? 'Writing...' : 'Regenerate Draft'}
                                </button>
                                <button 
                                  className="btn btn-primary"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                  onClick={() => handleSaveDraft(c.id)}
                                >
                                  Save changes
                                </button>
                                <button 
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                  onClick={() => setEditingContactId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>

                            <textarea 
                              className="form-textarea"
                              style={{ width: '100%', minHeight: '180px', fontFamily: 'monospace', fontSize: '0.875rem' }}
                              value={draftContent}
                              onChange={e => setDraftContent(e.target.value)}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
