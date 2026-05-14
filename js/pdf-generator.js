// ── Shared PDF header (logo + navy bar + doc-type badge) ─────────────────────
// Returns the Y position after the header (where content starts).
function drawPDFHeader(doc, pageW, docTypeLabel, subtitleText) {
  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [210, 210, 210];

  const HDR_H = 38;
  const margin = 14;

  // Navy background
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, HDR_H, 'F');

  // Red left accent stripe
  doc.setFillColor(...RED);
  doc.rect(0, 0, 4, HDR_H, 'F');

  // Logo — white area on left, colour PNG inside
  const logoX = 8, logoY = 5, logoW = 52, logoH = 28;
  doc.setFillColor(...WHITE);
  doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'F');

  if (typeof TM_LOGO_B64 !== 'undefined') {
    try {
      // Keep aspect ratio: original is ~2.03:1 (243×120)
      const imgH = logoH - 6;
      const imgW = imgH * (243 / 120);
      const imgX = logoX + (logoW - imgW) / 2;
      const imgY = logoY + 3;
      doc.addImage(TM_LOGO_B64, 'PNG', imgX, imgY, imgW, imgH);
    } catch(e) {
      // fallback text
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
      doc.text('TM', logoX + logoW / 2, logoY + logoH / 2 + 3, { align: 'center' });
    }
  } else {
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('TM', logoX + logoW / 2, logoY + logoH / 2 + 3, { align: 'center' });
  }

  // Subtitle text (form type description, shown below company area)
  if (subtitleText) {
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...LGRAY);
    const textX = logoX + logoW + 6;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('TRADEMARK MASONRY', textX, 16);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 230);
    doc.text(subtitleText, textX, 22);
  } else {
    const textX = logoX + logoW + 6;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('TRADEMARK MASONRY', textX, 17);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 230);
    doc.text('Safety Management System', textX, 23.5);
  }

  // Doc-type badge (red pill, top-right)
  const badgeW = 56, badgeH = 11;
  const badgeX = pageW - margin - badgeW;
  doc.setFillColor(...RED);
  doc.roundedRect(badgeX, 7, badgeW, badgeH, 2, 2, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text(docTypeLabel.toUpperCase(), badgeX + badgeW / 2, 14, { align: 'center' });

  return HDR_H + 6; // y start for content
}

// ── Compact continuation-page header ─────────────────────────────────────────
function drawContinuationHeader(doc, pageW, label) {
  const NAVY = [0, 32, 91];
  const RED  = [138, 42, 43];
  doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 10, 'F');
  doc.setFillColor(...RED);  doc.rect(0, 0, 4, 10, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255);
  doc.text(label, 8, 6.5);
  return 15;
}

async function generatePDF(formData, photos) {
  if (formData.submissionType === 'Weekly Timesheet') {
    return generateTimesheetPDF(formData);
  }
  if (formData.submissionType === 'QAQC - Foreman') {
    return generateQAQCPDF(formData, photos);
  }
  if (formData.submissionType === 'Production Report') {
    return generateProductionPDF(formData, photos);
  }
  if (formData.submissionType === 'Incident Report') {
    return generateIncidentReportPDF(formData, photos);
  }
  if (formData.submissionType === 'Weekly Toolbox Talk') {
    return generateToolboxPDF(formData, photos);
  }
  if (['Telehandler Inspection','Forklift Inspection','E-Pallet Jack Inspection','Scaffolding Inspection'].includes(formData.submissionType)) {
    return generateDailyInspectionPDF(formData, photos);
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Brand colors
  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [220, 220, 220];
  const DGRAY = [80, 80, 80];
  const MGRAY = [140, 140, 140];
  const BG    = [248, 248, 248];

  // ── Header ────────────────────────────────────────────────────────────────
  y = drawPDFHeader(doc, pageW, formData.submissionType);

  // â”€â”€ Info bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.setFillColor(...BG);
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);

  // Row 1: Foreman | Date | Workers
  doc.rect(margin, y, contentW, 18, 'F');
  doc.rect(margin, y, contentW, 18, 'S');
  const col3 = contentW / 3;
  [['FOREMAN', formData.foremanName || '—'], ['DATE', formData.date || '—'], ['WORKERS ON SITE', formData.workersOnSite || '—']].forEach(([lbl, val], i) => {
    const x = margin + col3 * i + 4;
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
    doc.text(lbl, x, y + 6);
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    doc.text(String(val), x, y + 14);
  });
  y += 19;

  // Row 2: Project (full width, wraps if needed)
  const projectLines = doc.splitTextToSize(formData.project || '—', contentW - 8);
  const projectRowH = Math.max(14, projectLines.length * 5 + 6);
  doc.setFillColor(240, 243, 250);
  doc.rect(margin, y, contentW, projectRowH, 'F');
  doc.rect(margin, y, contentW, projectRowH, 'S');
  doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
  doc.text('PROJECT', margin + 4, y + 5);
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
  doc.text(projectLines, margin + 4, y + 11);
  y += projectRowH + 6;

  // â”€â”€ Tailgate-specific content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (formData.submissionType === 'Daily Tailgate') {
    y = await renderDailyTailgatePDF(doc, formData, y, pageW, pageH, margin, contentW, { NAVY, RED, WHITE, LGRAY, DGRAY, MGRAY, BG });
  } else {
    y = renderGenericFieldsPDF(doc, formData, y, pageW, pageH, margin, contentW, { NAVY, RED, WHITE, LGRAY, DGRAY, MGRAY, BG });
  }

  // â”€â”€ Photos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (photos && photos.length > 0) {
    if (y > pageH - 80) { doc.addPage(); y = margin; }
    y = await renderPhotosPDF(doc, photos, y, margin, contentW, pageH, { NAVY, RED, LGRAY, MGRAY });
  }

  // â”€â”€ Signature â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (formData.signature) {
    // Supervisor section needs ~80mm (header 9 + disclaimer 20 + name 8 + sig box 32 + label 10)
    if (y > pageH - 85) { doc.addPage(); y = margin; }
    y = renderSignaturePDF(doc, formData, y, margin, contentW, { NAVY, RED, WHITE, LGRAY, DGRAY, MGRAY, BG });
  }

  drawFooter(doc, formData, pageW, pageH, margin);
  return doc.output('arraybuffer');
}

// â”€â”€ Daily Tailgate PDF Renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function renderDailyTailgatePDF(doc, formData, y, pageW, pageH, margin, contentW, C) {
  const checkNewPage = (needed) => {
    if (y + needed > pageH - 20) { doc.addPage(); y = margin; drawHeaderStrip(doc, formData, pageW, C); }
  };

  // Work Scope
  if (formData.fields.work_scope) {
    y = renderPDFSection(doc, 'DAILY WORK SCOPE', formData.fields.work_scope, y, margin, contentW, C);
  }

  // Project Concerns
  if (formData.fields.project_concerns) {
    y = renderPDFSection(doc, 'PROJECT CONCERNS AND CONTROLS', formData.fields.project_concerns, y, margin, contentW, C);
  }

  // Items Reviewed
  const items = formData.fields.items_reviewed || {};
  const checkedItems = Object.entries(items).filter(([, v]) => v).map(([k]) => k);
  if (checkedItems.length > 0 || Object.keys(items).length > 0) {
    checkNewPage(60);

    // Section header
    doc.setFillColor(...C.NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.WHITE);
    doc.text('ITEMS REVIEWED', margin + 3, y + 5);
    y += 9;

    // Render all items with checkmarks
    const tailgateConfig = (typeof TAILGATE_ITEMS !== 'undefined' && TAILGATE_ITEMS)
      ? TAILGATE_ITEMS
      : { 'Permits': [], 'Work Surfaces': [], 'General Safety': [], 'Fall Protection': [] };

    const sectionKeys = Object.keys(tailgateConfig);

    // Collect all items by section from config
    const sectionData = sectionKeys.map(sec => ({
      title: sec,
      items: (tailgateConfig[sec] || []).map(item => ({ label: item, checked: !!items[item] }))
    }));

    // Render in 2 columns
    const colW = contentW / 2;
    const leftSections  = sectionData.slice(0, 2);
    const rightSections = sectionData.slice(2);

    const startY = y;
    let leftY = y;
    let rightY = y;

    leftSections.forEach(sec => {
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.RED);
      doc.text(sec.title.toUpperCase(), margin + 2, leftY + 4);
      leftY += 7;
      sec.items.forEach(item => {
        drawPDFCheckbox(doc, margin + 2, leftY + 2, item.checked, C);
        doc.setFontSize(8);
        doc.setFont('helvetica', item.checked ? 'bold' : 'normal');
        item.checked ? doc.setTextColor(...C.NAVY) : doc.setTextColor(140,140,140);
        doc.text(item.label, margin + 8, leftY + 3.8);
        leftY += 6;
      });
      leftY += 2;
    });

    rightSections.forEach(sec => {
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.RED);
      doc.text(sec.title.toUpperCase(), margin + colW + 2, rightY + 4);
      rightY += 7;
      sec.items.forEach(item => {
        drawPDFCheckbox(doc, margin + colW + 2, rightY + 2, item.checked, C);
        doc.setFontSize(8);
        doc.setFont('helvetica', item.checked ? 'bold' : 'normal');
        item.checked ? doc.setTextColor(...C.NAVY) : doc.setTextColor(140,140,140);
        doc.text(item.label, margin + colW + 8, rightY + 3.8);
        rightY += 6;
      });
      rightY += 2;
    });

    y = Math.max(leftY, rightY) + 4;
  }

  // FLRA
  const flra = formData.fields.flra || [];
  const includedFLRA = flra.filter(r => r.included !== false && (r.task || r.hazards?.length > 0));
  if (includedFLRA.length > 0) {
    checkNewPage(40);
    doc.setFillColor(...C.NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.WHITE);
    doc.text('FIELD LEVEL RISK ASSESSMENT', margin + 3, y + 5);
    y += 9;

    includedFLRA.forEach((row, i) => {
      if (!row.task && !row.hazards?.length) return;
      checkNewPage(25);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.DGRAY);
      doc.text(`Task ${i + 1}: ${row.task || 'Untitled'}`, margin + 2, y + 4);

      if (row.riskLevel) {
        const rColors = { High: [239,68,68], Medium: [249,115,22], Low: [16,185,129] };
        const rc = rColors[row.riskLevel] || C.MGRAY;
        doc.setFillColor(...rc);
        doc.roundedRect(margin + contentW - 30, y, 30, 7, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255,255,255);
        doc.text(row.riskLevel.toUpperCase(), margin + contentW - 15, y + 4.8, { align: 'center' });
      }
      y += 8;

      if (row.hazards?.length > 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.MGRAY);
        const hazardText = 'Hazards: ' + row.hazards.join(' • ');
        const lines = doc.splitTextToSize(hazardText, contentW - 4);
        doc.text(lines, margin + 2, y + 3);
        y += lines.length * 4.5 + 2;
      }

      if (row.controls) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...C.DGRAY);
        const lines = doc.splitTextToSize('Controls: ' + row.controls, contentW - 4);
        doc.text(lines, margin + 2, y + 3);
        y += lines.length * 4.5;
      }

      doc.setDrawColor(...C.LGRAY);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 3, margin + contentW, y + 3);
      y += 7;
    });
  }

  // Close Out
  const closeout = formData.fields.closeout || {};
  if (Object.keys(closeout).length > 0) {
    checkNewPage(35);
    doc.setFillColor(...C.NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.WHITE);
    doc.text('DAILY CLOSE OUT / CLEAN UP', margin + 3, y + 5);
    y += 9;

    const colW = contentW / 2;
    const questions = Object.entries(closeout);
    questions.forEach(([q, ans], i) => {
      const x = i % 2 === 0 ? margin + 2 : margin + colW + 2;
      if (i % 2 === 0 && i > 0) y += 10;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.DGRAY);
      const qLines = doc.splitTextToSize(q, colW - 25);
      doc.text(qLines, x, y + 3);

      const ansColor = ans === 'No' ? C.RED : [16,185,129];
      doc.setFillColor(...ansColor);
      doc.roundedRect(x + colW - 22, y, 18, 7, 1, 1, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255,255,255);
      doc.text(ans || '—', x + colW - 13, y + 4.8, { align: 'center' });
    });
    y += 14;
  }

  // Crew Sign-In with signatures
  const crew = formData.fields.crew || [];
  const filledCrew = crew.filter(m => m.name);
  if (filledCrew.length > 0) {
    const rowH = 16;
    checkNewPage(18 + filledCrew.length * rowH);

    // Section header
    doc.setFillColor(...C.NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFillColor(...C.RED);
    doc.rect(margin, y, 3, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.WHITE);
    doc.text('CREW SIGN-IN', margin + 6, y + 5);
    y += 7;

    // Column header
    const nameColW = contentW * 0.42;
    const sigColW  = contentW - nameColW;
    doc.setFillColor(230, 235, 248); doc.setDrawColor(...C.LGRAY); doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, 6, 'FD');
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.NAVY);
    doc.text('#   PRINT NAME', margin + 3, y + 4.2);
    doc.text('SIGNATURE', margin + nameColW + 3, y + 4.2);
    y += 6;

    for (let i = 0; i < filledCrew.length; i++) {
      const member = filledCrew[i];
      if (y + rowH > pageH - 18) {
        doc.addPage(); y = margin;
        drawHeaderStrip(doc, formData, pageW, C);
        y = margin + 10;
      }
      const bg = i % 2 === 0 ? C.BG : [240, 243, 250];
      doc.setFillColor(...bg); doc.setDrawColor(...C.LGRAY); doc.setLineWidth(0.2);
      doc.rect(margin, y, nameColW, rowH, 'FD');
      doc.rect(margin + nameColW, y, sigColW, rowH, 'FD');

      // Number badge
      doc.setFillColor(...C.NAVY);
      doc.roundedRect(margin + 2, y + 3, 6, 6, 1, 1, 'F');
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.WHITE);
      doc.text(String(i + 1), margin + 5, y + 7.2, { align: 'center' });

      // Name
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.DGRAY);
      doc.text(member.name || '', margin + 11, y + 7.2);

      // Signature image
      if (member.sig) {
        try {
          doc.addImage(member.sig, 'PNG', margin + nameColW + 2, y + 1.5, sigColW - 4, rowH - 3);
        } catch(e) {}
      } else {
        // blank line placeholder
        doc.setDrawColor(...C.LGRAY); doc.setLineWidth(0.3);
        doc.line(margin + nameColW + 4, y + rowH - 3, margin + nameColW + sigColW - 4, y + rowH - 3);
      }

      y += rowH;
    }
    y += 4;
  }

  return y;
}

