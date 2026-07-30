// Init Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const COL = 'submissions';

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

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
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
    const notesInput = document.getElementById('notes');
    const notesCount = document.getElementById('notes-count');

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
    if (notesInput && notesCount) {
        notesInput.maxLength = 200;
        notesInput.addEventListener('input', () => {
            notesCount.textContent = notesInput.value.length;
        });
    }

    function showFileName() {
        if (fileInput.files.length > 0) {
            const f = fileInput.files[0];
            if (f.size > 5 * 1024 * 1024) {
                showAlert('File too large. Max 5MB.', 'error');
                fileInput.value = '';
                fileDrop.classList.remove('has-file');
                return;
            }
            fileName.textContent = f.name + ' (' + (f.size / 1024).toFixed(1) + ' KB)';
            fileName.style.display = 'block';
            fileDrop.classList.add('has-file');
        } else {
            fileDrop.classList.remove('has-file');
            fileName.style.display = 'none';
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
        let fileNameVal = null;
        let fileType = null;
        if (file) {
            try {
                fileData = await encodeFile(file);
                fileNameVal = file.name;
                fileType = file.type;
            } catch {
                showAlert('Failed to read file.', 'error');
                btn.disabled = false;
                btn.textContent = 'Submit Homework';
                return;
            }
        }

        try {
            await db.collection(COL).add({
                name,
                subject,
                notes,
                fileName: fileNameVal,
                fileType,
                fileData,
                timestamp: new Date().toISOString()
            });

            showAlert('Homework submitted!', 'success');
            form.reset();
            fileName.style.display = 'none';
            fileDrop.classList.remove('has-file');
            if (notesCount) notesCount.textContent = '0';
        } catch (err) {
            showAlert('Error saving: ' + err.message, 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Submit Homework';
    });
}

// ===== SUBMISSIONS PAGE =====
const subList = document.getElementById('submissions-list');
let allSubmissions = [];
if (subList) {
    renderSubmissions();
    const searchInput = document.getElementById('search-submissions');
    const subjectFilter = document.getElementById('subject-filter');
    if (searchInput) searchInput.addEventListener('input', renderFilteredSubmissions);
    if (subjectFilter) subjectFilter.addEventListener('change', renderFilteredSubmissions);

    const clearBtn = document.getElementById('clear-all');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (!confirm('Delete ALL submissions? This cannot be undone.')) return;
            const snap = await db.collection(COL).get();
            const batch = db.batch();
            snap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            allSubmissions = [];
            renderSubmissions();
        });
    }
}

async function renderSubmissions() {
    subList.innerHTML = '<div class="empty">Loading...</div>';

    try {
        const snap = await db.collection(COL).orderBy('timestamp', 'desc').get();
        const subs = [];
        snap.forEach(doc => subs.push({ id: doc.id, ...doc.data() }));
        allSubmissions = subs;

        const countEl = document.getElementById('sub-count');
        const subjectCountEl = document.getElementById('subject-count');
        if (countEl) countEl.textContent = subs.length;
        if (subjectCountEl) subjectCountEl.textContent = new Set(subs.map(s => s.subject)).size;
        fillSubjectFilter(subs);
        renderFilteredSubmissions();
    } catch (err) {
        subList.innerHTML = `<div class="empty"><h3>Error loading</h3><p>${esc(err.message)}</p></div>`;
    }
}

function fillSubjectFilter(subs) {
    const subjectFilter = document.getElementById('subject-filter');
    if (!subjectFilter) return;
    const selected = subjectFilter.value;
    const subjects = Array.from(new Set(subs.map(s => s.subject).filter(Boolean))).sort();
    subjectFilter.innerHTML = '<option value="">All subjects</option>' + subjects.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if (subjects.includes(selected)) subjectFilter.value = selected;
}

function renderFilteredSubmissions() {
    if (!subList) return;
    const searchInput = document.getElementById('search-submissions');
    const subjectFilter = document.getElementById('subject-filter');
    const query = (searchInput?.value || '').trim().toLowerCase();
    const subject = subjectFilter?.value || '';
    const filtered = allSubmissions.filter(s => {
        const byName = !query || (s.name || '').toLowerCase().includes(query);
        const bySubject = !subject || s.subject === subject;
        return byName && bySubject;
    });

    if (allSubmissions.length === 0) {
        subList.innerHTML = '<div class="empty"><h3>No submissions yet</h3><p>Be the first to submit!</p></div>';
        return;
    }

    if (filtered.length === 0) {
        subList.innerHTML = '<div class="empty"><h3>No matching submissions</h3><p>Try another name or subject.</p></div>';
        return;
    }

    subList.innerHTML = filtered.map(s => `
        <div class="sub-card">
            <div class="sub-info">
                <div class="sub-name">${esc(s.name)}</div>
                <span class="sub-badge">${esc(s.subject)}</span>
                <div class="sub-meta">${formatDate(s.timestamp)}</div>
                ${s.notes ? `<div class="sub-notes">"${esc(s.notes)}"</div>` : ''}
            </div>
            <div class="sub-actions">
                ${s.fileName ? `<button class="btn btn-sm btn-outline" onclick="downloadFile('${s.id}')">Download</button>` : ''}
                <button class="btn btn-sm btn-wsp" onclick="sendWsp('${s.id}')">WhatsApp</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSub('${s.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function downloadFile(id) {
    try {
        const doc = await db.collection(COL).doc(id).get();
        const s = doc.data();
        if (!s || !s.fileData) return;
        const a = document.createElement('a');
        a.href = s.fileData;
        a.download = s.fileName;
        a.click();
    } catch (err) {
        alert('Download failed: ' + err.message);
    }
}

async function sendWsp(id) {
    try {
        const doc = await db.collection(COL).doc(id).get();
        const s = doc.data();
        if (!s) return;
        const text = `📚 Homework Submission\n👤 ${s.name}\n📖 ${s.subject}\n📝 ${s.notes || 'No notes'}\n📅 ${formatDate(s.timestamp)}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } catch (err) {
        alert('Failed: ' + err.message);
    }
}

async function deleteSub(id) {
    if (!confirm('Delete this submission?')) return;
    try {
        await db.collection(COL).doc(id).delete();
        allSubmissions = allSubmissions.filter(s => s.id !== id);
        renderSubmissions();
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
}
