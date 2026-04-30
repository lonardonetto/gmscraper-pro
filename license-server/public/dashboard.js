// License Management Dashboard JavaScript

let licenses = [];
let currentFilter = '';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', function(e) {
        currentFilter = e.target.value.toLowerCase();
        filterLicenses();
    });
});

// Load dashboard data
async function loadDashboard() {
    showLoading(true);
    try {
        await Promise.all([
            loadLicenses(),
            loadStats()
        ]);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('Error loading dashboard data', 'danger');
    } finally {
        showLoading(false);
    }
}

// Load all licenses
async function loadLicenses() {
    try {
        const response = await fetch('/api/admin/licenses', {
            headers: {
                'X-Admin-Secret': getAdminSecret()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load licenses');
        }
        
        const data = await response.json();
        licenses = data.licenses || [];
        renderLicensesTable();
    } catch (error) {
        console.error('Error loading licenses:', error);
        throw error;
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: {
                'X-Admin-Secret': getAdminSecret()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load stats');
        }
        
        const stats = await response.json();
        updateStatsCards(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
        throw error;
    }
}

// Update statistics cards
function updateStatsCards(stats) {
    document.getElementById('totalLicenses').textContent = stats.totalLicenses || 0;
    document.getElementById('activeLicenses').textContent = stats.activeLicenses || 0;
    document.getElementById('totalActivations').textContent = stats.totalActivations || 0;
    document.getElementById('expiredLicenses').textContent = stats.expiredLicenses || 0;
}

// Render licenses table
function renderLicensesTable() {
    const tbody = document.getElementById('licensesTableBody');
    tbody.innerHTML = '';
    
    const filteredLicenses = licenses.filter(license => {
        if (!currentFilter) return true;
        return license.key.toLowerCase().includes(currentFilter) ||
               license.plan.toLowerCase().includes(currentFilter) ||
               license.notes.toLowerCase().includes(currentFilter);
    });
    
    filteredLicenses.forEach(license => {
        const row = createLicenseRow(license);
        tbody.appendChild(row);
    });
}

// Create license table row
function createLicenseRow(license) {
    const row = document.createElement('tr');
    
    const statusClass = getStatusClass(license);
    const statusText = getStatusText(license);
    
    row.innerHTML = `
        <td><code>${license.key}</code></td>
        <td><span class="badge bg-primary">${license.plan}</span></td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${license.activations || 0}</td>
        <td>${license.max_activations}</td>
        <td>${formatDate(license.expires_at)}</td>
        <td>${formatDate(license.created_at)}</td>
        <td>
            <button class="btn btn-sm btn-info btn-action" onclick="showLicenseDetails('${license.key}')">
                <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-warning btn-action" onclick="resetLicense('${license.key}')">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button class="btn btn-sm btn-danger btn-action" onclick="deleteLicense('${license.key}')">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    
    return row;
}

// Get status class for license
function getStatusClass(license) {
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
        return 'status-expired';
    }
    if (license.activations > 0) {
        return 'status-active';
    }
    return 'status-inactive';
}

// Get status text for license
function getStatusText(license) {
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
        return 'Expired';
    }
    if (license.activations > 0) {
        return 'Active';
    }
    return 'Inactive';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
}

// Show license details
async function showLicenseDetails(licenseKey) {
    try {
        const response = await fetch(`/api/admin/licenses/${licenseKey}`, {
            headers: {
                'X-Admin-Secret': getAdminSecret()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load license details');
        }
        
        const data = await response.json();
        renderLicenseDetails(data);
        
        const modal = new bootstrap.Modal(document.getElementById('licenseDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading license details:', error);
        showAlert('Error loading license details', 'danger');
    }
}

// Render license details
function renderLicenseDetails(data) {
    const detailsDiv = document.getElementById('licenseDetails');
    
    const activationsHtml = data.activations.map(activation => `
        <tr>
            <td><code>${activation.machine_id.substring(0, 8)}...</code></td>
            <td>${formatDate(activation.activated_at)}</td>
            <td>${formatDate(activation.last_validated)}</td>
            <td>
                <span class="status-badge ${activation.is_active ? 'status-active' : 'status-inactive'}">
                    ${activation.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-warning btn-action" onclick="deactivateLicense('${data.license.key}', '${activation.machine_id}')">
                    Deactivate
                </button>
            </td>
        </tr>
    `).join('');
    
    detailsDiv.innerHTML = `
        <div class="row mb-3">
            <div class="col-md-6">
                <h6>License Information</h6>
                <table class="table table-sm">
                    <tr><td>Key:</td><td><code>${data.license.key}</code></td></tr>
                    <tr><td>Plan:</td><td>${data.license.plan}</td></tr>
                    <tr><td>Max Activations:</td><td>${data.license.max_activations}</td></tr>
                    <tr><td>Created:</td><td>${formatDate(data.license.created_at)}</td></tr>
                    <tr><td>Expires:</td><td>${formatDate(data.license.expires_at)}</td></tr>
                    <tr><td>Notes:</td><td>${data.license.notes || 'N/A'}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>Activations (${data.activations.length})</h6>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Machine ID</th>
                                <th>Activated</th>
                                <th>Last Validated</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activationsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Show create license modal
function showCreateModal() {
    const modal = new bootstrap.Modal(document.getElementById('createLicenseModal'));
    modal.show();
}

// Create new license
async function createLicense() {
    const form = document.getElementById('createLicenseForm');
    const formData = new FormData(form);
    
    const licenseData = {
        plan: document.getElementById('licensePlan').value,
        maxActivations: parseInt(document.getElementById('maxActivations').value),
        expiresAt: document.getElementById('expiresAt').value || null,
        notes: document.getElementById('licenseNotes').value
    };
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/admin/create-license', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Secret': getAdminSecret()
            },
            body: JSON.stringify(licenseData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to create license');
        }
        
        const result = await response.json();
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('createLicenseModal')).hide();
        
        // Reset form
        form.reset();
        
        // Refresh data
        await loadDashboard();
        
        showAlert(`License created: ${result.key}`, 'success');
    } catch (error) {
        console.error('Error creating license:', error);
        showAlert('Error creating license', 'danger');
    } finally {
        showLoading(false);
    }
}

// Reset license (clear all activations)
async function resetLicense(licenseKey) {
    if (!confirm('Are you sure you want to reset all activations for this license?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/admin/licenses/${licenseKey}/reset`, {
            method: 'POST',
            headers: {
                'X-Admin-Secret': getAdminSecret()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to reset license');
        }
        
        await loadDashboard();
        showAlert('License reset successfully', 'success');
    } catch (error) {
        console.error('Error resetting license:', error);
        showAlert('Error resetting license', 'danger');
    } finally {
        showLoading(false);
    }
}

// Deactivate specific activation
async function deactivateLicense(licenseKey, machineId) {
    if (!confirm('Are you sure you want to deactivate this device?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/admin/deactivate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Secret': getAdminSecret()
            },
            body: JSON.stringify({
                licenseKey: licenseKey,
                machineId: machineId
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to deactivate license');
        }
        
        // Refresh modal data
        await showLicenseDetails(licenseKey);
        await loadDashboard();
        
        showAlert('License deactivated successfully', 'success');
    } catch (error) {
        console.error('Error deactivating license:', error);
        showAlert('Error deactivating license', 'danger');
    } finally {
        showLoading(false);
    }
}

// Delete license
async function deleteLicense(licenseKey) {
    if (!confirm('Are you sure you want to delete this license? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/admin/licenses/${licenseKey}`, {
            method: 'DELETE',
            headers: {
                'X-Admin-Secret': getAdminSecret()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete license');
        }
        
        await loadDashboard();
        showAlert('License deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting license:', error);
        showAlert('Error deleting license', 'danger');
    } finally {
        showLoading(false);
    }
}

// Export data
async function exportData() {
    try {
        const response = await fetch('/api/admin/export', {
            headers: {
                'X-Admin-Secret': getAdminSecret()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to export data');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `licenses-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showAlert('Data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showAlert('Error exporting data', 'danger');
    }
}

// Refresh data
async function refreshData() {
    await loadDashboard();
    showAlert('Data refreshed', 'info');
}

// Filter licenses
function filterLicenses() {
    renderLicensesTable();
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = show ? 'block' : 'none';
}

// Show alert message
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.dashboard-container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Get admin secret (in production, this should be more secure)
function getAdminSecret() {
    // For demo purposes - in production, use proper authentication
    return localStorage.getItem('adminSecret') || prompt('Enter admin secret:');
}

// Save admin secret
if (!localStorage.getItem('adminSecret')) {
    const secret = prompt('Enter admin secret:');
    if (secret) {
        localStorage.setItem('adminSecret', secret);
    }
}
