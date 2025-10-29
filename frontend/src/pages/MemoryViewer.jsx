import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const FrameBox = ({ idx, data }) => {
  const isFree = !data;
  const label = isFree ? `Frame ${idx}: Free` : `Frame ${idx}: PID ${data.pid}, VPage ${data.v_page}`;
  return (
    <div className={isFree ? '' : 'hologram'} style={{
      border: `2px solid ${isFree ? 'rgba(0, 255, 159, 0.3)' : '#00ff9f'}`,
      borderRadius: 0,
      padding: 12,
      minWidth: 150,
      textAlign: 'center',
      background: isFree 
        ? 'linear-gradient(135deg, rgba(10, 10, 15, 0.5), rgba(15, 10, 30, 0.5))'
        : 'linear-gradient(135deg, rgba(0, 255, 159, 0.15), rgba(0, 217, 255, 0.15))',
      color: isFree ? 'rgba(0, 255, 159, 0.5)' : '#00ff9f',
      boxShadow: isFree 
        ? '0 0 5px rgba(0, 255, 159, 0.1)'
        : '0 0 15px rgba(0, 255, 159, 0.5), inset 0 0 10px rgba(0, 255, 159, 0.1)',
      fontFamily: 'Rajdhani, monospace',
      fontWeight: 600,
      fontSize: '14px',
      textShadow: isFree ? 'none' : '0 0 5px rgba(0, 255, 159, 0.8)',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {!isFree && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'linear-gradient(rgba(0, 255, 159, 0.05) 1px, transparent 1px)',
          backgroundSize: '4px 4px',
          pointerEvents: 'none'
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>{label}</div>
    </div>
  );
};

const MemoryViewer = () => {
  const { token } = useAuth();
  const [frames, setFrames] = useState([]);
  const [running, setRunning] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const [flash, setFlash] = useState(false);
  const navigate = useNavigate();

  const fetchSnapshot = async () => {
    try {
      const resp = await axios.get('http://localhost:8000/api/memory-snapshot/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFrames(resp.data.frames || []);
      setRunning(resp.data.running || null);
      if (resp.data.last_event !== lastEvent) {
        setLastEvent(resp.data.last_event);
        if (resp.data.last_event && String(resp.data.last_event).includes('Page Fault')) {
          setFlash(true);
          setTimeout(() => setFlash(false), 600);
        }
      }
    } catch (e) {
      // ignore polling errors
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchSnapshot();
    const id = setInterval(fetchSnapshot, 1000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <div className="scanline" style={{ 
      padding: 30, 
      color: '#00ff9f', 
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 50%, #0f0a1e 100%)', 
      minHeight: '100vh', 
      fontFamily: 'Rajdhani, monospace',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: 'linear-gradient(rgba(0, 255, 159, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 159, 0.03) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        pointerEvents: 'none',
        opacity: 0.4
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h2 className="neon-text" style={{ 
          fontFamily: 'Orbitron, monospace',
          fontSize: '2.5rem',
          marginBottom: 20,
          letterSpacing: '3px',
          textTransform: 'uppercase'
        }}>⚡ Memory Viewer ⚡</h2>
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => navigate('/dashboard')}>
            ← Back to Terminal
          </button>
        </div>
        <div style={{ 
          marginBottom: 20,
          padding: 15,
          background: 'linear-gradient(135deg, rgba(255, 0, 110, 0.1), rgba(0, 217, 255, 0.1))',
          border: '2px solid #ff006e',
          boxShadow: '0 0 15px rgba(255, 0, 110, 0.3)',
          borderRadius: 4
        }}>
          <strong className="neon-pink" style={{ fontSize: '18px' }}>Last Event:</strong>{' '}
          <span className={flash ? 'glitch' : ''} style={{ 
            color: flash ? '#ff006e' : '#00d9ff', 
            transition: 'color 0.2s',
            textShadow: flash ? '0 0 10px #ff006e' : '0 0 5px #00d9ff',
            fontWeight: 600,
            fontSize: '16px'
          }}>
            {lastEvent || 'No events yet'}
          </span>
        </div>
        <h3 className="neon-blue" style={{ 
          fontFamily: 'Orbitron, monospace',
          fontSize: '1.8rem',
          marginTop: 30,
          marginBottom: 15,
          letterSpacing: '2px'
        }}>Physical RAM (8 Frames)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, maxWidth: 700, marginBottom: 40 }}>
          {(frames || []).map((fr, idx) => (
            <FrameBox key={idx} idx={idx} data={fr} />
          ))}
        </div>

        <h3 className="neon-blue" style={{ 
          fontFamily: 'Orbitron, monospace',
          fontSize: '1.8rem',
          marginTop: 30,
          marginBottom: 15,
          letterSpacing: '2px'
        }}>Running Process Page Table</h3>
        {running ? (
          <div className="glow-border" style={{ 
            background: 'linear-gradient(135deg, rgba(0, 255, 159, 0.05), rgba(0, 217, 255, 0.05))',
            borderRadius: 4,
            padding: 20,
            maxWidth: 600
          }}>
            <div style={{ fontSize: '18px', marginBottom: 15 }}>
              <strong className="neon-pink">PID:</strong> 
              <span style={{ 
                color: '#00d9ff',
                textShadow: '0 0 5px #00d9ff',
                fontWeight: 700,
                marginLeft: 10
              }}>{running.pid}</span>
            </div>
            <div style={{ marginTop: 15 }}>
              {Object.keys(running.page_table || {}).length === 0 ? (
                <div style={{ color: 'rgba(0, 255, 159, 0.5)', fontStyle: 'italic' }}>No pages mapped yet.</div>
              ) : (
                Object.entries(running.page_table).map(([v, p]) => (
                  <div key={v} style={{
                    padding: '8px 12px',
                    marginBottom: 8,
                    background: 'rgba(0, 255, 159, 0.05)',
                    border: '1px solid rgba(0, 255, 159, 0.3)',
                    borderLeft: '3px solid #00ff9f',
                    fontWeight: 600,
                    textShadow: '0 0 3px rgba(0, 255, 159, 0.5)'
                  }}>
                    {`${v.replace('v_', 'V').replace('_', ' ')} → ${p.replace('p_', 'P').replace('_', ' ')}`}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ 
            color: 'rgba(0, 255, 159, 0.5)',
            fontStyle: 'italic',
            padding: 20,
            border: '1px dashed rgba(0, 255, 159, 0.3)'
          }}>No Running process for your user.</div>
        )}
      </div>
    </div>
  );
};

export default MemoryViewer;
