import React, { useState } from 'react';
import { Upload, Mail, Eye, Send } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  template: string;
  createdAt: string;
}

interface Contact {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  emailDraft: string | null;
  status: string;
  campaignId: string | null;
}

interface CampaignTabProps {
  campaigns: Campaign[];
  contacts: Contact[];
  onUploadCampaign: (formData: FormData) => Promise<any>;
  onSendEmail: (id: string) => Promise<void>;
  onRefreshCampaigns: () => void;
}

export const CampaignTab: React.FC<CampaignTabProps> = ({
  campaigns,
  contacts,
  onUploadCampaign,
  onSendEmail,
  onRefreshCampaigns
}) => {
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState('');
  const [templateText, setTemplateText] = useState(
    "Hi {{name}},\n\nI hope you're doing well. I recently noticed engineering openings at {{company}} and wanted to reach out. With my experience in Software Engineering at Siemens and HighRadius, I'm highly interested in {{role}} positions.\n\nI've attached my resume for your review. Would you be open to a brief chat next week?\n\nBest regards,\nChandan Pandey"
  );
  const [file, setFile] = useState<File | null>(null);
  
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewContactId, setPreviewContactId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !campaignName || !subject || !templateText) {
      setStatusMsg('Error: Please fill in all fields and select a CSV file.');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg('Uploading CSV & importing contacts...');

    const formData = new FormData();
    formData.append('campaignCsv', file);
    formData.append('campaignName', campaignName);
    formData.append('subject', subject);
    formData.append('templateText', templateText);

    try {
      const data = await onUploadCampaign(formData);
      setStatusMsg(`Success! Imported ${data.contactsImported} contacts into "${campaignName}".`);
      setCampaignName('');
      setSubject('');
      setFile(null);
      onRefreshCampaigns();
    } catch (err) {
      setStatusMsg('Error: Failed to process CSV campaign upload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter contacts by selected campaign
  const filteredContacts = selectedCampaignId
    ? contacts.filter(c => c.campaignId === selectedCampaignId)
    : contacts.filter(c => c.campaignId !== null); // show all campaign contacts

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return 'Ad-hoc';
    const c = campaigns.find(cam => cam.id === campaignId);
    return c ? c.name : 'Unknown';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. CSV Campaign Creator */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Mail size={20} style={{ color: 'var(--accent-primary)' }} />
          Create Bulk Outreach Campaign
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Upload a CSV contact list and define a reusable template with variables: <code>{"{{name}}"}</code>, <code>{"{{company}}"}</code>, and <code>{"{{role}}"}</code>.
        </p>

        <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label>Campaign Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Bangalore Startup Founders June"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Subject Line</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Software Engineer Roles at {{company}}"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Outreach Email Template Body</label>
            <textarea 
              className="form-textarea" 
              style={{ minHeight: '160px', fontSize: '0.875rem', lineHeight: '1.5' }}
              value={templateText}
              onChange={e => setTemplateText(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                Select CSV Spreadsheet
                <input 
                  type="file" 
                  accept=".csv" 
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  required
                />
              </label>
              {file && <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{file.name}</span>}
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              Launch Campaign Queue
            </button>
          </div>
          
          {statusMsg && (
            <div style={{ fontSize: '0.875rem', color: statusMsg.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)', marginTop: '0.5rem' }}>
              {statusMsg}
            </div>
          )}
        </form>
      </div>

      {/* 2. Campaign Queues & Previewer */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Outreach Campaign Grid</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Review parsed spreadsheet leads and draft lists</p>
          </div>

          <select 
            className="filter-select"
            value={selectedCampaignId}
            onChange={e => setSelectedCampaignId(e.target.value)}
          >
            <option value="">All Campaigns</option>
            {campaigns.map(cam => (
              <option key={cam.id} value={cam.id}>{cam.name}</option>
            ))}
          </select>
        </div>

        <div className="table-container">
          {filteredContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No campaign contacts found. Create a campaign above.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Company</th>
                  <th>Recipient</th>
                  <th>Email Address</th>
                  <th>Outreach Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map(c => (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{getCampaignName(c.campaignId)}</td>
                      <td style={{ fontWeight: 600 }}>{c.companyName}</td>
                      <td>{c.contactName}</td>
                      <td><code>{c.email}</code></td>
                      <td>
                        <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => setPreviewContactId(previewContactId === c.id ? null : c.id)}
                          >
                            <Eye size={12} /> Preview
                          </button>
                          <button 
                            className="btn btn-teal" 
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => onSendEmail(c.id)}
                            disabled={c.status === 'Sent'}
                          >
                            <Send size={12} /> Send
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Draft Previewer */}
                    {previewContactId === c.id && (
                      <tr>
                        <td colSpan={6} style={{ background: 'rgba(255,255,255,0.01)', padding: '1.25rem' }}>
                          <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.3)', borderStyle: 'dashed' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                              GENERATED OUTREACH PITCH
                            </span>
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              {c.emailDraft || 'No draft content generated.'}
                            </pre>
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

    </div>
  );
};
