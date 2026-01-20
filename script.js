// --- State Management ---
let allCards = [];
const cardsPerPage = 10;
let unions = JSON.parse(localStorage.getItem('unions') || '[]');
let manualQueue = [];

// Default Template Configuration
const DEFAULT_TEMPLATE = {
    id: 'default',
    name: 'QR Template - Default',
    columns: ['HH ID', 'Name', 'Gender', 'Mobile', 'Union'],
    primaryKey: 'HH ID'
};

// --- UI Elements ---
const modeToggle = document.getElementById('modeToggle');
const singleMode = document.getElementById('singleMode');
const batchMode = document.getElementById('batchMode');
const unionList = document.getElementById('unionList');
const singleForm = document.getElementById('singleForm');
const pdfViewer = document.getElementById('pdfViewer');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const pdfDownloadContainer = document.getElementById('pdfDownloadContainer');
const manualQueueContainer = document.getElementById('manualQueueContainer');
const queueList = document.getElementById('queueList');
const queueCountSpan = document.getElementById('queueCount');
const generateManualPdfBtn = document.getElementById('generateManualPdf');

// --- State Management ---
let currentPdfBlob = null;
let activeTemplate = DEFAULT_TEMPLATE;

// --- Initialization ---
function init() {
    updateUnionDatalist();
}
init();

// PDF Download Button Listener
downloadPdfBtn.addEventListener('click', () => {
    if (currentPdfBlob) {
        const url = URL.createObjectURL(currentPdfBlob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `QR_ID_Cards_${timestamp}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});

// --- Mode Toggle Logic ---
modeToggle.addEventListener('change', () => {
    const isBatch = modeToggle.checked;
    if (isBatch) {
        singleMode.classList.remove('active');
        batchMode.classList.add('active');
    } else {
        batchMode.classList.remove('active');
        singleMode.classList.add('active');
        manualMappingContainer.style.display = 'none';
        activeTemplate = DEFAULT_TEMPLATE;
    }
    pdfViewer.style.display = 'none';
    pdfDownloadContainer.style.display = 'none';
});

// Batch Mode: Download Default Template
document.getElementById('downloadTemplate').addEventListener('click', () => {
    const csvContent = DEFAULT_TEMPLATE.columns.join(',') + '\\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${DEFAULT_TEMPLATE.name}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
});

// --- Validation and Formatting ---
const formatters = {
    hh_id: (val) => val.toUpperCase().replace(/[^A-Z0-9]/g, '').trim(),
    name: (val) => val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ').trim(),
    mobile: (val) => {
        const cleaned = val.replace(/\\s+/g, '').replace(/[^0-9]/g, '');
        return cleaned;
    },
    union: (val) => val.charAt(0).toUpperCase() + val.slice(1).trim()
};

function validateMobile(val) {
    const validPrefixes = ['013', '014', '015', '016', '017', '018', '019'];
    const cleaned = val.replace(/\\s+/g, '').replace(/[^0-9]/g, '');
    if (cleaned.length !== 11) return false;
    return validPrefixes.some(prefix => cleaned.startsWith(prefix));
}

// Attach Focus Out Handlers
['hh_id', 'name', 'mobile', 'union'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('blur', () => {
        if (input.value) {
            input.value = formatters[id](input.value);
            if (id === 'mobile') {
                if (!validateMobile(input.value)) {
                    input.style.borderColor = '#ef4444';
                } else {
                    input.style.borderColor = '';
                }
            }
        }
    });
});

// --- Union Autofill Logic ---
function updateUnionDatalist() {
    unionList.innerHTML = '';
    unions.sort().forEach(u => {
        const option = document.createElement('option');
        option.value = u;
        unionList.appendChild(option);
    });
}

function saveUnion(union) {
    if (union && !unions.includes(union)) {
        unions.push(union);
        localStorage.setItem('unions', JSON.stringify(unions));
        updateUnionDatalist();
    }
}

// --- Card Generation Logic ---

// Single Mode Submit
singleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(singleForm);
    const data = {};

    // Standardized fields from the form
    DEFAULT_TEMPLATE.columns.forEach(col => {
        data[col] = formData.get(col);
    });

    if (!validateMobile(data['Mobile'])) {
        alert('Please enter a valid 11-digit mobile number starting with 013-019.');
        return;
    }

    saveUnion(data['Union']);
    manualQueue.push(data);

    singleForm.reset();
    renderManualQueue();

    // Smooth scroll to queue if it's the first item
    if (manualQueue.length === 1) {
        manualQueueContainer.scrollIntoView({ behavior: 'smooth' });
    }
});

function renderManualQueue() {
    if (manualQueue.length === 0) {
        manualQueueContainer.style.display = 'none';
        return;
    }

    manualQueueContainer.style.display = 'block';
    queueCountSpan.textContent = manualQueue.length;
    queueList.innerHTML = '';

    manualQueue.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item['HH ID']}</td>
            <td>${item['Name']}</td>
            <td>${item['Union']}</td>
            <td><button class="remove-btn" onclick="removeFromQueue(${index})">Remove</button></td>
        `;
        queueList.appendChild(tr);
    });
}

window.removeFromQueue = (index) => {
    manualQueue.splice(index, 1);
    renderManualQueue();
};

generateManualPdfBtn.addEventListener('click', async () => {
    if (manualQueue.length === 0) return;

    updateProgress(0, 'Preparing cards...');
    activeTemplate = DEFAULT_TEMPLATE;
    allCards = [];

    for (let i = 0; i < manualQueue.length; i++) {
        const data = manualQueue[i];
        const pkValue = data[activeTemplate.primaryKey];

        // Store data without pre-generating QR (will generate fresh in PDF)
        allCards.push({
            data: data
        });

        const progress = ((i + 1) / manualQueue.length) * 50;
        updateProgress(progress, `Processing card ${i + 1}...`);
    }

    await generatePDF();
});

// Batch Mode: CSV Upload with Auto-Match
document.getElementById('csvFile').addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const csvData = e.target.result;
        const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== "");
        const headers = rows[0].split(',').map(h => h.trim());

        // Check if headers match DEFAULT_TEMPLATE exactly (in sequence)
        const headersMatch = headers.length === DEFAULT_TEMPLATE.columns.length &&
            headers.every((h, i) => h === DEFAULT_TEMPLATE.columns[i]);

        if (headersMatch) {
            // Auto-match: proceed with default generation
            activeTemplate = DEFAULT_TEMPLATE;
            processUploadedFile(file);
        } else {
            // No match: show manual header mapping
            showManualMappingUI(file, headers);
        }
    };
    reader.readAsText(file);
});