// â”€â”€ Generic Fields PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderGenericFieldsPDF(doc, formData, y, pageW, pageH, margin, contentW, C) {
  const fields = FORM_FIELDS[formData.submissionType] || [];
  const skipTypes = ['signature','crew-signin','tailgate-items','flra-table','closeout'];

  fields.filter(f => !skipTypes.includes(f.type)).forEach(field => {
    const val = formData.fields[field.id];
    if (!val || val === '' || (Array.isArray(val) && val.length === 0)) return;

    if (y > pageH - 40) { doc.addPage(); y = margin; }

    const displayVal = Array.isArray(val) ? val.join(' • ') : String(val);
    y = renderPDFSection(doc, field.label, displayVal, y, margin, contentW, C);
  });

  // Crew for non-tailgate types
  const crew = (formData.fields.crew || []).filter(m => m.name);
  if (crew.length > 0) {
    if (y > pageH - 30) { doc.addPage(); y = margin; }
    doc.setFillColor(...C.NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.WHITE);
    doc.text('CREW SIGN-IN', margin + 3, y + 5);
    y += 9;
    crew.forEach((m, i) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.DGRAY);
      doc.text(`${m.name}  |  In: ${m.in || '—'}  |  Out: ${m.out || '—'}`, margin + 3, y + 4);
      y += 7;
    });
    y += 4;
  }

  return y;
}

function renderPDFSection(doc, label, value, y, margin, contentW, C) {
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.RED);
  doc.text(label.toUpperCase(), margin, y + 4);
  y += 7;

  const lines = doc.splitTextToSize(value, contentW - 4);
  const blockH = lines.length * 5 + 4;
  doc.setFillColor(...C.BG);
  doc.rect(margin, y, contentW, blockH, 'F');
  doc.setDrawColor(...C.LGRAY);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, blockH, 'S');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(lines, margin + 3, y + 5);
  return y + blockH + 5;
}

// â”€â”€ Photos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function renderPhotosPDF(doc, photos, y, margin, contentW, pageH, C) {
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.RED);
  doc.text('ATTACHED PHOTOS', margin, y + 4);
  doc.setDrawColor(...C.RED);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 6, margin + contentW, y + 6);
  y += 10;

  const photoW = (contentW - 8) / 3;
  const photoH = photoW * 0.75;
  let col = 0;

  for (let i = 0; i < Math.min(photos.length, 9); i++) {
    if (col === 3) { col = 0; y += photoH + 6; }
    if (y + photoH > pageH - 20) { doc.addPage(); y = margin; }
    const x = margin + col * (photoW + 4);
    try {
      const imgData = await fileToDataURL(photos[i]);
      doc.addImage(imgData, 'JPEG', x, y, photoW, photoH, undefined, 'FAST');
    } catch {
      doc.setFillColor(220,220,220);
      doc.rect(x, y, photoW, photoH, 'F');
    }
    doc.setFontSize(6);
    doc.setTextColor(...C.MGRAY);
    doc.text(`Photo ${i + 1}`, x + photoW / 2, y + photoH + 3, { align: 'center' });
    col++;
  }

  return y + photoH + 8;
}

// â”€â”€ Signature â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderSignaturePDF(doc, formData, y, margin, contentW, C) {
  const pageH = doc.internal.pageSize.getHeight();
  // Guard: if less than 85mm remain on this page, start a fresh page
  if (y > pageH - 85) { doc.addPage(); y = margin; }

  doc.setFillColor(...C.NAVY);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.WHITE);
  doc.text('SUPERVISOR SIGN OFF', margin + 3, y + 5);
  y += 9;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...C.MGRAY);
  const disclaimer = 'I certify that I have reviewed this questionnaire with each crew member and am complying with the guidelines outlined by Trade Mark and the Ministry of Health.';
  const lines = doc.splitTextToSize(disclaimer, contentW - 4);
  doc.text(lines, margin + 2, y + 4);
  y += lines.length * 4.5 + 6;

  const nameVal = formData.fields.supervisor_name || formData.foremanName || '';
  if (nameVal) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.DGRAY);
    doc.text('Supervisor Name: ' + nameVal, margin + 2, y + 4);
    y += 8;
  }

  // Signature image
  const sigW = Math.min(contentW * 0.5, 80);
  const sigH = sigW * 0.4;
  doc.setFillColor(255,255,255);
  doc.setDrawColor(...C.LGRAY);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, sigW, sigH, 'FD');

  if (formData.signature && formData.signature.startsWith('data:image')) {
    try {
      doc.addImage(formData.signature, 'PNG', margin + 2, y + 2, sigW - 4, sigH - 4);
    } catch (e) {
      doc.setFontSize(8); doc.setTextColor(...C.MGRAY);
      doc.text('[Signature captured]', margin + sigW / 2, y + sigH / 2, { align: 'center' });
    }
  } else {
    doc.setFontSize(8); doc.setTextColor(...C.MGRAY);
    doc.text('[No signature]', margin + sigW / 2, y + sigH / 2, { align: 'center' });
  }

  doc.setFontSize(7);
  doc.setTextColor(...C.MGRAY);
  doc.text('Supervisor Signature', margin, y + sigH + 4);

  return y + sigH + 10;
}

// â”€â”€ Header strip for new pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawHeaderStrip(doc, formData, pageW, C) {
  doc.setFillColor(...C.NAVY);
  doc.rect(0, 0, pageW, 10, 'F');
  doc.setFillColor(...C.RED);
  doc.rect(0, 0, 4, 10, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.WHITE);
  doc.text(`TRADEMARK MASONRY — ${(formData.submissionType || '').toUpperCase()} — ${formData.project || ''}`, 8, 6.5);
}

// â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawFooter(doc, formData, pageW, pageH, margin) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(30,58,110);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    const ts = new Date().toLocaleString('en-CA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    doc.text(`${formData.submissionType} — ${formData.project}`, margin, pageH - 4);
    doc.text(`Page ${i} of ${pages}  |  ${ts}`, pageW - margin, pageH - 4, { align: 'right' });
  }
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Draw a real checkbox square (avoids Unicode font issues)
function drawPDFCheckbox(doc, x, y, checked, C) {
  const s = 3.5;
  doc.setLineWidth(0.4);
  if (checked) {
    doc.setFillColor(...C.NAVY);
    doc.setDrawColor(...C.NAVY);
    doc.rect(x, y, s, s, 'FD');
    // Draw checkmark in white
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.6);
    doc.line(x + 0.5, y + 1.8, x + 1.4, y + 2.8);
    doc.line(x + 1.4, y + 2.8, x + s - 0.4, y + 0.6);
  } else {
    doc.setDrawColor(180, 180, 180);
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, s, s, 'FD');
  }
  doc.setLineWidth(0.3);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 900;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = (h / w) * maxDim; w = maxDim; }
        else { w = (w / h) * maxDim; h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    img.src = URL.createObjectURL(file);
  });
}

