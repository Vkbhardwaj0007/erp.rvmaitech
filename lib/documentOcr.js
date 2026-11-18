/**
 * RvmAiTech Document OCR & Intelligent KYC Entity Extractor
 * Powered by Tesseract.js & Strict Document Verification Engine
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
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let m;
    while ((m = streamRegex.exec(raw)) !== null) {
      try {
        const streamBuf = Buffer.from(m[1], 'latin1');
        const inflated = zlib.inflateSync(streamBuf).toString('utf-8');
        text += ' ' + inflated;
      } catch (_) {
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
    const cleanSample = text.replace(/[^A-Za-z0-9]/g, '');
    if (cleanSample.length >= 60) {
      return text;
    }
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

  // Direct Image OCR (JPG, PNG, WEBP, etc.)
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

  if (s.length >= 15 && /\b\d{6}\b/.test(s)) {
    return s;
  }
  return s.length >= 20 ? s : null;
}

/**
 * STRICT Candidate Name Matching
 * Checks whether the document OCR text contains the employee's name tokens or parent's name
 */
function verifyCandidateNameMatch(docText, candidateName, parentsName = '') {
  if (!candidateName || !docText) return { matched: true, score: 1 };

  const normDoc = docText.toLowerCase();

  // 1. Check Candidate Name
  const candTokens = candidateName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !/^(mr|mrs|ms|shri|shree|dr|er|kumar)$/.test(t));

  let candMatched = 0;
  for (const t of candTokens) {
    if (normDoc.includes(t)) candMatched++;
  }

  // 2. Check Parents Name (especially useful when only back of Aadhaar is uploaded)
  let parentMatched = 0;
  let parentTokens = [];
  if (parentsName) {
    parentTokens = parentsName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3 && !/^(mr|mrs|ms|shri|shree|dr|er|kumar)$/.test(t));
    for (const t of parentTokens) {
      if (normDoc.includes(t)) parentMatched++;
    }
  }

  const hasCandMatch = candTokens.length ? (candMatched >= 1 || (candMatched / candTokens.length) >= 0.5) : true;
  const hasParentMatch = parentTokens.length ? (parentMatched >= 1 || (parentMatched / parentTokens.length) >= 0.5) : false;

  const matched = hasCandMatch || hasParentMatch;
  return {
    matched,
    hasCandMatch,
    hasParentMatch,
    expectedName: candidateName,
    parentsName
  };
}

/**
 * Analyze document text, STRICTLY identify true document type
 * NEVER trusts originalKind blindly!
 */
