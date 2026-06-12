// ─────────────────────────────────────────────
//  Auth Guard — redirect ke /login jika belum login
// ─────────────────────────────────────────────
(function () {
    var token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('/login');
        // Jangan throw Error mentah, cukup hentikan pemrosesan dengan warning
        console.warn('User not authenticated. Redirecting...');
    }
})();

// ─────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────
let currentMode = 'paraphrase';

// DOM refs — diisi setelah DOM siap
let authSection, inputText, charCount, btnProses, btnClear;
let spinner, magicIcon, resultCard, activeBadge, outputText, skeletonCard;

// ─────────────────────────────────────────────
//  Template contoh
// ─────────────────────────────────────────────
const templates = {
    paraphrase: "gue mau bilang makasih banget buat bantuan lu kemarin bro.",
    summary: "Kemajuan teknologi kecerdasan buatan berkembang dengan sangat pesat di era digital saat ini. Banyak sekali sektor industri yang mulai mengadopsi AI untuk mengotomatisasi pekerjaan mereka. Hal ini memicu pro dan kontra di kalangan pekerja karena takut posisi mereka digantikan. Namun, di sisi lain, AI juga membuka lapangan kerja baru yang membutuhkan keterampilan digital tingkat tinggi. Oleh karena itu, penting bagi kita untuk terus belajar dan beradaptasi.",
    grammar: "saya kemarin pergi ke apotik membeli obat tapi obat nya habis terpaksa saya pulang dengan tangan kosg."
};

// ─────────────────────────────────────────────
//  DOMContentLoaded
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    authSection  = document.getElementById('auth-section');
    inputText    = document.getElementById('input-text');
    charCount    = document.getElementById('char-count');
    btnProses    = document.getElementById('btn-proses');
    btnClear     = document.getElementById('btn-clear');
    spinner      = document.getElementById('spinner');
    magicIcon    = document.getElementById('magic-icon');
    resultCard   = document.getElementById('result-card');
    activeBadge  = document.getElementById('active-badge');
    outputText   = document.getElementById('output-text');
    skeletonCard = document.getElementById('skeleton-card');

    if (inputText) {
        inputText.addEventListener('input', () => {
            charCount.textContent = inputText.value.length;
        });
    }

    initTheme();
    updateAuthUI();
    fetchHistory();
});

// ─────────────────────────────────────────────
//  Auth UI
// ─────────────────────────────────────────────
async function updateAuthUI() {
    const token    = localStorage.getItem('token');
    let username   = localStorage.getItem('username');
    let role       = localStorage.getItem('role');

    if (!authSection) return;

    // Handle logo admin badge
    const brandLogo = document.getElementById('brand-logo');
    if (brandLogo) {
        const existingBadge = document.getElementById('brand-admin-badge');
        if (existingBadge) existingBadge.remove();

        if (token && role === 'admin') {
            const adminBadge = document.createElement('span');
            adminBadge.id = 'brand-admin-badge';
            adminBadge.className = 'text-xs font-semibold text-primary px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full ml-1.5';
            adminBadge.textContent = 'Admin';
            brandLogo.parentNode.appendChild(adminBadge);
        }
    }

    if (!token) {
        renderLoginButton();
        return;
    }

    // Jika token ada tetapi username/role tidak tersimpan (sesi lama/stale),
    // ambil datanya dari backend.
    if (!username || !role) {
        try {
            const response = await fetch('/api/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const user = await response.json();
                username = user.username;
                role = user.role;
                localStorage.setItem('username', username);
                localStorage.setItem('role', role);
                
                // Re-run to apply brand badge now that we have role
                if (brandLogo && role === 'admin') {
                    const existingBadge = document.getElementById('brand-admin-badge');
                    if (!existingBadge) {
                        const adminBadge = document.createElement('span');
                        adminBadge.id = 'brand-admin-badge';
                        adminBadge.className = 'text-xs font-semibold text-primary px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full ml-1.5';
                        adminBadge.textContent = 'Admin';
                        brandLogo.parentNode.appendChild(adminBadge);
                    }
                }
            } else if (response.status === 401) {
                // Token tidak valid/kedaluwarsa
                localStorage.clear();
                window.location.replace('/login');
                return;
            }
        } catch (error) {
            console.error('Gagal memuat profil user:', error);
        }
    }

    if (token && username) {
        // Tombol Admin Panel (hanya untuk admin)
        const adminBtn = role === 'admin'
            ? `<a href="/admin"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900
                         border border-gray-200 rounded-xl hover:bg-gray-50 transition-all
                         flex items-center gap-1.5 shadow-sm">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                       d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955
                          0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622
                          5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                   </svg>
                   Admin
               </a>`
            : '';

        authSection.innerHTML = `
            <div class="relative inline-block text-left" id="user-menu-container">
                <button onclick="toggleUserDropdown(event)" id="user-menu-btn"
                    class="text-xs font-semibold text-gray-700 dark:text-slate-305 bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-600 flex items-center gap-1.5 hover:bg-gray-200 dark:hover:bg-slate-650 transition-all focus:outline-none shadow-sm cursor-pointer">
                    <span>👋 ${escapeHtml(username)}</span>
                    <svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <div id="user-dropdown-menu" class="hidden absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg py-1 z-50 transition-all">
                    <button onclick="openEditProfileModal()" class="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 dark:text-slate-305 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        Edit Profil
                    </button>
                    <button onclick="handleLogout()" class="w-full text-left px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                        </svg>
                        Keluar
                    </button>
                </div>
            </div>
            ${adminBtn}
        `;
    } else {
        renderLoginButton();
    }
}