// ── Weekly Toolbox Meeting PDF ────────────────────────────────────────────────
async function generateToolboxPDF(formData, photos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 14;
  const cW     = pageW - margin * 2;

  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [220, 220, 220];
  const DGRAY = [55, 55, 55];
  const MGRAY = [130, 130, 130];
  const BG    = [248, 249, 252];
  const GREEN = [16, 185, 129];
  const ORANGE= [249, 115, 22];

  const f = formData.fields || {};

  function checkNewPage(needed) {
    if (y + needed > pageH - 18) {
      doc.addPage(); y = 14;
      drawContHeader();
    }
  }

  function drawContHeader() {
    doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 10, 'F');
    doc.setFillColor(...RED);  doc.rect(0, 0, 3, 10, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('WEEKLY TOOLBOX MEETING  —  Trade Mark Masonry Ltd. (continued)', 6, 7);
  }

  function sectionBar(num, label, y) {
    doc.setFillColor(...NAVY); doc.rect(margin, y, cW, 8, 'F');
    doc.setFillColor(...RED);  doc.rect(margin, y, 3, 8, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text(num + '  ' + label.toUpperCase(), margin + 6, y + 5.5);
    return y + 8;
  }

  function fieldRow(label, value, x, y, w, h) {
    doc.setFillColor(...BG);
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text(label.toUpperCase(), x + 3, y + 4.5);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DGRAY);
    const lines = doc.splitTextToSize(String(value || '—'), w - 6);
    doc.text(lines[0] || '—', x + 3, y + h - 3.5);
  }

  function textBlock(label, value, x, y, w, h) {
    doc.setFillColor(...BG);
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text(label.toUpperCase(), x + 3, y + 4.5);
    if (value) {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
      const lines = doc.splitTextToSize(value, w - 6);
      lines.slice(0, Math.floor((h - 9) / 4.5)).forEach((ln, i) => {
        doc.text(ln, x + 3, y + 10 + i * 4.5);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════
  doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 16, 'F');
  doc.setFillColor(...RED);  doc.rect(0, 0, 3, 16, 'F');

  doc.setFillColor(...WHITE); doc.roundedRect(6, 2, 52, 12, 1, 1, 'F');
  if (typeof TM_LOGO_B64 !== 'undefined') {
    try { doc.addImage(TM_LOGO_B64, 'PNG', 7.5, 3.5, 49, 9); } catch(e) {}
  }

  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text('WEEKLY TOOLBOX MEETING', 62, 8);
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 205, 235);
  doc.text('Complete before work begins each week  —  Trade Mark Masonry Ltd.', 62, 13);

  // Red badge top-right
  doc.setFillColor(...RED); doc.roundedRect(pageW - margin - 42, 4, 42, 9, 1.5, 1.5, 'F');
  doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text('TOOLBOX MEETING', pageW - margin - 21, 9.5, { align: 'center' });

  let y = 20;

  // Info bar: Date | Project # | Time | Foreman | # Workers
  const col5 = cW / 5;
  const projNum = (formData.project || '').match(/(\d{2}TM\d{3})/)?.[1] || '—';
  [
    ['Date',       formData.date || '—'],
    ['Project #',  projNum],
    ['Time',       ''],
    ['Foreman',    formData.foremanName || '—'],
    ['# Workers',  '']
  ].forEach(([lbl, val], i) => {
    fieldRow(lbl, val, margin + col5 * i, y, col5, 11);
  });
  y += 11;

  // Project Name (full width)
  fieldRow('Project Name', formData.project || '—', margin, y, cW, 10);
  y += 11;

  // ═══ ① WHAT ARE WE DOING THIS WEEK? ═══════════════════════
  y = sectionBar('①', 'What Are We Doing This Week?', y);
  textBlock('Brief description of scope — helps crew understand context for hazards below', f.work_scope || '', margin, y, cW, 22);
  y += 23;

  // ═══ ② SAFETY TOPIC OF THE WEEK ════════════════════════════
  checkNewPage(70);
  y = sectionBar('②', 'Safety Topic of the Week', y);

  // Topic checkboxes in 2 columns
  const allTopics = [
    'Silica dust / respiratory protection',
    'Fall protection & scaffold inspection',
    'Telehandler / forklift safety',
    'PPE requirements',
    'Manual lifting / ergonomics',
    'Heat / cold stress',
    'Housekeeping & site organization',
    'Near miss / incident review',
    'Lock out / tag out',
    'Emergency procedures & muster point'
  ];
  const selected = f.safety_topics || [];
  const colW = cW / 2;
  const rowH = 6;

  doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  const topicBoxH = Math.ceil(allTopics.length / 2) * rowH + 8;
  doc.rect(margin, y, cW, topicBoxH, 'FD');

  allTopics.forEach((topic, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const tx = margin + 3 + col * colW;
    const ty = y + 5 + row * rowH;
    const isChecked = selected.includes(topic);

    doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
    doc.rect(tx, ty - 3.5, 4, 4, 'S');
    if (isChecked) {
      doc.setFillColor(...NAVY); doc.rect(tx + 0.5, ty - 3, 3, 3, 'F');
    }
    doc.setFontSize(7); doc.setFont('helvetica', isChecked ? 'bold' : 'normal');
    if (isChecked) { doc.setTextColor(...NAVY); } else { doc.setTextColor(...DGRAY); }
    doc.text(topic, tx + 5.5, ty);
  });

  // Other topic
  y += topicBoxH + 1;
  if (f.topic_other) {
    doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
    doc.rect(margin, y, cW, 8, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text('OTHER TOPIC', margin + 3, y + 4.5);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
    doc.text(f.topic_other || '', margin + 26, y + 4.5);
    y += 9;
  }

  // Key points
  checkNewPage(28);
  textBlock('Key Points Discussed', f.key_points || '', margin, y, cW, 26);
  y += 27;

  // ═══ ③ HAZARD REVIEW ════════════════════════════════════════
  checkNewPage(55);
  y = sectionBar('③', 'Hazard Review', y);

  // Table header
  const hzW = cW * 0.44, riskW = cW * 0.16, ctrlW = cW - hzW - riskW;
  doc.setFillColor(230, 235, 248); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.25);
  doc.rect(margin, y, cW, 7, 'FD');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
  doc.text('HAZARD / TASK', margin + 3, y + 4.5);
  doc.text('RISK', margin + hzW + riskW / 2, y + 4.5, { align: 'center' });
  doc.text('CONTROL / ACTION', margin + hzW + riskW + 3, y + 4.5);
  y += 7;

  const hazardRows = f.hazard_review || [];
  const allHazardRows = [
    ...hazardRows,
    // ensure blank "Other" row always appears
    ...(hazardRows.find(r => r.custom) ? [] : [{ hazard: 'Other: ______________________________', risk: '', control: '', included: false, custom: true }])
  ];

  allHazardRows.forEach((row, idx) => {
    const rH = 10;
    if (y + rH > pageH - 18) { doc.addPage(); y = 14; drawContHeader(); y = 17; }

    const bg = idx % 2 === 0 ? BG : [240, 243, 250];
    doc.setFillColor(...bg); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
    doc.rect(margin, y, cW, rH, 'FD');

    // Checkbox
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.35);
    doc.rect(margin + 1.5, y + 2.5, 4.5, 4.5, 'S');
    if (row.included) {
      doc.setFillColor(...NAVY);
      doc.rect(margin + 2, y + 3, 3.5, 3.5, 'F');
    }

    // Hazard name
    doc.setFontSize(7.5); doc.setFont('helvetica', row.included ? 'bold' : 'normal');
    if (row.included) { doc.setTextColor(...NAVY); } else { doc.setTextColor(...DGRAY); }
    const hzText = row.hazard || 'Other: ______________________________';
    const hzLines = doc.splitTextToSize(hzText, hzW - 10);
    doc.text(hzLines[0], margin + 8, y + 6);

    // Risk level pill
    const risk = row.risk || '';
    const riskColor = risk === 'H' ? RED : risk === 'M' ? ORANGE : risk === 'L' ? GREEN : LGRAY;
    if (risk) {
      doc.setFillColor(...riskColor);
      doc.roundedRect(margin + hzW + (riskW - 12) / 2, y + 2, 12, 6, 1, 1, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
      doc.text(risk === 'H' ? 'HIGH' : risk === 'M' ? 'MED' : 'LOW',
        margin + hzW + riskW / 2, y + 6.2, { align: 'center' });
    } else {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
      doc.text('H  /  M  /  L', margin + hzW + riskW / 2, y + 6, { align: 'center' });
    }

    // Control text
    if (row.control) {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
      const ctrlLines = doc.splitTextToSize(row.control, ctrlW - 4);
      doc.text(ctrlLines[0], margin + hzW + riskW + 2, y + 6);
    }

    y += rH;
  });

  // Risk legend
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
  doc.text('H — HIGH  Immediate action required     M — MEDIUM  Controls must be applied     L — LOW  Monitor and review', margin, y + 4);
  y += 7;

  // ═══ ④ FOLLOW-UP FROM LAST MEETING ════════════════════════
  checkNewPage(24);
  y = sectionBar('④', 'Follow-Up from Last Meeting', y);

  function yesNoRow(label, value, y) {
    doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.25);
    doc.rect(margin, y, cW, 10, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
    doc.text(label, margin + 3, y + 6.5);
    const bx = margin + cW - 36, by = y + 2.5, bs = 5;
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.4);
    doc.rect(bx, by, bs, bs, 'S');
    doc.rect(bx + 14, by, bs, bs, 'S');
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('YES', bx + bs + 1.5, by + 3.8);
    doc.text('NO',  bx + 14 + bs + 1.5, by + 3.8);
    if (value === 'Yes') { doc.setFillColor(...NAVY); doc.rect(bx + 0.7, by + 0.7, bs - 1.4, bs - 1.4, 'F'); }
    if (value === 'No')  { doc.setFillColor(...NAVY); doc.rect(bx + 14.7, by + 0.7, bs - 1.4, bs - 1.4, 'F'); }
    return y + 10;
  }

  y = yesNoRow('Any incidents or near misses since last meeting?', f.incidents_since_last, y);
  y += 1;
  y = yesNoRow('Any open action items from last week?', f.open_action_items, y);
  y += 4;

  // ═══ ⑤ CREW ATTENDANCE ══════════════════════════════════════
  checkNewPage(50);
  y = sectionBar('⑤', 'Crew Attendance  —  Print name to confirm you attended and understood today\'s meeting', y);

  // Two-column crew table
  const crew = f.crew || [];
  const crewColW = cW / 2;
  const initW = 22;
  const nameW = crewColW - initW;

  // Table header
  doc.setFillColor(230, 235, 248); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  doc.rect(margin, y, cW, 7, 'FD');
  ['PRINT NAME', 'INITIALS', 'PRINT NAME', 'INITIALS'].forEach((hdr, i) => {
    const sx = margin + (i < 2 ? 0 : crewColW) + (i % 2 === 0 ? 2 : nameW + 2);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text(hdr, sx, y + 4.8);
  });
  y += 7;

  // Ensure at least 8 rows visible
  const minRows = Math.max(crew.length, 8);
  for (let i = 0; i < minRows; i++) {
    const rH = 8;
    if (y + rH > pageH - 20) { doc.addPage(); y = 14; drawContHeader(); y = 17; }

    const bg = i % 2 === 0 ? BG : [240, 243, 250];
    doc.setFillColor(...bg); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);

    // Left column
    doc.rect(margin, y, nameW, rH, 'FD');
    doc.rect(margin + nameW, y, initW, rH, 'FD');
    // Right column
    doc.rect(margin + crewColW, y, nameW, rH, 'FD');
    doc.rect(margin + crewColW + nameW, y, initW, rH, 'FD');

    // Fill names from state
    const left  = crew[i * 2]     || {};
    const right = crew[i * 2 + 1] || {};
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
    if (left.name)  doc.text(left.name,  margin + 2, y + 5.5);
    if (right.name) doc.text(right.name, margin + crewColW + 2, y + 5.5);
    y += rH;
  }
  y += 4;

  // ═══ FOREMAN SIGN-OFF ═══════════════════════════════════════
  checkNewPage(36);
  doc.setFillColor(...NAVY); doc.rect(margin, y, cW, 8, 'F');
  doc.setFillColor(...RED);  doc.rect(margin, y, 3, 8, 'F');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text('FOREMAN SIGN-OFF  —  I confirm this meeting was conducted, hazards were reviewed, and all crew members were briefed.', margin + 6, y + 5.5);
  y += 8;

  const halfC = cW / 2;
  fieldRow('Foreman — Printed Name', f.supervisor_name || '—', margin, y, halfC, 12);
  fieldRow('Date', formData.date || '—', margin + halfC, y, halfC / 2, 12);
  y += 12;

  // Signature
  doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.25);
  doc.rect(margin, y, cW * 0.7, 22, 'FD');
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
  doc.text('FOREMAN SIGNATURE', margin + 3, y + 5);
  if (formData.signature) {
    try { doc.addImage(formData.signature, 'PNG', margin + 3, y + 6, cW * 0.7 - 6, 13); } catch(e) {}
  }
  y += 24;

  // Photos
  if (photos && photos.length > 0) {
    checkNewPage(60);
    doc.setFillColor(...NAVY); doc.rect(margin, y, cW, 7, 'F');
    doc.setFillColor(...RED);  doc.rect(margin, y, 3, 7, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('SITE PHOTOS', margin + 6, y + 4.8);
    y += 9;
    y = await renderPhotosPDF(doc, photos, y, margin, cW, pageH, { NAVY, RED, LGRAY, MGRAY });
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text(
      'Send completed form to: info@trademarkmasonry.ca  |  Retain one copy on site  |  Trade Mark Masonry Ltd. — #11 – 8075 Enterprise St., Burnaby, BC  V5A 1V5',
      pageW / 2, pageH - 6, { align: 'center' }
    );
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
  }

  return doc.output('arraybuffer');
}