function processUploadedFile(file) {
    updateProgress(0);
    const reader = new FileReader();
    reader.onload = async function (e) {
        const csvData = e.target.result;
        const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== "");
        allCards = [];
        await generateIdCards(rows);
        await generatePDF();
    };
    reader.readAsText(file);
}

const manualMappingContainer = document.getElementById('manualMappingContainer');
const manualHeaderList = document.getElementById('manualHeaderList');
const manualMappingForm = document.getElementById('manualMappingForm');
const cancelManualMappingBtn = document.getElementById('cancelManualMapping');
let pendingFile = null;

function showManualMappingUI(file, headers) {
    pendingFile = file;
    manualHeaderList.innerHTML = `
        <div class="template-row header">
            <span>Seq</span>
            <span>CSV Column</span>
            <span>P.Key</span>
        </div>
    `;

    // Maximum 5 slots for mapping
    const maxSlots = 5;

    // Create options for dropdown if needed
    let dropdownOptions = '<option value="">Select Header...</option>';
    if (headers.length > 5) {
        headers.forEach(h => {
            // Simple escaping for interaction safety
            dropdownOptions += `<option value="${h.replace(/"/g, '&quot;')}">${h}</option>`;
        });
    }

    // Determine how many rows to show: 
    // If <= 5 headers, show exactly that many rows (auto-mapped).
    // If > 5 headers, show 5 rows (for manual mapping).
    const rowCount = headers.length <= 5 ? headers.length : 5;

    for (let i = 0; i < rowCount; i++) {
        const row = document.createElement('div');
        row.className = 'template-row';

        let inputHtml = '';
        if (headers.length <= 5) {
            // Auto-select sequentially (Readonly)
            inputHtml = `<input type="text" name="col${i + 1}" value="${headers[i]}" readonly>`;
        } else {
            // Manual selection (Dropdown)
            inputHtml = `<select name="col${i + 1}">${dropdownOptions}</select>`;
        }

        row.innerHTML = `
            <span>${i + 1}</span>
            ${inputHtml}
            <input type="radio" name="primaryKey" value="col${i + 1}" ${i === 0 ? 'checked' : ''}>
        `;
        manualHeaderList.appendChild(row);
    }

    manualMappingContainer.style.display = 'block';
}

manualMappingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(manualMappingForm);
    const columns = [];
    let pkName = '';

    // Validation
    const selectedValues = new Set();
    let hasDuplicate = false;

    for (let i = 1; i <= 5; i++) {
        const colVal = formData.get(`col${i}`);
        if (colVal && colVal.trim() !== '') {
            if (selectedValues.has(colVal)) {
                hasDuplicate = true;
            }
            selectedValues.add(colVal);

            columns.push(colVal);
            if (formData.get('primaryKey') === `col${i}`) {
                pkName = colVal;
            }
        }
    }

    if (columns.length === 0) {
        alert("Please select at least one header to map.");
        return;
    }

    if (hasDuplicate) {
        alert("Duplicate headers selected. Please select distinct headers for each column.");
        return;
    }

    if (!pkName) {
        alert("Invalid Primary Key. Please ensure the selected Primary Key row has a mapped header.");
        return;
    }

    activeTemplate = {
        id: 'manual',
        name: 'Manual Mapping',
        columns: columns,
        primaryKey: pkName
    };

    manualMappingContainer.style.display = 'none';
    if (pendingFile) processUploadedFile(pendingFile);
});

cancelManualMappingBtn.addEventListener('click', () => {
    manualMappingContainer.style.display = 'none';
    pendingFile = null;
});

async function generateIdCards(rows) {
    const headers = rows[0].split(',').map(header => header.trim());
    allCards = [];

    // Find index of Primary Key
    const pkIndex = headers.indexOf(activeTemplate.primaryKey);
    if (pkIndex === -1) {
        alert(`Error: Primary Key "${activeTemplate.primaryKey}" not found in CSV headers.`);
        return;
    }

    for (let i = 1; i < rows.length; i++) {
        const progress = (i / (rows.length - 1)) * 100;
        updateProgress(progress, `Processing card ${i}...`);

        const values = rows[i].split(',').map(value => value.trim());
        if (values.length === headers.length) {
            const data = {};
            headers.forEach((header, index) => {
                const key = header; // Use exact name to match PK
                data[key] = values[index];
            });

            const pkValue = data[activeTemplate.primaryKey];

            // Store data without pre-generating QR (will generate fresh in PDF)
            allCards.push({
                data: data
            });

            if (data.union) saveUnion(data.union);
        }
    }
}

// --- Progress and PDF Generation ---
function updateProgress(percent, text) {
    const progressContainer = document.querySelector('.progress-container');
    const progress = document.querySelector('.progress');
    const progressText = document.querySelector('#progressText');

    progressContainer.style.display = 'block';
    progress.style.width = `${percent}%`;
    if (text) progressText.textContent = text;

    if (percent >= 100) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1200);
    }
}

