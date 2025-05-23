// Global variables
let fileQueue = [];
let currentFileIndex = 0;
let currentMode = '';

// File upload handling
const uploadZone = document.querySelector('.upload-zone');
const fileInput = document.getElementById('fileInput');

// Drag and drop functionality
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.name.toLowerCase().endsWith('.vcf')
    );
    
    if (files.length > 0) {
        handleMultipleFiles(files);
    } else {
        showStatus('error', 'Mohon upload file dengan format .vcf');
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        handleMultipleFiles(files);
    }
});

// Handle multiple file uploads
function handleMultipleFiles(files) {
    fileQueue = files.map((file, index) => ({
        id: Date.now() + index,
        file: file,
        name: file.name,
        status: 'pending',
        contacts: [],
        vcfContent: ''
    }));
    
    displayFileQueue();
    showStatus('success', `${files.length} file(s) ditambahkan ke antrian`);
    
    // Load first file
    if (fileQueue.length > 0) {
        loadFile(0);
    }
}

// Display file queue
function displayFileQueue() {
    const queueSection = document.getElementById('fileQueue');
    const queueList = document.getElementById('queueList');
    
    if (fileQueue.length > 0) {
        queueSection.style.display = 'block';
        queueList.innerHTML = '';
        
        fileQueue.forEach((item, index) => {
            const queueItem = document.createElement('div');
            queueItem.className = `queue-item ${item.status}`;
            queueItem.innerHTML = `
                <div class="queue-info">
                    <div class="queue-name">${item.name}</div>
                    <div class="queue-status">${getStatusText(item.status)} ${item.contacts.length > 0 ? `(${item.contacts.length} kontak)` : ''}</div>
                </div>
                <div class="queue-actions">
                    ${index === currentFileIndex && item.status === 'loaded' ? '<span style="color: #ffd700;">● Aktif</span>' : ''}
                    <button class="btn btn-small btn-remove" onclick="removeFromQueue(${index})">Hapus</button>
                </div>
            `;
            queueList.appendChild(queueItem);
        });
        
        // Show process all button if multiple files
        document.getElementById('processAllBtn').style.display = 
            fileQueue.length > 1 ? 'inline-block' : 'none';
    } else {
        queueSection.style.display = 'none';
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Menunggu',
        'loading': 'Memuat...',
        'loaded': 'Siap',
        'processing': 'Memproses...',
        'completed': 'Selesai',
        'error': 'Error'
    };
    return statusMap[status] || status;
}

// Remove file from queue
function removeFromQueue(index) {
    fileQueue.splice(index, 1);
    
    if (currentFileIndex >= index && currentFileIndex > 0) {
        currentFileIndex--;
    }
    
    displayFileQueue();
    
    if (fileQueue.length === 0) {
        resetAll();
    } else if (index === currentFileIndex) {
        loadFile(currentFileIndex < fileQueue.length ? currentFileIndex : 0);
    }
}

// Load specific file
function loadFile(index) {
    if (fileQueue[index] && fileQueue[index].status === 'pending') {
        currentFileIndex = index;
        fileQueue[index].status = 'loading';
        displayFileQueue();
        
        const reader = new FileReader();
        reader.onload = function(e) {
            fileQueue[index].vcfContent = e.target.result;
            parseVcfFile(e.target.result, index);
        };
        reader.onerror = function() {
            fileQueue[index].status = 'error';
            displayFileQueue();
            showStatus('error', `Gagal membaca file ${fileQueue[index].name}`);
        };
        reader.readAsText(fileQueue[index].file);
    } else if (fileQueue[index] && fileQueue[index].status === 'loaded') {
        currentFileIndex = index;
        displayCurrentFileContacts();
        displayFileQueue();
    }
}