function renderLoginButton() {
    authSection.innerHTML = `
        <button onclick="window.location.href='/login'"
            class="px-4 py-2 text-xs font-semibold text-white bg-primary
                   hover:bg-indigo-700 rounded-xl transition-all shadow-sm">
            Masuk / Daftar
        </button>
    `;
}

// ─────────────────────────────────────────────
//  Logout
// ─────────────────────────────────────────────
async function handleLogout() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Logout error:', err);
        }
    }
    localStorage.clear();
    window.location.href = '/login';
}

// ─────────────────────────────────────────────
//  Tab switching
// ─────────────────────────────────────────────
function switchTab(mode) {
    currentMode = mode;
    const tabs = {
        paraphrase: document.getElementById('tab-paraphrase'),
        summary:    document.getElementById('tab-summary'),
        grammar:    document.getElementById('tab-grammar')
    };
    Object.keys(tabs).forEach(key => {
        tabs[key].className = "tab-btn px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700";
    });
    tabs[mode].className = "tab-btn px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 bg-primary text-white";
}

// ─────────────────────────────────────────────
//  Clear input
// ─────────────────────────────────────────────
function clearText() {
    inputText.value = '';
    charCount.textContent = '0';
    resultCard.classList.add('hidden');
    skeletonCard.classList.add('hidden');
    inputText.focus();
}

// ─────────────────────────────────────────────
//  Quick templates
// ─────────────────────────────────────────────
function applyTemplate(label, mode) {
    switchTab(mode);
    inputText.value = templates[mode];
    charCount.textContent = templates[mode].length;
    inputText.focus();
}

// ─────────────────────────────────────────────
//  Toast notifications
// ─────────────────────────────────────────────
function showToast(message, isError = false) {
    const toastId = isError ? 'error-toast' : 'toast';
    const msgId   = isError ? 'error-toast-message' : 'toast-message';
    const toast   = document.getElementById(toastId);
    const msg     = document.getElementById(msgId);
    msg.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}

// ─────────────────────────────────────────────
//  Copy result to clipboard
// ─────────────────────────────────────────────
async function copyResult() {
    const text = outputText.textContent.trim();
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        showToast("Hasil berhasil disalin ke clipboard!");
    } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); showToast("Berhasil disalin!"); }
        catch { showToast("Gagal menyalin teks.", true); }
        document.body.removeChild(ta);
    }
}

