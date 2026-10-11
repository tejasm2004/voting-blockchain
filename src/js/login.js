let cachedElectionData = null;
let liveTimerInterval = null;

window.showAdminFormForAudit = function() {
  const adminPortal = document.getElementById('adminPortalSection');
  const concludedPortal = document.getElementById('concludedPortalSection');
  if (concludedPortal) concludedPortal.style.display = 'none';
  if (adminPortal) adminPortal.style.display = 'block';
};

const adminForm = document.getElementById('adminLoginForm');
if (adminForm) {
  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('authAlert');
    const submitBtn = document.getElementById('adminSubmitBtn');

    if (alertBox) alertBox.style.display = 'none';

    const adminId = document.getElementById('admin_id').value.trim();
    const password = document.getElementById('admin_password').value.trim();

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Logging in...';

      const apiHost = window.location.hostname || '127.0.0.1';
      const apiUrl = 'http://' + (apiHost === 'localhost' ? '127.0.0.1' : apiHost) + ':8000';

      const response = await fetch(`${apiUrl}/admin_login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminId, password: password })
      });

      const data = await response.json();

      if (!response.ok || data.role !== 'admin') {
        if (alertBox) {
          alertBox.innerText = '❌ Incorrect Username or Password.';
          alertBox.style.display = 'block';
        }
        return;
      }

      localStorage.setItem('voter_id', data.unique_id || adminId);
      localStorage.setItem('citizen_name', data.full_name || 'Admin');
      localStorage.setItem('role', 'admin');
      localStorage.setItem('jwtTokenAdmin', data.token);

      window.location.href = `/admin.html?Authorization=Bearer ${encodeURIComponent(data.token)}`;
    } catch (err) {
      if (alertBox) {
        alertBox.innerText = '❌ Server Error: Could not connect to authentication server (' + err.message + ')';
        alertBox.style.display = 'block';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Login as Admin';
    }
  });
}

// ================= DYNAMIC PHASE CONTROLLER =================
// 1. Initial/Setup Phase: Shows JUST ONE option -> Admin. Voter Station is hidden.
// 2. Active Phase (3 tasks done): Admin section gets HIDED until time stops, Voter Station is shown.
// 3. Concluded Phase (Time stops): Voting closes, Admin access restores to review certified results.
async function updatePortalPhases() {
  try {
    const res = await fetch('/api/election_status');
    if (!res.ok) return;
    const data = await res.json();
    cachedElectionData = data;

    const adminPortal = document.getElementById('adminPortalSection');
    const voterPortal = document.getElementById('voterPortalSection');
    const concludedPortal = document.getElementById('concludedPortalSection');

    const chkCandIcon = document.getElementById('chkCandIcon');
    const chkCandStatus = document.getElementById('chkCandStatus');
    const chkVoterIcon = document.getElementById('chkVoterIcon');
    const chkVoterStatus = document.getElementById('chkVoterStatus');
    const chkTimelineIcon = document.getElementById('chkTimelineIcon');
    const chkTimelineStatus = document.getElementById('chkTimelineStatus');

    const currentSec = Math.floor(Date.now() / 1000);
    const hasConcluded = data.election_status === 'CONCLUDED' || (data.voting_end > 0 && currentSec >= data.voting_end);
    const isLive = data.all_prereqs_met && !hasConcluded;

    if (isLive) {
      // ----------------- PHASE 2: 3 TASKS DONE & VOTING ACTIVE -----------------
      // Admin section is completely HIDED until time stops. ONLY Voter Station shows up!
      if (adminPortal) adminPortal.style.display = 'none';
      if (concludedPortal) concludedPortal.style.display = 'none';
      if (voterPortal) voterPortal.style.display = 'block';

      // Update remaining ticker
      const diff = Math.max(0, data.voting_end - currentSec);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = Math.floor(diff % 60);
      const cdTimer = document.getElementById('portalCdTimer');
      if (cdTimer) {
        cdTimer.innerText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

    } else if (hasConcluded) {
      // ----------------- PHASE 3: TIME STOPS (POLLS CONCLUDED) -----------------
      // Voting closes; restore Authority section so admin can inspect results
      if (voterPortal) voterPortal.style.display = 'none';
      // If admin form was explicitly triggered, leave it visible, else show concluded banner
      if (adminPortal && adminPortal.style.display === 'block') {
        if (concludedPortal) concludedPortal.style.display = 'none';
      } else {
        if (concludedPortal) concludedPortal.style.display = 'block';
        if (adminPortal) adminPortal.style.display = 'none';
      }

    } else {
      // ----------------- PHASE 1: SETUP PHASE (BEFORE 3 TASKS DONE) -----------------
      // Shows JUST ONE option: Admin. Voter Station is completely hidden!
      if (adminPortal) adminPortal.style.display = 'block';
      if (voterPortal) voterPortal.style.display = 'none';
      if (concludedPortal) concludedPortal.style.display = 'none';

      // Update live indicators on Admin form
      if (chkCandIcon && chkCandStatus) {
        if (data.has_candidates) {
          chkCandIcon.innerText = '✓';
          chkCandStatus.innerText = `${data.candidates_count} Registered`;
          chkCandStatus.className = 'kpi-tag tag-green font-mono';
        } else {
          chkCandIcon.innerText = '❌';
          chkCandStatus.innerText = 'Pending';
          chkCandStatus.className = 'kpi-tag tag-purple font-mono';
        }
      }

      if (chkVoterIcon && chkVoterStatus) {
        if (data.has_voters) {
          chkVoterIcon.innerText = '✓';
          chkVoterStatus.innerText = `${data.voters_count} Electors`;
          chkVoterStatus.className = 'kpi-tag tag-green font-mono';
        } else {
          chkVoterIcon.innerText = '❌';
          chkVoterStatus.innerText = 'Pending';
          chkVoterStatus.className = 'kpi-tag tag-blue font-mono';
        }
      }

      if (chkTimelineIcon && chkTimelineStatus) {
        if (data.is_timeline_active) {
          chkTimelineIcon.innerText = '✓';
          chkTimelineStatus.innerText = 'Active';
          chkTimelineStatus.className = 'kpi-tag tag-green font-mono';
        } else {
          chkTimelineIcon.innerText = '❌';
          chkTimelineStatus.innerText = 'Pending';
          chkTimelineStatus.className = 'kpi-tag tag-purple font-mono';
        }
      }
    }

  } catch (err) {
    console.warn("Could not check portal phase:", err);
  }
}

updatePortalPhases();
setInterval(updatePortalPhases, 1000);