// ── Incident Report PDF ───────────────────────────────────────────────────────
async function generateIncidentReportPDF(formData, photos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 14;
  const cW     = pageW - margin * 2;

  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [220, 220, 220];
  const DGRAY = [60, 60, 60];
  const MGRAY = [130, 130, 130];
  const BG    = [248, 249, 252];
  const LBLUE = [235, 240, 252];

  const f = formData.fields || {};

  // helper: draw a labelled field row (label above, value line below)
  function fieldRow(label, value, x, y, w, h) {
    doc.setFillColor(...BG);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DGRAY);
    const lines = doc.splitTextToSize(value || '—', w - 6);
    doc.text(lines[0] || '—', x + 3, y + h - 4);
  }

  // helper: section header bar
  function sectionBar(label, y) {
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, cW, 7, 'F');
    doc.setFillColor(...RED);
    doc.rect(margin, y, 3, 7, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text(label, margin + 6, y + 5);
    return y + 7;
  }

  // helper: large text area box
  function textBox(label, value, x, y, w, h) {
    doc.setFillColor(...BG);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, 'FD');
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text(label.toUpperCase(), x + 3, y + 5);
    if (value) {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
      const lines = doc.splitTextToSize(value, w - 6);
      lines.slice(0, Math.floor((h - 10) / 4.5)).forEach((ln, i) => {
        doc.text(ln, x + 3, y + 11 + i * 4.5);
      });
    }
    return y + h;
  }

  // helper: yes/no row
  function yesNoRow(label, value, x, y, w) {
    const h = 10;
    doc.setFillColor(...BG);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
    doc.text(label, x + 3, y + 6.5);
    // Yes box
    const bx = x + w - 34, by = y + 2, bs = 6;
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.4);
    doc.rect(bx, by, bs, bs, 'S');
    doc.rect(bx + 14, by, bs, bs, 'S');
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('YES', bx + bs + 1, by + 4.5);
    doc.text('NO',  bx + 14 + bs + 1, by + 4.5);
    if (value === 'Yes') {
      doc.setFillColor(...NAVY); doc.rect(bx + 1, by + 1, bs - 2, bs - 2, 'F');
    } else if (value === 'No') {
      doc.setFillColor(...NAVY); doc.rect(bx + 15, by + 1, bs - 2, bs - 2, 'F');
    }
    return y + h;
  }

  // helper: signature block
  function sigBlock(label, sigData, takenBy, y) {
    const h = 28;
    if (y + h > pageH - 16) { doc.addPage(); drawPage2Header(); y = 24; }
    doc.setFillColor(...BG);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, cW, h, 'FD');
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text(label.toUpperCase(), margin + 3, y + 5);
    if (takenBy) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
      doc.text('The foregoing statement, which I have given to: ' + (takenBy || '___________________'), margin + 3, y + 11);
      doc.text('has been written and/or read over by me. I understand the contents and declare it truly and correctly describes the incident.', margin + 3, y + 16);
    }
    // Signature image if available
    if (sigData) {
      try {
        doc.addImage(sigData, 'PNG', margin + 3, y + 8, 60, 16);
      } catch(e) {}
    }
    // Date line
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text('Date: ' + (formData.date || ''), margin + cW - 50, y + h - 5);
    return y + h;
  }

  // Disclaimer text
  const DISCLAIMER = 'The information in this form is intended for general use and may not apply to every circumstance. It is not a definitive guide to government regulations and does not relieve persons from their responsibilities under applicable legislation. Trade Mark Masonry Ltd. does not guarantee the accuracy of, nor assume liability for, the information presented here.';

  function drawPage2Header() {
    doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 12, 'F');
    doc.setFillColor(...RED);  doc.rect(0, 0, 3, 12, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('INCIDENT STATEMENT  —  Trade Mark Masonry Ltd.  —  Complete one form per witness', 7, 8);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 210, 230);
    doc.text('Page 2 of 2', pageW - margin, 8, { align: 'right' });
  }

  function drawDisclaimer(y) {
    if (y + 14 > pageH - 6) return;
    doc.setFontSize(6); doc.setFont('helvetica', 'italic'); doc.setTextColor(...MGRAY);
    const lines = doc.splitTextToSize(DISCLAIMER, cW);
    doc.text(lines, margin, y + 4);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1
  // ═══════════════════════════════════════════════════════════════════════
  // Main header
  doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 14, 'F');
  doc.setFillColor(...RED);  doc.rect(0, 0, 3, 14, 'F');

  // Logo white box
  doc.setFillColor(...WHITE); doc.roundedRect(6, 2, 52, 10, 1, 1, 'F');
  if (typeof TM_LOGO_B64 !== 'undefined') {
    try {
      doc.addImage(TM_LOGO_B64, 'PNG', 8, 2.8, 48, 8.2);
    } catch(e) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
      doc.text('TM', 32, 8.5, { align: 'center' });
    }
  }

  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
  doc.text('INCIDENT STATEMENT', 62, 7);
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 205, 235);
  doc.text('Trade Mark Masonry Ltd.  —  Complete one form per witness', 62, 11.5);

  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 215, 240);
  doc.text('Page 1 of 2', pageW - margin, 8, { align: 'right' });

  let y = 18;

  // ── INCIDENT INFORMATION ────────────────────────────────────────────────
  y = sectionBar('INCIDENT INFORMATION', y);
  const col2 = cW / 2;

  // Row 1: Project Name | Project #
  const projNum = (formData.project || '').match(/(\d{2}TM\d{3})/)?.[1] || '—';
  fieldRow('Project Name', formData.project || '—', margin, y, col2, 12);
  fieldRow('Project #',    projNum,                  margin + col2, y, col2, 12);
  y += 12;

  // Row 2: Incident Location (full width)
  fieldRow('Incident Location', f.incident_location || '—', margin, y, cW, 12);
  y += 12;

  // Row 3: Date & Time | Submitted by
  fieldRow('Date & Time of Incident', f.incident_datetime || formData.date || '—', margin, y, col2, 12);
  fieldRow('Report Submitted by', formData.foremanName || '—', margin + col2, y, col2, 12);
  y += 13;

  // ── PERSON GIVING STATEMENT ─────────────────────────────────────────────
  y = sectionBar('PERSON GIVING STATEMENT', y);

  // Row: Full Name | Phone
  const col3 = cW / 3;
  fieldRow('Full Name', f.stmt_full_name || '—', margin, y, col3 * 2, 12);
  fieldRow('Phone',     f.stmt_phone     || '—', margin + col3 * 2, y, col3, 12);
  y += 12;

  // Row: Address (full width)
  fieldRow('Address', f.stmt_address || '—', margin, y, cW, 10);
  y += 10;

  // Row: Trade | Years Exp | Employer
  fieldRow('Trade / Occupation',   f.stmt_trade      || '—', margin,           y, col3, 10);
  fieldRow('Years of Experience',  f.stmt_years_exp  || '—', margin + col3,    y, col3, 10);
  fieldRow('Employer',             f.stmt_employer   || '—', margin + col3 * 2, y, col3, 10);
  y += 10;

  // Row: Other Experience (full width)
  fieldRow('Other Experience', f.stmt_other_exp || '—', margin, y, cW, 10);
  y += 11;

  // Yes/No rows
  y = yesNoRow('Were you present when the incident occurred?', f.stmt_was_present, margin, y, cW);
  y += 1;
  y = yesNoRow('Did you see it happen?', f.stmt_did_see, margin, y, cW);
  y += 4;

  // ── INCIDENT STATEMENT ──────────────────────────────────────────────────
  y = sectionBar('INCIDENT STATEMENT', y);
  doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(...MGRAY);
  doc.text('In your own words, state what you saw or what you know. Include dates/times and specifics. Answer: Who? What? Where? When? How? Why?', margin + 3, y + 4);
  y += 7;

  // Statement text box — use remaining space on page 1
  const stmtH = Math.min(pageH - y - 36, 80);
  y = textBox('Statement', f.statement || '', margin, y, cW, stmtH);
  y += 2;

  // Disclaimer at bottom of page 1
  drawDisclaimer(pageH - 20);

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2
  // ═══════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPage2Header();
  y = 17;

  // ── CONTINUATION ────────────────────────────────────────────────────────
  y = sectionBar('CONTINUATION OF INCIDENT STATEMENT', y);
  y = textBox('Continuation', f.continuation || '', margin, y, cW, 58);
  y += 4;

  // ── PERSON RECEIVING STATEMENT ──────────────────────────────────────────
  y = sectionBar('PERSON RECEIVING OR TAKING STATEMENT', y);
  const half = cW / 2;
  fieldRow('Date', formData.date || '—', margin, y, half, 10);
  fieldRow('Signature of Person Receiving / Taking Statement', '', margin + half, y, half, 10);
  y += 11;

  // ── WITNESS DECLARATION ─────────────────────────────────────────────────
  y = sectionBar('WITNESS DECLARATION', y);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
  const declText = 'The foregoing statement, which I have given to: ' + (f.taken_by_name || '___________________________________') +
    ' has been written and/or read over by me. I understand the contents of this statement and I declare that it truly and correctly describes the incident witnessed and records the information given by me.';
  const declLines = doc.splitTextToSize(declText, cW - 6);
  doc.setFillColor(...BG);
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.25);
  const declH = declLines.length * 4 + 8;
  doc.rect(margin, y, cW, declH, 'FD');
  doc.text(declLines, margin + 3, y + 5);
  y += declH + 2;

  // Signature + Date side by side
  const sigW = cW * 0.6;
  const dateW = cW - sigW;
  doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.25);
  doc.rect(margin, y, sigW, 22, 'FD');
  doc.rect(margin + sigW, y, dateW, 22, 'FD');
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
  doc.text('SIGNATURE OF WITNESS', margin + 3, y + 5);
  doc.text('DATE', margin + sigW + 3, y + 5);
  doc.setFontSize(8); doc.setTextColor(...DGRAY);
  doc.text(formData.date || '', margin + sigW + 3, y + 15);
  if (formData.signature) {
    try { doc.addImage(formData.signature, 'PNG', margin + 3, y + 5, sigW - 6, 14); } catch(e) {}
  }
  y += 24;

  // ── STATEMENT TAKEN BY ──────────────────────────────────────────────────
  y = sectionBar('STATEMENT TAKEN BY', y);
  const q3 = cW / 3;
  fieldRow('Name',     f.taken_by_name     || '—', margin,           y, q3, 10);
  fieldRow('Position', f.taken_by_position || '—', margin + q3,      y, q3, 10);
  fieldRow('Company',  f.taken_by_company  || '—', margin + q3 * 2,  y, q3, 10);
  y += 10;

  // Signature + Date/Time
  doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.25);
  doc.rect(margin, y, sigW, 20, 'FD');
  doc.rect(margin + sigW, y, dateW, 20, 'FD');
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
  doc.text('SIGNATURE', margin + 3, y + 5);
  doc.text('DATE / TIME', margin + sigW + 3, y + 5);
  doc.setFontSize(8); doc.setTextColor(...DGRAY);
  doc.text(formData.date || '', margin + sigW + 3, y + 13);
  y += 22;

  // ── Photos (if any) ────────────────────────────────────────────────────
  if (photos && photos.length > 0) {
    if (y > pageH - 60) { doc.addPage(); drawPage2Header(); y = 17; }
    y = sectionBar('SITE PHOTOS', y);
    y = await renderPhotosPDF(doc, photos, y + 2, margin, cW, pageH, { NAVY, RED, LGRAY, MGRAY });
  }

  // Disclaimer at bottom of page 2
  drawDisclaimer(pageH - 18);

  return doc.output('arraybuffer');
}

