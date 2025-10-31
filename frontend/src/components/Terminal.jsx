import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Terminal = () => {
  const [history, setHistory] = useState(['Welcome to Virtual OS!']);
  const [input, setInput] = useState('');
  const [currentPath, setCurrentPath] = useState([{ id: null, name: '~' }]);
  const [filesInCurrentDir, setFilesInCurrentDir] = useState([]);
  const [inputMode, setInputMode] = useState({ active: false, targetFile: null, append: false });
  const { token, user } = useAuth();
  const terminalEndRef = useRef(null);
  const navigate = useNavigate();

  const getCurrentDirId = () => currentPath[currentPath.length - 1].id;
  const getCurrentPathString = () => currentPath.map(p => p.name).join('/');

  const fetchFiles = async (directoryId) => {
    const parentId = directoryId === null ? 'null' : directoryId;
    try {
      const response = await axios.get(`http://localhost:8000/api/objects/?parent=${parentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setFilesInCurrentDir(response.data);
    } catch (error) { 
      setHistory(prev => [...prev, 'Error: Could not fetch files.']);
    }
  };

  const handleOpenEditor = () => {
    const fname = window.prompt('Enter filename to edit:');
    if (!fname) return;
    const f = filesInCurrentDir.find(x => x.name === fname);
    if (!f) {
      setHistory(prev => [...prev, `${getCurrentPathString()}> edit ${fname}`, `edit: ${fname}: No such file`]);
      return;
    }
    if (f.is_directory) {
      setHistory(prev => [...prev, `${getCurrentPathString()}> edit ${fname}`, `edit: ${fname}: Is a directory`]);
      return;
    }
    navigate(`/editor/${f.id}`);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const fullInput = input.trim();
    let newHistory = [...history];

    if (inputMode.active) {
      newHistory.push(`... ${fullInput}`);
      try {
        await axios.patch(`http://localhost:8000/api/objects/${inputMode.targetFile.id}/content/`, 
          { 
            content: fullInput,
            append: inputMode.append 
          },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      } catch (error) {
        newHistory.push('Error: Could not write to file.');
      }
      setInputMode({ active: false, targetFile: null, append: false });
      setHistory(newHistory);
      setInput('');
      return;
    }

    if (!fullInput) {
      setHistory([...history, `${getCurrentPathString()}>`]);
      setInput('');
      return;
    }
    newHistory.push(`${getCurrentPathString()}> ${fullInput}`);
    const [command, ...args] = fullInput.split(' ');

    let commandOutput = '';

    switch (command) {
      case 'ls':
        await fetchFiles(getCurrentDirId());
        let filesData = [...filesInCurrentDir];
        if (args.includes('-lt')) {
          filesData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        if (args.includes('-al')) {
          commandOutput = filesData.map(f => `${f.permissions} ${f.owner} ${f.id}\t${f.created_at.substring(0, 10)}\t${f.name}${f.is_directory ? '/' : ''}`).join('\n');
        } else {
          commandOutput = filesData.map(f => f.name).join('\t');
        }
        newHistory.push(commandOutput || ' ');
        break;
      case 'kill': {
        const pid = parseInt(args[0], 10);
        if (isNaN(pid)) { newHistory.push('Usage: kill <PID>'); break; }
        try {
          await axios.delete(`http://localhost:8000/api/processes/${pid}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          newHistory.push(`Terminated process ${pid}`);
        } catch (e) {
          newHistory.push(`kill: ${pid}: failed`);
        }
        break; }

      case 'edit': {
        const fname = args[0];
        if (!fname) { newHistory.push('Usage: edit <filename>'); break; }
        const f = filesInCurrentDir.find(x => x.name === fname);
        if (!f) { newHistory.push(`edit: ${fname}: No such file`); break; }
        if (f.is_directory) { newHistory.push(`edit: ${fname}: Is a directory`); break; }
        navigate(`/editor/${f.id}`);
        break; }
      case 'pkill': {
        const name = args[0];
        if (!name) { newHistory.push('Usage: pkill <name>'); break; }
        try {
          const resp = await axios.post('http://localhost:8000/api/processes/pkill/', { name }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          newHistory.push(`Killed ${resp.data.killed || 0} process(es)`);
        } catch (e) {
          newHistory.push('pkill failed');
        }
        break; }
      case 'chmod': {
        let perm = args[0];
        const fname = args[1];
        if (!perm || !fname) { newHistory.push('Usage: chmod <permissions> <filename>'); break; }
        const target = filesInCurrentDir.find(f => f.name === fname);
        if (!target) { newHistory.push(`chmod: cannot access '${fname}': No such file or directory`); break; }
        try {
          // Convert numeric (e.g., 755 or 400) to symbolic rwxrwxrwx
          const toBits = (n) => ({
            r: (n & 4) ? 'r' : '-',
            w: (n & 2) ? 'w' : '-',
            x: (n & 1) ? 'x' : '-',
          });
          if (/^\d{3}$/.test(perm)) {
            const o = parseInt(perm[0], 10), g = parseInt(perm[1], 10), ot = parseInt(perm[2], 10);
            const ob = toBits(o), gb = toBits(g), tb = toBits(ot);
            perm = `${ob.r}${ob.w}${ob.x}${gb.r}${gb.w}${gb.x}${tb.r}${tb.w}${tb.x}`;
          }
          await axios.patch(`http://localhost:8000/api/objects/${target.id}/`, { permissions: perm }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          await fetchFiles(getCurrentDirId());
          newHistory.push('');
        } catch (e) {
          newHistory.push('chmod failed');
        }
        break; }
      case 'whoami': {
        newHistory.push(user?.username || 'anonymous');
        break; }
      case 'echo': {
        // If no redirection, print to screen
        if (args.length === 0) { newHistory.push(''); break; }
        const text = fullInput.slice(5).trim();
        if (text.includes('>')) {
          newHistory.push('echo redirection not supported; use cat > or cat >>');
        } else {
          const unquoted = text.replace(/^\"|\"$/g, '').replace(/^'|'$/g, '');
          newHistory.push(unquoted);
        }
        break; }
      case 'date':
      case 'time':
      case 'Get-Date': {
        newHistory.push(new Date().toString());
        break; }
      case 'Get-TimeZone': {
        try {
          newHistory.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
        } catch {
          newHistory.push('');
        }
        break; }
      case 'cal': {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-based
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
        let out = `${now.toLocaleString('default', { month: 'long' })} ${year}\n${days.join(' ')}\n`;
        let line = Array(first.getDay()).fill('  ').join(' ');
        for (let d = 1; d <= last.getDate(); d++) {
          const dayStr = d.toString().padStart(2,' ');
          line += (line.length ? ' ' : '') + dayStr;
          if ((first.getDay() + d) % 7 === 0 || d === last.getDate()) { out += line + '\n'; line = ''; }
        }
        newHistory.push(out.trimEnd());
        break; }
      case 'Set-Date': {
        newHistory.push('Set-Date: This command is not supported in the simulation.');
        break; }
      case 'mem_view': {
        navigate('/memory');
        break; }
      case 'df':
      case 'quota': {
        try {
          const resp = await axios.get('http://localhost:8000/api/quota/', { headers: { 'Authorization': `Bearer ${token}` } });
          const used = resp.data.storage_used;
          const limit = resp.data.storage_limit;
          newHistory.push(`Disk usage: ${used} / ${limit} bytes`);
        } catch (e) {
          newHistory.push('quota: failed to fetch quota');
        }
        break; }
      case 'grep': {
        const parts = fullInput.split(/\s+/);
        let flagsStr = '';
        let i = 1;
        while (i < parts.length && parts[i].startsWith('-')) {
          flagsStr += parts[i].slice(1);
          i++;
        }
        let rest = fullInput.split(/\s+/).slice(i).join(' ');
        let patMatch = rest.match(/^"([^"]+)"\s+(.+)$/) || rest.match(/^([^\s]+)\s+(.+)$/);
        if (!patMatch) { newHistory.push('Usage: grep [-ivnc] "pattern" <filename>'); break; }
        const pattern = patMatch[1];
        const fname = patMatch[2].trim();
        const f = filesInCurrentDir.find(x => x.name === fname);
        if (!f) { newHistory.push(`grep: ${fname}: No such file`); break; }
        if (f.is_directory) { newHistory.push(`grep: ${fname}: Is a directory`); break; }
        const insensitive = flagsStr.includes('i');
        const invert = flagsStr.includes('v');
        const withNumbers = flagsStr.includes('n');
        const countOnly = flagsStr.includes('c');
        try {
          const resp = await axios.get(`http://localhost:8000/api/objects/${f.id}/content/`, { headers: { 'Authorization': `Bearer ${token}` } });
          const content = resp.data.content || '';
          const lines = content.split('\n');
          const pat = insensitive ? pattern.toLowerCase() : pattern;
          const matches = [];
          for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            const hay = insensitive ? line.toLowerCase() : line;
            const ok = hay.includes(pat);
            const finalOk = invert ? !ok : ok;
            if (finalOk) {
              if (withNumbers && !countOnly) {
                matches.push(`${idx + 1}:${line}`);
              } else if (!countOnly) {
                matches.push(line);
              } else {
                matches.push('');
              }
            }
          }
          if (countOnly) {
            newHistory.push(String(matches.length));
          } else {
            newHistory.push(matches.join('\n'));
          }
        } catch { newHistory.push('grep failed'); }
        break; }
      case 'sed': {
        const delMatch = fullInput.match(/^sed\s+"\/(.*)\/d"\s+(.+)$/);
        const subMatch = fullInput.match(/^sed\s+"s\/(.*?)\/(.*?)\/(gi|ig|g|i)?"\s+(.+)$/);
        if (!delMatch && !subMatch) { newHistory.push('Usage: sed "s/old/new/[g|i|gi]" <filename> or sed "/pattern/d" <filename>'); break; }
        let fname;
        try {
          if (delMatch) {
            const pattern = delMatch[1];
            fname = delMatch[2].trim();
            const f = filesInCurrentDir.find(x => x.name === fname);
            if (!f) { newHistory.push(`sed: ${fname}: No such file`); break; }
            if (f.is_directory) { newHistory.push(`sed: ${fname}: Is a directory`); break; }
            const resp = await axios.get(`http://localhost:8000/api/objects/${f.id}/content/`, { headers: { 'Authorization': `Bearer ${token}` } });
            const content = resp.data.content || '';
            const out = content.split('\n').filter(line => !line.includes(pattern)).join('\n');
            newHistory.push(out);
          } else if (subMatch) {
            const oldText = subMatch[1];
            const newText = subMatch[2];
            const flags = (subMatch[3] || '').toLowerCase();
            fname = subMatch[4].trim();
            const f = filesInCurrentDir.find(x => x.name === fname);
            if (!f) { newHistory.push(`sed: ${fname}: No such file`); break; }
            if (f.is_directory) { newHistory.push(`sed: ${fname}: Is a directory`); break; }
            const resp = await axios.get(`http://localhost:8000/api/objects/${f.id}/content/`, { headers: { 'Authorization': `Bearer ${token}` } });
            let content = resp.data.content || '';
            const insensitive = flags.includes('i');
            const global = flags.includes('g');
            if (!insensitive && !global) {
              content = content.replace(oldText, newText);
            } else if (!insensitive && global) {
              content = content.split(oldText).join(newText);
            } else if (insensitive && !global) {
              const re = new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
              content = content.replace(re, newText);
            } else {
              const re = new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
              content = content.replace(re, newText);
            }
            newHistory.push(content);
          }
        } catch { newHistory.push('sed failed'); }
        break; }
      case 'awk': {
        const simple = fullInput.match(/^awk\s+'\{print\s+\$(\d+)\}'\s+(.+)$/);
        const whole = fullInput.match(/^awk\s+'\{print\s+\$(0)\}'\s+(.+)$/);
        const patternPrint = fullInput.match(/^awk\s+'\/(.+)\/\s+\{print\s+\$(\d+)\}'\s+(.+)$/);
        let fname, out = '';
        try {
          if (simple || whole) {
            const col = simple ? parseInt(simple[1], 10) : 0;
            fname = (simple ? simple[2] : whole[2]).trim();
            const f = filesInCurrentDir.find(x => x.name === fname);
            if (!f) { newHistory.push(`awk: ${fname}: No such file`); break; }
            if (f.is_directory) { newHistory.push(`awk: ${fname}: Is a directory`); break; }
            const resp = await axios.get(`http://localhost:8000/api/objects/${f.id}/content/`, { headers: { 'Authorization': `Bearer ${token}` } });
            const content = resp.data.content || '';
            out = content.split('\n').map(line => {
              if (col === 0) return line;
              const parts = line.trim().split(/\s+/);
              return parts[col - 1] || '';
            }).join('\n');
          } else if (patternPrint) {
            const pattern = patternPrint[1];
            const col = parseInt(patternPrint[2], 10);
            fname = patternPrint[3].trim();
            const f = filesInCurrentDir.find(x => x.name === fname);
            if (!f) { newHistory.push(`awk: ${fname}: No such file`); break; }
            if (f.is_directory) { newHistory.push(`awk: ${fname}: Is a directory`); break; }
            const resp = await axios.get(`http://localhost:8000/api/objects/${f.id}/content/`, { headers: { 'Authorization': `Bearer ${token}` } });
            const content = resp.data.content || '';
            out = content.split('\n').filter(line => line.includes(pattern)).map(line => {
              const parts = line.trim().split(/\s+/);
              return parts[col - 1] || '';
            }).join('\n');
          } else {
            newHistory.push("Usage: awk '{print $N}' <filename> or awk '{print $0}' <filename> or awk '/pattern/ {print $N}' <filename>");
            break;
          }
          newHistory.push(out);
        } catch { newHistory.push('awk failed'); }
        break; }

      case 'mkdir':
      case 'touch':
        if (!args[0]) { newHistory.push(`Usage: ${command} <name>`); break; }
        try {
          await axios.post('http://localhost:8000/api/objects/', 
            { name: args[0], is_directory: command === 'mkdir', parent: getCurrentDirId() },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          await fetchFiles(getCurrentDirId());
        } catch (error) { newHistory.push(`Error: Could not create ${args[0]}`); }
        break;

      case 'cat':
        if (args[0] === '>' || args[0] === '>>') {
          const operator = args[0];
          const writeFileName = args[1];
          if (!writeFileName) { newHistory.push(`Usage: cat ${operator} <filename>`); break; }
          let writeFile = filesInCurrentDir.find(f => f.name === writeFileName);
          
          if (writeFile && writeFile.is_directory) { 
            newHistory.push(`cat: ${writeFileName}: Is a directory`); 
            break; 
          }
          
          if (!writeFile) {
              await axios.post('http://localhost:8000/api/objects/', 
                { name: writeFileName, is_directory: false, parent: getCurrentDirId() },
                { headers: { 'Authorization': `Bearer ${token}` } }
              );
              await fetchFiles(getCurrentDirId());
              writeFile = filesInCurrentDir.find(f => f.name === writeFileName);
          }
          setInputMode({ active: true, targetFile: writeFile, append: operator === '>>' });
          newHistory.push(`Enter content for ${writeFileName} and press Enter:`);
        
        } else { 
          const readFileName = args[0];
          if (!readFileName) { newHistory.push('Usage: cat <filename>'); break; }
          const readFile = filesInCurrentDir.find(f => f.name === readFileName);
          if (readFile) {
            if (readFile.is_directory) { newHistory.push(`cat: ${readFileName}: Is a directory`); break; }
            try {
              const response = await axios.get(`http://localhost:8000/api/objects/${readFile.id}/content/`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              newHistory.push(response.data.content || '');
            } catch (error) { newHistory.push(`Error: Could not read file.`); }
          } else { newHistory.push(`cat: no such file: ${readFileName}`); }
        }
        break;

      case 'more':
      case 'head':
      case 'tail':
        const fileName = args[0];
        if (!fileName) { newHistory.push(`Usage: ${command} <file_name>`); break; }
        const fileToRead = filesInCurrentDir.find(f => f.name === fileName);
        if (fileToRead) {
          if (fileToRead.is_directory) { newHistory.push(`${command}: ${fileName}: Is a directory`); break; }
          try {
            const response = await axios.get(`http://localhost:8000/api/objects/${fileToRead.id}/content/`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            commandOutput = response.data.content || '';
            if (command === 'head') commandOutput = commandOutput.split('\n').slice(0, 10).join('\n');
            if (command === 'tail') commandOutput = commandOutput.split('\n').slice(-10).join('\n');
            newHistory.push(commandOutput);
          } catch(error) { newHistory.push(`Error: Could not read file.`); }
        } else { newHistory.push(`${command}: no such file: ${fileName}`); }
        break;
      
      case 'rm':
        const targetFileName = args[0];
        if (!targetFileName) { newHistory.push('Usage: rm <name>'); break; }
        const targetFile = filesInCurrentDir.find(f => f.name === targetFileName);
        if (targetFile) {
          if (window.confirm(`Are you sure you want to delete ${targetFileName}?`)) {
            try {
              await axios.delete(`http://localhost:8000/api/objects/${targetFile.id}/`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              await fetchFiles(getCurrentDirId());
            } catch (error) { newHistory.push(`Error: Could not remove ${targetFileName}.`); }
          }
        } else { newHistory.push(`rm: no such file or directory: ${targetFileName}`); }
        break;
        
      case 'pwd': newHistory.push(getCurrentPathString()); break;
      case 'cd':
        const targetDirName = args[0];
        if (!targetDirName || targetDirName === '~') { setCurrentPath([{ id: null, name: '~' }]);
        } else if (targetDirName === '..') {
          if (currentPath.length > 1) setCurrentPath(currentPath.slice(0, -1));
        } else {
          const targetDir = filesInCurrentDir.find(f => f.is_directory && f.name === targetDirName);
          if (targetDir) { setCurrentPath([...currentPath, { id: targetDir.id, name: targetDir.name }]);
          } else { newHistory.push(`cd: no such directory: ${targetDirName}`); }
        }
        break;
      case 'mv': case 'cp':
        if (args.length < 2) { newHistory.push(`Usage: ${command} <source> <destination>`); break; }
        const sourceFile = filesInCurrentDir.find(f => f.name === args[0]);
        if (!sourceFile) { newHistory.push(`${command}: no such file or directory: ${args[0]}`); break; }
        try {
          if (command === 'mv') { 
            await axios.patch(`http://localhost:8000/api/objects/${sourceFile.id}/`, { name: args[1] }, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
          } else { 
            await axios.post('http://localhost:8000/api/objects/', 
              { name: args[1], is_directory: sourceFile.is_directory, parent: getCurrentDirId(), content: sourceFile.content },
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
          }
          await fetchFiles(getCurrentDirId());
        } catch (error) { newHistory.push(`Error: Operation failed.`); }
        break;
      case 'exec':
        const execTarget = args[0];
        if (!execTarget) { newHistory.push('Usage: exec <filename>'); break; }
        const program = filesInCurrentDir.find(f => f.name === execTarget);
        if (!program) { newHistory.push(`exec: no such file: ${execTarget}`); break; }
        if (program.is_directory) { newHistory.push(`exec: ${execTarget}: Is a directory`); break; }
        try {
          const resp = await axios.post('http://localhost:8000/api/processes/',
            { file_object: program.id },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          newHistory.push(`Process created with PID: ${resp.data.id}`);
        } catch (error) {
          newHistory.push('Error: Could not create process.');
        }
        break;
      case 'ps':
        try {
          const resp = await axios.get('http://localhost:8000/api/processes/', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const rows = resp.data;
          if (!rows || rows.length === 0) {
            newHistory.push('No processes.');
          } else {
            const header = 'PID\tSTATUS\tFILE';
            const body = rows.map(p => `${p.id}\t${p.status}\t${p.file_name || ''}`).join('\n');
            newHistory.push(`${header}\n${body}`);
          }
        } catch (error) {
          newHistory.push('Error: Could not fetch processes.');
        }
        break;
      case 'clear': setHistory([]); setInput(''); return;
      default: newHistory.push(`command not found: ${command}`);
    }

    setHistory(newHistory);
    setInput('');
  };
  
  useEffect(() => {
    if (token) fetchFiles(getCurrentDirId());
  }, [currentPath, token]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  return (
    <div className="scanline" style={{ 
      padding: '20px', 
      background: 'linear-gradient(135deg, rgba(10, 10, 15, 0.95), rgba(15, 10, 30, 0.95))',
      border: '2px solid #00ff9f',
      boxShadow: '0 0 20px rgba(0, 255, 159, 0.4), inset 0 0 30px rgba(0, 255, 159, 0.05)',
      color: '#00ff9f', 
      fontFamily: 'Rajdhani, monospace', 
      height: '500px', 
      overflowY: 'auto',
      position: 'relative',
      borderRadius: '4px'
    }}>
      <div style={{ position: 'relative', zIndex: 2, marginBottom: '10px', display: 'flex', gap: '10px' }}>
        <button onClick={handleOpenEditor}>Open Editor...</button>
        <button onClick={() => navigate('/dashboard')}>Back to Terminal</button>
      </div>
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
        {history.map((line, index) => (
          <pre key={index} style={{ 
            margin: 0, 
            whiteSpace: 'pre-wrap',
            color: '#00ff9f',
            textShadow: '0 0 5px rgba(0, 255, 159, 0.5)',
            fontSize: '15px',
            lineHeight: '1.6',
            fontWeight: 500
          }}>{line}</pre>
        ))}
        <div ref={terminalEndRef} />
      </div>
      <form onSubmit={handleFormSubmit} style={{ position: 'relative', zIndex: 1 }}>
        <span style={{
          color: '#ff006e',
          textShadow: '0 0 5px #ff006e',
          fontWeight: 700,
          fontSize: '16px'
        }}>{inputMode.active ? '...' : `${getCurrentPathString()}>`}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#00d9ff', 
            width: '90%', 
            outline: 'none', 
            fontFamily: 'Rajdhani, monospace',
            fontSize: '16px',
            fontWeight: 500,
            textShadow: '0 0 5px rgba(0, 217, 255, 0.5)',
            marginLeft: '8px'
          }}
          autoFocus
        />
      </form>
    </div>
  );
};

export default Terminal;