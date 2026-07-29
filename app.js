const STORAGE_KEY = 'hw_submissions';

function getSubmissions() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveSubmissions(subs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
}

function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        + ' at ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function showAlert(msg, type) {
    const box = document.getElementById('alert-box');
    if (!box) return;
    box.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
    setTimeout(() => box.innerHTML = '', 4000);
}

function encodeFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== INDEX PAGE (Form) =====
const form = document.getElementById('hw-form');
if (form) {
    const fileInput = document.getElementById('file');
    const fileDrop = document.getElementById('file-drop');
    const fileName = document.getElementById('file-name');

    fileDrop.addEventListener('click', () => fileInput.click());
    fileDrop.addEventListener('dragover', e => { e.preventDefault(); fileDrop.classList.add('dragover'); });
    fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
    fileDrop.addEventListener('drop', e => {
        e.preventDefault();
        fileDrop.classList.remove('dragover');
        fileInput.files = e.dataTransfer.files;
        showFileName();
    });
    fileInput.addEventListener('change', showFileName);

    function showFileName() {
        if (fileInput.files.length > 0) {
            const f = fileInput.files[0];
            if (f.size > 5 * 1024 * 1024) {
                showAlert('File too large. Max 5MB.', 'error');
                fileInput.value = '';
                return;
            }
            fileName.textContent = f.name + ' (' + (f.size / 1024).toFixed(1) + ' KB)';
            fileName.style.display = 'block';
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const name = document.getElementById('name').value.trim();
        const subject = document.getElementById('subject').value;
        const notes = document.getElementById('notes').value.trim();
        const file = fileInput.files[0];

        if (!name || !subject) { showAlert('Name and subject are required.', 'error'); return; }

        btn.disabled = true;
        btn.textContent = 'Saving...';

        let fileData = null;
        if (file) {
            try { fileData = await encodeFile(file); }
            catch { showAlert('Failed to read file.', 'error'); btn.disabled = false; btn.textContent = 'Submit Homework'; return; }
        }

        const submission = {
            id: Date.now(),
            name,
            subject,
            notes,
            fileName: file ? file.name : null,
            fileType: file ? file.type : null,
            fileData,
            timestamp: new Date().toISOString()
        };

        const subs = getSubmissions();
        subs.push(submission);
        saveSubmissions(subs);

        showAlert('Homework submitted!', 'success');
        form.reset();
        fileName.style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Submit Homework';
    });
}

// ===== SUBMISSIONS PAGE =====
const subList = document.getElementById('submissions-list');
if (subList) {
    renderSubmissions();

    const clearBtn = document.getElementById('clear-all');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Delete ALL submissions? This cannot be undone.')) {
                localStorage.removeItem(STORAGE_KEY);
                renderSubmissions();
            }
        });
    }
}

function renderSubmissions() {
    const subs = getSubmissions().reverse();
    const countEl = document.getElementById('sub-count');
    const subjectCountEl = document.getElementById('subject-count');
    if (countEl) countEl.textContent = subs.length;
    if (subjectCountEl) subjectCountEl.textContent = new Set(subs.map(s => s.subject)).size;

    if (subs.length === 0) {
        subList.innerHTML = '<div class="empty"><h3>No submissions yet</h3><p>Go submit your first homework!</p></div>';
        return;
    }

    subList.innerHTML = subs.map(s => `
        <div class="sub-card">
            <div class="sub-info">
                <div class="sub-name">${esc(s.name)}</div>
                <span class="sub-badge">${esc(s.subject)}</span>
                <div class="sub-meta">${formatDate(s.timestamp)}</div>
                ${s.notes ? `<div class="sub-notes">"${esc(s.notes)}"</div>` : ''}
            </div>
            <div class="sub-actions">
                ${s.fileName ? `<button class="btn btn-sm btn-outline" onclick="downloadFile(${s.id})">Download</button>` : ''}
                <button class="btn btn-sm btn-wsp" onclick="sendWsp(${s.id})">WhatsApp</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSub(${s.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function downloadFile(id) {
    const s = getSubmissions().find(x => x.id === id);
    if (!s || !s.fileData) return;
    const a = document.createElement('a');
    a.href = s.fileData;
    a.download = s.fileName;
    a.click();
}

function sendWsp(id) {
    const s = getSubmissions().find(x => x.id === id);
    if (!s) return;
    const text = `📚 Homework Submission\n👤 ${s.name}\n📖 ${s.subject}\n📝 ${s.notes || 'No notes'}\n📅 ${formatDate(s.timestamp)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function deleteSub(id) {
    if (!confirm('Delete this submission?')) return;
    const subs = getSubmissions().filter(x => x.id !== id);
    saveSubmissions(subs);
    renderSubmissions();
}
