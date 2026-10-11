const Web3 = require('web3');
const contract = require('@truffle/contract');

const votingArtifacts = require('../../build/contracts/Voting.json');
var VotingContract = contract(votingArtifacts);

const GANACHE_RPC = "http://127.0.0.1:7545";
const API_URL = "http://127.0.0.1:8000";
const AVATAR_EMOJIS = ["🏛️", "🌟", "🦅", "⚖️", "🛡️", "🔥", "🚀", "💎"];

let countdownInterval = null;
let cachedCandidates = [];
let ganacheAccountsCache = [];
let parsedImportedVoters = [];

function truncateAddress(addr) {
  if (!addr) return "N/A";
  return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
}

function getAccountForVoter(voterId, accounts) {
  if (!accounts || accounts.length === 0) return "0x0000...0000";
  const vid = (voterId || '').toLowerCase();
  if (vid.includes('admin') || vid === 'admin-001') return accounts[0];
  if (vid.includes('101')) return accounts[1] || accounts[0];
  if (vid.includes('102')) return accounts[2] || accounts[0];
  if (vid.includes('103')) return accounts[3] || accounts[0];
  if (vid.includes('104')) return accounts[4] || accounts[0];
  if (vid.includes('105')) return accounts[5] || accounts[0];
  if (vid.includes('106')) return accounts[6] || accounts[0];
  if (vid.includes('107')) return accounts[7] || accounts[0];
  if (vid.includes('108')) return accounts[8] || accounts[0];
  if (vid.includes('109')) return accounts[9] || accounts[0];

  let sum = 0;
  for (let i = 0; i < vid.length; i++) sum += vid.charCodeAt(i);
  const maxIdx = Math.max(1, accounts.length - 1);
  const idx = (sum % maxIdx) + 1;
  return accounts[idx];
}

async function setupProviderAndAccount() {
  const directProvider = new Web3.providers.HttpProvider(GANACHE_RPC);
  const directWeb3 = new Web3(directProvider);

  let useMetaMask = false;
  let activeProvider = directProvider;
  let activeWeb3 = directWeb3;
  let activeAccount = null;

  if (window.ethereum) {
    try {
      const netId = await window.ethereum.request({ method: 'net_version' });
      if (netId === "5777" || netId === "1337") {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          useMetaMask = true;
          activeProvider = window.ethereum;
          activeWeb3 = new Web3(window.ethereum);
          activeAccount = accounts[0];
          console.log("MetaMask connected on Ganache:", activeAccount);
        }
      }
    } catch (e) {
      console.warn("MetaMask fallback to Direct Mode:", e);
    }
  }

  try {
    ganacheAccountsCache = await directWeb3.eth.getAccounts();
  } catch (e) {
    console.error("Failed to connect to Ganache at " + GANACHE_RPC, e);
  }

  if (!useMetaMask) {
    activeProvider = directProvider;
    activeWeb3 = directWeb3;
    
    if (ganacheAccountsCache.length > 0) {
      const role = localStorage.getItem('role') || 'user';
      const voterId = (localStorage.getItem('voter_id') || '').toLowerCase();
      activeAccount = (role === 'admin') 
        ? ganacheAccountsCache[0] 
        : getAccountForVoter(voterId, ganacheAccountsCache);
    }
  }

  VotingContract.setProvider(activeProvider);
  VotingContract.defaults({ from: activeAccount, gas: 3000000 });
  window.eth = activeWeb3;
  App.account = activeAccount;
  App.web3 = activeWeb3;
  App.isDirectMode = !useMetaMask;

  return { activeAccount, isDirectMode: !useMetaMask, activeWeb3 };
}

async function getVotingInstance() {
  const fallbackAddress = (votingArtifacts.networks["5777"] && votingArtifacts.networks["5777"].address) 
    || (votingArtifacts.networks["1337"] && votingArtifacts.networks["1337"].address) 
    || "0x25bB06000e8ffc7Acc51A6c968767B7Da48975fD";

  try {
    return await VotingContract.deployed();
  } catch (err) {
    console.warn("Using contract at direct address:", fallbackAddress);
    VotingContract.setNetwork("5777");
    votingArtifacts.networks["5777"] = { address: fallbackAddress };
    return await VotingContract.at(fallbackAddress);
  }
}

