import { useState, useEffect } from 'react';
import { Zap, Shield, Key, Download, CheckCircle, HelpCircle, Lock, ArrowRight } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('jobhit_portal_token'));
  const [email, setEmail] = useState<string | null>(localStorage.getItem('jobhit_portal_email'));
  const [hasPaid, setHasPaid] = useState<boolean>(false);
  
  const [view, setView] = useState<'landing' | 'auth' | 'unlocked'>('landing');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Auto load profile on load
  useEffect(() => {
    if (token) {
      loadProfile();
    }
  }, [token]);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHasPaid(data.hasPaid);
        setView('unlocked');
      } else {
        // Token expired
        handleLogout();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jobhit_portal_token');
    localStorage.removeItem('jobhit_portal_email');
    setToken(null);
    setEmail(null);
    setHasPaid(false);
    setView('landing');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    setIsLoading(true);
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('jobhit_portal_token', data.token);
        localStorage.setItem('jobhit_portal_email', data.email);
        setToken(data.token);
        setEmail(data.email);
        setHasPaid(data.hasPaid);
        setView('unlocked');
        setIsLoading(false);
      } else {
        setStatusMsg(`Error: ${data.error || 'Authentication failed'}`);
        setIsLoading(false);
      }
    } catch (err) {
      setStatusMsg('Error: Network communication failed.');
      setIsLoading(false);
    }
  };

  const triggerMockPayment = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHasPaid(data.hasPaid);
        setPaymentSuccess(true);
        setTimeout(() => {
          setShowPaymentModal(false);
          setPaymentSuccess(false);
        }, 1500);
      } else {
        alert('Payment registration failed.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerDownload = async () => {
    try {
      const res = await fetch('/api/auth/download', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Download failed.');
        return;
      }
      
      // Handle file download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'desktop-app.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('Download trigger failed', e);
      alert('Failed to trigger download. Please make sure the desktop app build is compiled.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Premium Navbar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.25rem 2rem',
        borderBottom: '1px solid var(--border-light)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'rgba(10, 10, 15, 0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setView(token ? 'unlocked' : 'landing')}>
          <Zap size={26} style={{ color: 'var(--accent-secondary)' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.02em' }}>JobHit</span>
        </div>
        <div>
          {token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{email}</span>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleLogout}>Log Out</button>
            </div>
          ) : (
            <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => { setView('auth'); setIsRegistering(false); }}>Log In</button>
          )}
        </div>
      </header>

      {/* Main Panel Content Area */}
      <main style={{ flex: 1, padding: '3rem 2rem', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        
        {/* VIEW 1: LANDING PAGE */}
        {view === 'landing' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            {/* Hero Section */}
            <div style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
              <span style={{
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid var(--border-active)',
                color: 'var(--text-primary)',
                padding: '0.35rem 0.85rem',
                borderRadius: '50px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                🔒 100% Private Local Execution
              </span>
              <h1 style={{
                fontSize: '3.5rem',
                fontWeight: 800,
                marginTop: '1.5rem',
                marginBottom: '1rem',
                background: 'linear-gradient(135deg, #ffffff, #9ca3af)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: '1.2'
              }}>
                The Smartest AI Job Scraper & <br/>Auto-Applier, Runs on Your Desktop
              </h1>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '1.15rem',
                maxWidth: '700px',
                margin: '0 auto 2.5rem auto',
                lineHeight: '1.6'
              }}>
                Scrapes targeted LinkedIn positions, evaluates them against your custom profile using Gemini AI, and auto-applies with Playwright. Stored locally, secure, and immune to account limits.
              </p>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="btn btn-primary" style={{ padding: '0.8rem 1.75rem', fontSize: '0.95rem' }} onClick={() => { setView('auth'); setIsRegistering(true); }}>
                  Get Started Now <ArrowRight size={18} style={{ marginLeft: '0.25rem' }} />
                </button>
                <a href="#features" className="btn btn-secondary" style={{ padding: '0.8rem 1.75rem', fontSize: '0.95rem' }}>
                  Explore Features
                </a>
              </div>
            </div>

            {/* Core Pillars */}
            <div id="features" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginBottom: '5rem'
            }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <Shield size={32} style={{ color: 'var(--accent-secondary)', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Full Data Ownership</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                  Your LinkedIn cookies, SMTP configurations, and resumes never leave your machine. No shared databases, no risk of data breaches.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '2rem' }}>
                <Zap size={32} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>AI Matching Engine</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                  Integrated with Gemini 1.5 Flash to automatically grade job roles, filter out mismatches, and draft personalized outreach.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '2rem' }}>
                <Key size={32} style={{ color: 'var(--color-warning)', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Account Protection</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                  Runs Playwright sessions on your local IP address. Leverages conservative 8-hour intervals and randomized human delays to protect your LinkedIn ID.
                </p>
              </div>
            </div>

            {/* How it Works / Pricing Call to Action */}
            <div className="glass-panel" style={{
              padding: '3rem',
              textAlign: 'center',
              background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent), var(--bg-card)',
              border: '1px solid var(--border-active)'
            }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>Get the Desktop Package</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 2rem auto', lineHeight: '1.6' }}>
                Create a secure web-portal account to explore detailed dashboard capacities. Purchase the complete pre-compiled local package for just 1 Rupee, and run it locally forever.
              </p>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: '#ffffff',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem'
              }}>
                <span style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>₹</span>1
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ Lifetime license</span>
              </div>
              <button className="btn btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '0.95rem' }} onClick={() => { setView('auth'); setIsRegistering(true); }}>
                Register to Download
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: AUTH PAGE */}
        {view === 'auth' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="glass-panel" style={{ width: '400px', padding: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <Zap size={28} style={{ color: 'var(--accent-secondary)' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{isRegistering ? 'Create Portal Account' : 'Log In to Portal'}</h2>
              </div>
              
              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)} 
                    placeholder="e.g. you@example.com" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)} 
                    placeholder="Enter password" 
                    required 
                  />
                </div>

                {statusMsg && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)', textAlign: 'center' }}>
                    {statusMsg}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} disabled={isLoading}>
                  {isRegistering ? 'Sign Up' : 'Log In'}
                </button>
              </form>

              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {isRegistering ? (
                  <span>Already have an account? <a href="#" style={{ color: 'var(--accent-primary)', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setIsRegistering(false); setStatusMsg(''); }}>Log In</a></span>
                ) : (
                  <span>Need an account? <a href="#" style={{ color: 'var(--accent-primary)', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setIsRegistering(true); setStatusMsg(''); }}>Register</a></span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: UNLOCKED SHOWCASE & ZIP DOWNLOAD PANEL */}
        {view === 'unlocked' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
              <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Welcome to the JobHit Portal</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Review features and capacities below, then complete the 1-Rupee licensing to download the local package.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
              
              {/* Left Column: Detailed Capacity Showcase */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: '#ffffff' }}>Desktop Product Capacity & Tech Specifications</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Scraper Engine:</span>
                      <strong style={{ color: 'var(--accent-secondary)' }}>Playwright (Chromium Headless/Headful)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>LLM Integrations:</span>
                      <strong style={{ color: 'var(--accent-secondary)' }}>Gemini 1.5 Flash (via @google/genai SDK)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>DB Cryptography:</span>
                      <strong style={{ color: 'var(--accent-secondary)' }}>Symmetric AES-256-CBC</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Learning Mode:</span>
                      <strong style={{ color: 'var(--accent-secondary)' }}>Active (Screening Question Database Learning)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Job Processing Cap:</span>
                      <strong style={{ color: 'var(--accent-secondary)' }}>User-defined limit (Max jobs processed settings)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Data Storage Location:</span>
                      <strong style={{ color: '#ffffff' }}>Your local MongoDB Database (100% private)</strong>
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <HelpCircle size={18} style={{ color: 'var(--accent-secondary)' }} /> Why Run Locally on Desktop?
                  </h3>
                  <ul style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', lineHeight: '1.5' }}>
                    <li>
                      <strong>IP Rotation & Safety:</strong> Running Playwright requests from the same cloud IP address (e.g. Render, AWS) quickly flags and blocks your LinkedIn account. Running on your own desktop utilizes your home IP.
                    </li>
                    <li>
                      <strong>Session Cookie Safety:</strong> LinkedIn session cookies are extremely sensitive. Running locally avoids uploading your active logins to third-party web servers.
                    </li>
                    <li>
                      <strong>Zero Subscription Cost:</strong> Running the scraper and auto-applier uses your machine resources, which means you only configure your free Gemini/Prisma environments with no recurring hosting costs!
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Download & License Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {hasPaid ? (
                  <div className="glass-panel" style={{ padding: '2.5rem', border: '2px solid var(--accent-secondary)', background: 'rgba(20, 184, 166, 0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-success)' }}>
                      <CheckCircle size={28} />
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>License Verified</h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                      Thank you! You have unlocked the full local desktop application. Download your packaged archive below.
                    </p>
                    
                    <button className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }} onClick={triggerDownload}>
                      <Download size={18} /> Download Desktop App (.zip)
                    </button>
                    
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <strong>Archive details:</strong>
                      <div style={{ marginTop: '0.35rem' }}>Name: <code>desktop-app.zip</code></div>
                      <div>Contains: Backend API (Express), Frontend Client (Vite/React) dashboard, setup guidelines.</div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel" style={{ padding: '2.5rem', border: '2px solid var(--accent-primary)', background: 'rgba(99, 102, 241, 0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>
                      <Lock size={26} />
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Desktop App Locked</h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: '1.5' }}>
                      Unlock lifetime access to the pre-packaged local build by completing the symbolic 1-Rupee activation.
                    </p>
                    
                    <div style={{
                      fontSize: '3rem',
                      fontWeight: 900,
                      color: '#ffffff',
                      marginBottom: '2rem',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>₹</span>1
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}> / One-time license</span>
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 600 }} onClick={() => setShowPaymentModal(true)}>
                      Unlock for 1 Rupee
                    </button>
                  </div>
                )}

                {/* Setup Instructions Card (Quick Overview) */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Local Setup Steps:</h4>
                  <ol style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.25rem', lineHeight: '1.4' }}>
                    <li>Unzip the downloaded <code>desktop-app.zip</code> on your computer.</li>
                    <li>Duplicate <code>.env.example</code> to <code>.env</code> in the <code>backend/</code> folder.</li>
                    <li>Add your local MongoDB URI and Gemini API Key to the <code>.env</code> file.</li>
                    <li>Run <code>npm install</code> in both folders to install dependencies.</li>
                    <li>Compile the frontend, start the server, and open <code>http://localhost:5000/jobhit</code>!</li>
                  </ol>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* UPI QR PAYMENT MODAL */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{
            width: '420px',
            padding: '2.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
            border: '1px solid var(--border-active)',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            {paymentSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <CheckCircle size={64} style={{ color: 'var(--color-success)', animation: 'scaleUp 0.3s ease' }} />
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Payment Successful!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Licensing database updated. Unlocking downloads...</p>
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Secure UPI Payment</span>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setShowPaymentModal(false)}>Close</button>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem' }}>
                  Scan the UPI QR Code with Google Pay, PhonePe, Paytm, or BHIM to pay <strong>1 Rupee</strong> and unlock your download.
                </p>

                {/* Dummy UPI QR Code SVG */}
                <div style={{
                  background: '#ffffff',
                  padding: '1rem',
                  borderRadius: '12px',
                  marginBottom: '1.5rem',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <svg width="180" height="180" viewBox="0 0 100 100" style={{ display: 'block' }}>
                    {/* Mock QR grid structure */}
                    <rect x="0" y="0" width="25" height="25" fill="#000000" />
                    <rect x="3" y="3" width="19" height="19" fill="#ffffff" />
                    <rect x="6" y="6" width="13" height="13" fill="#000000" />

                    <rect x="75" y="0" width="25" height="25" fill="#000000" />
                    <rect x="78" y="3" width="19" height="19" fill="#ffffff" />
                    <rect x="81" y="6" width="13" height="13" fill="#000000" />

                    <rect x="0" y="75" width="25" height="25" fill="#000000" />
                    <rect x="3" y="78" width="19" height="19" fill="#ffffff" />
                    <rect x="6" y="81" width="13" height="13" fill="#000000" />

                    {/* Fake noise inside the QR Code */}
                    <rect x="35" y="10" width="5" height="15" fill="#000000" />
                    <rect x="50" y="5" width="15" height="5" fill="#000000" />
                    <rect x="40" y="30" width="20" height="5" fill="#000000" />
                    <rect x="30" y="45" width="40" height="10" fill="#000000" />
                    <rect x="10" y="40" width="15" height="5" fill="#000000" />
                    <rect x="45" y="60" width="15" height="25" fill="#000000" />
                    <rect x="75" y="40" width="10" height="15" fill="#000000" />
                    <rect x="70" y="70" width="25" height="10" fill="#000000" />
                    <rect x="80" y="85" width="15" height="5" fill="#000000" />
                    <rect x="35" y="80" width="5" height="10" fill="#000000" />
                    
                    {/* Tiny lightning icon in middle of QR */}
                    <path d="M48,35 L40,55 L47,55 L45,70 L55,48 L48,48 Z" fill="#6366f1" />
                  </svg>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>UPI ID:</div>
                  <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>jobhit.outreach@upi</strong>
                </div>

                <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }} onClick={triggerMockPayment} disabled={isLoading}>
                  {isLoading ? 'Processing...' : 'Simulate Payment Success'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-light)',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        background: 'rgba(0,0,0,0.2)'
      }}>
        © 2026 JobHit Automation. Packaged locally for full compliance and data privacy.
      </footer>

    </div>
  );
}