// ── Weekly Timesheet PDF (landscape) ────────────────────────────────────────
async function generateTimesheetPDF(formData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth(); // 279mm
  const pageH = doc.internal.pageSize.getHeight(); // 216mm
  const margin = 12;
  const contentW = pageW - margin * 2;

  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [220, 220, 220];
  const DGRAY = [80, 80, 80];
  const MGRAY = [140, 140, 140];
  const BG    = [248, 248, 248];
  const GREEN = [16, 185, 129];

  let y = drawPDFHeader(doc, pageW, 'Weekly Timesheet', 'Weekly Timesheet');

  // â”€â”€ Info row â”€â”€
  const proj = formData.project || '—';
  const projParts = proj.match(/^(\w+)\s*-\s*(.+?)\s*-\s*(.+)$/);
  const projNum  = projParts ? projParts[1] : proj;
  const projName = projParts ? projParts[3] : '';

  const infoItems = [
    ['PROJECT #', projNum],
    ['PROJECT NAME', projName || proj],
    ['WEEK ENDING', formData.fields.week_ending || '—'],
    ['FOREMAN', formData.foremanName || '—'],
    ['JOB / LOCATION', formData.fields.location || '—']
  ];

  const infoColW = contentW / infoItems.length;
  doc.setFillColor(...BG);
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, 14, 'FD');

  infoItems.forEach(([lbl, val], i) => {
    const x = margin + infoColW * i + 3;
    if (i > 0) { doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2); doc.line(margin + infoColW * i, y, margin + infoColW * i, y + 14); }
    doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
    doc.text(lbl, x, y + 4);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    const valLines = doc.splitTextToSize(String(val), infoColW - 5);
    doc.text(valLines[0], x, y + 10);
  });
  y += 17;

  // â”€â”€ Table header â”€â”€
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const nameW  = 44;
  const dayW   = (contentW - nameW - 28) / 7; // 28mm for totals cols
  const regW   = dayW * 0.5;
  const totRegW = 10; const totOtW = 10; const totTotalW = 8;

  const hdrH = 12;
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, hdrH, 'F');
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);

  // Name header
  doc.text('EMPLOYEE NAME', margin + 2, y + 5);

  // Day headers
  days.forEach((day, i) => {
    const dx = margin + nameW + dayW * i;
    doc.text(day, dx + dayW / 2, y + 4.5, { align: 'center' });
    doc.setFontSize(5.5);
    doc.text('REG', dx + regW * 0.5, y + 9, { align: 'center' });
    doc.text('O/T', dx + regW * 1.5, y + 9, { align: 'center' });
    doc.setFontSize(7);
  });

  // Total headers
  let tx = margin + nameW + dayW * 7;
  doc.setFontSize(6);
  doc.text('WEEK', tx + totRegW / 2, y + 4, { align: 'center' });
  doc.text('REG', tx + totRegW / 2, y + 9, { align: 'center' });
  tx += totRegW;
  doc.text('WEEK', tx + totOtW / 2, y + 4, { align: 'center' });
  doc.text('O/T', tx + totOtW / 2, y + 9, { align: 'center' });
  tx += totOtW;
  doc.text('TOTAL', tx + totTotalW / 2, y + 4.5, { align: 'center' });
  doc.text('HRS', tx + totTotalW / 2, y + 9, { align: 'center' });
  y += hdrH;

  // â”€â”€ Employee rows â”€â”€
  const employees = (formData.fields.timesheet || []).filter(e => e.name);
  const rowH = 8;

  employees.forEach((emp, idx) => {
    // Check page space
    if (y + rowH > pageH - 30) {
      doc.addPage();
      y = margin;
      // Repeat header on new page (simplified)
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
      doc.text('EMPLOYEE NAME', margin + 2, y + 5.5);
      days.forEach((day, i) => {
        const dx = margin + nameW + dayW * i;
        doc.text(day, dx + dayW / 2, y + 5.5, { align: 'center' });
      });
      y += 8;
    }

    // Row background
    doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250);
    doc.rect(margin, y, contentW, rowH, 'F');
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.15);
    doc.rect(margin, y, contentW, rowH, 'S');

    // Row number + name
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
    doc.text(String(idx + 1), margin + 1.5, y + 5.5);
    doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    doc.text(emp.name, margin + 5.5, y + 5.5);

    // Day hours
    let weekReg = 0, weekOT = 0;
    days.forEach((day, i) => {
      const dayKey = day.toLowerCase().replace('mon','mon').replace('tue','tue').replace('wed','wed')
        .replace('thu','thu').replace('fri','fri').replace('sat','sat').replace('sun','sun');
      const actual = {'MON':'mon','TUE':'tue','WED':'wed','THU':'thu','FRI':'fri','SAT':'sat','SUN':'sun'}[day];
      const reg = parseFloat(emp.days?.[actual]?.r || 0);
      const ot  = parseFloat(emp.days?.[actual]?.ot || 0);
      weekReg += reg; weekOT += ot;

      const dx = margin + nameW + dayW * i;
      doc.setLineWidth(0.15); doc.setDrawColor(...LGRAY);
      doc.line(dx, y, dx, y + rowH);
      doc.line(dx + regW, y, dx + regW, y + rowH);

      doc.setFontSize(8); doc.setFont('helvetica','normal');
      if (reg > 0) { doc.setTextColor(...DGRAY); doc.text(String(reg % 1 === 0 ? reg : reg.toFixed(1)), dx + regW * 0.5, y + 5.5, { align: 'center' }); }
      else { doc.setTextColor(...LGRAY); doc.text('—', dx + regW * 0.5, y + 5.5, { align: 'center' }); }

      if (ot > 0) { doc.setTextColor([196,30,58]); doc.text(String(ot % 1 === 0 ? ot : ot.toFixed(1)), dx + regW * 1.5, y + 5.5, { align: 'center' }); }
      else { doc.setTextColor(...LGRAY); doc.text('—', dx + regW * 1.5, y + 5.5, { align: 'center' }); }
    });

    // Totals
    const weekTotal = weekReg + weekOT;
    tx = margin + nameW + dayW * 7;
    doc.setFillColor(240, 245, 255); doc.rect(tx, y, totRegW, rowH, 'F');
    doc.setTextColor(...NAVY); doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.text(weekReg % 1 === 0 ? String(weekReg) : weekReg.toFixed(1), tx + totRegW / 2, y + 5.5, { align: 'center' });
    tx += totRegW;
    doc.setFillColor(255, 245, 245); doc.rect(tx, y, totOtW, rowH, 'F');
    doc.setTextColor(...RED);
    doc.text(weekOT % 1 === 0 ? String(weekOT) : weekOT.toFixed(1), tx + totOtW / 2, y + 5.5, { align: 'center' });
    tx += totOtW;
    doc.setFillColor(240, 255, 248); doc.rect(tx, y, totTotalW, rowH, 'F');
    doc.setTextColor(...GREEN);
    doc.text(weekTotal % 1 === 0 ? String(weekTotal) : weekTotal.toFixed(1), tx + totTotalW / 2, y + 5.5, { align: 'center' });

    y += rowH;
  });

  // â”€â”€ Grand totals row â”€â”€
  if (employees.length > 0) {
    let grandReg = 0, grandOT = 0;
    employees.forEach(emp => {
      TS_DAYS_PDF.forEach(d => {
        grandReg += parseFloat(emp.days?.[d]?.r || 0);
        grandOT  += parseFloat(emp.days?.[d]?.ot || 0);
      });
    });
    const grandTotal = grandReg + grandOT;

    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text('TOTALS', margin + 2, y + 5.5);

    tx = margin + nameW + dayW * 7;
    doc.text(grandReg % 1 === 0 ? String(grandReg) : grandReg.toFixed(1), tx + totRegW / 2, y + 5.5, { align: 'center' });
    tx += totRegW;
    doc.text(grandOT % 1 === 0 ? String(grandOT) : grandOT.toFixed(1), tx + totOtW / 2, y + 5.5, { align: 'center' });
    tx += totOtW;
    doc.text((grandReg + grandOT) % 1 === 0 ? String(grandReg + grandOT) : (grandReg + grandOT).toFixed(1), tx + totTotalW / 2, y + 5.5, { align: 'center' });
    y += 12;
  }

  // â”€â”€ Legend â”€â”€
  doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
  doc.text('REG = Regular hours     O/T = Overtime hours     TOTAL HRS = REG + O/T combined', margin, y + 4);
  y += 10;

  // â”€â”€ Sign-off â”€â”€
  if (y + 28 > pageH - 14) { doc.addPage(); y = margin; }
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text('FOREMAN SIGN-OFF', margin + 3, y + 5);
  y += 9;

  const nameVal = formData.fields.supervisor_name || formData.foremanName || '';
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
  doc.text('Printed Name: ' + nameVal, margin + 2, y + 4);
  doc.text('Date: ' + (formData.fields.week_ending || formData.date || '—'), margin + contentW / 2, y + 4);
  y += 10;

  // Signature image
  const sigW = 70; const sigH = 22;
  doc.setFillColor(255,255,255); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
  doc.rect(margin, y, sigW, sigH, 'FD');
  if (formData.signature && formData.signature.startsWith('data:image')) {
    try { doc.addImage(formData.signature, 'PNG', margin + 2, y + 2, sigW - 4, sigH - 4); } catch(e) {}
  }
  doc.setFontSize(6.5); doc.setTextColor(...MGRAY);
  doc.text('Foreman Signature', margin, y + sigH + 4);

  // â”€â”€ Footer â”€â”€
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, pageH - 8, pageW, 8, 'F');
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
    const ts = new Date().toLocaleString('en-CA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    doc.text(`Weekly Timesheet — ${formData.project}`, margin, pageH - 3);
    doc.text(`Page ${i} of ${pages}  |  ${ts}`, pageW - margin, pageH - 3, { align: 'right' });
  }

  return doc.output('arraybuffer');
}

const TS_DAYS_PDF   = ['mon','tue','wed','thu','fri','sat','sun'];
const PROD_DAYS_PDF = ['mon','tue','wed','thu','fri','sat','sun'];
const PROD_DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const BLOCK_TYPES_PDF = ['8"','4"','6"','10"','12"'];