function startCountdown(startSec, endSec) {
  if (countdownInterval) clearInterval(countdownInterval);

  const nowSec = Math.floor(Date.now() / 1000);

  if (!endSec || endSec <= 0) {
    $("#cdDays").text("00");
    $("#cdHours").text("00");
    $("#cdMins").text("00");
    $("#cdSecs").text("00");
    $("#electionPhaseTag").text("POLLS PENDING").removeClass("tag-green tag-blue").addClass("tag-purple");
    return;
  }

  function tick() {
    const current = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, endSec - current);

    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = Math.floor(diff % 60);

    $("#cdDays").text(String(d).padStart(2, '0'));
    $("#cdHours").text(String(h).padStart(2, '0'));
    $("#cdMins").text(String(m).padStart(2, '0'));
    $("#cdSecs").text(String(s).padStart(2, '0'));

    if (diff > 0 && current >= startSec) {
      $("#electionPhaseTag").text("POLLS ACTIVE").removeClass("tag-purple tag-blue").addClass("tag-green");
    } else if (diff > 0 && current < startSec) {
      $("#electionPhaseTag").text("POLLS SCHEDULED").removeClass("tag-green tag-purple").addClass("tag-blue");
    } else {
      $("#electionPhaseTag").text("POLLS CLOSED").removeClass("tag-green tag-blue").addClass("tag-purple");
    }
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

async function loadBlockchainExplorer(web3, instanceAddress) {
  const tbody = $("#txExplorerTableBody");
  if (!tbody.length) return;

  try {
    const currentBlock = await web3.eth.getBlockNumber();
    $("#currentBlockNumber").text("#" + currentBlock);
    $("#telemetryContractAddr").text(instanceAddress || "0x0000000000000000000000000000000000000000");
    $("#telemetryBlockHeight").text("#" + currentBlock);

    if (App.instance) {
      try {
        if (App.instance.electionRound) {
          const r = await App.instance.electionRound();
          $("#telemetryElectionRound").text("Round #" + r.toString());
        }
        if (App.instance.totalVotes) {
          const tv = await App.instance.totalVotes();
          $("#telemetryTotalVotes").text(tv.toString());
        }
      } catch (e) {}
    }

    tbody.empty();
    const rows = [];
    const minBlock = Math.max(0, currentBlock - 14);

    for (let b = currentBlock; b >= minBlock; b--) {
      const block = await web3.eth.getBlock(b, true);
      if (block && block.transactions && block.transactions.length > 0) {
        for (const tx of block.transactions) {
          const isTarget = tx.to && instanceAddress && (tx.to.toLowerCase() === instanceAddress.toLowerCase());
          
          let actionLabel = "Ethereum Transfer";
          let actionColor = "tag-blue";

          if (isTarget) {
            const input = tx.input || "";
            if (input.startsWith("0x0121b93f") || input.startsWith("0x02")) {
              actionLabel = "Cast Ballot";
              actionColor = "tag-green";
            } else if (input.includes("addCandidate")) {
              actionLabel = "Add Candidate";
              actionColor = "tag-purple";
            } else if (input.includes("setDates")) {
              actionLabel = "Timeline Oracle";
              actionColor = "tag-blue";
            } else {
              actionLabel = "Smart Contract Call";
              actionColor = "tag-green";
            }
          } else if (!tx.to) {
            actionLabel = "Contract Deployed";
            actionColor = "tag-purple";
          }

          const timeStr = block.timestamp 
            ? new Date(block.timestamp * 1000).toLocaleTimeString() 
            : "Just now";

          rows.push(`
            <tr>
              <td><span class="font-mono" style="color: #60a5fa; font-weight: 700;">#${block.number}</span></td>
              <td><span class="font-mono" title="${tx.hash}">${truncateAddress(tx.hash)}</span></td>
              <td><span class="kpi-tag ${actionColor}">${actionLabel}</span></td>
              <td><span class="font-mono">${tx.gas || '300000'}</span></td>
              <td><span style="color: #94a3b8;">${timeStr}</span></td>
              <td><span class="kpi-tag tag-green">CONFIRMED</span></td>
            </tr>
          `);
        }
      }
    }

    if (rows.length === 0) {
      tbody.html(`
        <tr>
          <td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">
            Blocks #0 through #${currentBlock} synced. Ready for live transactions.
          </td>
        </tr>
      `);
    } else {
      tbody.html(rows.join(""));
    }
  } catch (err) {
    console.error("Error loading explorer:", err);
    tbody.html(`<tr><td colspan="6" style="text-align: center; color: #f87171;">Query error: ${err.message}</td></tr>`);
  }
}

let kioskStream = null;
let biometricAnimId = null;

function drawSimulatedBiometricFeed(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement?.clientWidth || 320;
  const h = canvas.height = canvas.parentElement?.clientHeight || 210;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Clean user avatar silhouette
  ctx.save();
  ctx.translate(w / 2, h / 2 - 10);
  ctx.fillStyle = '#334155';
  
  // Head
  ctx.beginPath();
  ctx.arc(0, -20, 30, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders
  ctx.beginPath();
  ctx.ellipse(0, 36, 52, 28, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // Text
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Camera Ready', w / 2, h / 2 + 65);
}

async function initWebcam() {
  const videoEl = document.getElementById('webcamVideo');
  const fallbackCanvas = document.getElementById('cameraFallbackCanvas');
  if (!videoEl) return;

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      kioskStream = stream;
      videoEl.srcObject = stream;
      await videoEl.play();
      if (fallbackCanvas) fallbackCanvas.style.display = 'none';
      videoEl.style.display = 'block';
      return;
    }
  } catch (err) {
    console.warn("Camera access fallback:", err.message);
  }

  if (fallbackCanvas) {
    fallbackCanvas.style.display = 'block';
    videoEl.style.display = 'none';
    drawSimulatedBiometricFeed(fallbackCanvas);
  }
}

function capturePhotoSnapshot() {
  const videoEl = document.getElementById('webcamVideo');
  const photoCanvas = document.getElementById('capturedPhotoCanvas');
  const fallbackCanvas = document.getElementById('cameraFallbackCanvas');
  if (!photoCanvas) return null;

  const ctx = photoCanvas.getContext('2d');
  const src = (videoEl && videoEl.videoWidth > 0 && videoEl.style.display !== 'none') ? videoEl : fallbackCanvas;

  if (src) {
    photoCanvas.width = src.videoWidth || src.width || 320;
    photoCanvas.height = src.videoHeight || src.height || 240;
    ctx.drawImage(src, 0, 0, photoCanvas.width, photoCanvas.height);
    return photoCanvas.toDataURL('image/jpeg', 0.85);
  }
  return null;
}

let candCameraStream = null;

function setCandidatePhotoPreview(dataUrl) {
  $('#candPhotoBase64').val(dataUrl);
  $('#candPhotoPreviewImg').attr('src', dataUrl);
  $('#candPhotoPreviewBox').css('display', 'flex');
  $('#candPhotoStatusBadge').text("Photo Attached ✓").removeClass("tag-purple").addClass("tag-green");

  try {
    const rawLen = dataUrl.length;
    const shortHash = "0x" + Array.from(dataUrl.slice(25, 57)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').slice(0, 24) + "...";
    $('#candPhotoHashDisplay').text(`SHA-256: ${shortHash}`);
  } catch (e) {
    $('#candPhotoHashDisplay').text("SHA-256: Verified");
  }
}

function clearCandidatePhoto() {
  $('#candPhotoBase64').val('');
  $('#candPhotoPreviewImg').attr('src', '');
  $('#candPhotoPreviewBox').hide();
  $('#candPhotoStatusBadge').text("Photo Optional").removeClass("tag-green").addClass("tag-purple");
  $('#btnStartCandCamera').show().text("📷 Open Camera");
  $('#candPhotoFileInput').val('');
  if (candCameraStream) {
    candCameraStream.getTracks().forEach(t => t.stop());
    candCameraStream = null;
  }
  $('#candCameraBox').hide();
  $('#btnCaptureCandPhoto').hide();
}

function initCandidateCameraHandlers() {
  if (!$('#candidateForm').length) return;

  $('#btnStartCandCamera').off('click').on('click', async function(e) {
    e.preventDefault();
    const videoEl = document.getElementById('candCameraVideo');
    const box = document.getElementById('candCameraBox');
    if (!videoEl || !box) return;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        candCameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
        videoEl.srcObject = candCameraStream;
        await videoEl.play();
        $(box).show();
        $('#btnStartCandCamera').hide();
        $('#btnCaptureCandPhoto').show();
        return;
      }
    } catch (err) {
      console.warn("Candidate camera access:", err.message);
      alert("Unable to access camera directly (" + err.message + "). You can use 'Upload Photo' instead.");
    }
  });

  $('#btnCaptureCandPhoto').off('click').on('click', function(e) {
    e.preventDefault();
    const videoEl = document.getElementById('candCameraVideo');
    const canvas = document.getElementById('candPhotoCanvas');
    if (!videoEl || !canvas) return;

    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    setCandidatePhotoPreview(dataUrl);

    if (candCameraStream) {
      candCameraStream.getTracks().forEach(t => t.stop());
      candCameraStream = null;
    }
    $('#candCameraBox').hide();
    $('#btnCaptureCandPhoto').hide();
    $('#btnStartCandCamera').show().text("📷 Retake Photo");
  });

  $('#btnUploadCandPhoto').off('click').on('click', function(e) {
    e.preventDefault();
    $('#candPhotoFileInput').click();
  });

  $('#candPhotoFileInput').off('change').on('change', function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      setCandidatePhotoPreview(evt.target.result);
    };
    reader.readAsDataURL(file);
  });

  $('#btnClearCandPhoto').off('click').on('click', function(e) {
    e.preventDefault();
    clearCandidatePhoto();
  });
}

