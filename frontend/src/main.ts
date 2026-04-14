import './style.css';

// Dynamic API base: Use relative path if behind proxy, otherwise fallback to port 3002 on same host
const API_BASE = import.meta.env.VITE_API_URL || 
  (window.location.port === '' || window.location.port === '80' || window.location.port === '443' 
    ? '/api' 
    : `${window.location.protocol}//${window.location.hostname}:3002/api`);

// Deteksi cabang dari nomor port — tidak butuh env variable, tidak bisa salah
const PORT_MAP: Record<string, string> = {
  '5000': 'master',
  '5001': 'adiwerna',
  '5002': 'pesalakan',
  '5003': 'pacul',
  '5004': 'cikditiro',
  '5005': 'trayeman',
};
const CURRENT_CABANG = PORT_MAP[window.location.port] || 'master';

let loggedInUser: any = JSON.parse(localStorage.getItem('fitmotor_user') || 'null');

const CABANG_LIST = [
  { id: 'adiwerna', name: 'Cabang Adiwerna' },
  { id: 'pesalakan', name: 'Cabang Pesalakan' },
  { id: 'pacul', name: 'Cabang Pacul' },
  { id: 'cikditiro', name: 'Cabang Cikditiro' }
];

// Elements
const loginGate = document.getElementById('login-gate') as HTMLDivElement;
const appDashboard = document.getElementById('app-dashboard') as HTMLDivElement;
const loginForm = document.getElementById('loginForm') as HTMLFormElement;
const loginError = document.getElementById('login-error') as HTMLParagraphElement;
const roleBadge = document.getElementById('role-badge') as HTMLSpanElement;

const cabangGrid = document.getElementById('cabangGrid') as HTMLDivElement;
const colPending = document.getElementById('col-pending') as HTMLDivElement;
const colProses = document.getElementById('col-proses') as HTMLDivElement;
const colSelesai = document.getElementById('col-selesai') as HTMLDivElement;

const branchFilter = document.getElementById('branch-filter') as HTMLSelectElement;
const masterPanel = document.getElementById('master-panel') as HTMLElement;
const bgRefreshButton = document.getElementById('btn-refresh') as HTMLButtonElement;
const userList = document.getElementById('userList') as HTMLDivElement;

// ==========================================
// 1. AUTHENTICATION (LOGIN GATE)
// ==========================================

// Jika bukan master, paksakan filter HTML ke default cabang
if (CURRENT_CABANG !== 'master') {
  branchFilter.style.display = 'none'; // Sembunyikan dropdown filter
  branchFilter.value = CURRENT_CABANG;
}

if (loggedInUser) {
  if (CURRENT_CABANG !== 'master' && loggedInUser.cabang !== CURRENT_CABANG) {
    localStorage.removeItem('fitmotor_user');
    loggedInUser = null;
  } else {
    loginGate.style.display = 'none';
    appDashboard.style.display = 'flex';
    roleBadge.innerText = `Cabang: ${loggedInUser.cabang.toUpperCase()}`;
    setTimeout(initializeAppBasedOnRole, 100);
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userBox = document.getElementById('username') as HTMLInputElement;
  const passBox = document.getElementById('password') as HTMLInputElement;

  // Security Check: Cabang tidak boleh login di Port cabang lain
  if (CURRENT_CABANG !== 'master' && userBox.value !== CURRENT_CABANG) {
    showLoginError(`AKSES DITOLAK: Anda berada di port khusus cabang ${CURRENT_CABANG}.`);
    return;
  }
  
  if (CURRENT_CABANG === 'master' && userBox.value !== 'fitmotor') {
    showLoginError(`AKSES DITOLAK: Jalur ini murni khusus Master Owner.`);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userBox.value, password: passBox.value })
    });
    
    const json = await res.json();
    if (json.success) {
      loggedInUser = json.user;
      localStorage.setItem('fitmotor_user', JSON.stringify(json.user));
      roleBadge.innerText = `Cabang: ${loggedInUser.cabang.toUpperCase()}`;
      
      // Buka Gerbang
      loginGate.style.opacity = '0';
      setTimeout(() => {
        loginGate.style.display = 'none';
        appDashboard.style.display = 'flex';
        initializeAppBasedOnRole();
      }, 500);
      
    } else {
      showLoginError(json.error);
    }
  } catch(e) {
    showLoginError("Gagal terhubung ke API Bridge Server");
  }
});

function showLoginError(msg: string) {
  loginError.innerText = msg;
  const card = document.querySelector('.login-card') as HTMLElement;
  card.classList.remove('shake');
  void card.offsetWidth; // trigger reflow
  card.classList.add('shake');
}

document.getElementById('btn-logout')?.addEventListener('click', () => {
  localStorage.removeItem('fitmotor_user');
  location.reload();
});


