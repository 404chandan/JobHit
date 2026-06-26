import React, { useState } from 'react';
import { Search, RefreshCw, Eye, ArrowUpRight } from 'lucide-react';

interface Job {
  id: string;
  jobId: string;
  title: string;
  company: string;
  location: string;
  status: string;
  score: number | null;
  linkedinUrl: string;
  createdAt: string;
}

interface JobListProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onTriggerScrape: () => Promise<void>;
  isScraping: boolean;
}

export const JobList: React.FC<JobListProps> = ({ jobs, onSelectJob, onTriggerScrape, isScraping }) => {
  const [statusFilter, setStatusFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Local filter logic
  const filteredJobs = jobs.filter(job => {
    // 1. Status Filter
    if (statusFilter && job.status !== statusFilter) return false;

    // 2. Score Filter
    if (scoreFilter) {
      const minScore = parseFloat(scoreFilter);
      if (job.score === null || job.score < minScore) return false;
    }

    // 3. Search Query (Title or Company)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!job.title.toLowerCase().includes(q) && !job.company.toLowerCase().includes(q)) return false;
    }

    // 4. Day Filter
    if (dayFilter) {
      const now = new Date();
      const jobDate = new Date(job.createdAt);
      const diffTime = Math.abs(now.getTime() - jobDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (dayFilter === 'today' && diffDays > 1) return false;
      if (dayFilter === 'yesterday' && (diffDays <= 1 || diffDays > 2)) return false;
      if (dayFilter === 'week' && diffDays > 7) return false;
    }

    return true;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Applied_Auto': return 'Applied (Auto)';
      case 'Applied_Manual': return 'External Apply';
      case 'Requires_Action': return 'Action Required';
      default: return status;
    }
  };

  const getScoreClass = (score: number | null) => {
    if (score === null) return '';
    if (score >= 4.0) return 'score-high';
    if (score >= 3.0) return 'score-mid';
    return 'score-low';
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Discovered Jobs</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Review parsed roles and automation results</p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={onTriggerScrape}
          disabled={isScraping}
        >
          <RefreshCw size={16} className={isScraping ? 'spin-anim' : ''} />
          {isScraping ? 'Scraping LinkedIn...' : 'Scrape Now'}
        </button>
      </div>

      {/* Filter controls */}
      <div className="filter-bar">
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by title or company..." 
            className="form-input" 
            style={{ paddingLeft: '2.25rem', width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <select 
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Scraped">Not Applied / Unmatched</option>
          <option value="Queue">Auto-Apply Queue</option>
          <option value="Applied_Auto">Applied (Auto)</option>
          <option value="Applied_Manual">External Apply</option>
          <option value="Requires_Action">Action Required</option>
          <option value="Failed">Failed</option>
        </select>

        {/* Match Score Filter */}
        <select 
          className="filter-select"
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value)}
        >
          <option value="">Any Match Score</option>
          <option value="4.0">Highly Matching (≥4.0)</option>
          <option value="3.0">Matching (≥3.0)</option>
          <option value="2.0">Weak Match (≥2.0)</option>
        </select>

        {/* Date Filter */}
        <select 
          className="filter-select"
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
        >
          <option value="">All Dates</option>
          <option value="today">Scraped Today</option>
          <option value="yesterday">Scraped Yesterday</option>
          <option value="week">Past 7 Days</option>
        </select>
      </div>

      {/* Jobs table */}
      <div className="table-container">
        {filteredJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No jobs found matching your current filters. Click "Scrape Now" to scan LinkedIn.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Job Title</th>
                <th>Company</th>
                <th>Location</th>
                <th>Date Discovered</th>
                <th>Match Score</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map(job => (
                <tr key={job.id}>
                  <td style={{ fontWeight: 600 }}>{job.title}</td>
                  <td>{job.company}</td>
                  <td>{job.location}</td>
                  <td>{new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    {job.score !== null ? (
                      <div className={`score-circle ${getScoreClass(job.score)}`}>
                        {job.score.toFixed(1)}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${job.status.toLowerCase()}`}>
                      {getStatusLabel(job.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                        onClick={() => onSelectJob(job)}
                      >
                        <Eye size={12} />
                        Details
                      </button>
                      <a 
                        href={job.linkedinUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                      >
                        <ArrowUpRight size={12} />
                        LinkedIn
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
