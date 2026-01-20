// --- State Management ---
let allCards = [];
const cardsPerPage = 10;
let unions = JSON.parse(localStorage.getItem('unions') || '[]');
let qrTemplates = JSON.parse(localStorage.getItem('qr_templates') || '[]');

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

const templateGallery = document.getElementById('templateGallery');
const templateList = document.getElementById('templateList');
const editCustomTemplateBtn = document.getElementById('editCustomTemplate');
const customTemplateEditor = document.getElementById('customTemplateEditor');
const customTemplateForm = document.getElementById('customTemplateForm');
const cancelTemplateEditBtn = document.getElementById('cancelTemplateEdit');

// --- State Management ---
let currentPdfBlob = null;
let activeTemplate = DEFAULT_TEMPLATE;

// --- Initialization ---
function init() {
    updateUnionDatalist();
    renderTemplateGallery();
}
init();

function renderTemplateGallery() {
    // Keep default template
    templateList.innerHTML = `
        <div class="template-item default">
          <span class="template-name">QR Template - Default</span>
          <div class="template-actions">
            <button onclick="downloadDefaultTemplate()" title="Download">⬇️</button>
          </div>
        </div>
    `;

    qrTemplates.forEach((template, index) => {
        const item = document.createElement('div');
        item.className = 'template-item';
        item.innerHTML = `
            <span class="template-name" title="${template.name}">${template.name}</span>
            <div class="template-actions">
                <button onclick="downloadCustomTemplateById('${template.id}')" title="Download">⬇️</button>
                <button onclick="editTemplate('${template.id}')" title="Edit">✏️</button>
                <button onclick="deleteTemplate('${template.id}')" title="Delete">🗑️</button>
            </div>
        `;
        templateList.appendChild(item);
    });
}

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
        templateGallery.style.display = 'block';
    } else {
        batchMode.classList.remove('active');
        singleMode.classList.add('active');
        templateGallery.style.display = 'none';
        customTemplateEditor.style.display = 'none';
    }
    pdfViewer.style.display = 'none';
});

// --- Template Editor Logic ---
editCustomTemplateBtn.addEventListener('click', () => {
    customTemplateEditor.style.display = 'block';
    editCustomTemplateBtn.style.display = 'none';
});

cancelTemplateEditBtn.addEventListener('click', () => {
    customTemplateEditor.style.display = 'none';
    editCustomTemplateBtn.style.display = 'block';
});

// Custom Template Form Submission
customTemplateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(customTemplateForm);
    const columns = [
        formData.get('col1'),
        formData.get('col2'),
        formData.get('col3'),
        formData.get('col4'),
        formData.get('col5')
    ].filter(c => c && c.trim() !== '');

    const pkKey = formData.get('primaryKey'); // col1, col2, etc.
    const pkIndex = parseInt(pkKey.replace('col', '')) - 1;
    const pkName = columns[pkIndex];

    const random6 = Math.floor(100000 + Math.random() * 900000).toString();
    const templateName = `QR Template_${pkName}_${random6}`;

    const newTemplate = {
        id: Date.now().toString(),
        name: templateName,
        columns: columns,
        primaryKey: pkName
    };

    qrTemplates.push(newTemplate);
    localStorage.setItem('qr_templates', JSON.stringify(qrTemplates));
    renderTemplateGallery();
    downloadCSV(newTemplate);

    customTemplateEditor.style.display = 'none';
    editCustomTemplateBtn.style.display = 'block';
});

