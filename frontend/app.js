// State management
let currentMode = 'paraphrase';

// Auth State Management
let authMode = 'login'; // 'login' or 'register'

// DOM Elements (lazily initialized)
let authSection, authModal, authModalTitle, authForm;
let authUsernameInput, authPasswordInput, authSubmitBtn, authSwitchText, authSwitchBtn;
let inputText, charCount, btnProses, btnClear, spinner, magicIcon;
let resultCard, activeBadge, outputText, skeletonCard;

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    // Auth Elements
    authSection = document.getElementById('auth-section');
    authModal = document.getElementById('auth-modal');
    authModalTitle = document.getElementById('auth-modal-title');
    authForm = document.getElementById('auth-form');
    authUsernameInput = document.getElementById('auth-username');
    authPasswordInput = document.getElementById('auth-password');
    authSubmitBtn = document.getElementById('auth-submit-btn');
    authSwitchText = document.getElementById('auth-switch-text');
    authSwitchBtn = document.getElementById('auth-switch-btn');

    // Main Elements
    inputText = document.getElementById('input-text');
    charCount = document.getElementById('char-count');
    btnProses = document.getElementById('btn-proses');
    btnClear = document.getElementById('btn-clear');
    spinner = document.getElementById('spinner');
    magicIcon = document.getElementById('magic-icon');
    resultCard = document.getElementById('result-card');
    activeBadge = document.getElementById('active-badge');
    outputText = document.getElementById('output-text');
    skeletonCard = document.getElementById('skeleton-card');

    // Event Listeners
    if (inputText) {
        inputText.addEventListener('input', () => {
            charCount.textContent = inputText.value.length;
        });
    }

    updateAuthUI();
});

// Templates content
const templates = {
    paraphrase: "gue mau bilang makasih banget buat bantuan lu kemarin bro.",
    summary: "Kemajuan teknologi kecerdasan buatan berkembang dengan sangat pesat di era digital saat ini. Banyak sekali sektor industri yang mulai mengadopsi AI untuk mengotomatisasi pekerjaan mereka. Hal ini memicu pro dan kontra di kalangan pekerja karena takut posisi mereka digantikan. Namun, di sisi lain, AI juga membuka lapangan kerja baru yang membutuhkan keterampilan digital tingkat tinggi. Oleh karena itu, penting bagi kita untuk terus belajar dan beradaptasi.",
    grammar: "saya kemarin pergi ke apotik membeli obat tapi obat nya habis terpaksa saya pulang dengan tangan kosg."
};

// Switch Tabs
function switchTab(mode) {
    currentMode = mode;
    
    const tabs = {
        paraphrase: document.getElementById('tab-paraphrase'),
        summary: document.getElementById('tab-summary'),
        grammar: document.getElementById('tab-grammar')
    };
    
    // Reset semua tab ke style border (non-aktif)
    Object.keys(tabs).forEach(key => {
        tabs[key].className = "tab-btn px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700";
    });
    
    // Set tab aktif ke style pill indigo (sesuai Figma)
    tabs[mode].className = "tab-btn px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 bg-primary text-white";
}

// Clear all inputs and outputs
function clearText() {
    inputText.value = '';
    charCount.textContent = '0';
    resultCard.classList.add('hidden');
    skeletonCard.classList.add('hidden');
    inputText.focus();
}

// Apply quick prompt templates
function applyTemplate(label, mode) {
    switchTab(mode);
    inputText.value = templates[mode];
    charCount.textContent = templates[mode].length;
    inputText.focus();
}

