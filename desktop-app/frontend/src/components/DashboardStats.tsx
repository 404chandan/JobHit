import React from 'react';
import { Briefcase, Send, AlertCircle, CheckCircle, FolderPlus, Globe, Copy } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  company: string;
  status: string;
  score: number | null;
  createdAt: string;
}

interface Contact {
  id: string;
  companyName: string;
  status: string;
  campaignId: string | null;
}

interface StatsProps {
  jobs: Job[];
  contacts: Contact[];
}

export const DashboardStats: React.FC<StatsProps> = ({ jobs, contacts }) => {
  // Calculations
  const totalScraped = jobs.length;
  
  // Total startups discovered: Unique company names in leads list (ad-hoc leads)
  const adhocLeads = contacts.filter(c => c.campaignId === null);
  const uniqueCompanies = Array.from(new Set(adhocLeads.map(c => c.companyName))).length;
  
  // Filters matching
  const matchingJobs = jobs.filter(j => (j.score || 0) >= 3.0 && j.status !== 'Skipped').length;
  
  // Applications submitted
  const autoApplied = jobs.filter(j => j.status === 'Applied_Auto').length;
  const manualApplied = jobs.filter(j => j.status === 'Applied_Manual').length;
  const jobApplications = autoApplied + manualApplied;
  const emailsSent = contacts.filter(c => c.status === 'Sent').length;

  // Skipped duplicates
  const skippedDuplicates = jobs.filter(j => j.status === 'Skipped').length;

  // Failed applications
  const failedApps = jobs.filter(j => j.status === 'Failed').length;

  // Success Rate (Applied vs total candidates)
  const successRate = totalScraped > 0 
    ? Math.round(((autoApplied + manualApplied) / Math.max(matchingJobs, 1)) * 100) 
    : 0;

  // Chart data extraction (last 7 days counts)
  const getDailyStats = () => {
    const dailyCounts: { [key: string]: { scraped: number; applied: number } } = {};
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyCounts[dateStr] = { scraped: 0, applied: 0 };
    }

    jobs.forEach(job => {
      const dateStr = new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyCounts[dateStr]) {
        dailyCounts[dateStr].scraped++;
        if (job.status === 'Applied_Auto' || job.status === 'Applied_Manual') {
          dailyCounts[dateStr].applied++;
        }
      }
    });

    return Object.keys(dailyCounts).map(date => ({
      date,
      scraped: dailyCounts[date].scraped,
      applied: dailyCounts[date].applied
    }));
  };

  const chartData = getDailyStats();
  const maxVal = Math.max(...chartData.map(d => Math.max(d.scraped, d.applied, 5)));

  return (
    <div>
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {/* Total Startups Discovered */}
        <div className="glass-panel stat-card">
          <div className="stat-info">
            <h3>Startups Discovered</h3>
            <div className="stat-value">{uniqueCompanies}</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}>
            <Globe size={18} />
          </div>
        </div>

        {/* Active Jobs Found */}
        <div className="glass-panel stat-card">
          <div className="stat-info">
            <h3>Active Jobs Scraped</h3>
            <div className="stat-value">{totalScraped}</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
            <Briefcase size={18} />
          </div>
        </div>

        {/* Matching Filters */}
        <div className="glass-panel stat-card">
          <div className="stat-info">
            <h3>Matching Roles</h3>
            <div className="stat-value">{matchingJobs}</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <FolderPlus size={18} />
          </div>
        </div>

        {/* Applications Submitted */}
        <div className="glass-panel stat-card">
          <div className="stat-info">
            <h3>Apps Submitted</h3>
            <div className="stat-value">{jobApplications}</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCircle size={18} />
          </div>
        </div>

        {/* Duplicate Jobs Skipped */}
        <div className="glass-panel stat-card">
          <div className="stat-info">
            <h3>Duplicates Skipped</h3>
            <div className="stat-value">{skippedDuplicates}</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(107, 114, 128, 0.15)', color: 'var(--text-secondary)' }}>
            <Copy size={18} />
          </div>
        </div>

        {/* Outreach Sent */}
        <div className="glass-panel stat-card">
          <div className="stat-info">
            <h3>Outreach Sent</h3>
            <div className="stat-value">{emailsSent}</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Send size={18} />
          </div>
        </div>

        {/* Failed Apps */}
        <div className="glass-panel stat-card">
          <div className="stat-info">
            <h3>Failed Submissions</h3>
            <div className="stat-value" style={{ color: failedApps > 0 ? 'var(--color-danger)' : 'inherit' }}>
              {failedApps}
            </div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertCircle size={18} />
          </div>
        </div>

        {/* Success Rate */}
        <div className="glass-panel stat-card">
          <div className="stat-info">
            <h3>Auto Success Rate</h3>
            <div className="stat-value">{successRate}%</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}>
            <CheckCircle size={18} />
          </div>
        </div>
      </div>

      {/* SVG Chart Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Application & Scraping History (Last 7 Days)</h3>
        <div className="chart-container" style={{ position: 'relative' }}>
          <svg viewBox="0 0 600 220" style={{ width: '100%', height: '100%' }}>
            {/* Grid lines */}
            <line x1="40" y1="20" x2="580" y2="20" stroke="rgba(255,255,255,0.05)" />
            <line x1="40" y1="70" x2="580" y2="70" stroke="rgba(255,255,255,0.05)" />
            <line x1="40" y1="120" x2="580" y2="120" stroke="rgba(255,255,255,0.05)" />
            <line x1="40" y1="170" x2="580" y2="170" stroke="rgba(255,255,255,0.05)" />
            <line x1="40" y1="170" x2="580" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

            {/* Y axis labels */}
            <text x="15" y="24" className="chart-text">{Math.round(maxVal)}</text>
            <text x="15" y="74" className="chart-text">{Math.round(maxVal * 0.75)}</text>
            <text x="15" y="124" className="chart-text">{Math.round(maxVal * 0.5)}</text>
            <text x="15" y="174" className="chart-text">0</text>

            {/* Bars */}
            {chartData.map((d, index) => {
              const xPos = 60 + index * 75;
              const barWidth = 22;
              
              const scrapedHeight = (d.scraped / maxVal) * 140;
              const appliedHeight = (d.applied / maxVal) * 140;

              return (
                <g key={d.date}>
                  <rect
                    x={xPos}
                    y={170 - scrapedHeight}
                    width={barWidth}
                    height={scrapedHeight}
                    fill="#6366f1"
                    rx="3"
                    style={{ opacity: 0.8 }}
                  />
                  <rect
                    x={xPos + barWidth + 4}
                    y={170 - appliedHeight}
                    width={barWidth}
                    height={appliedHeight}
                    fill="#14b8a6"
                    rx="3"
                    style={{ opacity: 0.8 }}
                  />
                  <text
                    x={xPos + barWidth}
                    y="192"
                    textAnchor="middle"
                    className="chart-text"
                    style={{ fill: 'var(--text-secondary)' }}
                  >
                    {d.date}
                  </text>
                </g>
              );
            })}
          </svg>

          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
              <div style={{ width: '12px', height: '12px', background: '#6366f1', borderRadius: '3px' }}></div>
              <span>Jobs Scraped</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
              <div style={{ width: '12px', height: '12px', background: '#14b8a6', borderRadius: '3px' }}></div>
              <span>Jobs Applied</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
