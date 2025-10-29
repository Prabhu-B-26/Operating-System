import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FileManager from './components/FileManager';
import MemoryViewer from './pages/MemoryViewer';
import { useAuth } from './context/AuthContext';
import './App.css';

function App() {
  const { user, logout } = useAuth();

  return (
    <Router>
      <header style={{
        background: 'linear-gradient(135deg, rgba(10, 10, 15, 0.9), rgba(26, 10, 46, 0.9))',
        borderBottom: '2px solid #00ff9f',
        boxShadow: '0 0 20px rgba(0, 255, 159, 0.3), 0 5px 30px rgba(0, 217, 255, 0.2)',
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <h1 className="neon-text hologram" style={{
          margin: 0,
          fontSize: '2.5rem',
          fontFamily: 'Orbitron, monospace',
          letterSpacing: '4px',
          textTransform: 'uppercase'
        }}>
          ⚡ Virtual OS ⚡
        </h1>
        {user && (
          <button onClick={logout} style={{
            background: 'linear-gradient(135deg, rgba(255, 0, 110, 0.2), rgba(0, 217, 255, 0.2))',
            borderColor: '#ff006e',
            color: '#ff006e'
          }}>
            Logout
          </button>
        )}
      </header>
      <main style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
        <Routes>
          <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={user ? <FileManager /> : <Navigate to="/login" />} />
          <Route path="/memory" element={user ? <MemoryViewer /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;