// ==========================================
// 2. INISIALISASI SETELAH LOGIN (MULTI-TENANT)
// ==========================================
function initializeAppBasedOnRole() {
  if (loggedInUser.role === 'master') {
    branchFilter.style.display = 'inline-block';
    masterPanel.style.display = 'flex'; // Munculkan Master Password Manager
    renderMasterUserPanel();
    renderCabangGrid(CABANG_LIST); // Munculkan semua WA Scanner
  } else {
    // Cabang hanya melihat kotaknya sendiri
    const myCabang = CABANG_LIST.filter(c => c.id === loggedInUser.cabang);
    renderCabangGrid(myCabang);
  }
  
  checkAllGoWAStatus();
  fetchBookings();
}


// ==========================================
// 3. MASTER PASSWORD MANAGER
// ==========================================
async function renderMasterUserPanel() {
  if (!userList) return;
  try {
    const res = await fetch(`${API_BASE}/auth/users`);
    const users = await res.json();
    
    userList.innerHTML = users.map((u:any) => `
      <div class="user-row">
        <span class="user-name">${u.username.toUpperCase()}</span>
        <button class="btn-edit-pass" onclick="changeUserPassword('${u.username}')">Ubah Sandi</button>
      </div>
    `).join('');
  } catch(e) {}
}

(window as any).changeUserPassword = async (username: string) => {
  const p = prompt(`Masukkan password baru untuk cabang ${username.toUpperCase()}:`);
  if (!p) return;
  
  try {
    await fetch(`${API_BASE}/auth/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, newPassword: p })
    });
    alert(`Sukses mengubah password cabang ${username}!`);
  } catch(e) {
    alert("Gagal merubah password.");
  }
};


// ==========================================
// 4. GOWA QR MANAGER
// ==========================================

function renderCabangGrid(list: any[]) {
  if (!cabangGrid) return;
  cabangGrid.innerHTML = list.map(cabang => `
    <div class="cabang-item">
      <h3>${cabang.name}</h3>
      <div id="status-${cabang.id}" class="status-badge badge-waiting">Connecting API...</div>
      
      <div class="qr-box" id="qrbox-${cabang.id}" style="display:none;">
        <img id="qrimg-${cabang.id}" class="qr-img" src="" alt="QR" />
      </div>
      
      <button class="btn-gowa" id="btn-start-${cabang.id}" onclick="startGoWASession('${cabang.id}')">
        Generate QR
      </button>
      <button class="btn-gowa" id="btn-logout-${cabang.id}" onclick="logoutGoWASession('${cabang.id}')" style="display:none; background:var(--danger-color);">
        Logout Scanner
      </button>
    </div>
  `).join('');
}

(window as any).startGoWASession = async (cabangId: string) => {
  const btn = document.getElementById(`btn-start-${cabangId}`) as HTMLButtonElement;
  btn.innerText = 'Requesting...'; btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/gowa/start/${cabangId}`, { method: 'POST' });
    const json = await res.json();
    
    if (json.error) {
       alert(`Terjadi Kesalahan: ${json.error}. Pastikan GoWA menyala!`);
       return;
    }
    
    if (json.data && json.data.qr) {
      document.getElementById(`qrbox-${cabangId}`)!.style.display = 'flex';
      (document.getElementById(`qrimg-${cabangId}`) as HTMLImageElement).src = json.data.qr;
      
      const st = document.getElementById(`status-${cabangId}`)!;
      st.className = 'status-badge badge-waiting';
      st.innerText = 'SCAN QR NOW';
      pollStatus(cabangId);
    }
  } catch (e) {
    alert('Gagal reach API Bridge Server');
  } finally { btn.innerText = 'Generated'; }
};

(window as any).logoutGoWASession = async (cabangId: string) => {
  if(!confirm(`Putuskan WhatsApp dari Cabang ${cabangId}?`)) return;
  try {
    await fetch(`${API_BASE}/gowa/logout/${cabangId}`, { method: 'DELETE' });
    checkAllGoWAStatus();
  } catch (e) {}
};

async function checkAllGoWAStatus() {
  const targetList = loggedInUser.role === 'master' ? CABANG_LIST : CABANG_LIST.filter(c => c.id === loggedInUser.cabang);
  for (const cabang of targetList) {
    try {
      const res = await fetch(`${API_BASE}/gowa/status/${cabang.id}`);
      const json = await res.json();
      
      const badge = document.getElementById(`status-${cabang.id}`);
      const qrbox = document.getElementById(`qrbox-${cabang.id}`);
      const btnStart = document.getElementById(`btn-start-${cabang.id}`);
      const btnLogout = document.getElementById(`btn-logout-${cabang.id}`);
      
      if (!badge) continue;

      if (json.data && json.data.status === 'CONNECTED') {
        badge.className = 'status-badge badge-connected'; badge.innerText = 'CONNECTED ✅';
        qrbox!.style.display = 'none'; btnStart!.style.display = 'none'; btnLogout!.style.display = 'block';
      } else {
        badge.className = 'status-badge badge-disconnected'; badge.innerText = 'DISCONNECTED ❌';
        qrbox!.style.display = 'none'; btnStart!.style.display = 'block'; btnStart!.innerText = 'Generate QR'; btnLogout!.style.display = 'none';
      }
    } catch (e) {}
  }
}

