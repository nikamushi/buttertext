// State management
let usersData = [];
const token = localStorage.getItem('token');
const userRole = localStorage.getItem('role');

// Frontend Validation: Redirect if not an admin
if (!token || userRole !== 'admin') {
    window.location.href = '/';
}

// DOM Elements
const userTableBody = document.getElementById('user-table-body');
const statTotalUsers = document.getElementById('stat-total-users');
const statTotalAdmins = document.getElementById('stat-total-admins');
const editModal = document.getElementById('edit-modal');
const editUserIdInput = document.getElementById('edit-user-id');
const editUsernameInput = document.getElementById('edit-username');
const editRoleInput = document.getElementById('edit-role');

// Load Data on Load
document.addEventListener('DOMContentLoaded', () => {
    // Tampilkan nama admin yang sedang login
    const username = localStorage.getItem('username');
    const badge = document.getElementById('admin-username-badge');
    if (badge && username) {
        badge.textContent = '👋 ' + username;
    }
    fetchUsers();
});

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

// Fetch all users
async function fetchUsers() {
    try {
        const response = await fetch('/api/users', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            // Unauthorized/Forbidden
            localStorage.clear();
            window.location.href = '/';
            return;
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Gagal memuat pengguna.');
        }

        usersData = data;
        renderUsersTable();
        calculateStats();

    } catch (error) {
        console.error('Fetch error:', error);
        showToast(error.message, true);
        userTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-red-500 font-medium">
                    Gagal mengambil data dari server.
                </td>
            </tr>
        `;
    }
}

// Render Users inside table
function renderUsersTable() {
    if (usersData.length === 0) {
        userTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    Tidak ada pengguna terdaftar.
                </td>
            </tr>
        `;
        return;
    }

    userTableBody.innerHTML = usersData.map(user => {
        // Format Date
        let dateFormatted = '-';
        if (user.created_at) {
            const dateObj = new Date(user.created_at + 'Z'); // Treat SQLite timestamp as UTC
            dateFormatted = dateObj.toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        const isAdmin = user.role === 'admin';
        const roleBadge = isAdmin 
            ? `<span class="px-2 py-0.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-150 rounded-md">Admin</span>`
            : `<span class="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-150 rounded-md">User</span>`;

        return `
            <tr class="hover:bg-gray-50/50 transition-all">
                <td class="px-6 py-4 font-mono text-gray-500 font-semibold">${user.id}</td>
                <td class="px-6 py-4 font-medium text-gray-900">${escapeHtml(user.username)}</td>
                <td class="px-6 py-4">${roleBadge}</td>
                <td class="px-6 py-4 text-gray-400 text-xs">${dateFormatted}</td>
                <td class="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="openEditModal(${user.id})" class="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-primary bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all">
                        Edit
                    </button>
                    <button onclick="deleteUser(${user.id})" class="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-danger bg-red-50 hover:bg-red-100 rounded-lg transition-all">
                        Hapus
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Calculate Stats Widgets
function calculateStats() {
    statTotalUsers.textContent = usersData.length;
    const adminCount = usersData.filter(u => u.role === 'admin').length;
    statTotalAdmins.textContent = adminCount;
}

// Edit Modal Functions
function openEditModal(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    
    editUserIdInput.value = user.id;
    editUsernameInput.value = user.username;
    editRoleInput.value = user.role;
    
    editModal.classList.remove('hidden');
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editUserIdInput.value = '';
    editUsernameInput.value = '';
}

// Submit edit user form
async function submitEditUserForm(e) {
    e.preventDefault();
    
    const userId = editUserIdInput.value;
    const username = editUsernameInput.value.trim();
    const role = editRoleInput.value;
    
    if (!username) {
        showToast('Username tidak boleh kosong!', true);
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, role })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Gagal memperbarui pengguna.');
        }

        showToast('Informasi pengguna berhasil diperbarui!');
        closeEditModal();
        fetchUsers();

    } catch (error) {
        showToast(error.message, true);
    }
}

// Delete user API request
async function deleteUser(userId) {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini secara permanen?')) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Gagal menghapus pengguna.');
        }

        showToast('Pengguna berhasil dihapus!');
        fetchUsers();

    } catch (error) {
        showToast(error.message, true);
    }
}

// Logout Function
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