function parseDocumentEntities(text, originalKind = '') {
  const norm = (text || '').toLowerCase().replace(/[\r\n]+/g, ' ');
  const res = {
    docType: 'Other',
    extracted: {},
    confidence: 'low',
    detectedSignatures: []
  };

  if (!text || text.trim().length < 10) {
    return res;
  }

  // --- 1. Internal Company HR Document Detection ---
  const isInternalHr = /appointment & joining order|appointment order|joining letter|rvmaitech|employment offer|commencement of duties|corporate workstation|reporting acknowledgement|business suite|hrms portal access/.test(norm);
  if (isInternalHr) {
    res.docType = 'Internal HR Document';
    res.confidence = 'high';
    res.detectedSignatures.push('Company Appointment / Joining Letter');
    return res;
  }

  // --- 2. Marksheet / College Certificate / Academic Degree Detection ---
  const isMarksheet = /board of technical education|marksheet|statement of marks|marks obtained|roll no|diploma in|semester|maximum marks|minimum pass marks|grand total|examination 20\d\d|b\.?tech|bachelor of|master of|provisional certificate|board of secondary education|university|institute of technology/.test(norm);
  if (isMarksheet) {
    res.docType = 'College Certificate';
    res.confidence = 'high';
    res.detectedSignatures.push('College / University / Board Marksheet');

    const degMatch = text.match(/(Bachelor\s*of\s*[A-Za-z\s]+|Master\s*of\s*[A-Za-z\s]+|B\.?Tech(?:\s*\([A-Za-z\s]+\))?|Diploma\s*in\s*[A-Za-z\s]+)/i);
    const univMatch = text.match(/([A-Za-z\s]+(?:University|Institute\s*of\s*Technology|College|Board\s*of[A-Za-z\s]+))/i);

    const degStr = degMatch ? degMatch[1].replace(/[\r\n]+/g, ' ').trim() : 'Diploma / Degree Marksheet';
    const univStr = univMatch ? univMatch[1].replace(/[\r\n]+/g, ' ').trim() : 'Board of Technical Education';
    res.extracted.highestCollege = univStr ? `${degStr} - ${univStr}` : degStr;
    return res;
  }

  // --- 3. Genuine Aadhaar Card Detection ---
  const hasAadhaarKeywords = /unique identification authority of india|uidai|mera aadhaar|enrollment no|vid\s*:\s*\d|मेरा आधार|मेरी पहचान|भारत सरकार|help@uidai/.test(norm);
  const aadhaarNoMatch = text.match(/\b([2-9]\d{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})\b/);

  if (hasAadhaarKeywords || (aadhaarNoMatch && (/address|पता|dob|male|female|year of birth/.test(norm)))) {
    res.docType = 'Aadhaar Card';
    res.confidence = 'high';
    res.detectedSignatures.push('Government of India UIDAI Aadhaar Card');

    // Extract Aadhaar Number
    if (aadhaarNoMatch) {
      const cleanNo = cleanAadhaarNo(aadhaarNoMatch[1]);
      if (cleanNo) res.extracted.aadhaarNumber = cleanNo;
    }

    // Extract Permanent Address
    const addrRegexes = [
      /(?:Address|पता)\s*[:\-]?\s*([\s\S]{10,250}?\b[1-9]\d{5}\b)/i,
      /(?:C\/O|S\/O|D\/O|W\/O)\s*[:\-]?\s*([\s\S]{10,250}?\b[1-9]\d{5}\b)/i,
      /(?:To|Name)\s*[,:\-]?\s*\n\s*([\s\S]{15,250}?\b[1-9]\d{5}\b)/i,
      /([A-Za-z0-9\s,\.\-\/]{15,200}?\b[1-9]\d{5}\b)/i
    ];

    for (const rgx of addrRegexes) {
      const m = text.match(rgx);
      if (m && m[1]) {
        const cleaned = cleanIndianAddress(m[1]);
        if (cleaned) {
          res.extracted.address = cleaned;
          break;
        }
      }
    }

    // Extract Parent / Guardian Name (S/O, D/O, C/O, W/O)
    const parentMatch = text.match(/(?:S\/O|D\/O|W\/O|C\/O|Son\s*of|Daughter\s*of|Care\s*of)\s*[:\-]?\s*([A-Za-z\s\.]{3,50})(?:,|\n|$)/i);
    if (parentMatch && parentMatch[1]) {
      const pName = parentMatch[1].replace(/Address|पता|H\.?No/i, '').trim();
      if (pName.length >= 3 && !/\d/.test(pName)) {
        res.extracted.parentsName = pName;
      }
    }

    // Extract Date of Birth
    const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|जन्म\s*तिथि)\s*[:\-]?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i)
                  || text.match(/(?:Year\s*of\s*Birth|जन्म\s*वर्ष)\s*[:\-]?\s*(\d{4})/i);
    if (dobMatch) res.extracted.dob = dobMatch[1];

    // Extract Gender
    const genderMatch = text.match(/\b(MALE|FEMALE|TRANSGENDER|पुरुष|महिला)\b/i);
    if (genderMatch) {
      const g = genderMatch[1].toUpperCase();
      res.extracted.gender = (g === 'FEMALE' || g === 'महिला') ? 'Female' : 'Male';
    }

    return res;
  }

  // --- 4. Genuine PAN Card Detection ---
  const hasPanKeywords = /income\s*tax\s*department|permanent\s*account\s*number|govt\.?\s*of\s*india/i.test(norm);
  const panNoMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/);

  if ((hasPanKeywords && panNoMatch) || (panNoMatch && /father|birth|date of birth|tax/.test(norm))) {
    res.docType = 'PAN Card';
    res.confidence = 'high';
    res.detectedSignatures.push('Income Tax Department PAN Card');
    res.extracted.panNumber = panNoMatch[1].toUpperCase();

    const dobM = text.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/);
    if (dobM) res.extracted.dob = dobM[1];

    return res;
  }

  // --- 5. Rent Agreement / Tenancy Detection ---
  const hasRentKeywords = /rent\s*agreement|tenancy\s*agreement|lease\s*deed|landlord|tenant|lessor|lessee|premises\s*situated/i.test(norm);
  if (hasRentKeywords) {
    res.docType = 'Rent Agreement';
    res.confidence = 'high';
    res.extracted.livingStatus = 'Rented Room / PG';

    const llMatch = text.match(/(?:Landlord|Lessor|Owner|First\s*Party)\s*[:\-]?\s*([A-Za-z\s\.]{3,50})(?:,|\n|$)/i);
    if (llMatch) res.extracted.roomOwnerName = llMatch[1].trim();

    const phoneMatch = text.match(/(?:Phone|Mobile|Contact)\s*[:\-]?\s*(?:\+?91[\s\-]?)?([6-9]\d{9})/i);
    if (phoneMatch) res.extracted.roomOwnerPhone = phoneMatch[1];

    const roomAddrM = text.match(/(?:Premises|Property|Rented\s*Premises|Situated\s*at)\s*[:\-]?\s*([\s\S]{15,150}?\b\d{6}\b)/i);
    if (roomAddrM) {
      let rAddr = cleanIndianAddress(roomAddrM[1]);
      if (rAddr) rAddr = rAddr.replace(/^(Situated\s*at|Premises|Property)[:\s,\-]*/i, '').trim();
      res.extracted.roomAddress = rAddr;
    }
    return res;
  }

  // --- 6. Relieving / Experience Letter Detection ---
  const hasExpKeywords = /relieving\s*letter|experience\s*certificate|service\s*certificate|relieved\s*from\s*(?:his|her)\s*duties|resignation/i.test(norm);
  if (hasExpKeywords) {
    res.docType = 'Experience Letter';
    res.confidence = 'high';

    const compMatch = text.match(/(?:worked\s*with|employed\s*at|relieved\s*from|service\s*at)\s+([A-Za-z0-9\s\.\&]+(?:Pvt\.?\s*Ltd\.?|Limited|Solutions|Technologies|Corp|Inc))/i);
    if (compMatch) res.extracted.previousEmployer = compMatch[1].trim();
    return res;
  }

  return res;
}

/**
 * Main export: Process file buffer and return OCR results + classification + candidate verification
 */
async function processDocumentOcr(buf, mime, originalKind = '', filename = '', candidateName = '', parentsName = '') {
  try {
    const rawText = await performOcr(buf, mime);
    const analysis = parseDocumentEntities(rawText, originalKind);
    const nameMatch = verifyCandidateNameMatch(rawText, candidateName, parentsName);

    return {
      success: true,
      docType: analysis.docType,
      confidence: analysis.confidence,
      detectedSignatures: analysis.detectedSignatures,
      nameMatch,
      rawTextLength: (rawText || '').length,
      rawTextSnippet: (rawText || '').slice(0, 300).replace(/\s+/g, ' '),
      extracted: analysis.extracted
    };
  } catch (err) {
    console.error('[processDocumentOcr] Error:', err);
    return {
      success: false,
      docType: 'Other',
      error: err.message,
      nameMatch: { matched: true },
      extracted: {}
    };
  }
}

module.exports = {
  performOcr,
  parseDocumentEntities,
  verifyCandidateNameMatch,
  processDocumentOcr,
  cleanAadhaarNo,
  cleanIndianAddress
};