// Parse VCF file
function parseVcfFile(content, fileIndex) {
    try {
        const contacts = [];
        const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const vcardBlocks = normalizedContent.split(/(?=BEGIN:VCARD)/);
        
        for (const block of vcardBlocks) {
            if (!block.trim() || !block.includes('BEGIN:VCARD')) continue;
            
            const lines = block.split('\n').map(line => line.trim()).filter(line => line);
            
            let name = '';
            let phone = '';
            let version = '';
            let hasValidStructure = false;
            
            if (lines.some(line => line === 'BEGIN:VCARD') && 
                lines.some(line => line === 'END:VCARD')) {
                hasValidStructure = true;
            }
            
            if (!hasValidStructure) continue;
            
            for (const line of lines) {
                if (line.startsWith('VERSION:')) {
                    version = line.substring(8);
                } else if (line.startsWith('FN:')) {
                    name = line.substring(3);
                } else if (line.startsWith('TEL:') || line.includes('TEL;')) {
                    const telMatch = line.match(/TEL[^:]*:(.+)/);
                    if (telMatch) {
                        phone = telMatch[1];
                    }
                }
            }
            
            if (name || phone) {
                contacts.push({
                    name: name || 'Tanpa Nama',
                    phone: phone || 'Tanpa Nomor',
                    version: version || '3.0',
                    originalBlock: block.trim()
                });
            }
        }
        
        fileQueue[fileIndex].contacts = contacts;
        fileQueue[fileIndex].status = 'loaded';
        
        displayFileQueue();
        displayCurrentFileContacts();
        
        if (contacts.length > 0) {
            document.getElementById('modeSection').style.display = 'block';
            showStatus('success', `File ${fileQueue[fileIndex].name}: ${contacts.length} kontak berhasil dimuat`);
        } else {
            showStatus('error', `File ${fileQueue[fileIndex].name}: Tidak ada kontak yang ditemukan`);
        }
    } catch (error) {
        fileQueue[fileIndex].status = 'error';
        displayFileQueue();
        showStatus('error', `Gagal memproses file ${fileQueue[fileIndex].name}`);
        console.error('Parse error:', error);
    }
}

// Display current file contacts
function displayCurrentFileContacts() {
    if (fileQueue[currentFileIndex] && fileQueue[currentFileIndex].contacts.length > 0) {
        populateContactList(fileQueue[currentFileIndex].contacts);
    }
}

// Select processing mode
function selectMode(mode) {
    currentMode = mode;
    
    document.querySelectorAll('.mode-card').forEach(card => card.classList.remove('active'));
    event.target.closest('.mode-card').classList.add('active');
    
    document.querySelectorAll('.batch-section, .selective-section').forEach(section => {
        section.classList.remove('active');
    });
    
    if (mode === 'batch') {
        document.getElementById('batchSection').classList.add('active');
    } else {
        document.getElementById('selectiveSection').classList.add('active');
    }
}

// Populate contact list for selective mode
function populateContactList(contacts) {
    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';
    
    contacts.forEach((contact, index) => {
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';
        contactItem.innerHTML = `
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-phone">${contact.phone}</div>
            </div>
            <div class="contact-actions">
                <input type="checkbox" class="contact-checkbox" data-index="${index}" onchange="toggleContactInput(this)">
                <input type="text" class="contact-input" data-index="${index}" placeholder="Nama baru...">
            </div>
        `;
        contactList.appendChild(contactItem);
    });
}

// Toggle contact input field
function toggleContactInput(checkbox) {
    const input = checkbox.parentElement.querySelector('.contact-input');
    if (checkbox.checked) {
        input.classList.add('show');
        input.focus();
    } else {
        input.classList.remove('show');
        input.value = '';
    }
}

// Process current file
function processCurrentFile() {
    if (!currentMode) {
        showStatus('error', 'Mohon pilih mode penggantian terlebih dahulu');
        return;
    }
    
    if (!fileQueue[currentFileIndex] || fileQueue[currentFileIndex].contacts.length === 0) {
        showStatus('error', 'Tidak ada file yang dimuat');
        return;
    }
    
    processFile(currentFileIndex);
}

// Process all files in queue
function processAllFiles() {
    if (!currentMode) {
        showStatus('error', 'Mohon pilih mode penggantian terlebih dahulu');
        return;
    }
    
    const loadedFiles = fileQueue.filter(file => file.status === 'loaded');
    if (loadedFiles.length === 0) {
        showStatus('error', 'Tidak ada file yang siap diproses');
        return;
    }
    
    processAllFilesSequentially(0);
}

// Process files sequentially
async function processAllFilesSequentially(index) {
    if (index >= fileQueue.length) {
        showStatus('success', 'Semua file berhasil diproses!');
        return;
    }
    
    if (fileQueue[index].status === 'loaded') {
        await processFile(index);
        // Wait a bit before processing next file
        setTimeout(() => processAllFilesSequentially(index + 1), 1000);
    } else {
        processAllFilesSequentially(index + 1);
    }
}