function downloadCSV(template) {
    const csvContent = template.columns.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function downloadDefaultTemplate() {
    downloadCSV(DEFAULT_TEMPLATE);
}

function downloadCustomTemplateById(id) {
    const template = qrTemplates.find(t => t.id === id);
    if (template) downloadCSV(template);
}

function deleteTemplate(id) {
    qrTemplates = qrTemplates.filter(t => t.id !== id);
    localStorage.setItem('qr_templates', JSON.stringify(qrTemplates));
    renderTemplateGallery();
}

function editTemplate(id) {
    const template = qrTemplates.find(t => t.id === id);
    if (template) {
        customTemplateEditor.style.display = 'block';
        editCustomTemplateBtn.style.display = 'none';
        // Fill form with template data
        template.columns.forEach((col, i) => {
            const input = customTemplateForm.querySelector(`input[name="col${i + 1}"]`);
            if (input) input.value = col;
            if (col === template.primaryKey) {
                const radio = customTemplateForm.querySelector(`input[name="primaryKey"][value="col${i + 1}"]`);
                if (radio) radio.checked = true;
            }
        });
        // We will remove the old one on save or just update it? 
        // For simplicity, let's just create a new one as requested "reuse again and again".
    }
}

function viewTemplate(id) {
    const template = qrTemplates.find(t => t.id === id);
    if (template) {
        alert(`Template: ${template.name}\nColumns: ${template.columns.join(', ')}\nPrimary Key: ${template.primaryKey}`);
    }
}

// --- Validation and Formatting ---
const formatters = {
    hh_id: (val) => val.toUpperCase().replace(/[^A-Z0-9]/g, '').trim(),
    name: (val) => val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ').trim(),
    mobile: (val) => {
        const cleaned = val.replace(/\s+/g, '').replace(/[^0-9]/g, '');
        return cleaned;
    },
    union: (val) => val.charAt(0).toUpperCase() + val.slice(1).trim()
};

function validateMobile(val) {
    const validPrefixes = ['013', '014', '015', '016', '017', '018', '019'];
    const cleaned = val.replace(/\s+/g, '').replace(/[^0-9]/g, '');
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
    const data = {
        hh_id: formData.get('hh_id') || document.getElementById('hh_id').value,
        name: formData.get('name') || document.getElementById('name').value,
        gender: formData.get('gender') || document.getElementById('gender').value,
        mobile: formData.get('mobile') || document.getElementById('mobile').value,
        union: formData.get('union') || document.getElementById('union').value
    };

    if (!validateMobile(data.mobile)) {
        alert('Please enter a valid 11-digit mobile number starting with 013-019.');
        return;
    }

    saveUnion(data.union);

    // Create preview data
    const tempDiv = document.createElement('div');
    new QRCode(tempDiv, {
        text: data.hh_id,
        width: 100,
        height: 100,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    allCards = [{
        data: data,
        qrCode: tempDiv.innerHTML
    }];

    await generatePDF();
});

// Batch Mode
document.getElementById('downloadTemplate').addEventListener('click', downloadDefaultTemplate);

document.getElementById('csvFile').addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;

    // Identify Template from Filename (matching 6 random digits)
    const fileName = file.name;
    const match = fileName.match(/\d{6}/);
    const randomId = match ? match[0] : null;

    activeTemplate = null;

    if (randomId) {
        activeTemplate = qrTemplates.find(t => t.name.includes(randomId));
    }

    if (!activeTemplate && fileName.toLowerCase().includes('default')) {
        activeTemplate = DEFAULT_TEMPLATE;
    }

    if (activeTemplate) {
        processUploadedFile(file);
    } else {
        // No match found - show Manual Mapping UI
        showManualMappingUI(file);
    }
});

function processUploadedFile(file) {
    updateProgress(0);
    const reader = new FileReader();
    reader.onload = async function (e) {
        const csvData = e.target.result;
        const rows = csvData.split('\n').filter(row => row.trim() !== "");
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

function showManualMappingUI(file) {
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = function (e) {
        const headers = e.target.result.split('\n')[0].split(',').map(h => h.trim());
        manualHeaderList.innerHTML = `
            <div class="template-row header">
                <span>Seq</span>
                <span>CSV Column</span>
                <span>P.Key</span>
            </div>
        `;

        headers.slice(0, 5).forEach((header, i) => {
            const row = document.createElement('div');
            row.className = 'template-row';
            row.innerHTML = `
                <span>${i + 1}</span>
                <input type="text" name="col${i + 1}" value="${header}" readonly>
                <input type="radio" name="primaryKey" value="col${i + 1}" ${i === 0 ? 'checked' : ''}>
            `;
            manualHeaderList.appendChild(row);
        });

        manualMappingContainer.style.display = 'block';
    };
    reader.readAsText(file);
}

manualMappingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(manualMappingForm);
    const columns = [];
    let pkName = '';

    for (let i = 1; i <= 5; i++) {
        const colVal = formData.get(`col${i}`);
        if (colVal) {
            columns.push(colVal);
            if (formData.get('primaryKey') === `col${i}`) {
                pkName = colVal;
            }
        }
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

            const tempDiv = document.createElement('div');
            new QRCode(tempDiv, {
                text: pkValue,
                width: 100,
                height: 100,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            allCards.push({
                data: data,
                qrCode: tempDiv.innerHTML
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

            // QR Code
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
