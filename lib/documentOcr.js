/**
 * RvmAiTech Document OCR & Intelligent KYC Entity Extractor
 * Powered by Tesseract.js & Smart Regex Parser
 */
const fs = require('fs');
const zlib = require('zlib');
const Tesseract = require('tesseract.js');

/**
 * Extract embedded text from a PDF buffer (decompresses Flate streams)
 */
function extractPdfTextStreams(buf) {
  let text = '';
  try {
    const raw = buf.toString('latin1');
    // Extract standard literal strings / text objects (Tj / TJ)
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let m;
    while ((m = streamRegex.exec(raw)) !== null) {
      try {
        const streamBuf = Buffer.from(m[1], 'latin1');
        const inflated = zlib.inflateSync(streamBuf).toString('utf-8');
        text += ' ' + inflated;
      } catch (_) {
        // Raw or other filter
        text += ' ' + m[1];
      }
    }
  } catch (err) {
    console.warn('[PDF Text Extract] Warning:', err.message);
  }
  return text;
}

/**
 * Extract embedded JPEG image from scanned PDF buffer (if text is empty)
 */
function extractFirstEmbeddedJpeg(buf) {
  try {
    const start = buf.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]));
    if (start !== -1) {
      const end = buf.indexOf(Buffer.from([0xFF, 0xD9]), start);
      if (end !== -1 && (end - start) > 5000) {
        return buf.subarray(start, end + 2);
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Primary OCR text extractor (supports Images & Scanned PDFs)
 */
async function performOcr(buf, mime) {
  let text = '';
  const isPdf = (mime === 'application/pdf');

  if (isPdf) {
    text = extractPdfTextStreams(buf);
    // If the PDF had embedded textual characters, check if meaningful
    const cleanSample = text.replace(/[^A-Za-z0-9]/g, '');
    if (cleanSample.length >= 60) {
      return text;
    }
    // If text was too short, this is likely a scanned PDF document with embedded image!
    const imgBuf = extractFirstEmbeddedJpeg(buf);
    if (imgBuf) {
      try {
        const ocrRes = await Tesseract.recognize(imgBuf, 'eng');
        if (ocrRes && ocrRes.data && ocrRes.data.text) {
          text += '\n' + ocrRes.data.text;
        }
      } catch (err) {
        console.warn('[OCR Scanned PDF] Error:', err.message);
      }
    }
    return text;
  }

  // Image processing (JPG, PNG, WEBP, etc.)
  try {
    const ocrRes = await Tesseract.recognize(buf, 'eng');
    if (ocrRes && ocrRes.data && ocrRes.data.text) {
      text = ocrRes.data.text;
    }
  } catch (err) {
    console.warn('[OCR Image] Error:', err.message);
  }

  return text;
}

/**
 * Format Indian 12-digit Aadhaar number
 */
function cleanAadhaarNo(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && /^[2-9]/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  }
  return null;
}

/**
 * Clean multi-line Indian address from OCR text
 */
function cleanIndianAddress(rawAddr) {
  if (!rawAddr) return null;
  let s = rawAddr
    .replace(/[\r\n]+/g, ', ')
    .replace(/[|—_~^`]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[:,\s\-]+/, '')
    .trim();

  // Remove common OCR noise lines
  s = s.replace(/\b(VID|UIDAI|Help\s*line|Toll\s*Free|www\.uidai|Enrollment|1947)\b.*$/i, '').trim();
  s = s.replace(/,\s*,/g, ',').replace(/\s*,\s*/g, ', ').replace(/,\s*$/, '').trim();

  // Must have reasonable length and contain a 6-digit PIN
  if (s.length >= 15 && /\b\d{6}\b/.test(s)) {
    return s;
  }
  return s.length >= 20 ? s : null;
}

/**
 * Analyze document text, auto-identify document type and extract structured fields
 */
function parseDocumentEntities(text, originalKind = '') {
  const norm = text.replace(/\r?\n/g, ' \n ');
  const res = {
    docType: originalKind || 'Other',
    extracted: {},
    confidence: 'low'
  };

  // 1. Aadhaar Card Pattern Detection
  const hasAadhaarKeywords = /aadhaar|adhar|uidai|unique\s*identification|government\s*of\s*india|मेरा\s*आधार|enrollment\s*no/i.test(norm);
  const aadhaarNoMatch = norm.match(/\b([2-9]\d{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})\b/);
  
  if (hasAadhaarKeywords || aadhaarNoMatch || /aadhaar|adhar/i.test(originalKind)) {
    res.docType = 'Aadhaar Card';
    res.confidence = 'high';

    // Extract Aadhaar Number
    if (aadhaarNoMatch) {
      const cleanNo = cleanAadhaarNo(aadhaarNoMatch[1]);
      if (cleanNo) res.extracted.aadhaarNumber = cleanNo;
    }

    // Extract Permanent Address (Comprehensive multi-line capture)
    // Matches: Address: / Address - / पता: / To, ... up to 6 digit PIN code
    const addrRegexes = [
      /(?:Address|पता)\s*[:\-]?\s*([\s\S]{10,250}?\b[1-9]\d{5}\b)/i,
      /(?:C\/O|S\/O|D\/O|W\/O)\s*[:\-]?\s*([\s\S]{10,250}?\b[1-9]\d{5}\b)/i,
      /(?:To|Name)\s*[,:\-]?\s*\n\s*([\s\S]{15,250}?\b[1-9]\d{5}\b)/i,
      /([A-Za-z0-9\s,\.\-\/]{15,200}?\b[1-9]\d{5}\b)/i
    ];

    for (const rgx of addrRegexes) {
      const m = norm.match(rgx);
      if (m && m[1]) {
        const cleaned = cleanIndianAddress(m[1]);
        if (cleaned) {
          res.extracted.address = cleaned;
          break;
        }
      }
    }

    // Extract Parent / Guardian Name (S/O, D/O, C/O, W/O)
    const parentMatch = norm.match(/(?:S\/O|D\/O|W\/O|C\/O|Son\s*of|Daughter\s*of|Care\s*of)\s*[:\-]?\s*([A-Za-z\s\.]{3,50})(?:,|\n|$)/i);
    if (parentMatch && parentMatch[1]) {
      const pName = parentMatch[1].replace(/Address|पता|H\.?No/i, '').trim();
      if (pName.length >= 3 && !/\d/.test(pName)) {
        res.extracted.parentsName = pName;
      }
    }

    // Extract Date of Birth
    const dobMatch = norm.match(/(?:DOB|Date\s*of\s*Birth|जन्म\s*तिथि)\s*[:\-]?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i)
                  || norm.match(/(?:Year\s*of\s*Birth|जन्म\s*वर्ष)\s*[:\-]?\s*(\d{4})/i);
    if (dobMatch) {
      res.extracted.dob = dobMatch[1];
    }

    // Extract Gender
    const genderMatch = norm.match(/\b(MALE|FEMALE|TRANSGENDER|पुरुष|महिला)\b/i);
    if (genderMatch) {
      const g = genderMatch[1].toUpperCase();
      res.extracted.gender = (g === 'FEMALE' || g === 'महिला') ? 'Female' : 'Male';
    }

    return res;
  }

  // 2. PAN Card Pattern Detection
  const hasPanKeywords = /income\s*tax\s*department|permanent\s*account\s*number|govt\.?\s*of\s*india/i.test(norm);
  const panNoMatch = norm.match(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/);

  if (hasPanKeywords || panNoMatch || /pan/i.test(originalKind)) {
    res.docType = 'PAN Card';
    res.confidence = 'high';
    if (panNoMatch) res.extracted.panNumber = panNoMatch[1].toUpperCase();

    // PAN DOB
    const dobM = norm.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/);
    if (dobM) res.extracted.dob = dobM[1];

    return res;
  }

  // 3. Rent Agreement / Tenancy Pattern Detection
  const hasRentKeywords = /rent\s*agreement|tenancy\s*agreement|lease\s*deed|landlord|tenant|lessor|lessee|premises|rented\s*room/i.test(norm);
  if (hasRentKeywords || /rent/i.test(originalKind)) {
    res.docType = 'Rent Agreement';
    res.confidence = 'high';
    res.extracted.livingStatus = 'Rented Room / PG';

    // Landlord name
    const llMatch = norm.match(/(?:Landlord|Lessor|Owner|First\s*Party)\s*[:\-]?\s*([A-Za-z\s\.]{3,50})(?:,|\n|$)/i);
    if (llMatch) res.extracted.roomOwnerName = llMatch[1].trim();

    // Landlord phone
    const phoneMatch = norm.match(/(?:Phone|Mobile|Contact)\s*[:\-]?\s*(?:\+?91[\s\-]?)?([6-9]\d{9})/i);
    if (phoneMatch) res.extracted.roomOwnerPhone = phoneMatch[1];

    // Property Address
    const roomAddrM = norm.match(/(?:Premises|Property|Rented\s*Premises|Situated\s*at)\s*[:\-]?\s*([\s\S]{15,150}?\b\d{6}\b)/i);
    if (roomAddrM) {
      let rAddr = cleanIndianAddress(roomAddrM[1]);
      if (rAddr) rAddr = rAddr.replace(/^(Situated\s*at|Premises|Property)[:\s,\-]*/i, '').trim();
      res.extracted.roomAddress = rAddr;
    }

    return res;
  }

  // 4. College Degree / Certificate Detection
  const hasCollegeKeywords = /university|degree|diploma|bachelor|master|b\.?tech|b\.?sc|marksheet|provisional\s*certificate|institute\s*of\s*technology|higher\s*secondary/i.test(norm);
  if (hasCollegeKeywords || /college|degree|education|marksheet/i.test(originalKind)) {
    res.docType = 'College / Degree';
    res.confidence = 'high';

    const degMatch = norm.match(/(Bachelor\s*of\s*[A-Za-z\s]+|Master\s*of\s*[A-Za-z\s]+|B\.?Tech(?:\s*\([A-Za-z\s]+\))?|Diploma\s*in\s*[A-Za-z\s]+)/i);
    const univMatch = norm.match(/([A-Za-z\s]+(?:University|Institute\s*of\s*Technology|College|Board\s*of[A-Za-z\s]+))/i);

    const degStr = degMatch ? degMatch[1].replace(/[\r\n]+/g, ' ').trim() : 'Degree Certificate';
    const univStr = univMatch ? univMatch[1].replace(/[\r\n]+/g, ' ').trim() : '';
    res.extracted.highestCollege = univStr ? `${degStr} - ${univStr}` : degStr;

    return res;
  }

  // 5. Experience / Relieving Letter Detection
  const hasExpKeywords = /relieving\s*letter|experience\s*certificate|service\s*certificate|relieved\s*from\s*(?:his|her)\s*duties|resignation/i.test(norm);
  if (hasExpKeywords || /relieving|experience/i.test(originalKind)) {
    res.docType = 'Experience / Relieving';
    res.confidence = 'high';

    const compMatch = norm.match(/(?:worked\s*with|employed\s*at|relieved\s*from|service\s*at)\s+([A-Za-z0-9\s\.\&]+(?:Pvt\.?\s*Ltd\.?|Limited|Solutions|Technologies|Corp|Inc))/i);
    if (compMatch) res.extracted.previousEmployer = compMatch[1].trim();

    return res;
  }

  return res;
}

/**
 * Main export: Process file buffer and return OCR results + extracted entities
 */
async function processDocumentOcr(buf, mime, originalKind = '', filename = '') {
  try {
    const rawText = await performOcr(buf, mime);
    const analysis = parseDocumentEntities(rawText, originalKind);

    return {
      success: true,
      docType: analysis.docType,
      confidence: analysis.confidence,
      rawTextLength: (rawText || '').length,
      rawTextSnippet: (rawText || '').slice(0, 300).replace(/\s+/g, ' '),
      extracted: analysis.extracted
    };
  } catch (err) {
    console.error('[processDocumentOcr] Error:', err);
    return {
      success: false,
      docType: originalKind || 'Other',
      error: err.message,
      extracted: {}
    };
  }
}

module.exports = {
  performOcr,
  parseDocumentEntities,
  processDocumentOcr,
  cleanAadhaarNo,
  cleanIndianAddress
};