async function generateProductionPDF(formData, photos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;

  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [220, 220, 220];
  const DGRAY = [80, 80, 80];
  const MGRAY = [140, 140, 140];
  const BG    = [248, 248, 248];
  const GREEN = [16, 185, 129];

  let y = drawPDFHeader(doc, pageW, 'Production Report', 'CMU Block Wall — Weekly Production Report');

  // â”€â”€ Info bar â”€â”€
  const proj = formData.project || '—';
  const projParts = proj.match(/^(\w+)\s*-\s*(.+?)\s*-\s*(.+)$/);
  const projNum  = projParts ? projParts[1] : proj;
  const projName = projParts ? projParts[3] : proj;

  const infoItems = [
    ['PROJECT #', projNum],
    ['PROJECT NAME', projName],
    ['WEEK OF', formData.fields.week_of || '—'],
    ['FOREMAN', formData.foremanName || '—'],
    ['GC', formData.fields.gc || '—'],
    ['LOCATION / AREA', formData.fields.location || '—']
  ];
  const infoColW = contentW / infoItems.length;
  doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, 14, 'FD');
  infoItems.forEach(([lbl, val], i) => {
    const x = margin + infoColW * i + 3;
    if (i > 0) { doc.line(margin + infoColW * i, y, margin + infoColW * i, y + 14); }
    doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
    doc.text(lbl, x, y + 4);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    doc.text(doc.splitTextToSize(String(val), infoColW - 5)[0], x, y + 10);
  });
  y += 17;

  // â”€â”€ Block Placement Table â”€â”€
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text('BLOCK PLACEMENT — Enter number of blocks placed per type per day', margin + 3, y + 5);
  y += 7;

  // Column widths
  const typeW   = 28;
  const dayW    = (contentW - typeW - 22) / 7;
  const wkTotW  = 14; const notesW = 8;

  // Sub-header
  const subHdrH = 9;
  doc.setFillColor(240, 243, 250);
  doc.rect(margin, y, contentW, subHdrH, 'F');
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, subHdrH, 'S');
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
  doc.text('BLOCK TYPE', margin + 2, y + 6);

  PROD_DAY_LABELS.forEach((day, i) => {
    const dx = margin + typeW + dayW * i;
    doc.text(day, dx + dayW / 2, y + 6, { align: 'center' });
    if (i > 0) { doc.setDrawColor(...LGRAY); doc.line(dx, y, dx, y + subHdrH); }
  });
  const totX = margin + typeW + dayW * 7;
  doc.line(totX, y, totX, y + subHdrH);
  doc.text('WEEK\nTOTAL', totX + wkTotW / 2, y + 4, { align: 'center' });
  y += subHdrH;

  // Block rows
  const prod = formData.fields.production || {};
  const blocks = prod.blocks || {};
  const rowH = 8;

  let dailyTotals = { mon:0, tue:0, wed:0, thu:0, fri:0, sat:0, sun:0 };
  let grandTotal  = 0;

  BLOCK_TYPES_PDF.forEach((type, bIdx) => {
    const dayData = blocks[type] || {};
    let weekTotal = 0;
    PROD_DAYS_PDF.forEach(d => { weekTotal += parseInt(dayData[d] || 0); });
    grandTotal += weekTotal;

    doc.setFillColor(bIdx % 2 === 0 ? 255 : 250, bIdx % 2 === 0 ? 255 : 250, bIdx % 2 === 0 ? 255 : 250);
    doc.rect(margin, y, contentW, rowH, 'F');
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.15);
    doc.rect(margin, y, contentW, rowH, 'S');

    doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    doc.text(type + ' Block', margin + 2, y + 5.5);

    PROD_DAYS_PDF.forEach((d, i) => {
      const val = parseInt(dayData[d] || 0);
      dailyTotals[d] += val;
      const dx = margin + typeW + dayW * i;
      doc.setDrawColor(...LGRAY); doc.line(dx, y, dx, y + rowH);
      doc.setFont('helvetica', val > 0 ? 'bold' : 'normal');
      doc.setTextColor(val > 0 ? NAVY[0] : LGRAY[0], val > 0 ? NAVY[1] : LGRAY[1], val > 0 ? NAVY[2] : LGRAY[2]);
      doc.setFontSize(val > 0 ? 9 : 7);
      doc.text(val > 0 ? String(val) : '—', dx + dayW / 2, y + 5.5, { align: 'center' });
    });

    const totX = margin + typeW + dayW * 7;
    doc.line(totX, y, totX, y + rowH);
    doc.setFillColor(...(weekTotal > 0 ? [240,245,255] : [255,255,255]));
    doc.rect(totX, y, wkTotW, rowH, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica','bold');
    doc.setTextColor(...(weekTotal > 0 ? NAVY : LGRAY));
    doc.text(weekTotal > 0 ? String(weekTotal) : '—', totX + wkTotW / 2, y + 5.5, { align: 'center' });

    y += rowH;
  });

  // Daily total row
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text('DAILY TOTAL', margin + 2, y + 5.5);
  PROD_DAYS_PDF.forEach((d, i) => {
    const dx = margin + typeW + dayW * i;
    doc.text(dailyTotals[d] > 0 ? String(dailyTotals[d]) : '—', dx + dayW / 2, y + 5.5, { align: 'center' });
  });
  const totX2 = margin + typeW + dayW * 7;
  doc.text(grandTotal > 0 ? String(grandTotal) : '—', totX2 + wkTotW / 2, y + 5.5, { align: 'center' });
  y += 12;

  // â”€â”€ Crew Table â”€â”€
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text('CREW — Number of workers on site each day', margin + 3, y + 5);
  y += 7;

  const crew = prod.crew || {};
  [['masons','Masons on Site'],['laborers','Laborers on Site']].forEach(([key, label], ci) => {
    const dayData = crew[key] || {};
    doc.setFillColor(ci === 0 ? 255 : 250, ci === 0 ? 255 : 250, ci === 0 ? 255 : 250);
    doc.rect(margin, y, contentW, rowH, 'F');
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.15);
    doc.rect(margin, y, contentW, rowH, 'S');
    doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    doc.text(label, margin + 2, y + 5.5);
    PROD_DAYS_PDF.forEach((d, i) => {
      const val = parseInt(dayData[d] || 0);
      const dx = margin + typeW + dayW * i;
      doc.setDrawColor(...LGRAY); doc.line(dx, y, dx, y + rowH);
      doc.setFontSize(val > 0 ? 9 : 7); doc.setFont('helvetica', val > 0 ? 'bold' : 'normal');
      doc.setTextColor(val > 0 ? DGRAY[0] : LGRAY[0], val > 0 ? DGRAY[1] : LGRAY[1], val > 0 ? DGRAY[2] : LGRAY[2]);
      doc.text(val > 0 ? String(val) : '—', dx + dayW / 2, y + 5.5, { align: 'center' });
    });
    y += rowH;
  });
  y += 6;

  // â”€â”€ Delays / Issues â”€â”€
  if (formData.fields.delays) {
    if (y > pageH - 40) { doc.addPage(); y = margin; }
    doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...RED);
    doc.text('DELAYS / ISSUES', margin, y + 4);
    y += 7;
    const lines = doc.splitTextToSize(formData.fields.delays, contentW - 4);
    const blockH = lines.length * 5 + 4;
    doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, blockH, 'FD');
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
    doc.text(lines, margin + 3, y + 5);
    y += blockH + 6;
  }

  // â”€â”€ Foreman Sign-off â”€â”€
  if (y + 30 > pageH - 12) { doc.addPage(); y = margin; }
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text('FOREMAN SIGN-OFF', margin + 3, y + 5);
  y += 9;
  const nameVal = formData.fields.supervisor_name || formData.foremanName || '';
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
  doc.text('Printed Name: ' + nameVal, margin + 2, y + 4);
  doc.text('Date: ' + (formData.fields.week_of || formData.date || '—'), margin + contentW / 2, y + 4);
  y += 10;
  const sigW = 70; const sigH = 22;
  doc.setFillColor(255,255,255); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
  doc.rect(margin, y, sigW, sigH, 'FD');
  if (formData.signature && formData.signature.startsWith('data:image')) {
    try { doc.addImage(formData.signature, 'PNG', margin + 2, y + 2, sigW - 4, sigH - 4); } catch(e) {}
  }
  doc.setFontSize(6.5); doc.setTextColor(...MGRAY);
  doc.text('Foreman Signature', margin, y + sigH + 4);

  // â”€â”€ Photos â”€â”€
  if (photos && photos.length > 0) {
    doc.addPage(); let py = margin;
    doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...RED);
    doc.text('ATTACHED PHOTOS', margin, py + 4);
    py += 10;
    const photoW = (contentW - 8) / 3; const photoH = photoW * 0.65;
    let col = 0;
    for (let i = 0; i < Math.min(photos.length, 9); i++) {
      if (col === 3) { col = 0; py += photoH + 6; }
      const px = margin + col * (photoW + 4);
      try { const imgData = await fileToDataURL(photos[i]); doc.addImage(imgData, 'JPEG', px, py, photoW, photoH, undefined, 'FAST'); } catch(e) {}
      col++;
    }
  }

  // Footer
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY); doc.rect(0, pageH - 8, pageW, 8, 'F');
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
    const ts = new Date().toLocaleString('en-CA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    doc.text(`Production Report — ${formData.project}`, margin, pageH - 3);
    doc.text(`Page ${i} of ${pages}  |  ${ts}`, pageW - margin, pageH - 3, { align: 'right' });
  }

  return doc.output('arraybuffer');
}

// â”€â”€ Inspection PDF (portrait) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateInspectionPDF(formData, photos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [220, 220, 220];
  const DGRAY = [80, 80, 80];
  const MGRAY = [140, 140, 140];
  const BG    = [248, 248, 248];
  const GREEN = [16, 185, 129];
  const REDCL = [239, 68, 68];

  const config = INSPECTION_CONFIGS[formData.submissionType];

  // â”€â”€ Header â”€â”€
  // header drawn above
  let y = drawPDFHeader(doc, pageW, formData.submissionType, config.subtitle);

  // â”€â”€ Info bar â”€â”€
  const infoFields = [['PROJECT', formData.project || '—'], ['FOREMAN', formData.foremanName || '—'], ['WEEK STARTING', formData.fields.week_starting || '—']];
  // Type-specific extra info
  if (formData.submissionType === 'E-Pallet Jack Inspection') {
    infoFields.push(['MACHINE / UNIT #', formData.fields.machine_unit || '—']);
  } else if (formData.submissionType === 'Forklift Inspection') {
    infoFields.push(['MACHINE / UNIT #', formData.fields.machine_unit || '—']);
    infoFields.push(['OPERATOR', formData.fields.operator || '—']);
  } else if (formData.submissionType === 'Scaffolding Inspection') {
    infoFields.push(['SCAFFOLD LOCATION', formData.fields.scaffold_location || '—']);
    infoFields.push(['INSPECTOR', formData.fields.inspector || '—']);
  }

  const iColW = contentW / infoFields.length;
  doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, 16, 'FD');
  infoFields.forEach(([lbl, val], i) => {
    const x = margin + iColW * i + 3;
    if (i > 0) doc.line(margin + iColW * i, y, margin + iColW * i, y + 16);
    doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
    doc.text(lbl, x, y + 5);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    doc.text(doc.splitTextToSize(String(val), iColW - 6)[0], x, y + 12);
  });
  y += 19;

  // â”€â”€ WorkSafeBC notice â”€â”€
  doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...MGRAY);
  doc.text(config.notice, margin, y + 3);
  y += 8;

  // Legend
  doc.setFontSize(7); doc.setFont('helvetica','bold');
  doc.setFillColor(...GREEN);  doc.circle(margin + 2,    y + 2.5, 1.5, 'F'); doc.setTextColor(...DGRAY); doc.text('= OK',                 margin + 5,    y + 3.5);
  doc.setFillColor(...REDCL);  doc.circle(margin + 22,   y + 2.5, 1.5, 'F'); doc.setTextColor(...REDCL); doc.text('= Correction needed', margin + 25,   y + 3.5);
  doc.setFillColor(200,200,200); doc.circle(margin + 72, y + 2.5, 1.5, 'FD'); doc.setTextColor(...MGRAY); doc.text('= Not inspected',    margin + 75,   y + 3.5);
  y += 8;

  // Column layout: item text | 6 day columns
  const dayColW = 9.5;
  const itemColW = contentW - dayColW * 6;

  // â”€â”€ Checklist sections â”€â”€
  const checklist = formData.fields.checklist || {};

  const checkNewPage = (needed) => {
    if (y + needed > pageH - 18) {
      doc.addPage();
      y = margin;
      // Compact header on continuation pages
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 10, 'F');
      doc.setFillColor(...RED);
      doc.rect(0, 0, 4, 10, 'F');
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
      doc.text(`TRADEMARK MASONRY — ${formData.submissionType.toUpperCase()} — ${formData.project}`, 8, 6.5);
      y = 15;
    }
  };

  Object.entries(config.sections).forEach(([secName, items]) => {
    checkNewPage(10 + items.length * 8);

    // Section header bar
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text(secName.toUpperCase(), margin + 3, y + 5.5);

    // Day labels in header
    INSP_DAYS.forEach((d, i) => {
      const dx = margin + itemColW + dayColW * i;
      doc.setFontSize(6.5);
      doc.text(d, dx + dayColW / 2, y + 5.5, { align: 'center' });
    });
    y += 8;

    const secData = checklist[secName] || {};

    items.forEach((item, idx) => {
      const rowH = 7.5;
      // Alternating row background
      doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250);
      doc.rect(margin, y, contentW, rowH, 'F');
      doc.setDrawColor(...LGRAY); doc.setLineWidth(0.15);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);

      // Item text
      doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
      const itemLines = doc.splitTextToSize(item, itemColW - 4);
      const lineH = 4;
      doc.text(itemLines, margin + 3, y + 4.5);

      // Day cells
      const dayStates = secData[item] || new Array(6).fill(null);
      INSP_DAYS.forEach((_, di) => {
        const dx = margin + itemColW + dayColW * di;
        const val = dayStates[di];
        // Cell border
        doc.setDrawColor(...LGRAY); doc.setLineWidth(0.15);
        doc.line(dx, y, dx, y + rowH);

        const cx = dx + dayColW / 2;
        const cy = y + rowH / 2;
        const r = 2.8;

        if (val === 'ok') {
          doc.setFillColor(...GREEN);
          doc.circle(cx, cy, r, 'F');
          // White checkmark lines
          doc.setDrawColor(255,255,255); doc.setLineWidth(0.7);
          doc.line(cx - 1.2, cy, cx - 0.3, cy + 1);
          doc.line(cx - 0.3, cy + 1, cx + 1.3, cy - 1);
        } else if (val === 'x') {
          doc.setFillColor(...REDCL);
          doc.circle(cx, cy, r, 'F');
          // White X lines
          doc.setDrawColor(255,255,255); doc.setLineWidth(0.7);
          doc.line(cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.2);
          doc.line(cx + 1.2, cy - 1.2, cx - 1.2, cy + 1.2);
        } else {
          doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
          doc.setFillColor(245,245,245);
          doc.circle(cx, cy, r, 'FD');
        }
        doc.setLineWidth(0.15);
      });

      y += rowH;
    });

    y += 4; // gap between sections
  });

  y += 4;

  // â”€â”€ Scaffold tag status (scaffold only) â”€â”€
  if (formData.submissionType === 'Scaffolding Inspection' && formData.fields.tag_status) {
    checkNewPage(28);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text('SCAFFOLD TAG STATUS', margin + 3, y + 5);
    y += 9;

    const tagColors = {
      'GREEN': [22,163,74],
      'YELLOW': [202,138,4],
      'RED': [220,38,38]
    };
    const tagKey = Object.keys(tagColors).find(k => (formData.fields.tag_status || '').includes(k)) || '';
    const tagColor = tagColors[tagKey] || LGRAY;
    doc.setFillColor(...tagColor);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text(formData.fields.tag_status, margin + contentW / 2, y + 6.5, { align: 'center' });
    y += 14;
  }

  // â”€â”€ Final determination â”€â”€
  if (formData.fields.final_determination) {
    checkNewPage(20);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text('FINAL DETERMINATION', margin + 3, y + 5);
    y += 9;

    const isSafe = formData.fields.final_determination.includes('SAFE');
    doc.setFillColor(...(isSafe ? [240,255,248] : [255,240,240]));
    doc.setDrawColor(...(isSafe ? GREEN : REDCL));
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'FD');
    doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.setTextColor(...(isSafe ? GREEN : REDCL));
    doc.text(formData.fields.final_determination, margin + contentW / 2, y + 6.5, { align: 'center' });
    y += 14;
  }

  // â”€â”€ Additional comments â”€â”€
  const commentsVal = formData.fields.add_comments || formData.fields.comments;
  if (commentsVal) {
    checkNewPage(20);
    doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...RED);
    doc.text('COMMENTS / CORRECTIVE ACTIONS', margin, y + 4);
    y += 7;
    const lines = doc.splitTextToSize(commentsVal, contentW - 4);
    const blockH = lines.length * 5 + 4;
    doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, blockH, 'FD');
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
    doc.text(lines, margin + 3, y + 5);
    y += blockH + 5;
  }

  // â”€â”€ Footer notice â”€â”€
  checkNewPage(16);
  doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...REDCL);
  const noteLines = doc.splitTextToSize('** ' + config.footerNote + ' **', contentW);
  doc.text(noteLines, margin, y + 4);
  y += noteLines.length * 5 + 6;

  // â”€â”€ Sign-off â”€â”€
  checkNewPage(38);
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text(config.signOffLabel.toUpperCase(), margin + 3, y + 5);
  y += 9;

  const nameVal = formData.fields.supervisor_name || formData.foremanName || '';
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
  doc.text('Printed Name: ' + nameVal, margin + 2, y + 4);
  doc.text('Date: ' + (formData.fields.week_starting || formData.date || '—'), margin + contentW * 0.55, y + 4);
  y += 10;

  const sigW = Math.min(contentW * 0.5, 80); const sigH = sigW * 0.4;
  doc.setFillColor(255,255,255); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
  doc.rect(margin, y, sigW, sigH, 'FD');
  if (formData.signature && formData.signature.startsWith('data:image')) {
    try { doc.addImage(formData.signature, 'PNG', margin + 2, y + 2, sigW - 4, sigH - 4); } catch(e) {}
  }
  doc.setFontSize(6.5); doc.setTextColor(...MGRAY);
  doc.text('Signature', margin, y + sigH + 4);
  y += sigH + 10;

  // â”€â”€ Photos â”€â”€
  if (photos && photos.length > 0) {
    if (y > pageH - 80) { doc.addPage(); y = margin; }
    y = await renderPhotosPDF(doc, photos, y, margin, contentW, pageH, { NAVY, RED, LGRAY, MGRAY });
  }

  // â”€â”€ Page footers â”€â”€
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
    const ts = new Date().toLocaleString('en-CA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    doc.text(`${formData.submissionType} — ${formData.project}`, margin, pageH - 4);
    doc.text(`Page ${i} of ${pages}  |  ${ts}`, pageW - margin, pageH - 4, { align: 'right' });
  }

  return doc.output('arraybuffer');
}