// Toast Notifications
function showToast(message, isError = false) {
    const toastId = isError ? 'error-toast' : 'toast';
    const msgId = isError ? 'error-toast-message' : 'toast-message';
    
    const toast = document.getElementById(toastId);
    const toastMessage = document.getElementById(msgId);
    
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Copy results to clipboard
async function copyResult() {
    const textToCopy = outputText.textContent.trim();
    if (!textToCopy) return;
    
    try {
        await navigator.clipboard.writeText(textToCopy);
        showToast("Hasil berhasil disalin ke clipboard!");
    } catch (err) {
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = textToCopy;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        try {
            document.execCommand("copy");
            showToast("Hasil berhasil disalin ke clipboard!");
        } catch (copyErr) {
            showToast("Gagal menyalin teks.", true);
        }
        document.body.removeChild(tempTextArea);
    }
}

// Process the text with backend
async function processText() {
    const text = inputText.value.trim();
    
    // Front-end Validation
    if (!text) {
        showToast("Masukkan teks terlebih dahulu.", true);
        return;
    }
    if (text.length < 5) {
        showToast("Teks terlalu pendek untuk diproses.", true);
        return;
    }

    // Check Authentication
    const token = localStorage.getItem('token');
    
    if (!token) {
        showToast("Silakan masuk/login terlebih dahulu untuk menggunakan ButterText.", true);
        openAuthModal('login');
        return;
    }
    
    // Log token for debugging (remove in production)
    console.log('Token exists:', token.substring(0, 20) + '...');
    
    // Set UI to loading state
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
            updateAuthUI();
            throw new Error("Sesi login berakhir. Silakan masuk kembali.");
        }

        if (!response.ok) {
            throw new Error(data.detail || "Terjadi kesalahan saat memproses teks.");
        }
        
        // Success
        activeBadge.textContent = getBadgeLabel(currentMode);
        outputText.textContent = data.result;
        
        // Transition from skeleton to result card
        skeletonCard.classList.add('hidden');
        resultCard.classList.remove('hidden');
        
    } catch (error) {
        console.error("API Error:", error);
        skeletonCard.classList.add('hidden');
        showToast(error.message || "Terjadi kesalahan saat memproses teks. Silakan coba lagi.", true);
    } finally {
        setInputDisabledState(false);
    }
}

// Helper: Toggle disabled states
function setInputDisabledState(disabled) {
    inputText.disabled = disabled;
    btnProses.disabled = disabled;
    btnClear.disabled = disabled;
    
    if (disabled) {
        spinner.classList.remove('hidden');
        magicIcon.classList.add('hidden');
        btnProses.classList.add('opacity-80', 'cursor-not-allowed');
    } else {
        spinner.classList.add('hidden');
        magicIcon.classList.remove('hidden');
        btnProses.classList.remove('opacity-80', 'cursor-not-allowed');
    }
}

// Helper: Get Badge Label for output card
function getBadgeLabel(mode) {
    switch(mode) {
        case 'paraphrase': return 'Parafrase';
        case 'summary': return 'Ringkasan';
        case 'grammar': return 'Grammar';
        default: return mode;
    }
}

// Authentication Functions
function openAuthModal(mode = 'login') {
    window.location.href = '/login';
}

function closeAuthModal() {
    authModal.classList.add('hidden');
}

function switchAuthMode() {
    if (authMode === 'login') {
        openAuthModal('register');
    } else {
        openAuthModal('login');
    }
}

async function submitAuthForm(e) {
    e.preventDefault();
    
    const usernameVal = authUsernameInput.value.trim();
    const passwordVal = authPasswordInput.value.trim();
    
    if (!usernameVal || !passwordVal) {
        showToast('Username dan password tidak boleh kosong.', true);
        return;
    }
    
    const url = authMode === 'login' ? '/api/login' : '/api/register';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: usernameVal, password: passwordVal })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Autentikasi gagal.');
        }
        
        if (authMode === 'login') {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            localStorage.setItem('role', data.role);
            showToast(`Selamat datang kembali, ${data.username}!`);
            closeAuthModal();
            updateAuthUI();
        } else {
            showToast('Pendaftaran akun berhasil! Silakan login.');
            openAuthModal('login');
        }
        
    } catch (err) {
        showToast(err.message, true);
    }
}

async function handleLogout() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (err) {
            console.error('Logout error:', err);
        }
    }
    localStorage.clear();
    window.location.href = '/login';
}

function updateAuthUI() {
    const currentToken = localStorage.getItem('token');
    const currentUsername = localStorage.getItem('username');
    const currentRole = localStorage.getItem('role');
    
    if (currentToken && currentUsername) {
        let adminBtn = '';
        if (currentRole === 'admin') {
            adminBtn = `
                <a href="/admin" class="px-4 py-2 text-xs font-semibold text-primary bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-xl transition-all">
                    Admin Panel
                </a>
            `;
        }
        
        authSection.innerHTML = `
            ${adminBtn}
            <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200">
                    👋 ${escapeHtml(currentUsername)}
                </span>
                <button onclick="handleLogout()" class="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl transition-all">
                    Keluar
                </button>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <button onclick="window.location.href = '/login'" class="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-indigo-700 rounded-xl transition-all shadow-sm">
                Masuk / Daftar
            </button>
        `;
    }
}

// Utility: Escape HTML tags to prevent XSS injection
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