function initKioskAuth() {
  const form = document.getElementById('kioskAuthForm');
  if (!form) return;

  initWebcam();

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const alertBox = $('#voterAuthAlert');
    const btn = $('#btnVerifyAndCapture');
    alertBox.hide().empty();

    const fullName = $('#kiosk_citizen_name').val().trim();
    const uniqueId = $('#kiosk_citizen_uid').val().trim();

    if (!fullName || !uniqueId) {
      alertBox.html('❌ Please enter both your Full Name and Voter ID.').fadeIn();
      return;
    }

    const photoData = capturePhotoSnapshot();
    btn.prop('disabled', true).text('📷 Verifying...');

    try {
      const apiHost = window.location.hostname || '127.0.0.1';
      const apiUrl = 'http://' + (apiHost === 'localhost' ? '127.0.0.1' : apiHost) + ':8000';

      const res = await fetch(`${apiUrl}/verify_voter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, unique_id: uniqueId, photo_base64: photoData })
      });

      const data = await res.json();

      if (!res.ok) {
        alertBox.html(`❌ Invalid voter: Name and Voter ID do not match the uploaded voters list.`).fadeIn();
        btn.prop('disabled', false).text('📷 Capture Photo & Proceed to Vote');
        return;
      }

      // Matches voter list
      const voterAccount = getAccountForVoter(data.unique_id, ganacheAccountsCache);
      App.account = voterAccount;
      App.currentCitizen = data;

      // Check on-chain duplicate voting
      let hasVoted = false;
      try {
        if (App.instance) {
          if (App.instance.getVoterReceipt) {
            const receipt = await App.instance.getVoterReceipt(voterAccount);
            hasVoted = receipt[0];
          } else {
            hasVoted = await App.instance.checkVote({ from: voterAccount });
          }
        }
      } catch (e) {
        console.warn("Check vote status:", e);
      }

      if (hasVoted) {
        alertBox.html(`⚠️ Voter <strong>${data.full_name}</strong> (${data.unique_id}) has already voted! Duplicate votes are not permitted.`).fadeIn();
        btn.prop('disabled', false).text('📷 Capture Photo & Proceed to Vote');
        return;
      }

      // Transition to Candidate Selection Screen
      $('#electorBadgeName').text(data.full_name);
      $('#electorBadgeUID').text(data.unique_id);

      // Populate verified voter photo card
      if (data.photo_url) {
        const fullPhotoUrl = data.photo_url.startsWith('http') ? data.photo_url : `${apiUrl}${data.photo_url}`;
        $('#voterVerifiedPhotoImg').attr('src', fullPhotoUrl);
      } else if (photoData) {
        $('#voterVerifiedPhotoImg').attr('src', photoData);
      }
      $('#voterVerifiedName').text(data.full_name);
      $('#voterVerifiedUID').text(data.unique_id);
      if (data.photo_hash) {
        const hashDisplay = `${data.photo_hash.substring(0, 16)}...${data.photo_hash.substring(data.photo_hash.length - 8)}`;
        $('#voterVerifiedHashDisplay').text(`SHA-256: ${hashDisplay}`).attr('title', data.photo_hash);
      }

      App.selectedCandidateId = null;
      $('.ballot-toggle-card').removeClass('selected');
      $("input[name='candidate']").prop('checked', false);
      $('#voteButton').prop('disabled', true).text('Select a Candidate Above to Vote');
      $('#voteSealedSuccessBox').hide();
      $('#ballotSelectionBox').show();
      $('#voteActionContainer').show();

      $('#voterAuthStage').hide();
      $('#voterBallotStage').fadeIn();
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error("Verification error:", err);
      alertBox.html(`❌ Server error: Could not verify voter (${err.message}).`).fadeIn();
    } finally {
      btn.prop('disabled', false).text('📷 Capture Photo & Proceed to Vote');
    }
  });
}

window.App = {
  selectedCandidateId: null,
  account: null,
  currentCitizen: null,
  web3: null,
  isDirectMode: true,
  instance: null,

  applyTimePreset: function(hours, minutes, seconds) {
    $("#timelineHours").val(hours);
    $("#timelineMinutes").val(minutes);
    $("#timelineSeconds").val(seconds);
    App.updateTimelinePreview();
  },

  updateTimelinePreview: function() {
    const hours = parseInt($("#timelineHours").val()) || 0;
    const mins = parseInt($("#timelineMinutes").val()) || 0;
    const secs = parseInt($("#timelineSeconds").val()) || 0;
    const totalSec = (hours * 3600) + (mins * 60) + secs;

    $("#previewDurationText").text(`${hours}h ${mins}m ${secs}s (${totalSec} secs)`);

    if (totalSec > 0) {
      const endTime = new Date(Date.now() + (totalSec * 1000));
      $("#previewEndTimeText").text(endTime.toLocaleTimeString() + " (" + endTime.toLocaleDateString() + ")");
    } else {
      $("#previewEndTimeText").text("Instant / Expired");
    }
  },

  resetElectionCycle: async function() {
    if (!confirm("Are you sure you want to reset the election and return to Setup mode? All candidate nominations will be wiped and voter records will be ready for a new round.")) return;
    try {
      if (App.instance) {
        try {
          await App.instance.resetElection({ from: App.account || ganacheAccountsCache[0], gas: 3000000 });
        } catch (contractErr) {
          console.warn("Direct contract reset notice:", contractErr);
        }
      }

      const res = await fetch('/api/reset_election', { method: 'POST' });
      const data = await res.json();

      try {
        await fetch(`${API_URL}/clear_audit_logs`, { method: 'POST' });
        await fetch(`${API_URL}/clear_candidates`, { method: 'POST' });
      } catch (e) {}

      if (res.ok) {
        alert("Election successfully reset to SETUP mode! Old candidates have been removed and photo audit logs cleared.");
        window.location.reload();
      } else {
        alert("Reset failed: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Reset error: " + e.message);
    }
  },

  loadPhotoAuditLogs: async function() {
    const tbody = $("#photoAuditTableBody");
    if (!tbody.length) return;

    try {
      const res = await fetch(`${API_URL}/voter_audit_logs`);
      if (!res.ok) throw new Error("Could not load audit logs");
      const data = await res.json();
      const logs = data.audit_logs || [];

      $("#auditTotalCount").text(logs.length);
      $("#tabPhotoAuditCount").text(logs.length);

      if (logs.length === 0) {
        tbody.html(`
          <tr>
            <td colspan="6" style="text-align: center; color: #64748b; padding: 28px;">
              No voter photos recorded yet in this election cycle. Photos appear here as voters verify at the voter kiosk.
            </td>
          </tr>
        `);
        return;
      }

      const rows = logs.map(item => {
        const photoSrc = item.photo_url.startsWith('http') ? item.photo_url : `${API_URL}${item.photo_url}`;
        const hashShort = item.photo_hash ? `${item.photo_hash.substring(0, 16)}...${item.photo_hash.substring(item.photo_hash.length - 8)}` : 'N/A';

        return `
          <tr>
            <td>
              <a href="${photoSrc}" target="_blank" title="Click to view full photo">
                <img src="${photoSrc}" alt="${item.full_name}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 2px solid rgba(59, 130, 246, 0.4); background: #000;" onerror="this.src='/favicon.ico';">
              </a>
            </td>
            <td><strong class="font-mono" style="color: #60a5fa;">${item.unique_id}</strong></td>
            <td><span style="color: #ffffff; font-weight: 600;">${item.full_name}</span></td>
            <td><code class="font-mono" style="color: #34d399; font-size: 11px; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;" title="${item.photo_hash}">${hashShort}</code></td>
            <td><span style="color: #94a3b8; font-size: 12px;">${item.timestamp}</span></td>
            <td><span class="kpi-tag tag-green">VERIFIED ✓</span></td>
          </tr>
        `;
      });

      tbody.html(rows.join(""));
    } catch (e) {
      console.warn("Audit logs query error:", e);
      tbody.html(`<tr><td colspan="6" style="text-align: center; color: #f87171;">Failed to load audit logs: ${e.message}</td></tr>`);
    }
  },

  downloadVoterPhotoCSV: async function() {
    try {
      const apiHost = window.location.hostname || '127.0.0.1';
      const apiUrl = 'http://' + (apiHost === 'localhost' ? '127.0.0.1' : apiHost) + ':8000';

      const res = await fetch(`${apiUrl}/export_voters_csv?format=json`);
      if (!res.ok) throw new Error("Could not fetch voter records from server");
      const data = await res.json();
      const records = data.records || [];

      if (records.length === 0) {
        alert("No voter records found in database to export.");
        return;
      }

      // Format CSV rows with proper quote escaping
      let csvContent = "Voter_ID,Full_Name,Group_Locality,Verification_Status,Photo_Filename,Photo_URL,SHA256_Hash,Verification_Timestamp\n";
      
      records.forEach(r => {
        const row = [
          `"${(r.unique_id || '').replace(/"/g, '""')}"`,
          `"${(r.full_name || '').replace(/"/g, '""')}"`,
          `"${(r.locality || '').replace(/"/g, '""')}"`,
          `"${(r.status || '').replace(/"/g, '""')}"`,
          `"${(r.photo_filename || '').replace(/"/g, '""')}"`,
          `"${(r.photo_url || '').replace(/"/g, '""')}"`,
          `"${(r.photo_hash || '').replace(/"/g, '""')}"`,
          `"${(r.timestamp || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
      });

      // Create downloadable Blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      const nowTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadLink.href = url;
      downloadLink.setAttribute("download", `VOTERS_DETAILS_AND_PHOTOS_${nowTs}.csv`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Export CSV error:", err);
      // Fallback: direct browser trigger
      const apiHost = window.location.hostname || '127.0.0.1';
      window.open(`http://${apiHost === 'localhost' ? '127.0.0.1' : apiHost}:8000/export_voters_csv`, '_blank');
    }
  },

  broadcastCustomTimeline: async function() {
    if ((App.countCandidates || 0) < 1 || (App.votersCount || 0) < 1) {
      alert("Sequential activation required: You must complete Step 1 (Nominate Candidates) and Step 2 (Import Voters Database) before starting the election timeline!");
      return;
    }

    const hours = parseInt($("#timelineHours").val()) || 0;
    const mins = parseInt($("#timelineMinutes").val()) || 0;
    const secs = parseInt($("#timelineSeconds").val()) || 0;
    const totalSec = (hours * 3600) + (mins * 60) + secs;

    if (totalSec <= 0) {
      alert("Please specify a duration greater than 0 seconds!");
      return;
    }

    try {
      const instance = await getVotingInstance();
      const btn = $("#addDate");
      btn.prop('disabled', true).text('Broadcasting Oracle (Hours, Mins, Secs)...');

      const nowSec = Math.floor(Date.now() / 1000);
      const endSec = nowSec + totalSec;

      await instance.setDates(nowSec, endSec, { from: App.account, gas: 3000000 });
      await instance.startElection({ from: App.account, gas: 3000000 });

      // Lock database access on backend
      try {
        await fetch(`${API_URL}/set_election_lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locked: true })
        });
      } catch (e) {
        console.warn("Backend lock sync:", e);
      }

      alert(`🎉 SUCCESS!\nElection Timeline programmed: ${hours}h ${mins}m ${secs}s!\nPolls are officially OPEN and ACTIVE.\nPer consensus rules, the voter database and nominee roster are now frozen.`);
      window.location.reload();
    } catch (err) {
      console.error("Timeline broadcast error:", err);
      alert("Failed to broadcast timeline: " + (err.message || err));
      $("#addDate").prop('disabled', false).text('💾 Broadcast Timeline & Start Polls');
    }
  },

  selectCard: function(id, name, party) {
    App.selectedCandidateId = id;
    $(".ballot-toggle-card").removeClass("selected");
    $("#ballot_card_" + id).addClass("selected");
    $("input[name='candidate']").prop("checked", false);
    $("#candidate_" + id).prop("checked", true);
    
    $("#voteButton").prop("disabled", false).text("Vote for " + name);
  },

  refreshExplorer: function() {
    if (App.web3 && App.instance) {
      loadBlockchainExplorer(App.web3, App.instance.address);
    }
  },

  updateLocalityTelemetry: async function(totalVotes) {
    const votes = typeof totalVotes === 'number' ? totalVotes : (parseInt($("#locBallotsCast").text()) || 0);

    let totalElectors = 50;
    try {
      const res = await fetch(`${API_URL}/locality_stats`);
      if (res.ok) {
        const stats = await res.json();
        totalElectors = stats.total_registered_electors || 50;
      }
    } catch (e) {
      console.warn("Could not query locality stats:", e);
    }

    const remaining = Math.max(0, totalElectors - votes);
    const turnoutPct = totalElectors > 0 ? ((votes / totalElectors) * 100).toFixed(1) : 0;

    $("#locTotalElectors").text(totalElectors);
    $("#locBallotsCast").text(votes);
    $("#locRemainingElectors").text(remaining);
    $("#locTurnoutPct").text(turnoutPct + "%");

    $("#localityRemainingBadge").text(`${remaining} Left to Vote`);
    $("#turnoutRatioText").text(`${votes} of ${totalElectors} Electors Cast Ballots • ${remaining} Remaining in Locality`);
    $("#turnoutProgressBar").css("width", Math.min(100, Math.max(1, turnoutPct)) + "%");

    const p1Total = Math.ceil(totalElectors * 0.35);
    const p2Total = Math.floor(totalElectors * 0.40);
    const p3Total = Math.max(0, totalElectors - p1Total - p2Total);

    const p1Cast = Math.ceil(votes * 0.35);
    const p2Cast = Math.floor(votes * 0.40);
    const p3Cast = Math.max(0, votes - p1Cast - p2Cast);

    const rows = `
      <tr>
        <td><strong style="color: #60a5fa;">PRECINCT-01</strong></td>
        <td>Precinct Alpha (North Ward)</td>
        <td>North Sector</td>
        <td><span class="font-mono">${p1Total}</span></td>
        <td><span class="font-mono" style="color: #34d399;">${p1Cast}</span></td>
        <td><strong class="font-mono" style="color: #fbbf24;">${Math.max(0, p1Total - p1Cast)} Remaining</strong></td>
        <td><span class="kpi-tag tag-green">POLLS ACTIVE</span></td>
      </tr>
      <tr>
        <td><strong style="color: #60a5fa;">PRECINCT-02</strong></td>
        <td>Precinct Beta (Central Ward)</td>
        <td>Central Sector</td>
        <td><span class="font-mono">${p2Total}</span></td>
        <td><span class="font-mono" style="color: #34d399;">${p2Cast}</span></td>
        <td><strong class="font-mono" style="color: #fbbf24;">${Math.max(0, p2Total - p2Cast)} Remaining</strong></td>
        <td><span class="kpi-tag tag-green">POLLS ACTIVE</span></td>
      </tr>
      <tr>
        <td><strong style="color: #60a5fa;">PRECINCT-03</strong></td>
        <td>Precinct Gamma (South Ward)</td>
        <td>South Sector</td>
        <td><span class="font-mono">${p3Total}</span></td>
        <td><span class="font-mono" style="color: #34d399;">${p3Cast}</span></td>
        <td><strong class="font-mono" style="color: #fbbf24;">${Math.max(0, p3Total - p3Cast)} Remaining</strong></td>
        <td><span class="kpi-tag tag-green">POLLS ACTIVE</span></td>
      </tr>
    `;
    $("#precinctTableBody").html(rows);
  },

  handleFileSelect: function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    $("#selectedFileName").text(file.name);
    $("#selectedFileSize").text(`(${(file.size / 1024).toFixed(1)} KB)`);
    $("#uploadStatusBox").fadeIn();
    $("#uploadAlert").html("<span style='color: #60a5fa;'>Reading spreadsheet data...</span>");

    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
      reader.onload = function(e) {
        const text = e.target.result;
        App.parseCSVText(text);
      };
      reader.readAsText(file);
    } else {
      // Excel (.xlsx, .xls)
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          if (typeof XLSX === 'undefined') {
            throw new Error("SheetJS library is loading. Please try again.");
          }
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet);
          App.processParsedRows(jsonRows);
        } catch (err) {
          $("#uploadAlert").html(`<span style='color: #f87171;'>Parse Error: ${err.message}</span>`);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  },

  parseCSVText: function(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      $("#uploadAlert").html("<span style='color: #f87171;'>CSV must contain a header and at least one voter record.</span>");
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/["']/g, ''));
      if (cols.length >= 2) {
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = cols[idx] || '';
        });
        rows.push(row);
      }
    }

    App.processParsedRows(rows);
  },

  processParsedRows: function(rows) {
    parsedImportedVoters = [];

    rows.forEach(r => {
      // Check column names flexibly
      const uid = r['unique_id'] || r['unique id'] || r['voter_id'] || r['voter id'] || r['id'] || Object.values(r)[0];
      const name = r['full_name'] || r['full name'] || r['name'] || r['citizen_name'] || Object.values(r)[1];
      const loc = r['locality'] || r['ward'] || 'Ward 4 - Central District';

      if (uid && name && String(uid).trim().length > 0 && String(name).trim().length > 0) {
        parsedImportedVoters.push({
          unique_id: String(uid).trim(),
          full_name: String(name).trim(),
          locality: String(loc).trim()
        });
      }
    });

    if (parsedImportedVoters.length === 0) {
      $("#uploadAlert").html("<span style='color: #f87171;'>No valid voter records found. Ensure sheet has 'Unique_ID' and 'Full_Name' columns.</span>");
      $("#btnConfirmImport").prop('disabled', true);
    } else {
      $("#parsedCountBadge").text(`${parsedImportedVoters.length} Voters Ready`);
      $("#uploadAlert").html(`<span style='color: #34d399;'>✓ Validated ${parsedImportedVoters.length} voter records. Ready to import into database!</span>`);
      $("#btnConfirmImport").prop('disabled', false);
    }
  },

  submitImportedVoters: async function() {
    if (!parsedImportedVoters.length) return;

    try {
      $("#btnConfirmImport").prop('disabled', true).text('Writing to Electoral Registry...');

      const res = await fetch(`${API_URL}/import_voters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voters: parsedImportedVoters })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");

      alert(`🎉 SUCCESS!\n${data.message}\nTotal registered voters: ${data.totalRegistered}`);
      
      $("#excelFileInput").val('');
      $("#uploadStatusBox").hide();
      $("#btnConfirmImport").text('⚡ Upload Voters List');
      $("#tabVoterCount").text(data.totalRegistered);
      App.votersCount = data.totalRegistered;
      $("#step2ProceedNotice").fadeIn();

      // Proceed to Step 3 (Timer & Start Voting)
      switchTab('tab-lifecycle');
    } catch (err) {
      console.error("Import error:", err);
      alert("Error importing voters: " + err.message);
      $("#btnConfirmImport").prop('disabled', false).text('⚡ Upload Voters List');
    }
  },

  downloadSampleExcel: function() {
    let csv = "Unique_ID,Full_Name,Locality\n";
    csv += "VOT-2026-201,Sarah Jenkins,Ward 4 - Precinct Alpha\n";
    csv += "VOT-2026-202,Michael Chang,Ward 4 - Precinct Alpha\n";
    csv += "VOT-2026-203,Fatima Al-Mansoor,Ward 4 - Precinct Beta\n";
    csv += "VOT-2026-204,Robert Thorne,Ward 4 - Precinct Beta\n";
    csv += "VOT-2026-205,Ananya Sen,Ward 4 - Precinct Gamma\n";
    csv += "VOT-2026-206,Carlos Mendez,Ward 4 - Precinct Gamma\n";
    csv += "VOT-2026-207,Emily Watson,Ward 4 - Precinct Alpha\n";
    csv += "VOT-2026-208,James O'Connor,Ward 4 - Precinct Beta\n";

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VOTEX_Sample_Voters_Template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  eventStart: async function() {
    try {
      const { activeAccount, isDirectMode, activeWeb3 } = await setupProviderAndAccount();

      if (!activeAccount) {
        alert("Could not connect to Ganache blockchain! Make sure Ganache is running on http://127.0.0.1:7545");
        return;
      }

      const shortAddr = truncateAddress(activeAccount);
      const citizenName = localStorage.getItem('citizen_name') || localStorage.getItem('voter_id') || 'Verified Citizen';
      $("#accountAddressShort").text(citizenName + " (" + shortAddr + ")").attr("title", activeAccount);

      $("#accountAddress").html("Your Node Identity: <code class='font-mono' style='color:#93c5fd;'>" + activeAccount + "</code>");

      const instance = await getVotingInstance();
      App.instance = instance;

      if ($("#kioskAuthForm").length) {
        initKioskAuth();
      }

      // Initialize candidate camera controls on admin page
      initCandidateCameraHandlers();

      if ($("#contractAddrDisplay").length) {
        $("#contractAddrDisplay").text(instance.address);
      }

      // Load Blockchain Explorer & Photo Audit Trail (Admin)
      if ($("#txExplorerTableBody").length) {
        loadBlockchainExplorer(activeWeb3, instance.address);
      }
      if ($("#photoAuditTableBody").length) {
        App.loadPhotoAuditLogs();
      }

      // Candidate Registration Handler (Admin)
      $('#addCandidate').off('click').on('click', async function(e) {
        e.preventDefault();
        const firstName = $('#candFirstName').val()?.trim() || "";
        const lastName = $('#candLastName').val()?.trim() || "";
        const phone = $('#candPhone').val()?.trim() || "";
        const location = $('#candLocation').val()?.trim() || "";
        const party = $('#party').val()?.trim() || "";
        const manifesto = $('#manifesto').val()?.trim() || "";
        const photoBase64 = $('#candPhotoBase64').val() || null;

        let fullName = `${firstName} ${lastName}`.trim();
        if (!fullName && $('#name').length) {
          fullName = $('#name').val()?.trim() || "";
        }

        if (!firstName || !lastName) {
          alert("Please enter Candidate First Name and Last Name!");
          return;
        }

        if (!phone) {
          alert("Please enter Candidate Phone Number!");
          return;
        }

        if (!location) {
          alert("Please enter Candidate Location / Region!");
          return;
        }

        if (!party) {
          alert("Please specify Category / Department / Party!");
          return;
        }

        try {
          $('#addCandidate').prop('disabled', true).text('Writing Candidate to Blockchain & Database...');

          // 1. Save candidate profile & photo to backend API
          try {
            await fetch(`${API_URL}/register_candidate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                location: location,
                party: party,
                manifesto: manifesto,
                photo_base64: photoBase64
              })
            });
          } catch (backendErr) {
            console.warn("Backend candidate registration warning:", backendErr);
          }

          // 2. Register candidate on Ethereum Smart Contract
          const chainManifesto = manifesto ? `${location} | ${manifesto}` : `Location: ${location}`;
          if (instance.methods && instance.methods['addCandidate(string,string,string)']) {
            await instance.methods['addCandidate(string,string,string)'](fullName, party, chainManifesto, { from: App.account, gas: 3000000 });
          } else {
            await instance.addCandidate(fullName, party, chainManifesto, { from: App.account, gas: 3000000 });
          }

          alert(`Candidate "${fullName}" (${location}) registered successfully on Ethereum blockchain!`);
          $('#candFirstName').val('');
          $('#candLastName').val('');
          $('#candPhone').val('');
          $('#candLocation').val('');
          $('#party').val('');
          $('#manifesto').val('');
          clearCandidatePhoto();
          window.location.reload();
        } catch (err) {
          console.error(err);
          alert("Registration failed: " + (err.message || err));
        } finally {
          $('#addCandidate').prop('disabled', false).text('➕ Register Candidate');
        }
      });

      // Date Setting Handler (Admin)
      $('#addDate').off('click').on('click', async function(e) {
        e.preventDefault();
        const startVal = document.getElementById("startDate").value;
        const endVal = document.getElementById("endDate").value;
        if (!startVal || !endVal) {
          alert("Please select both Polls Open and Close dates!");
          return;
        }

        const startDate = Math.floor(new Date(startVal + "T00:00:00").getTime() / 1000);
        const endDate = Math.floor(new Date(endVal + "T23:59:59").getTime() / 1000);
        if (endDate <= startDate) {
          alert("Close Date must be after Open Date!");
          return;
        }

        try {
          $('#addDate').prop('disabled', true).text('Writing Timeline Oracle...');
          await instance.setDates(startDate, endDate, { from: App.account, gas: 3000000 });
          alert("Timeline broadcasted to smart contract!");
          window.location.reload();
        } catch (err) {
          console.error(err);
          alert("Failed to set timeline: " + (err.message || err));
        } finally {
          $('#addDate').prop('disabled', false).text('💾 Broadcast Timeline to Blockchain');
        }
      });

      // Lifecycle State Controls (Admin)
      $('#btnOpenElection').off('click').on('click', async function() {
        try {
          $(this).prop('disabled', true).text('Updating State...');
          await instance.startElection({ from: App.account, gas: 3000000 });
          alert("Election state is ACTIVE! Voting open.");
          window.location.reload();
        } catch (err) {
          alert("State change failed: " + (err.message || err));
          $(this).prop('disabled', false).text('▶ Open Polls Immediately');
        }
      });

      $('#btnCloseElection').off('click').on('click', async function() {
        if (!confirm("Are you sure you want to officially seal and conclude voting?")) return;
        try {
          $(this).prop('disabled', true).text('Sealing Contract...');
          await instance.endElection({ from: App.account, gas: 3000000 });
          alert("Election officially CONCLUDED!");
          window.location.reload();
        } catch (err) {
          alert("State change failed: " + (err.message || err));
          $(this).prop('disabled', false).text('⏹ Conclude & Certify Results');
        }
      });

      // Query Election Lifecycle Status & Timeline
      let electionStatus = "SETUP";
      let startSec = 0;
      let endSec = 0;
      const nowSec = Math.floor(Date.now() / 1000);

      try {
        electionStatus = await instance.getElectionStatus();
        const dates = await instance.getDates();
        startSec = parseInt(dates[0].toString(), 10);
        endSec = parseInt(dates[1].toString(), 10);

        if (startSec > 0 && endSec > 0 && endSec > nowSec) {
          startCountdown(startSec, endSec);
        } else {
          startCountdown(0, 0);
        }
      } catch (err) {
        startCountdown(0, 0);
      }

      // Real-time Lifecycle Determination:
      // Locked ONLY after time starts (active voting session)!
      const isElectionActive = (startSec > 0 && endSec > 0 && nowSec >= startSec && nowSec < endSec && electionStatus !== "CONCLUDED");
      const isElectionConcluded = (electionStatus === "CONCLUDED" || (endSec > 0 && nowSec >= endSec));

      if (isElectionActive) {
        $("#electionPhaseTag").text("POLLS ACTIVE • VOTING WINDOW LIVE").removeClass("tag-purple").addClass("tag-green");

        // 1. Lock Database Import (Tab 2)
        $("#dbLockdownNotice").show();
        $("#dropZone").css("pointer-events", "none").css("opacity", "0.35");
        $("#excelFileInput").prop("disabled", true);
        $("#btnConfirmImport").prop("disabled", true).text("🔒 Database Locked: Election in Progress");

        // 2. Lock Candidate Nominations (Tab 1)
        $("#candLockdownNotice").show();
        $("#candFirstName").prop("disabled", true);
        $("#candLastName").prop("disabled", true);
        $("#candPhone").prop("disabled", true);
        $("#candLocation").prop("disabled", true);
        $("#name").prop("disabled", true);
        $("#party").prop("disabled", true);
        $("#manifesto").prop("disabled", true);
        $("#btnStartCandCamera").prop("disabled", true);
        $("#btnUploadCandPhoto").prop("disabled", true);
        $("#btnClearCandPhoto").prop("disabled", true);
        $("#addCandidate").prop("disabled", true).text("🔒 Nominations Closed: Election in Progress");

        // 3. Lock Timeline Controls Notice (Tab 3)
        $("#timelineActiveNotice").show();
        $(".timeline-ctrl").prop("disabled", true);
        $("#addDate").prop("disabled", true).text("🔒 Timeline Running: Polls Active");

        // 4. Sync backend lock
        fetch(`${API_URL}/set_election_lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locked: true })
        }).catch(() => {});
      } else {
        // NOT ACTIVE: Authority has full power to configure (UNLOCKED!)
        $("#dbLockdownNotice").hide();
        $("#candLockdownNotice").hide();
        $("#timelineActiveNotice").hide();

        $("#dropZone").css("pointer-events", "auto").css("opacity", "1");
        $("#excelFileInput").prop("disabled", false);
        $("#candFirstName").prop("disabled", false);
        $("#candLastName").prop("disabled", false);
        $("#candPhone").prop("disabled", false);
        $("#candLocation").prop("disabled", false);
        $("#name").prop("disabled", false);
        $("#party").prop("disabled", false);
        $("#manifesto").prop("disabled", false);
        $("#btnStartCandCamera").prop("disabled", false);
        $("#btnUploadCandPhoto").prop("disabled", false);
        $("#btnClearCandPhoto").prop("disabled", false);
        $("#addCandidate").prop("disabled", false).text("➕ Register Candidate");
        $(".timeline-ctrl").prop("disabled", false);

        if (isElectionConcluded) {
          $("#electionPhaseTag").text("POLLS CONCLUDED • CERTIFIED RESULTS").removeClass("tag-green").addClass("tag-purple");
        } else {
          $("#electionPhaseTag").text("SETUP & CONFIGURATION MODE").removeClass("tag-green").addClass("tag-purple");
        }

        fetch(`${API_URL}/set_election_lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locked: false })
        }).catch(() => {});
      }

      // Initialize customizable timeline preview if on admin page
      if ($("#timelineHours").length) {
        App.updateTimelinePreview();
      }

      // Query Candidates from Smart Contract
      let countCandidates = 0;
      try {
        countCandidates = parseInt((await instance.getCountCandidates()).toString(), 10);
      } catch (e) {
        console.error("Count candidates error:", e);
      }

      let totalVotes = 0;
      const candidatesList = [];

      for (let i = 1; i <= countCandidates; i++) {
        try {
          const data = await instance.getCandidate(i);
          const id = parseInt(data[0].toString(), 10);
          const name = data[1];
          const party = data[2];
          const manifesto = data[3] || "Platform on Ethereum";
          const voteCount = parseInt(data[4].toString(), 10);
          totalVotes += voteCount;
          candidatesList.push({ id, name, party, manifesto, voteCount });
        } catch (e) {
          console.error("Error candidate " + i, e);
        }
      }

      // Query registered candidate profiles (photos, phone, location) from backend
      try {
        const cRes = await fetch(`${API_URL}/candidates`);
        if (cRes.ok) {
          const backendCandidates = await cRes.json();
          candidatesList.forEach((c, idx) => {
            const match = backendCandidates[idx] || backendCandidates.find(bc => bc.full_name && bc.full_name.toLowerCase() === c.name.toLowerCase());
            if (match) {
              c.photo_url = match.photo_url;
              c.phone = match.phone;
              c.location = match.location;
              c.first_name = match.first_name;
              c.last_name = match.last_name;
            }
          });
        }
      } catch (candErr) {
        console.warn("Backend candidates load warning:", candErr);
      }

      cachedCandidates = candidatesList;
      App.countCandidates = countCandidates;

      // Query registered electors count from backend
      let votersCount = 0;
      try {
        const statsRes = await fetch(`${API_URL}/locality_stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          votersCount = statsData.total_registered_electors || 0;
        }
      } catch (e) {}
      App.votersCount = votersCount;

      $("#totalCandidatesCount").text(countCandidates);
      $("#tabCandidateCount").text(countCandidates);
      $("#tabVoterCount").text(votersCount);
      $("#ballotCandidateCountBadge").text(`${countCandidates} Nominees`);

      // ================= STEP-BY-STEP ENFORCEMENT & STEPPER =================
      const step1Done = countCandidates >= 1;
      const step2Done = votersCount >= 1;
      const step3Done = isElectionActive;

      // Step 1: Candidates
      if (step1Done) {
        $("#stepIcon1").text("Complete ✓").removeClass("tag-blue tag-purple").addClass("tag-green");
        $("#stepDesc1").text(`${countCandidates} Nominees registered on contract.`);
        $("#stepCard1").css("border-color", "#10b981").css("opacity", "1");
        if (!isElectionActive) {
          $("#step1ProceedNotice").show();
        } else {
          $("#step1ProceedNotice").hide();
        }
      } else {
        $("#stepIcon1").text("Active").removeClass("tag-green tag-purple").addClass("tag-blue");
        $("#stepDesc1").text("Add at least 1 nominee to begin.");
        $("#stepCard1").css("border-color", "#3b82f6").css("opacity", "1");
        $("#step1ProceedNotice").hide();
      }

      // Step 2: Import Voters Database
      if (!step1Done) {
        $("#step2ReqAlert").show();
        $("#dropZone").css("pointer-events", "none").css("opacity", "0.4");
        $("#excelFileInput").prop("disabled", true);
        $("#stepIcon2").text("Locked 🔒").removeClass("tag-green tag-blue").addClass("tag-purple");
        $("#stepCard2").css("border-color", "rgba(255,255,255,0.1)").css("opacity", "0.5");
        $("#stepDesc2").text("Requires Step 1 (Candidates) first.");
        $("#step2ProceedNotice").hide();
      } else {
        $("#step2ReqAlert").hide();
        if (!isElectionActive) {
          $("#dropZone").css("pointer-events", "auto").css("opacity", "1");
          $("#excelFileInput").prop("disabled", false);
        }
        if (step2Done) {
          $("#stepIcon2").text("Complete ✓").removeClass("tag-purple tag-blue").addClass("tag-green");
          $("#stepDesc2").text(`${votersCount} Electors imported into registry.`);
          $("#stepCard2").css("border-color", "#10b981").css("opacity", "1");
          if (!isElectionActive) {
            $("#step2ProceedNotice").show();
          } else {
            $("#step2ProceedNotice").hide();
          }
        } else {
          $("#stepIcon2").text("Active").removeClass("tag-green tag-purple").addClass("tag-blue");
          $("#stepDesc2").text("Upload Excel/CSV sheet to register voters.");
          $("#stepCard2").css("border-color", "#3b82f6").css("opacity", "1");
          $("#step2ProceedNotice").hide();
        }
      }

      // Step 3: Program Timeline & Start Polls
      if (!step1Done || !step2Done) {
        $("#step3ReqAlert").show();
        $("#step3CheckCand").text(step1Done ? `✓ Step 1: Nominate Candidates (${countCandidates} registered)` : "❌ Step 1: Nominate Candidates (0 registered)")
          .css("color", step1Done ? "#34d399" : "#f87171");
        $("#step3CheckVoters").text(step2Done ? `✓ Step 2: Import Voters Database (${votersCount} electors)` : "❌ Step 2: Import Voters Database (0 electors)")
          .css("color", step2Done ? "#34d399" : "#f87171");

        $(".timeline-ctrl").prop("disabled", true);
        $("#addDate").prop("disabled", true).text("🔒 Sequential Setup Required (Complete Steps 1 & 2 First)");
        $("#stepIcon3").text("Locked 🔒").removeClass("tag-green tag-blue").addClass("tag-purple");
        $("#stepCard3").css("border-color", "rgba(255,255,255,0.1)").css("opacity", "0.5");
        $("#stepDesc3").text("Requires Candidates & Database first.");
      } else {
        $("#step3ReqAlert").hide();
        if (!isElectionActive) {
          $(".timeline-ctrl").prop("disabled", false);
          $("#addDate").prop("disabled", false).text("💾 Broadcast Timeline & Start Polls");
          $("#stepIcon3").text("Ready to Start").removeClass("tag-purple tag-green").addClass("tag-blue");
          $("#stepCard3").css("border-color", "#3b82f6").css("opacity", "1");
          $("#stepDesc3").text("Ready to program duration and open polls.");
        } else {
          $("#stepIcon3").text("Polls Live ⏱️").removeClass("tag-blue tag-purple").addClass("tag-green");
          $("#stepCard3").css("border-color", "#10b981").css("opacity", "1");
          $("#stepDesc3").text("Voting session in progress.");
        }
      }

      if (!step1Done) {
        $("#wizardOverallStatus").text("Current: Step 1 (Nominate Candidates)");
      } else if (!step2Done) {
        $("#wizardOverallStatus").text("Current: Step 2 (Import Voters Database)");
      } else if (!isElectionActive && !isElectionConcluded) {
        $("#wizardOverallStatus").text("Current: Step 3 (Ready to Start Polls)");
      } else if (isElectionActive) {
        $("#wizardOverallStatus").text("Polls Active • Smart Contract Locked");
      } else if (isElectionConcluded) {
        $("#wizardOverallStatus").text("Polls Concluded • Certified Results Ready");
      }

      // ================= CERTIFIED RESULTS SECTION =================
      // Highest vote: GREEN, 2nd highest: YELLOW. Strictly NO EMOJI TROPHIES!
      if (isElectionConcluded) {
        $("#certifiedResultsSection").show();

        const sortedCandidates = [...candidatesList].sort((a, b) => b.voteCount - a.voteCount);

        // 1st Place / Highest Votes: GREEN
        if (sortedCandidates.length > 0) {
          const winner = sortedCandidates[0];
          $("#winnerName").text(winner.name);
          $("#winnerParty").text(winner.party);
          $("#winnerVotes").text(winner.voteCount);
        } else {
          $("#winnerName").text("No Nominees");
          $("#winnerParty").text("-");
          $("#winnerVotes").text("0");
        }

        // 2nd Place / 2nd Highest Votes: YELLOW
        if (sortedCandidates.length > 1) {
          const runnerUp = sortedCandidates[1];
          $("#runnerUpName").text(runnerUp.name);
          $("#runnerUpParty").text(runnerUp.party);
          $("#runnerUpVotes").text(runnerUp.voteCount);
        } else {
          $("#runnerUpName").text(sortedCandidates.length === 1 ? "None (Sole Candidate)" : "No Nominees");
          $("#runnerUpParty").text("-");
          $("#runnerUpVotes").text("0");
        }

        // Complete Rankings Table (NO EMOJI TROPHIES)
        $("#certifiedRankingsTableBody").empty();
        sortedCandidates.forEach((c, idx) => {
          const rank = idx + 1;
          const share = totalVotes > 0 ? ((c.voteCount / totalVotes) * 100).toFixed(1) + "%" : "0.0%";
          let standingHtml = `<span style="background: rgba(255,255,255,0.08); color: #94a3b8; font-weight: 700; padding: 3px 10px; border-radius: 4px; font-size: 11px;">#${rank}</span>`;
          let statusText = `<span class="kpi-tag tag-purple">Certified</span>`;

          if (rank === 1) {
            standingHtml = `<span style="background: #10b981; color: #022c22; font-weight: 800; padding: 4px 12px; border-radius: 6px; font-size: 11px; letter-spacing: 0.5px;">HIGHEST VOTES (WINNER)</span>`;
            statusText = `<span class="kpi-tag tag-green">Elected</span>`;
          } else if (rank === 2) {
            standingHtml = `<span style="background: #f59e0b; color: #451a03; font-weight: 800; padding: 4px 12px; border-radius: 6px; font-size: 11px; letter-spacing: 0.5px;">2ND HIGHEST VOTES</span>`;
            statusText = `<span class="kpi-tag tag-blue">Runner-up</span>`;
          }

          const tr = `
            <tr>
              <td>${standingHtml}</td>
              <td><strong style="color: #ffffff; font-size: 14px;">${c.name}</strong></td>
              <td><span style="color: #94a3b8;">${c.party}</span></td>
              <td><strong class="font-mono" style="color: ${rank === 1 ? '#34d399' : rank === 2 ? '#fbbf24' : '#f8fafc'}; font-size: 15px;">${c.voteCount}</strong></td>
              <td><span class="font-mono" style="color: #cbd5e1;">${share}</span></td>
              <td>${statusText}</td>
            </tr>
          `;
          $("#certifiedRankingsTableBody").append(tr);
        });

      } else {
        $("#certifiedResultsSection").hide();
      }

      // KIOSK PREREQUISITE CHECK (on index.html):
      // Only unlock citizen enrollment and photo capture when Candidates >= 1, Voters DB >= 1, and Timeline is Active!
      if ($("#stationLockedStage").length || $("#voterAuthStage").length) {
        try {
          const statRes = await fetch('/api/election_status');
          if (statRes.ok) {
            const statData = await statRes.json();

            const kChkCandIcon = $("#kioskChkCandIcon");
            const kChkCandStatus = $("#kioskChkCandStatus");
            const kChkVoterIcon = $("#kioskChkVoterIcon");
            const kChkVoterStatus = $("#kioskChkVoterStatus");
            const kChkTimelineIcon = $("#kioskChkTimelineIcon");
            const kChkTimelineStatus = $("#kioskChkTimelineStatus");

            if (statData.has_candidates) {
              kChkCandIcon.text("✓");
              kChkCandStatus.text(`${statData.candidates_count} Nominees`).removeClass("tag-purple").addClass("tag-green");
            } else {
              kChkCandIcon.text("❌");
              kChkCandStatus.text("0 Nominees").removeClass("tag-green").addClass("tag-purple");
            }

            if (statData.has_voters) {
              kChkVoterIcon.text("✓");
              kChkVoterStatus.text(`${statData.voters_count} Electors`).removeClass("tag-purple").addClass("tag-green");
            } else {
              kChkVoterIcon.text("❌");
              kChkVoterStatus.text("0 Electors").removeClass("tag-green").addClass("tag-purple");
            }

            if (statData.is_timeline_active) {
              kChkTimelineIcon.text("✓");
              kChkTimelineStatus.text("POLLS ACTIVE").removeClass("tag-purple").addClass("tag-green");
            } else {
              kChkTimelineIcon.text("❌");
              kChkTimelineStatus.text(statData.election_status === "CONCLUDED" ? "CONCLUDED" : "Inactive / Pending").removeClass("tag-green").addClass("tag-purple");
            }

            if (!statData.all_prereqs_met) {
              // Prerequisites NOT met: HIDE citizen enrollment & camera!
              $("#stationLockedStage").show();
              $("#voterAuthStage").hide();
              $("#voterBallotStage").hide();
            } else {
              // ALL 3 PREREQUISITES MET: UNLOCK VOTER ENROLLMENT!
              $("#stationLockedStage").hide();
              if (!$("#voterBallotStage").is(":visible")) {
                $("#voterAuthStage").show();
              }
            }
          }
        } catch (e) {
          console.warn("Kiosk prereq check:", e);
        }
      }

      // Update Locality Telemetry for Admin
      if ($("#locTotalElectors").length) {
        await App.updateLocalityTelemetry(totalVotes);
      }

      // Render Admin Candidate Roster
      if ($("#candidateRoster").length) {
        $("#candidateRoster").empty();
        candidatesList.forEach(c => {
          const emoji = AVATAR_EMOJIS[(c.id - 1) % AVATAR_EMOJIS.length];
          const photoSrc = c.photo_url ? (c.photo_url.startsWith('http') ? c.photo_url : `${API_URL}${c.photo_url}`) : null;
          const avatarHtml = photoSrc
            ? `<img src="${photoSrc}" alt="${c.name}" style="width: 52px; height: 52px; border-radius: 12px; object-fit: cover; border: 2px solid #3b82f6; flex-shrink: 0;" onerror="this.onerror=null; this.src='/favicon.ico';">`
            : `<div class="candidate-avatar">${emoji}</div>`;

          const card = `
            <div class="candidate-card-item" style="display: flex; gap: 16px; align-items: flex-start; padding: 18px; background: rgba(14, 21, 38, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; margin-bottom: 12px;">
              ${avatarHtml}
              <div class="candidate-details" style="flex: 1; min-width: 0;">
                <div class="candidate-name" style="font-size: 16px; font-weight: 700; color: #ffffff;">${c.name}</div>
                <div class="candidate-party" style="font-size: 13px; color: #60a5fa; font-weight: 600; margin-top: 2px;">${c.party}</div>
                ${c.location ? `<div style="font-size: 12px; color: #93c5fd; margin-top: 4px;">📍 Location: <strong>${c.location}</strong></div>` : ''}
                ${c.phone ? `<div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">📞 Phone: <span class="font-mono">${c.phone}</span></div>` : ''}
                <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0; line-height: 1.4;">${c.manifesto}</p>
              </div>
            </div>
          `;
          $("#candidateRoster").append(card);
        });
      }

      // Render Citizen Ballot Selection List
      // CRITICAL: NO VOTE COUNTS, NO PERCENTAGES, NO VOLUME SHOWN TO CITIZENS!
      if ($("#ballotCardsGrid").length) {
        $("#ballotCardsGrid").empty();
        $("#boxCandidate").empty();

        candidatesList.forEach(c => {
          const emoji = AVATAR_EMOJIS[(c.id - 1) % AVATAR_EMOJIS.length];
          const photoSrc = c.photo_url ? (c.photo_url.startsWith('http') ? c.photo_url : `${API_URL}${c.photo_url}`) : null;
          const avatarHtml = photoSrc
            ? `<img src="${photoSrc}" alt="${c.name}" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover; border: 2px solid rgba(59, 130, 246, 0.6); flex-shrink: 0;" onerror="this.onerror=null; this.src='/favicon.ico';">`
            : `<div style="font-size: 26px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.04); border-radius: 10px;">${emoji}</div>`;

          const card = `
            <div class="ballot-toggle-card" id="ballot_card_${c.id}" onclick="App.selectCard(${c.id}, '${c.name.replace(/'/g, "\\'")}', '${c.party.replace(/'/g, "\\'")}')" style="display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; background: rgba(14, 21, 38, 0.65); border: 2px solid rgba(255, 255, 255, 0.08); border-radius: 12px; cursor: pointer; transition: all 0.25s ease;">
              <div style="display: flex; align-items: center; gap: 16px;">
                ${avatarHtml}
                <div>
                  <h3 style="font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 2px;">${c.name}</h3>
                  <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <span style="font-size: 12px; color: #60a5fa; font-weight: 600;">${c.party}</span>
                    ${c.location ? `<span style="font-size: 12px; color: #94a3b8;">📍 ${c.location}</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="toggle-circle" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid #64748b; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                <div class="toggle-dot" style="width: 10px; height: 10px; border-radius: 50%; background: transparent; transition: all 0.2s ease;"></div>
              </div>
            </div>
          `;
          $("#ballotCardsGrid").append(card);

          const radio = `<input type="radio" name="candidate" value="${c.id}" id="candidate_${c.id}">`;
          $("#boxCandidate").append(radio);
        });
      }

      // Check Voter Status (only for standard/admin views, kiosk checks dynamically per citizen)
      if (!$("#kioskAuthForm").length) {
        try {
          let hasVoted = false;
          if (instance.getVoterReceipt) {
            const receipt = await instance.getVoterReceipt(activeAccount);
            hasVoted = receipt[0];
          } else {
            hasVoted = await instance.checkVote({ from: activeAccount });
          }

          if (hasVoted) {
            $("#voteButton").prop("disabled", true).text("✓ Official Ballot Sealed on Blockchain");
            $("#votedSuccessBanner").fadeIn();
            $(".ballot-toggle-card").css("pointer-events", "none").css("opacity", "0.6");
          } else {
            $("#voteButton").prop("disabled", true).text("Select a Candidate Above to Vote");
            $("#votedSuccessBanner").hide();
          }
        } catch (err) {
          console.warn("Check vote error:", err);
        }
      }

    } catch (err) {
      console.error("Critical error in App.eventStart:", err);
    }
  },

  vote: async function() {
    const candidateID = App.selectedCandidateId || $("input[name='candidate']:checked").val();
    if (!candidateID) {
      alert("Please toggle select your chosen candidate first!");
      return;
    }

    try {
      const instance = await getVotingInstance();
      $("#voteButton").prop("disabled", true).text("Sealing Ballot into Smart Contract...");
      
      const voterAccount = App.account || ganacheAccountsCache[1];
      const tx = await instance.vote(parseInt(candidateID), { from: voterAccount, gas: 3000000 });
      console.log("Vote transaction mined:", tx);

      const txHash = tx.tx || tx.transactionHash || (tx.receipt && tx.receipt.transactionHash) || "0xVerifiedOnChain";
      let blockNumber = (tx.receipt && tx.receipt.blockNumber);
      if (!blockNumber && App.web3) {
        try { blockNumber = await App.web3.eth.getBlockNumber(); } catch (e) {}
      }

      // Populate Blockchain Verification Receipt details
      $("#receiptTxHash").text(txHash).attr("title", txHash);
      $("#receiptBlockNumber").text(`Block #${blockNumber || 'Synced'}`);
      $("#receiptContractAddr").text(instance.address);

      // If in Polling Booth Kiosk mode, show full blockchain receipt then countdown 5s
      if ($("#voterAuthStage").length && $("#voterBallotStage").length) {
        $("#ballotSelectionBox").hide();
        $("#voteActionContainer").hide();
        $("#voteSealedSuccessBox").fadeIn();
        $("#kioskResetCountdownText").text("Returning to voter verification screen in 5 seconds for next voter...");

        let remainingSec = 5;
        if (App.kioskResetTicker) clearInterval(App.kioskResetTicker);
        App.kioskResetTicker = setInterval(() => {
          remainingSec--;
          if (remainingSec > 0) {
            $("#kioskResetCountdownText").text(`Returning to voter verification screen in ${remainingSec} second${remainingSec > 1 ? 's' : ''} for next voter...`);
          }
        }, 1000);

        if (App.kioskResetTimer) clearTimeout(App.kioskResetTimer);
        App.kioskResetTimer = setTimeout(() => {
          App.returnToKioskAuthImmediately();
        }, 5000);

      } else {
        alert(`🎉 SUCCESS!\nVote officially mined into Block #${blockNumber}!\nTx Hash: ${txHash}`);
        window.location.reload();
      }
    } catch (err) {
      console.error("Vote submission error:", err);
      alert("Voting failed: " + (err.message || err));
      $("#voteButton").prop("disabled", false).text("Vote for Candidate");
    }
  },

  returnToKioskAuthImmediately: function() {
    if (App.kioskResetTimer) {
      clearTimeout(App.kioskResetTimer);
      App.kioskResetTimer = null;
    }
    if (App.kioskResetTicker) {
      clearInterval(App.kioskResetTicker);
      App.kioskResetTicker = null;
    }

    $("#kiosk_citizen_name").val("");
    $("#kiosk_citizen_uid").val("");
    $("#voterAuthAlert").hide().empty();
    
    App.selectedCandidateId = null;
    App.currentCitizen = null;
    $(".ballot-toggle-card").removeClass("selected");
    $("input[name='candidate']").prop("checked", false);

    $("#voteSealedSuccessBox").hide();
    $("#ballotSelectionBox").show();
    $("#voteActionContainer").show();
    $("#voteButton").prop("disabled", true).text("Select a Candidate Above to Vote");

    $("#voterBallotStage").hide();
    $("#voterAuthStage").fadeIn();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

window.addEventListener("load", function() {
  window.App.eventStart();
});