async function generatePDF() {
    updateProgress(0, 'Preparing PDF...');
    const { PDFDocument, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const pageCount = Math.ceil(allCards.length / cardsPerPage);

    pdfViewer.style.display = 'block';

    for (let pageNum = 0; pageNum < pageCount; pageNum++) {
        const page = pdfDoc.addPage([595, 842]);
        const { width, height } = page.getSize();

        const startIdx = pageNum * cardsPerPage;
        const endIdx = Math.min(startIdx + cardsPerPage, allCards.length);
        const pageCards = allCards.slice(startIdx, endIdx);

        const cardWidth = (width - 40) / 2;
        const cardHeight = (height - 60) / 5;

        for (let i = 0; i < pageCards.length; i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const x = 20 + (col * cardWidth);
            const y = height - 30 - ((row + 1) * cardHeight);

            const card = pageCards[i];
            const { data } = card;

            // Border
            page.drawRectangle({
                x: x, y: y,
                width: cardWidth - 10,
                height: cardHeight - 10,
                borderWidth: 1,
                borderColor: rgb(0, 0, 0),
                borderDashArray: [2, 2]
            });

            const fontSize = 11;
            const lineHeight = 15;
            const textStartX = x + 10;
            const textWidth = cardWidth * 0.55 - 10;

            const texts = activeTemplate.columns.map(col => {
                return `${col}: ${data[col] || ''}`;
            });

            let totalLines = 0;
            texts.forEach(t => {
                totalLines += Math.ceil((t.length * (fontSize * 0.5)) / textWidth);
            });

            const cardCenterY = y + (cardHeight / 2);
            const totalTextHeight = totalLines * lineHeight;
            let currentY = cardCenterY + (totalTextHeight / 2) - lineHeight;

            const addWrappedText = (text, startY) => {
                const words = text.split(' ');
                let line = '';
                let resultY = startY;

                words.forEach(word => {
                    const testLine = line + (line ? ' ' : '') + word;
                    if (testLine.length * (fontSize * 0.55) < textWidth) {
                        line = testLine;
                    } else {
                        page.drawText(line, { x: textStartX, y: resultY, size: fontSize });
                        resultY -= lineHeight;
                        line = word;
                    }
                });
                if (line) {
                    page.drawText(line, { x: textStartX, y: resultY, size: fontSize });
                    resultY -= lineHeight;
                }
                return resultY;
            };

            texts.forEach(text => {
                currentY = addWrappedText(text, currentY);
            });

            // QR Code - Generate fresh (canvas is available immediately)
            const pkValue = data[activeTemplate.primaryKey] || 'N/A';
            const tempDiv = document.createElement('div');
            new QRCode(tempDiv, {
                text: pkValue,
                width: 100,
                height: 100,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            const qrCanvas = tempDiv.querySelector('canvas');
            if (!qrCanvas) {
                console.error("QR Code canvas not found");
                continue;
            }

            const qrDataUrl = qrCanvas.toDataURL('image/png');
            const qrImageBytes = await fetch(qrDataUrl).then(res => res.arrayBuffer());
            const qrImage = await pdfDoc.embedPng(qrImageBytes);

            const qrCodeSize = 85;
            const qrCodeY = y + ((cardHeight - 10 - qrCodeSize) / 2);
            page.drawImage(qrImage, {
                x: x + cardWidth - qrCodeSize - 15,
                y: qrCodeY,
                width: qrCodeSize,
                height: qrCodeSize
            });

            const progress = ((pageNum * cardsPerPage + i + 1) / allCards.length) * 100;
            updateProgress(progress, `Generating PDF... ${Math.round(progress)}%`);
        }

        // Header
        const startPK = pageCards[0].data[activeTemplate.primaryKey] || 'N/A';
        const endPK = pageCards[pageCards.length - 1].data[activeTemplate.primaryKey] || 'N/A';
        const pkLabel = activeTemplate.primaryKey;
        const headerText = `Page ${pageNum + 1} of ${pageCount} | ${pkLabel} Range: ${startPK} - ${endPK}`;

        page.drawText(headerText, {
            x: (width - (headerText.length * 5.5)) / 2,
            y: height - 20,
            size: 10
        });
    }

    const pdfBytes = await pdfDoc.save();
    currentPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const dataUrl = URL.createObjectURL(currentPdfBlob);

    pdfViewer.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = dataUrl;
    pdfViewer.appendChild(iframe);

    // Show download button
    pdfDownloadContainer.style.display = 'block';
}