// Process individual file
function processFile(fileIndex) {
    return new Promise((resolve) => {
        const fileItem = fileQueue[fileIndex];
        fileItem.status = 'processing';
        displayFileQueue();

        showProgress(0);

        setTimeout(() => {
            try {
                let processedVcf = '';
                const contacts = fileItem.contacts;

                if (currentMode === 'batch') {
                    // Batch processing
                    const baseName = document.getElementById('baseName').value.trim();
                    const startNumber = parseInt(document.getElementById('startNumber').value) || 1;
                    const digitCount = parseInt(document.getElementById('digitCount').value) || 3;
                    const outputFileName = document.getElementById('outputFileName').value.trim() || 'contacts_renamed';

                    if (!baseName) {
                        showStatus('error', 'Mohon masukkan nama dasar untuk kontak');
                        fileItem.status = 'error';
                        displayFileQueue();
                        resolve();
                        return;
                    }

                    contacts.forEach((contact, index) => {
                        const newNumber = (startNumber + index).toString().padStart(digitCount, '0');
                        const newName = `${baseName} ${newNumber}`;
                        
                        // Replace name in VCF block
                        let newBlock = contact.originalBlock;
                        newBlock = newBlock.replace(/FN:.*/g, `FN:${newName}`);
                        
                        processedVcf += newBlock + '\n';

                        // Update progress
                        const progress = ((index + 1) / contacts.length) * 100;
                        showProgress(progress);
                    });

                    // Download file
                    downloadVcf(processedVcf, `${outputFileName}.vcf`);

                } else if (currentMode === 'selective') {
                    // Selective processing
                    const outputFileName = document.getElementById('selectiveOutputFileName').value.trim() || 'contacts_selective';
                    const checkboxes = document.querySelectorAll('.contact-checkbox:checked');
                    
                    if (checkboxes.length === 0) {
                        showStatus('error', 'Mohon pilih minimal satu kontak untuk diubah');
                        fileItem.status = 'error';
                        displayFileQueue();
                        resolve();
                        return;
                    }

                    const selectedContacts = new Set();
                    const newNames = {};

                    checkboxes.forEach(checkbox => {
                        const index = parseInt(checkbox.dataset.index);
                        const newName = checkbox.parentElement.querySelector('.contact-input').value.trim();
                        
                        if (newName) {
                            selectedContacts.add(index);
                            newNames[index] = newName;
                        }
                    });

                    contacts.forEach((contact, index) => {
                        let newBlock = contact.originalBlock;
                        
                        if (selectedContacts.has(index)) {
                            newBlock = newBlock.replace(/FN:.*/g, `FN:${newNames[index]}`);
                        }
                        
                        processedVcf += newBlock + '\n';

                        // Update progress
                        const progress = ((index + 1) / contacts.length) * 100;
                        showProgress(progress);
                    });

                    // Download file
                    downloadVcf(processedVcf, `${outputFileName}.vcf`);
                }

                // Mark as completed
                fileItem.status = 'completed';
                displayFileQueue();
                showStatus('success', `File ${fileItem.name} berhasil diproses!`);
                hideProgress();

            } catch (error) {
                fileItem.status = 'error';
                displayFileQueue();
                showStatus('error', `Gagal memproses file ${fileItem.name}: ${error.message}`);
                hideProgress();
                console.error('Processing error:', error);
            }

            resolve();
        }, 1000);
    });
}

// Download VCF file
function downloadVcf(content, filename) {
    const blob = new Blob([content], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Show status message
function showStatus(type, message) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 5000);
}

// Show progress bar
function showProgress(percent) {
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    
    progressBar.style.display = 'block';
    progressFill.style.width = percent + '%';
}

// Hide progress bar
function hideProgress() {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.display = 'none';
}

// Reset all
function resetAll() {
    fileQueue = [];
    currentFileIndex = 0;
    currentMode = '';
    
    // Reset UI
    document.getElementById('fileQueue').style.display = 'none';
    document.getElementById('modeSection').style.display = 'none';
    document.getElementById('statusMessage').style.display = 'none';
    document.getElementById('progressBar').style.display = 'none';
    
    // Clear form inputs
    document.getElementById('baseName').value = '';
    document.getElementById('startNumber').value = '1';
    document.getElementById('digitCount').value = '3';
    document.getElementById('outputFileName').value = 'contacts_renamed';
    document.getElementById('selectiveOutputFileName').value = 'contacts_selective';
    
    // Clear file input
    document.getElementById('fileInput').value = '';
    
    // Reset mode selection
    document.querySelectorAll('.mode-card').forEach(card => card.classList.remove('active'));
    document.querySelectorAll('.batch-section, .selective-section').forEach(section => {
        section.classList.remove('active');
    });
    
    showStatus('success', 'Aplikasi berhasil direset');
}