function pollStatus(cabangId: string) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/gowa/status/${cabangId}`);
      const json = await res.json();
      if (json.data && json.data.status === 'CONNECTED') {
        clearInterval(interval); checkAllGoWAStatus();
      }
    } catch(e) {}
  }, 3000);
}

// ==========================================
// 5. KANBAN BOOKING MANAGER & LIVE SYNC
// ==========================================

async function fetchBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    let bookings = await res.json();
    
    // Pastikan bookings adalah array (bukan object wrapped)
    if (!Array.isArray(bookings)) bookings = bookings.value || bookings.data || [];

    // LOGIC MULTI-TENANT FILTER
    // Cabang: selalu filter ke cabang sendiri (CURRENT_CABANG dari env)
    // Master: gunakan dropdown branchFilter
    if (CURRENT_CABANG !== 'master') {
      // Non-master: paksa filter ke cabang sendiri (dari VITE_CABANG)
      bookings = bookings.filter((b:any) => b.cabang_id === CURRENT_CABANG);
    } else {
      // Master: filter sesuai pilihan dropdown
      const selectedBranchFilter = branchFilter.value;
      if (selectedBranchFilter !== 'all') {
        bookings = bookings.filter((b:any) => b.cabang_id === selectedBranchFilter);
      }
    }
    
    renderKanban(bookings);
  } catch (e) { console.error('fetchBookings error:', e); }
}

branchFilter.addEventListener('change', fetchBookings);

bgRefreshButton.addEventListener('click', async () => {
  bgRefreshButton.classList.add('spin');
  await fetchBookings();
  await checkAllGoWAStatus();
  setTimeout(() => bgRefreshButton.classList.remove('spin'), 500); // Effect duration
});

// Auto-Refresh tiap 5 detik
setInterval(() => {
  if(loggedInUser) fetchBookings();
}, 5000);

(window as any).updateBookingStatus = async (bookingId: string, newStatus: string) => {
  try {
    await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    fetchBookings(); // Force Update
  } catch(e) {
    alert('Gagal update MySQL');
  }
}

function renderKanban(bookings: any[]) {
  if (!colPending) return;

  const pending: any[] = [];
  const proses: any[] = [];
  const selesai: any[] = [];
  
  bookings.forEach(bkg => {
    if (bkg.status === 'pending') pending.push(bkg);
    if (bkg.status === 'proses') proses.push(bkg);
    if (bkg.status === 'selesai') selesai.push(bkg);
  });

  const generateCard = (b: any, statusType: string) => `
    <div class="booking-card">
      <div class="bkg-head">
        <span class="bkg-id">${b.id}</span>
        <span class="bkg-cabang">${(b.cabang_id || '').toUpperCase()}</span>
      </div>
      <div class="bkg-body">
        <h4>${(b.nopol || '').toUpperCase().replace(/([A-Z]+)\s*(\d+)\s*([A-Z]+)/g, '$1 $2 $3')}</h4>
        <p>${b.nama || b.nama_pelanggan || 'Pelanggan'} - ${b.pelanggan_motor || b.layanan || 'Motor'}</p>
        <p style="margin-top:4px; font-size:0.8rem; color:var(--primary-accent);">
          <i>${b.status_jemput === 'jemput' ? '🚨 Antar Jemput' : '🔧 ' + (b.layanan || 'Servis Reguler')}</i>
        </p>
      </div>
      <div class="bkg-actions">
        ${statusType === 'pending'
          ? `<button class="btn-action btn-proses" onclick="updateBookingStatus('${b.id}', 'proses')">TANDAI PROSES</button>` 
          : statusType === 'proses'
          ? `<button class="btn-action btn-selesai" onclick="updateBookingStatus('${b.id}', 'selesai')">SERVIS SELESAI</button>`
          : `<span class="badge-success" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--success-color); color: var(--success-color);">Tuntas</span>`
        }
      </div>
    </div>
  `;

  colPending.innerHTML = pending.length === 0 ? '<p style="text-align:center; color:#94a3b8;">Tidak ada antrean</p>' : pending.map(b => generateCard(b, 'pending')).join('');
  colProses.innerHTML = proses.length === 0 ? '<p style="text-align:center; color:#94a3b8;">Tidak ada yang dikerjakan</p>' : proses.map(b => generateCard(b, 'proses')).join('');
  if (colSelesai) {
    colSelesai.innerHTML = selesai.length === 0 ? '<p style="text-align:center; color:#94a3b8;">Belum ada tuntas</p>' : selesai.map(b => generateCard(b, 'selesai')).join('');
  }
}
