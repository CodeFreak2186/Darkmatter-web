document.addEventListener('DOMContentLoaded', async () => {
  const urlDisplay = document.getElementById('url');
  const scanBtn = document.getElementById('scanBtn');
  const profileSelect = document.getElementById('profile');
  const statusDisplay = document.getElementById('status');

  // Fetch current tab URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      // Validate it's a scanable URL
      if (!tab.url.startsWith('http')) {
        urlDisplay.textContent = 'Non-scannable page';
        urlDisplay.style.color = '#ff4444';
        scanBtn.disabled = true;
      } else {
        urlDisplay.textContent = tab.url;
      }
    }
  } catch (error) {
    urlDisplay.textContent = 'Error fetching URL';
  }

  scanBtn.addEventListener('click', async () => {
    const target = urlDisplay.textContent;
    const profile = profileSelect.value;

    if (target === 'Fetching...' || target === 'Non-scannable page' || target === 'Error fetching URL') {
      return;
    }

    // Update UI for scanning
    scanBtn.classList.add('scanning');
    scanBtn.disabled = true;
    statusDisplay.className = '';
    statusDisplay.textContent = 'Initiating scan pipeline...';
    statusDisplay.style.display = 'block';

    try {
      // Make request to the local Darkmatter Python backend
      // Note: Assuming the Python backend is running on localhost:8001
      const response = await fetch('http://localhost:8000/api/scan/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: target,
          profile: profile,
          mode: 'scan' // parallel AI agents mode
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.jobId) {
        statusDisplay.className = 'status-success';
        statusDisplay.innerHTML = `<strong>Scan Initiated!</strong><br>ID: ${data.jobId.slice(0, 8)}...`;
        
        // Show results section
        document.getElementById('results').style.display = 'block';
        
        // Start listening to the stream
        listenToScanStream(data.jobId, target, profile);
      } else {
        throw new Error('Failed to retrieve Job ID');
      }
    } catch (error) {
      statusDisplay.className = 'status-error';
      statusDisplay.textContent = `Error: ${error.message}`;
      console.error('Scan Request Error:', error);
    } finally {
      scanBtn.classList.remove('scanning');
      scanBtn.disabled = false;
    }
  });

  function listenToScanStream(jobId, target, profile) {
    const findingsList = document.getElementById('findings-list');
    findingsList.innerHTML = ''; // Clear initial message

    const url = `http://localhost:8000/api/scan/stream/${jobId}?target=${encodeURIComponent(target)}&mode=scan&profile=${profile}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('finding', (event) => {
      addFinding(JSON.parse(event.data));
    });

    eventSource.addEventListener('status', (event) => {
      updateStatus(JSON.parse(event.data).message);
    });

    eventSource.addEventListener('terminal', (event) => {
      addLog(JSON.parse(event.data));
    });

    eventSource.addEventListener('complete', (event) => {
      statusDisplay.innerHTML = '<strong>Scan Complete!</strong>';
      statusDisplay.className = 'status-success';
      eventSource.close();
    });

    eventSource.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      statusDisplay.textContent = `Error: ${data.message}`;
      statusDisplay.className = 'status-error';
      eventSource.close();
    });

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      eventSource.close();
    };
  }

  function addFinding(finding) {
    const findingsList = document.getElementById('findings-list');
    const findingDiv = document.createElement('div');
    
    const colors = {
      critical: '#ff0000',
      high: '#ff4444',
      medium: '#ffbb33',
      low: '#00C851',
      info: '#33b5e5'
    };
    
    const icons = {
      critical: '🛑',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
      info: '🔵'
    };

    const sev = (finding.severity || 'info').toLowerCase();
    const color = colors[sev] || colors.info;
    const icon = icons[sev] || icons.info;
    
    findingDiv.style.cssText = `
      background: #111;
      border-left: 4px solid ${color};
      padding: 10px;
      margin-bottom: 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      border: 1px solid #222;
      border-left-width: 4px;
    `;
    
    findingDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <div style="font-weight: bold; color: ${color}; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px;">
          ${icon} ${sev}
        </div>
        <div style="font-size: 0.6rem; color: #555; background: #222; padding: 2px 6px; border-radius: 10px;">
          ${finding.tool || 'AI Agent'}
        </div>
      </div>
      <div style="color: #eee; font-weight: 500; margin-bottom: 4px;">${finding.title}</div>
      <div style="color: #666; font-size: 0.7rem; font-family: monospace; word-break: break-all;">
        ${finding.path || finding.endpoint || '/'}
      </div>
    `;
    
    findingsList.prepend(findingDiv);
  }

  function addLog(log) {
    const findingsList = document.getElementById('findings-list');
    const logDiv = document.createElement('div');
    logDiv.style.cssText = `
      background: #000;
      border-left: 2px solid #444;
      padding: 4px 8px;
      margin-bottom: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.7rem;
      color: #888;
    `;
    logDiv.textContent = `[${log.phase.toUpperCase()}] ${log.log}`;
    findingsList.prepend(logDiv);
  }

  function updateStatus(message) {
    statusDisplay.innerHTML = `<strong>Status:</strong> ${message}`;
  }
});
