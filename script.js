// --- State Management ---
let allCards = [];
const cardsPerPage = 10;
let unions = JSON.parse(localStorage.getItem('unions') || '[]');

// --- UI Elements ---
const modeToggle = document.getElementById('modeToggle');
const singleMode = document.getElementById('singleMode');
const batchMode = document.getElementById('batchMode');
const unionList = document.getElementById('unionList');
const singleForm = document.getElementById('singleForm');
const pdfViewer = document.getElementById('pdfViewer');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const pdfDownloadContainer = document.getElementById('pdfDownloadContainer');

// --- State Management ---
let currentPdfBlob = null;

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
    }
    pdfViewer.style.display = 'none';
});

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
document.getElementById('downloadTemplate').addEventListener('click', function () {
    const headers = ['HH ID', 'Name', 'Gender', 'Mobile', 'Union'];
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'id_card_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
});

document.getElementById('csvFile').addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;

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
});

async function generateIdCards(rows) {
    const headers = rows[0].split(',').map(header => header.trim());
    allCards = [];

    for (let i = 1; i < rows.length; i++) {
        const progress = (i / (rows.length - 1)) * 100;
        updateProgress(progress, `Processing card ${i}...`);

        const values = rows[i].split(',').map(value => value.trim());
        if (values.length === headers.length) {
            const data = {};
            headers.forEach((header, index) => {
                const key = header.toLowerCase().replace(' ', '_');
                data[key] = values[index];
            });

            const tempDiv = document.createElement('div');
            new QRCode(tempDiv, {
                text: data.hh_id,
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

            const texts = [
                `Name: ${data.name || ''}`,
                `HH ID: ${data.hh_id || ''}`,
                `Gender: ${data.gender || ''}`,
                `Mobile: ${data.mobile || ''}`,
                `Union: ${data.union || ''}`
            ];

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
            const tempDiv = document.createElement('div');
            new QRCode(tempDiv, {
                text: data.hh_id,
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
        const startHHID = pageCards[0].data.hh_id || 'N/A';
        const endHHID = pageCards[pageCards.length - 1].data.hh_id || 'N/A';
        const headerText = `Page ${pageNum + 1} of ${pageCount} | HH ID Range: ${startHHID} - ${endHHID}`;

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
