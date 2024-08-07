const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle file upload and team generation
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  const workbook = XLSX.readFile(file.path);
  const sheetNames = workbook.SheetNames;

  let developers = [];
  let businessAnalysts = [];
  let dataAnalysts = [];

  sheetNames.forEach(sheetName => {
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    if (sheetName.toLowerCase().includes('developer')) {
      developers = sheetData;
    } else if (sheetName.toLowerCase().includes('business')) {
      businessAnalysts = sheetData;
    } else if (sheetName.toLowerCase().includes('data')) {
      dataAnalysts = sheetData;
    }
  });

  if (developers.length === 0 || businessAnalysts.length === 0 || dataAnalysts.length === 0) {
    return res.status(400).send('Missing required sheets. Please ensure you have sheets for Developers, Business Analysts, and Data Analysts.');
  }

  const teams = generateTeams(developers, businessAnalysts, dataAnalysts);

  // Generate PDF and send as response
  generatePdf(teams, (pdfBuffer) => {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=teams.pdf',
    });
    res.send(pdfBuffer);

    fs.unlinkSync(file.path);
  });

});

function generateTeams(developers, businessAnalysts, dataAnalysts) {
  const teams = [];
  const teamCount = Math.min(Math.floor(developers.length / 3), businessAnalysts.length, dataAnalysts.length);

  for (let i = 0; i < teamCount; i++) {
    const team = {
      developers: developers.splice(0, 3),
      businessAnalyst: businessAnalysts.splice(0, 1)[0],
      dataAnalyst: dataAnalysts.splice(0, 1)[0]
    };
    teams.push(team);
  }

  return teams;
}

function generatePdf(teams, callback) {
  const doc = new PDFDocument();
  const buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(buffers);
    callback(pdfBuffer);
  });

  let yPosition = 50;
  const pageHeight = doc.page.height - 50;
  teams.forEach((team, index) => {
    if (yPosition + 150 > pageHeight) {
      doc.addPage();
      yPosition = 50;
    }

    doc.fontSize(16).text(`Team ${index + 1}`, 50, yPosition, { underline: true });
    yPosition += 25;

    team.developers.forEach((dev, i) => {
      doc.fontSize(12).text(`Developer ${i + 1}: ${dev.Name}`, 70, yPosition);
      yPosition += 20;
    });

    doc.fontSize(12).text(`Business Analyst: ${team.businessAnalyst.Name}`, 70, yPosition);
    yPosition += 20;

    doc.fontSize(12).text(`Data Analyst: ${team.dataAnalyst.Name}`, 70, yPosition);
    yPosition += 40; //add some space
  });

  doc.end();

}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