// ─────────────────────────────────────────────
//  Process text via API
// ─────────────────────────────────────────────
async function processText() {
    const text = inputText.value.trim();
    if (!text) { showToast("Masukkan teks terlebih dahulu.", true); return; }
    if (text.length < 5) { showToast("Teks terlalu pendek untuk diproses.", true); return; }

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    setInputDisabledState(true);
    resultCard.classList.add('hidden');
    skeletonCard.classList.remove('hidden');

    try {
        const provider = document.getElementById('provider-select').value;
        const response = await fetch(`/${currentMode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text, provider })
        });

        const data = await response.json();

        if (response.status === 401) {
            localStorage.clear();
            window.location.replace('/login');
            return;
        }

        if (!response.ok) throw new Error(data.detail || "Terjadi kesalahan saat memproses teks.");

        activeBadge.textContent = getBadgeLabel(currentMode);
        outputText.textContent  = data.result;
        skeletonCard.classList.add('hidden');
        resultCard.classList.remove('hidden');
        fetchHistory(); // Refresh riwayat

    } catch (error) {
        skeletonCard.classList.add('hidden');
        showToast(error.message || "Terjadi kesalahan. Silakan coba lagi.", true);
    } finally {
        setInputDisabledState(false);
    }
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function setInputDisabledState(disabled) {
    inputText.disabled  = disabled;
    btnProses.disabled  = disabled;
    btnClear.disabled   = disabled;
    if (disabled) {
        spinner.classList.remove('hidden');
        magicIcon.classList.add('hidden');
        btnProses.classList.add('opacity-70', 'cursor-not-allowed');
    } else {
        spinner.classList.add('hidden');
        magicIcon.classList.remove('hidden');
        btnProses.classList.remove('opacity-70', 'cursor-not-allowed');
    }
}

function getBadgeLabel(mode) {
    return { paraphrase: 'Parafrase', summary: 'Ringkasan', grammar: 'Grammar' }[mode] || mode;
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// ─────────────────────────────────────────────
//  Dark Mode
// ─────────────────────────────────────────────
function initTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const iconMoon = document.getElementById('icon-moon');
    const iconSun  = document.getElementById('icon-sun');
    if (iconMoon && iconSun) {
        iconMoon.classList.toggle('hidden', isDark);
        iconSun.classList.toggle('hidden', !isDark);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    initTheme();
}

// ─────────────────────────────────────────────
//  Riwayat (History)
// ─────────────────────────────────────────────
async function fetchHistory() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/history', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const items = await res.json();
        renderHistory(items);
    } catch (e) {
        console.error('Gagal memuat riwayat:', e);
    }
}

function renderHistory(items) {
    const list   = document.getElementById('history-list');
    const empty  = document.getElementById('history-empty');
    const btnClearHist = document.getElementById('btn-clear-history');
    if (!list) return;

    if (!items || items.length === 0) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        if (btnClearHist) btnClearHist.classList.add('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    if (btnClearHist) btnClearHist.classList.remove('hidden');

    const modeLabel = { paraphrase: 'Parafrase', summary: 'Ringkasan', grammar: 'Grammar' };
    const modeColor = {
        paraphrase: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800',
        summary:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800',
        grammar:    'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-100 dark:border-amber-800'
    };

    list.innerHTML = items.map(item => {
        let date = '-';
        if (item.created_at) {
            const dateStr = item.created_at.replace(' ', 'T') + 'Z';
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
                date = dateObj.toLocaleString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
        }
        const preview = item.processed_text.length > 120
            ? item.processed_text.substring(0, 120) + '…'
            : item.processed_text;
        const badge = modeColor[item.mode] || 'bg-gray-50 text-gray-600';

        return `
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-2 hover:shadow-sm transition-all">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 text-xs font-semibold rounded-md border ${badge}">${modeLabel[item.mode] || item.mode}</span>
                    <span class="text-xs text-gray-300 dark:text-slate-500">${item.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-300 dark:text-slate-500">${date}</span>
                    <button onclick="copyHistoryResult(${item.id})" data-result="${escapeHtml(item.processed_text).replace(/"/g, '&quot;')}"
                        class="text-xs text-gray-400 dark:text-slate-400 hover:text-primary transition-all" title="Salin hasil">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                    </button>
                    <button onclick="deleteHistoryItem(${item.id})"
                        class="text-xs text-gray-300 dark:text-slate-600 hover:text-red-500 transition-all" title="Hapus">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">${escapeHtml(preview)}</p>
        </div>`;
    }).join('');
}

async function deleteHistoryItem(id) {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        await fetch(`/api/history/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchHistory();
    } catch (e) {
        showToast('Gagal menghapus item.', true);
    }
}

async function clearHistory() {
    if (!confirm('Hapus semua riwayat pemrosesan?')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        await fetch('/api/history', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchHistory();
    } catch (e) {
        showToast('Gagal menghapus riwayat.', true);
    }
}

async function copyHistoryResult(id) {
    const btn = document.querySelector(`[onclick="copyHistoryResult(${id})"]`);
    const text = btn ? btn.dataset.result : '';
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Hasil disalin!');
    } catch {
        showToast('Gagal menyalin.', true);
    }
}

// Profile Dropdown functions
function toggleUserDropdown(e) {
    e.stopPropagation();
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Close user dropdown when clicking outside
document.addEventListener('click', (e) => {
    const container = document.getElementById('user-menu-container');
    const menu = document.getElementById('user-dropdown-menu');
    if (menu && container && !container.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

// Edit Profile Modal functions
function openEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) {
        const username = localStorage.getItem('username') || '';
        document.getElementById('edit-profile-username').value = username;
        document.getElementById('old-password').value = '';
        document.getElementById('new-password').value = '';
        modal.classList.remove('hidden');
    }
}

function closeEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function submitUpdateUsername(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const username = document.getElementById('edit-profile-username').value.trim();
    if (!username) {
        showToast('Username tidak boleh kosong!', true);
        return;
    }
    
    try {
        const response = await fetch('/api/users/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Gagal mengubah username.');
        }
        
        localStorage.setItem('username', data.username);
        showToast('Username berhasil diperbarui!');
        updateAuthUI();
        closeEditProfileModal();
    } catch (error) {
        showToast(error.message, true);
    }
}

async function submitChangePassword(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const oldPassword = document.getElementById('old-password').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    
    if (!oldPassword || !newPassword) {
        showToast('Password tidak boleh kosong!', true);
        return;
    }
    if (newPassword.length < 6) {
        showToast('Password baru minimal 6 karakter!', true);
        return;
    }
    
    try {
        const response = await fetch('/api/users/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Gagal mengganti password.');
        }
        
        showToast('Password berhasil diganti!');
        closeEditProfileModal();
    } catch (error) {
        showToast(error.message, true);
    }
}
