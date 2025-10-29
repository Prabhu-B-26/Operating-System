import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // 1. Import useAuth
import { Link } from 'react-router-dom';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const auth = useAuth(); // 2. Get the auth context

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post('http://localhost:8000/api/token/', {
        username: username,
        password: password,
      });
      console.log('Login successful:', response.data);

      // 3. Call the login function with the user and token
      auth.login({ username: username }, response.data.access);

      alert('Login successful!');
    } catch (error) {
      console.error('There was an error logging in!', error);
      alert('Error logging in. Please check your credentials.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div className="glow-border scanline" style={{
        background: 'linear-gradient(135deg, rgba(10, 10, 15, 0.95), rgba(26, 10, 46, 0.95))',
        padding: 40,
        maxWidth: 450,
        width: '100%',
        position: 'relative',
        borderRadius: 4
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'linear-gradient(rgba(0, 255, 159, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 159, 0.02) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          pointerEvents: 'none',
          opacity: 0.3
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="neon-text hologram" style={{
            fontFamily: 'Orbitron, monospace',
            fontSize: '2.5rem',
            marginBottom: 30,
            textAlign: 'center',
            letterSpacing: '3px',
            textTransform: 'uppercase'
          }}>⚡ Login ⚡</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ 
                display: 'block',
                marginBottom: 8,
                color: '#00d9ff',
                fontWeight: 600,
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                textShadow: '0 0 5px rgba(0, 217, 255, 0.5)'
              }}>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>
            <div>
              <label style={{ 
                display: 'block',
                marginBottom: 8,
                color: '#00d9ff',
                fontWeight: 600,
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                textShadow: '0 0 5px rgba(0, 217, 255, 0.5)'
              }}>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>
            <button type="submit" style={{ 
              marginTop: 10,
              padding: '14px',
              fontSize: '16px'
            }}>Access System</button>
          </form>
          <p style={{ 
            marginTop: 25,
            textAlign: 'center',
            color: 'rgba(0, 255, 159, 0.7)',
            fontSize: '14px'
          }}>
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;