// â”€â”€ Daily Inspection PDF (Telehandler / Forklift — portrait, single check) â”€â”€â”€â”€
async function generateDailyInspectionPDF(formData, photos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [220, 220, 220];
  const DGRAY = [80, 80, 80];
  const MGRAY = [140, 140, 140];
  const BG    = [248, 248, 248];
  const GREEN = [16, 185, 129];
  const REDCL = [239, 68, 68];

  const config = INSPECTION_CONFIGS[formData.submissionType];

  // â”€â”€ Header â”€â”€
  // header drawn above
  let y = drawPDFHeader(doc, pageW, formData.submissionType, config.subtitle);

  // â”€â”€ Info bar (type-aware) â”€â”€
  const infoFields = [
    ['PROJECT', formData.project || '—'],
    ['FOREMAN', formData.foremanName || '—'],
    ['DATE',    formData.date || '—']
  ];
  if (formData.submissionType === 'Scaffolding Inspection') {
    infoFields.push(['SCAFFOLD LOCATION', formData.fields.scaffold_location || '—']);
    infoFields.push(['INSPECTOR',         formData.fields.inspector        || '—']);
  } else {
    infoFields.push(['MACHINE / UNIT #',  formData.fields.machine_unit || '—']);
    infoFields.push(['OPERATOR',          formData.fields.operator     || '—']);
  }
  const iColW = contentW / infoFields.length;
  doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, 16, 'FD');
  infoFields.forEach(([lbl, val], i) => {
    const x = margin + iColW * i + 3;
    if (i > 0) { doc.setDrawColor(...LGRAY); doc.line(margin + iColW * i, y, margin + iColW * i, y + 16); }
    doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
    doc.text(lbl, x, y + 5);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    doc.text(doc.splitTextToSize(String(val), iColW - 6)[0], x, y + 12);
  });
  y += 19;

  // â”€â”€ WorkSafeBC notice â”€â”€
  doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...MGRAY);
  doc.text(config.notice, margin, y + 3);
  y += 8;

  // Legend
  doc.setFontSize(7.5); doc.setFont('helvetica','bold');
  doc.setFillColor(...GREEN);    doc.circle(margin + 2,  y + 2.5, 1.5, 'F');  doc.setTextColor(...DGRAY); doc.text('= OK',                 margin + 5,  y + 3.5);
  doc.setFillColor(...REDCL);    doc.circle(margin + 22, y + 2.5, 1.5, 'F');  doc.setTextColor(...REDCL); doc.text('= Correction needed', margin + 25, y + 3.5);
  doc.setFillColor(200,200,200); doc.circle(margin + 75, y + 2.5, 1.5, 'FD'); doc.setTextColor(...MGRAY); doc.text('= Not inspected',    margin + 78, y + 3.5);
  y += 8;

  // Single check column width
  const checkColW = 14;
  const itemColW  = contentW - checkColW;

  const checkNewPage = (needed) => {
    if (y + needed > pageH - 18) {
      doc.addPage();
      y = margin;
      y = drawContinuationHeader(doc, pageW, `TRADEMARK MASONRY - ${formData.submissionType.toUpperCase()} - ${formData.project}`);
    }
  };

  // â”€â”€ Checklist sections â”€â”€
  const checklist = formData.fields.checklist || {};

  Object.entries(config.sections).forEach(([secName, items]) => {
    checkNewPage(10 + items.length * 9);

    // Section header bar
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text(secName.toUpperCase(), margin + 3, y + 5.5);
    // Check column label
    doc.setFontSize(6.5);
    doc.text('CHECK', margin + itemColW + checkColW / 2, y + 5.5, { align: 'center' });
    y += 8;

    const secData = checklist[secName] || {};

    items.forEach((item, idx) => {
      const rowH = 9;
      // Alternating row bg
      doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250);
      doc.rect(margin, y, contentW, rowH, 'F');
      doc.setDrawColor(...LGRAY); doc.setLineWidth(0.15);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);

      // Item text
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
      const itemLines = doc.splitTextToSize(item, itemColW - 5);
      doc.text(itemLines, margin + 3, y + 5.5);

      // Separator line before check column
      doc.setDrawColor(...LGRAY); doc.setLineWidth(0.15);
      doc.line(margin + itemColW, y, margin + itemColW, y + rowH);

      // Draw circle indicator
      const val = secData[item]; // null | 'ok' | 'x'
      const cx = margin + itemColW + checkColW / 2;
      const cy = y + rowH / 2;
      const r  = 3.5;

      if (val === 'ok') {
        doc.setFillColor(...GREEN);
        doc.circle(cx, cy, r, 'F');
        doc.setDrawColor(255,255,255); doc.setLineWidth(0.8);
        doc.line(cx - 1.6, cy, cx - 0.4, cy + 1.3);
        doc.line(cx - 0.4, cy + 1.3, cx + 1.7, cy - 1.3);
      } else if (val === 'x') {
        doc.setFillColor(...REDCL);
        doc.circle(cx, cy, r, 'F');
        doc.setDrawColor(255,255,255); doc.setLineWidth(0.8);
        doc.line(cx - 1.5, cy - 1.5, cx + 1.5, cy + 1.5);
        doc.line(cx + 1.5, cy - 1.5, cx - 1.5, cy + 1.5);
      } else {
        doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
        doc.setFillColor(245,245,245);
        doc.circle(cx, cy, r, 'FD');
      }
      doc.setLineWidth(0.15);

      y += rowH;
    });

    y += 5;
  });

  y += 4;

  // â”€â”€ Scaffold Tag Status (scaffolding only) â”€â”€
  if (formData.submissionType === 'Scaffolding Inspection' && formData.fields.tag_status) {
    checkNewPage(26);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text('SCAFFOLD TAG STATUS', margin + 3, y + 5);
    y += 9;

    const tagRaw = formData.fields.tag_status || '';
    const tagColors = { 'GREEN': [22,163,74], 'YELLOW': [202,138,4], 'RED': [220,38,38] };
    const tagKey   = Object.keys(tagColors).find(k => tagRaw.toUpperCase().includes(k)) || '';
    const tagColor = tagColors[tagKey] || LGRAY;
    // Strip emoji for clean PDF text
    const tagText  = tagRaw.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[ðŸŸ¢ðŸŸ¡ðŸ”´]/g, '').trim();
    doc.setFillColor(...tagColor);
    doc.roundedRect(margin, y, contentW, 11, 2, 2, 'F');
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text(tagText, margin + contentW / 2, y + 7, { align: 'center' });
    y += 15;
  }

  // â”€â”€ Final Determination â”€â”€
  if (formData.fields.final_determination) {
    checkNewPage(22);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text('FINAL DETERMINATION', margin + 3, y + 5);
    y += 9;

    const isSafe = formData.fields.final_determination.includes('SAFE');
    doc.setFillColor(...(isSafe ? [240,255,248] : [255,240,240]));
    doc.setDrawColor(...(isSafe ? GREEN : REDCL));
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'FD');
    doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.setTextColor(...(isSafe ? GREEN : REDCL));
    doc.text(formData.fields.final_determination, margin + contentW / 2, y + 6.5, { align: 'center' });
    y += 14;
  }

  // â”€â”€ Additional Comments â”€â”€
  if (formData.fields.add_comments) {
    checkNewPage(22);
    doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...RED);
    doc.text('COMMENTS / CORRECTIVE ACTIONS', margin, y + 4);
    y += 7;
    const lines = doc.splitTextToSize(formData.fields.add_comments, contentW - 4);
    const blockH = lines.length * 5 + 6;
    doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, blockH, 'FD');
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
    doc.text(lines, margin + 3, y + 5);
    y += blockH + 5;
  }

  // â”€â”€ Footer note â”€â”€
  checkNewPage(16);
  doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...REDCL);
  const noteLines = doc.splitTextToSize('** ' + config.footerNote + ' **', contentW);
  doc.text(noteLines, margin, y + 4);
  y += noteLines.length * 5 + 6;

  // â”€â”€ Sign-off â”€â”€
  checkNewPage(40);
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text(config.signOffLabel.toUpperCase(), margin + 3, y + 5);
  y += 9;

  const nameVal = formData.fields.supervisor_name || formData.foremanName || '';
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
  doc.text('Printed Name: ' + nameVal, margin + 2, y + 5);
  doc.text('Date: ' + (formData.date || '—'), margin + contentW * 0.55, y + 5);
  y += 12;

  const sigW = Math.min(contentW * 0.5, 80); const sigH = sigW * 0.4;
  doc.setFillColor(255,255,255); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
  doc.rect(margin, y, sigW, sigH, 'FD');
  if (formData.signature && formData.signature.startsWith('data:image')) {
    try { doc.addImage(formData.signature, 'PNG', margin + 2, y + 2, sigW - 4, sigH - 4); } catch(e) {}
  }
  doc.setFontSize(6.5); doc.setTextColor(...MGRAY);
  doc.text('Signature', margin, y + sigH + 4);
  y += sigH + 10;

  // â”€â”€ Photos â”€â”€
  if (photos && photos.length > 0) {
    if (y > pageH - 80) { doc.addPage(); y = margin; }
    y = await renderPhotosPDF(doc, photos, y, margin, contentW, pageH, { NAVY, RED, LGRAY, MGRAY });
  }

  // â”€â”€ Page footers â”€â”€
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
    const ts = new Date().toLocaleString('en-CA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    doc.text(`${formData.submissionType} — ${formData.project}`, margin, pageH - 4);
    doc.text(`Page ${i} of ${pages}  |  ${ts}`, pageW - margin, pageH - 4, { align: 'right' });
  }

  return doc.output('arraybuffer');
}

