// Template download functionality
document.getElementById('downloadTemplate').addEventListener('click', function() {
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

let allCards = [];
let currentPage = 0;
const cardsPerPage = 10;

function updateProgress(percent, text) {
    const progressContainer = document.querySelector('.progress-container');
    const progress = document.querySelector('.progress');
    const progressText = document.querySelector('#progressText');
    progressContainer.style.display = 'block';
    progress.style.width = `${percent}%`;
    if (text) {
        progressText.textContent = text;
    }
    if (percent >= 100) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1000);
    }
}

document.getElementById('csvFile').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    updateProgress(0);
    const reader = new FileReader();
    reader.onload = async function(e) {
        const csvData = e.target.result;
        const rows = csvData.split('\n').filter(row => row.trim() !== "");
        allCards = [];
        await generateIdCards(rows);
        await generatePDF();
    };
    reader.readAsText(file);
});

function generateQRCode(text) {
    const qr = new QRCode(document.createElement("div"), {
        text: text,
        width: 100,
        height: 100,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    return qr._oDrawing._elImage.outerHTML;
}

async function generateIdCards(rows) {
    const headers = rows[0].split(',').map(header => header.trim());
    allCards = [];

    for (let i = 1; i < rows.length; i++) {
        const progress = (i / (rows.length - 1)) * 100;
        updateProgress(progress);

        const values = rows[i].split(',').map(value => value.trim());
        if (values.length === headers.length) {
            const data = {};
            headers.forEach((header, index) => {
                data[header.toLowerCase().replace(' ', '_')] = values[index];
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
            const qrCodeSvg = tempDiv.innerHTML;
            allCards.push({
                data: data,
                qrCode: qrCodeSvg
            });
        }
    }
}

function updateNavigationButtons() {
    // Navigation buttons removed
}

async function generatePDF() {
    updateProgress(0);
    const { PDFDocument, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const pageCount = Math.ceil(allCards.length / cardsPerPage);
    document.querySelector('.progress-container').style.display = 'block';

    for (let pageNum = 0; pageNum < pageCount; pageNum++) {
        const page = pdfDoc.addPage([595, 842]); // A4 size in points
        const { width, height } = page.getSize();

        const startIdx = pageNum * cardsPerPage;
        const endIdx = Math.min(startIdx + cardsPerPage, allCards.length);
        const pageCards = allCards.slice(startIdx, endIdx);

        // Calculate card dimensions and margins
        const cardWidth = (width - 40) / 2;  // 2 columns, 20pt margins
        const cardHeight = (height - 60) / 5; // 5 rows, 30pt margins + footer

        for (let i = 0; i < pageCards.length; i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const x = 20 + (col * cardWidth);
            const y = height - 30 - ((row + 1) * cardHeight);

            const card = pageCards[i];
            const { data } = card;

            // Draw card border
            page.drawRectangle({
                x: x,
                y: y,
                width: cardWidth - 10,
                height: cardHeight - 10,
                borderWidth: 2,
                borderColor: rgb(0, 0, 0),
                borderDashArray: [4, 4]
            });

            // Add text content with word wrapping and vertical centering
            const fontSize = 12;
            const lineHeight = 16;
            const textStartX = x + 10; // 10px left padding
            const textWidth = cardWidth * 0.55 - 10; // 55% of card width minus padding

            // Calculate total text height to center vertically within the card
            const texts = [
                `Name: ${data.name}`,
                `HH ID: ${data.hh_id}`,
                `Gender: ${data.gender}`,
                `Mobile: ${data.mobile}`,
                `Union: ${data.union}`
            ];

            // Calculate total lines needed
            let totalLines = 0;
            texts.forEach(text => {
                const words = text.split(' ');
                let currentLine = '';
                words.forEach(word => {
                    const testLine = currentLine + (currentLine ? ' ' : '') + word;
                    if (testLine.length * (fontSize * 0.6) < textWidth) {
                        currentLine = testLine;
                    } else {
                        totalLines++;
                        currentLine = word;
                    }
                });
                if (currentLine) totalLines++;
            });

            // Calculate exact vertical center of the card
            const cardCenterY = y + (cardHeight / 2);
            const totalTextHeight = totalLines * lineHeight;
            // Position text block to start from the center
            let currentY = cardCenterY + (totalTextHeight / 2) - lineHeight;

            const addWrappedText = (text, startY) => {
                const words = text.split(' ');
                let line = '';
                let resultY = startY;

                words.forEach(word => {
                    const testLine = line + (line ? ' ' : '') + word;
                    if (testLine.length * (fontSize * 0.6) < textWidth) {
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

            // Create QR code image
            const tempDiv = document.createElement('div');
            const qr = new QRCode(tempDiv, {
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

            // Position QR code - right aligned with 10px padding, vertically centered
            const qrCodeY = y + ((cardHeight - 10 - 100) / 2); // Subtract border padding
            page.drawImage(qrImage, {
                x: x + cardWidth - 110 - 10,
                y: qrCodeY,
                width: 100,
                height: 100
            });

            // Update progress
            const progress = ((pageNum * cardsPerPage + i + 1) / allCards.length) * 100;
            updateProgress(progress);
        }

        // Add centered header
        const startHHID = allCards[startIdx].data.hh_id;
        const endHHID = allCards[endIdx - 1].data.hh_id;

        const headerText = `Page ${pageNum + 1}  |  HH ID Range: ${startHHID} - ${endHHID}`;
        const textWidth = headerText.length * 5; // Approximate width

        page.drawText(headerText, {
            x: (width - textWidth) / 2,
            y: height - 20,
            size: 10
        });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const dataUrl = URL.createObjectURL(blob);

    const pdfViewerDiv = document.getElementById('pdfViewer');
    pdfViewerDiv.innerHTML = ''; // Clear previous PDF
    const iframe = document.createElement('iframe');
    iframe.src = dataUrl;
    iframe.type = 'application/pdf';
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    pdfViewerDiv.appendChild(iframe);
}

// PDF generation starts automatically after CSV upload
