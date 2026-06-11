// State management
let currentMode = 'paraphrase';

// DOM Elements
const inputText = document.getElementById('input-text');
const charCount = document.getElementById('char-count');
const btnProses = document.getElementById('btn-proses');
const btnClear = document.getElementById('btn-clear');
const spinner = document.getElementById('spinner');
const magicIcon = document.getElementById('magic-icon');

const resultCard = document.getElementById('result-card');
const activeBadge = document.getElementById('active-badge');
const outputText = document.getElementById('output-text');
const skeletonCard = document.getElementById('skeleton-card');

// Templates content
const templates = {
    paraphrase: "gue mau bilang makasih banget buat bantuan lu kemarin bro.",
    summary: "Kemajuan teknologi kecerdasan buatan berkembang dengan sangat pesat di era digital saat ini. Banyak sekali sektor industri yang mulai mengadopsi AI untuk mengotomatisasi pekerjaan mereka. Hal ini memicu pro dan kontra di kalangan pekerja karena takut posisi mereka digantikan. Namun, di sisi lain, AI juga membuka lapangan kerja baru yang membutuhkan keterampilan digital tingkat tinggi. Oleh karena itu, penting bagi kita untuk terus belajar dan beradaptasi.",
    grammar: "saya kemarin pergi ke apotik membeli obat tapi obat nya habis terpaksa saya pulang dengan tangan kosg."
};

// Event Listeners
inputText.addEventListener('input', () => {
    charCount.textContent = inputText.value.length;
});

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
    toast.classList.add('animate-toast');
    
    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('animate-toast');
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
        // Fallback for older browsers
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
    
    // Set UI to loading state
    setInputDisabledState(true);
    resultCard.classList.add('hidden');
    skeletonCard.classList.remove('hidden');
    
    try {
        const provider = document.getElementById('provider-select').value;
        const response = await fetch(`/${currentMode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, provider })
        });
        
        const data = await response.json();
        
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
