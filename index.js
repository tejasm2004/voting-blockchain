const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const http = require('http');
const Web3 = require('web3');
const contract = require('@truffle/contract');

require('dotenv').config();

const app = express();

const GANACHE_RPC = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(GANACHE_RPC);
const web3 = new Web3(provider);

function getFreshContract() {
  try {
    const artifactPath = path.join(__dirname, 'build/contracts/Voting.json');
    if (!fs.existsSync(artifactPath)) return null;
    const raw = fs.readFileSync(artifactPath, 'utf8');
    const artifact = JSON.parse(raw);
    const Contract = contract(artifact);
    Contract.setProvider(provider);
    return Contract;
  } catch (e) {
    console.warn("Failed to load fresh contract artifact:", e.message);
    return null;
  }
}


function getRegisteredVotersCount() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:8000/election_readiness', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.voters_count || 0);
        } catch (e) {
          resolve(0);
        }
      });
    }).on('error', () => resolve(0));
  });
}

app.get('/api/election_status', async (req, res) => {
  try {
    let cCount = 0;
    let status = 'SETUP';
    let startSec = 0;
    let endSec = 0;
    const nowSec = Math.floor(Date.now() / 1000);

    const Contract = getFreshContract();
    if (Contract) {
      try {
        const instance = await Contract.deployed();
        cCount = parseInt((await instance.getCountCandidates()).toString(), 10);
        status = await instance.getElectionStatus();
        const dates = await instance.getDates();
        startSec = parseInt(dates[0].toString(), 10);
        endSec = parseInt(dates[1].toString(), 10);
      } catch (err) {
        console.warn("Contract query fallback:", err.message);
      }
    }

    let derivedStatus = 'SETUP';
    if (startSec > 0 && endSec > 0) {
      if (nowSec >= endSec) {
        derivedStatus = 'CONCLUDED';
      } else if (nowSec >= startSec) {
        derivedStatus = 'ACTIVE';
      } else {
        derivedStatus = 'UPCOMING';
      }
    } else if (status === 'CONCLUDED') {
      derivedStatus = 'CONCLUDED';
    }

    const votersCount = await getRegisteredVotersCount();
    const hasCandidates = cCount >= 1;
    const hasVoters = votersCount >= 1;
    const isTimelineActive = (derivedStatus === 'ACTIVE');
    const isConcluded = (derivedStatus === 'CONCLUDED');
    const allPrereqsMet = hasCandidates && hasVoters && isTimelineActive;

    res.json({
      candidates_count: cCount,
      voters_count: votersCount,
      election_status: derivedStatus,
      raw_contract_status: status,
      voting_start: startSec,
      voting_end: endSec,
      now_sec: nowSec,
      has_candidates: hasCandidates,
      has_voters: hasVoters,
      is_timeline_active: isTimelineActive,
      is_concluded: isConcluded,
      all_prereqs_met: allPrereqsMet
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Election Endpoint (Wipes candidates, restores state to SETUP, clears photos audit, & unlocks database)
app.post('/api/reset_election', async (req, res) => {
  try {
    const Contract = getFreshContract();
    if (Contract) {
      const accounts = await web3.eth.getAccounts();
      const instance = await Contract.deployed();
      await instance.resetElection({ from: accounts[0], gas: 3000000 });
    }

    // Unlock voters database configuration
    try {
      await fetch('http://127.0.0.1:8000/set_election_lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: false })
      });
    } catch (e) {}

    // Clear photo audit logs for fresh election round
    try {
      await fetch('http://127.0.0.1:8000/clear_audit_logs', {
        method: 'POST'
      });
    } catch (e) {}

    res.json({ success: true, message: "Election successfully reset to SETUP mode. Candidates cleared, audit logs reset." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Authorization middleware
const authorizeUser = (req, res, next) => {
  let token = req.query.Authorization || req.query.token || req.headers.authorization;
  if (token && typeof token === 'string') {
    if (token.startsWith('Bearer ')) {
      token = token.substring(7).trim();
    } else if (token.includes('Bearer')) {
      token = token.split('Bearer')[1].trim();
    }
  }

  if (token) {
    try {
      const decodedToken = jwt.verify(token, process.env.SECRET_KEY, { algorithms: ['HS256'] });
      req.user = decodedToken;
      return next();
    } catch (error) {
      console.warn("Invalid token in query, falling back to client-side auth check:", error.message);
    }
  }
  
  // Allow rendering so client-side localStorage/session check can handle or redirect smoothly
  next();
};


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/login.html'));
});

app.get('/js/login.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/login.js'))
});

app.get('/css/login.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/login.css'))
});

app.get('/css/index.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/index.css'))
});

app.get('/css/admin.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/admin.css'))
});

app.get('/css/style_major.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/style_major.css'))
});

app.get('/assets/eth5.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/assets/eth5.jpg'))
});

app.get('/js/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/app.js'))
});

app.get('/admin.html', authorizeUser, (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/admin.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/index.html'));
});

app.get('/dist/login.bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/dist/login.bundle.js'));
});

app.get('/dist/app.bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/dist/app.bundle.js'));
});

// Serve the favicon.ico file
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/favicon.ico'));
});

// Start the server
app.listen(8080, () => {
  console.log('Server listening on http://localhost:8080');
});
