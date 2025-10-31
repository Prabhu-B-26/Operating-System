import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EditorPage = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchContent = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await axios.get(`http://localhost:8000/api/objects/${fileId}/content/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!isMounted) return;
        setContent(resp.data?.content || '');
      } catch (e) {
        if (!isMounted) return;
        setError('Failed to load file content.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (token && fileId) fetchContent();
    return () => { isMounted = false; };
  }, [fileId, token]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axios.patch(`http://localhost:8000/api/objects/${fileId}/content/`, { content }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMessage('Saved successfully.');
    } catch (e) {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scanline" style={{
      height: 'calc(100vh - 120px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      background: 'linear-gradient(135deg, rgba(10, 10, 15, 0.95), rgba(15, 10, 30, 0.95))',
      border: '2px solid #00ff9f',
      boxShadow: '0 0 20px rgba(0, 255, 159, 0.4), inset 0 0 30px rgba(0, 255, 159, 0.05)',
      padding: '12px',
      borderRadius: '4px'
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={() => navigate('/dashboard')}>Back to Terminal</button>
        <button onClick={handleSave} disabled={saving || loading}>{saving ? 'Saving...' : 'Save'}</button>
        {loading && <span className="neon-blue" style={{ marginLeft: 8 }}>Loading...</span>}
        {message && <span className="neon-text" style={{ marginLeft: 8 }}>{message}</span>}
        {error && <span className="neon-pink" style={{ marginLeft: 8 }}>{error}</span>}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="glow-border"
        style={{
          flex: 1,
          width: '100%',
          resize: 'none',
          background: 'rgba(10, 10, 15, 0.8)',
          color: '#00ff9f',
          border: '2px solid #00ff9f',
          boxShadow: '0 0 5px rgba(0, 255, 159, 0.2), inset 0 0 5px rgba(0, 255, 159, 0.05)',
          fontFamily: 'Rajdhani, monospace',
          fontSize: '16px',
          padding: '12px',
          outline: 'none'
        }}
      />
    </div>
  );
};

export default EditorPage;