// â”€â”€ QAQC PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateQAQCPDF(formData, photos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;

  const NAVY  = [0, 32, 91];
  const RED   = [138, 42, 43];
  const WHITE = [255, 255, 255];
  const LGRAY = [220, 220, 220];
  const DGRAY = [60, 60, 60];
  const MGRAY = [130, 130, 130];
  const BG    = [248, 248, 248];
  const GREEN = [22, 163, 74];
  const AMBER = [202, 138, 4];
  const REDCL = [220, 38, 38];

  const f = formData.fields;

  // ── Header ──
  let y = drawPDFHeader(doc, pageW, 'QAQC — Foreman', 'CMU Block Wall — QAQC Sign-Off Form');

  // â”€â”€ Project info grid (2 columns) â”€â”€
  const infoLeft = [
    ['PROJECT', formData.project || '—'],
    ['PROJECT #', f.project_number || '—'],
    ['DATE', formData.date || '—'],
    ['GENERAL CONTRACTOR', f.gc || '—']
  ];
  const infoRight = [
    ['FOREMAN', formData.foremanName || '—'],
    ['LOCATION / AREA', f.location_area || '—'],
    ['FLOOR / ROOM', f.floor_room || '—'],
    ['DRAWING REF #', f.drawing_ref || '—']
  ];

  const colW = contentW / 2 - 2;
  const rowH = 10;

  doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, rowH * infoLeft.length, 'FD');

  infoLeft.forEach(([lbl, val], i) => {
    const ry = y + rowH * i;
    if (i > 0) { doc.setDrawColor(...LGRAY); doc.line(margin, ry, margin + contentW, ry); }
    // Left cell
    doc.setFontSize(5); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
    doc.text(lbl, margin + 3, ry + 3.5);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    doc.text(doc.splitTextToSize(String(val), colW - 6)[0], margin + 3, ry + 8);
    // Divider
    doc.setDrawColor(...LGRAY); doc.line(margin + colW + 2, ry, margin + colW + 2, ry + rowH);
    // Right cell
    const [rlbl, rval] = infoRight[i];
    doc.setFontSize(5); doc.setFont('helvetica','normal'); doc.setTextColor(...MGRAY);
    doc.text(rlbl, margin + colW + 5, ry + 3.5);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...DGRAY);
    doc.text(doc.splitTextToSize(String(rval), colW - 6)[0], margin + colW + 5, ry + 8);
  });
  y += rowH * infoLeft.length + 3;

  // Work description
  if (f.work_description) {
    doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(...MGRAY);
    doc.text('WORK DESCRIPTION', margin, y + 3.5);
    y += 5;
    const wdLines = doc.splitTextToSize(f.work_description, contentW - 6);
    const wdH = wdLines.length * 4.5 + 5;
    doc.setFillColor(...BG); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, wdH, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
    doc.text(wdLines, margin + 3, y + 5);
    y += wdH + 3;
  }

  y += 2;

  // â”€â”€ Note â”€â”€
  doc.setFontSize(6.5); doc.setFont('helvetica','italic'); doc.setTextColor(...MGRAY);
  doc.text('NOTE: Inspect each item during walkthrough. Mark PASS, FAIL, or N/A. Use Comments for deficiency notes.', margin, y + 3);
  y += 7;

  // â”€â”€ Checklist table â”€â”€
  // Column widths: # | INSPECTION ITEM | PASS | FAIL | N/A | COMMENTS
  const numW   = 7;
  const passW  = 13;
  const failW  = 13;
  const naW    = 13;
  const commW  = 38;
  const itemW  = contentW - numW - passW - failW - naW - commW;

  const checkNewPage = (needed) => {
    if (y + needed > pageH - 16) {
      doc.addPage();
      y = margin;
      doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 9, 'F');
      doc.setFillColor(...RED);  doc.rect(0, 0, 4, 9, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
      doc.text(`TRADEMARK MASONRY — QAQC FOREMAN — ${formData.project}`, 8, 6);
      y = 14;
    }
  };

  // Table header
  checkNewPage(12);
  doc.setFillColor(...NAVY); doc.rect(margin, y, contentW, 8, 'F');
  doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  const hdrCols = [
    [margin + numW / 2, '#'],
    [margin + numW + itemW / 2, 'INSPECTION ITEM'],
    [margin + numW + itemW + passW / 2, 'PASS'],
    [margin + numW + itemW + passW + failW / 2, 'FAIL'],
    [margin + numW + itemW + passW + failW + naW / 2, 'N/A'],
    [margin + numW + itemW + passW + failW + naW + commW / 2, 'COMMENTS']
  ];
  hdrCols.forEach(([x, lbl]) => doc.text(lbl, x, y + 5.5, { align: 'center' }));
  y += 8;

  const items = f.checklist || QAQC_ITEMS.map(() => ({ result: null, comment: '' }));

  items.forEach((item, idx) => {
    const itemText = QAQC_ITEMS[idx] || '';
    const textLines = doc.splitTextToSize(itemText, itemW - 4);
    const rh = Math.max(8, textLines.length * 4.5 + 3);

    checkNewPage(rh + 1);

    // Row background
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 248);
    doc.rect(margin, y, contentW, rh, 'F');
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.12);
    doc.line(margin, y + rh, margin + contentW, y + rh);

    // Column dividers
    let cx = margin + numW;
    [itemW, passW, failW, naW, commW].forEach(w => {
      doc.line(cx, y, cx, y + rh);
      cx += w;
    });

    // Row number
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...MGRAY);
    doc.text(String(idx + 1), margin + numW / 2, y + rh / 2 + 2, { align: 'center' });

    // Item text
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
    doc.text(textLines, margin + numW + 2, y + 5);

    // PASS / FAIL / N/A circles
    const result = item.result || null;
    const circDefs = [
      { col: margin + numW + itemW + passW / 2,                    val: 'pass', color: GREEN },
      { col: margin + numW + itemW + passW + failW / 2,             val: 'fail', color: REDCL },
      { col: margin + numW + itemW + passW + failW + naW / 2,       val: 'na',   color: MGRAY }
    ];
    circDefs.forEach(({ col, val, color }) => {
      const cy = y + rh / 2;
      const r  = 3;
      if (result === val) {
        doc.setFillColor(...color);
        doc.circle(col, cy, r, 'F');
        if (val === 'pass') {
          doc.setDrawColor(255,255,255); doc.setLineWidth(0.7);
          doc.line(col - 1.4, cy, col - 0.3, cy + 1.2);
          doc.line(col - 0.3, cy + 1.2, col + 1.5, cy - 1.2);
        } else if (val === 'fail') {
          doc.setDrawColor(255,255,255); doc.setLineWidth(0.7);
          doc.line(col - 1.3, cy - 1.3, col + 1.3, cy + 1.3);
          doc.line(col + 1.3, cy - 1.3, col - 1.3, cy + 1.3);
        } else {
          doc.setFontSize(6); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
          doc.text('N/A', col, cy + 2, { align: 'center' });
        }
      } else {
        doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
        doc.setFillColor(245,245,245);
        doc.circle(col, cy, r, 'FD');
      }
      doc.setLineWidth(0.12);
    });

    // Comment text
    if (item.comment) {
      const commX = margin + numW + itemW + passW + failW + naW + 2;
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
      const cl = doc.splitTextToSize(item.comment, commW - 4);
      doc.text(cl, commX, y + 4.5);
    }

    y += rh;
  });

  y += 6;

  // â”€â”€ Overall Result â”€â”€
  if (f.overall_result) {
    checkNewPage(22);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
    doc.text('OVERALL RESULT', margin + 3, y + 5);
    y += 9;

    const isPass = f.overall_result.includes('PASS');
    const resColor = isPass ? GREEN : AMBER;
    doc.setFillColor(...(isPass ? [240,255,248] : [255,251,235]));
    doc.setDrawColor(...resColor);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentW, 11, 2, 2, 'FD');
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...resColor);
    doc.text(f.overall_result, margin + contentW / 2, y + 7.5, { align: 'center' });
    y += 15;
  }

  // â”€â”€ Sign-off — Masonry Contractor â”€â”€
  checkNewPage(48);
  doc.setFillColor(...NAVY); doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text('MASONRY CONTRACTOR — Inspector / Foreman', margin + 3, y + 5);
  y += 9;

  const nameVal = f.supervisor_name || formData.foremanName || '';
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
  doc.text('Printed Name: ' + nameVal, margin + 2, y + 5);
  doc.text('Date: ' + (formData.date || '—'), margin + contentW * 0.6, y + 5);
  y += 10;

  const sigW = Math.min(contentW * 0.48, 75); const sigH = sigW * 0.38;
  doc.setFillColor(255,255,255); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
  doc.rect(margin, y, sigW, sigH, 'FD');
  if (formData.signature && formData.signature.startsWith('data:image')) {
    try { doc.addImage(formData.signature, 'PNG', margin + 2, y + 2, sigW - 4, sigH - 4); } catch(e) {}
  }
  doc.setFontSize(6.5); doc.setTextColor(...MGRAY); doc.text('Signature', margin, y + sigH + 4);
  y += sigH + 12;

  // â”€â”€ Sign-off — GC â”€â”€
  checkNewPage(48);
  doc.setFillColor(60, 80, 60); doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...WHITE);
  doc.text('GENERAL CONTRACTOR — Site Representative (Acceptance Signature)', margin + 3, y + 5);
  y += 9;

  const gcName = f.gc_name || '___________________________________';
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
  doc.text('Printed Name: ' + gcName, margin + 2, y + 5);
  doc.text('Date: _______________', margin + contentW * 0.6, y + 5);
  y += 10;

  // GC signature box (blank — signed on paper)
  doc.setFillColor(255,255,255); doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
  doc.rect(margin, y, sigW, sigH, 'FD');
  doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...MGRAY);
  doc.text('GC signature — signed on paper', margin + sigW / 2, y + sigH / 2 + 2, { align: 'center' });
  doc.setFontSize(6.5); doc.text('Signature', margin, y + sigH + 4);
  y += sigH + 10;

  // â”€â”€ Photos â”€â”€
  if (photos && photos.length > 0) {
    if (y > pageH - 80) { doc.addPage(); y = margin; }
    y = await renderPhotosPDF(doc, photos, y, margin, contentW, pageH, { NAVY, RED, LGRAY, MGRAY });
  }

  // â”€â”€ Page footers â”€â”€
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY); doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
    const ts = new Date().toLocaleString('en-CA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    doc.text(`QAQC Foreman — ${formData.project}`, margin, pageH - 4);
    doc.text(`Page ${i} of ${pages}  |  ${ts}`, pageW - margin, pageH - 4, { align: 'right' });
  }

  return doc.output('arraybuffer');
}

function buildFileName(formData) {
  const safeDate = (formData.date || '').replace(/-/g, '');
  const safeProject = (formData.project || '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 30);
  const safeType = (formData.submissionType || '').replace(/\s+/g, '_');
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  return `${safeType}_${safeProject}_${safeDate}_${hhmm}.pdf`;
}




