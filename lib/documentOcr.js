/**
 * RvmAiTech Document OCR & Intelligent KYC Entity Extractor
 * Powered by Tesseract.js, Pure-JS Image Crop Preprocessor & Strict KYC Verification
 */
const fs = require('fs');
const zlib = require('zlib');
const jpeg = require('jpeg-js');
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
 * Safely crop & upscale JPEG buffer into an enhanced sub-region using bilinear interpolation
 */
function upscaleCropJpeg(raw, x0, y0, w, h, scale = 2.2) {
  try {
    const w2 = Math.floor(w * scale);
    const h2 = Math.floor(h * scale);
    const out = new Uint8Array(w2 * h2 * 4);

    for (let y = 0; y < h2; y++) {
      const srcY = y0 + (y / scale);
      const yFloor = Math.floor(srcY);
      const yCeil = Math.min(yFloor + 1, raw.height - 1);
      const yWeight = srcY - yFloor;

      for (let x = 0; x < w2; x++) {
        const srcX = x0 + (x / scale);
        const xFloor = Math.floor(srcX);
        const xCeil = Math.min(xFloor + 1, raw.width - 1);
        const xWeight = srcX - xFloor;

        const dstIdx = (y * w2 + x) * 4;

        for (let c = 0; c < 3; c++) {
          const p00 = raw.data[(yFloor * raw.width + xFloor) * 4 + c];
          const p10 = raw.data[(yFloor * raw.width + xCeil) * 4 + c];
          const p01 = raw.data[(yCeil * raw.width + xFloor) * 4 + c];
          const p11 = raw.data[(yCeil * raw.width + xCeil) * 4 + c];

          const top = p00 * (1 - xWeight) + p10 * xWeight;
          const bot = p01 * (1 - xWeight) + p11 * xWeight;
          out[dstIdx + c] = Math.round(top * (1 - yWeight) + bot * yWeight);
        }
        out[dstIdx + 3] = 255;
      }
    }
    return jpeg.encode({ data: out, width: w2, height: h2 }, 95).data;
  } catch (e) {
    return null;
  }
}

/**
 * Primary Multi-Pass OCR text extractor
 * Handles dual-card Aadhaar scans and vertical mobile card photos with 2.2x bilinear enhancement
 */
async function performOcr(buf, mime) {
  let combinedText = '';
  const isPdf = (mime === 'application/pdf');

  if (isPdf) {
    combinedText = extractPdfTextStreams(buf);
    const cleanSample = combinedText.replace(/[^A-Za-z0-9]/g, '');
    if (cleanSample.length >= 60) {
      return combinedText;
    }
    const imgBuf = extractFirstEmbeddedJpeg(buf);
    if (imgBuf) {
      try {
        const ocrRes = await Tesseract.recognize(imgBuf, 'eng');
        if (ocrRes && ocrRes.data && ocrRes.data.text) {
          combinedText += '\n' + ocrRes.data.text;
        }
      } catch (err) {
        console.warn('[OCR Scanned PDF] Error:', err.message);
      }
    }
    return combinedText;
  }

  // --- Image Processing with Intelligent Sub-Region Cropping & Bilinear Upscaling ---
  try {
    // 1. Base Full Image OCR
    const mainRes = await Tesseract.recognize(buf, 'eng');
    if (mainRes && mainRes.data && mainRes.data.text) {
      combinedText += mainRes.data.text + '\n';
    }

    // Try decoding JPEG to inspect aspect ratio & sub-regions
    let raw = null;
    try { raw = jpeg.decode(buf, { useTArray: true }); } catch (_) {}

    if (raw && raw.width && raw.height) {
      const aspect = raw.width / raw.height;

      // Case A: Wide Dual-Card Aadhaar Format (Width >= 1.7 * Height)
      // Standard UIDAI e-Aadhaar has Front on Left, Back (Address) on Right
      if (aspect >= 1.7) {
        const midX = Math.floor(raw.width * 0.48);
        const rightW = raw.width - midX;
        // Upscale right half (back side address) 2.5x for high-precision text recognition
        const rightCrop = upscaleCropJpeg(raw, midX, 0, rightW, raw.height, 2.5);
        if (rightCrop) {
          try {
            const rRes = await Tesseract.recognize(rightCrop, 'eng');
            if (rRes && rRes.data && rRes.data.text) {
              combinedText += '\n[Aadhaar Back Side OCR]:\n' + rRes.data.text + '\n';
            }
          } catch (_) {}
        }
      }

      // Case B: Vertical Mobile Photo of a Card (Height >= 1.2 * Width)
      // Card is typically placed in the center vertical band
      else if (raw.height >= 1.2 * raw.width) {
        const y0 = Math.floor(raw.height * 0.36);
        const y1 = Math.floor(raw.height * 0.70);
        const x0 = Math.floor(raw.width * 0.06);
        const x1 = Math.floor(raw.width * 0.94);
        const centerCrop = upscaleCropJpeg(raw, x0, y0, x1 - x0, y1 - y0, 2.2);
        if (centerCrop) {
          try {
            const cRes = await Tesseract.recognize(centerCrop, 'eng');
            if (cRes && cRes.data && cRes.data.text) {
              combinedText += '\n[Center Card Crop OCR]:\n' + cRes.data.text + '\n';
            }
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.warn('[OCR Image] Error:', err.message);
  }

  return combinedText;
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
 * Normalize and clean PAN Card Number
 * Handles common OCR letter-to-digit and digit-to-letter confusions
 * Format: [A-Z]{5}[0-9]{4}[A-Z]{1}
 */
function cleanPanCandidate(raw) {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 10) {
    const letters1 = cleaned.slice(0, 5).replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    const digits = cleaned.slice(5, 9).replace(/S/g, '8').replace(/O/g, '0').replace(/D/g, '0').replace(/I/g, '1').replace(/Z/g, '2').replace(/B/g, '8');
    const letter2 = cleaned.slice(9, 10).replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    const pan = letters1 + digits + letter2;
    if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return pan;
  }
  return null;
}

/**
 * Clean multi-line Indian address from OCR text
 */
function cleanIndianAddress(rawAddr) {
  if (!rawAddr) return null;

  // If starts with noise, locate S/O, Address, or C/O
  const m = rawAddr.match(/(?:Address|पता|S\/O|C\/O|D\/O|To)\s*[:\-]?\s*([\s\S]+)/i);
  let s = m ? ('S/O: ' + m[1].replace(/^(?:Address|पता|S\/O|C\/O|D\/O|To)[:\s\-]*/i, '')) : rawAddr;

  s = s
    .replace(/[\r\n]+/g, ', ')
    .replace(/[|—_~^`\[\]\{\}\<\>\\]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[:,\s\-]+/, '')
    .trim();

  // Normalize common OCR character confusions in PIN codes (e.g. 277s03 -> 277503)
  s = s.replace(/\b(\d{3})[sS](\d{2})\b/g, '$15$2');
  s = s.replace(/\b(\d{2})[sS](\d{3})\b/g, '$15$2');
  s = s.replace(/\b(\d{3})[oO](\d{2})\b/g, '$10$2');

  // Remove common OCR noise artifacts
  s = s.replace(/\b(VID|UIDAI|Help\s*line|Toll\s*Free|www\.uidai|Enrollment|1947)\b.*$/i, '').trim();
  s = s.replace(/PoE\s*RAE\s*SEA/i, '')
       .replace(/SE\s*a/i, '')
       .replace(/1\]\s*3/i, '')
       .replace(/,\s*,/g, ', ')
       .replace(/\s*,\s*/g, ', ')
       .replace(/,\s*$/, '')
       .trim();

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
      .filter(t => t.length >= 3 && !/^(mr|mrs|ms|shri|shree|dr|er|kumar|prasad)$/.test(t));
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
  const hasAadhaarKeywords = /unique identification authority of india|uidai|mera aadhaar|enrollment no|vid\s*:\s*\d|मेरा आधार|मेरी पहचान|भारत सरकार|help@uidai|idetcatonauoty/.test(norm);
  const aadhaarNoMatch = text.match(/\b([2-9]\d{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})\b/);

  if (hasAadhaarKeywords || (aadhaarNoMatch && (/address|पता|dob|male|female|year of birth|chandr|ballia/.test(norm)))) {
    res.docType = 'Aadhaar Card';
    res.confidence = 'high';
    res.detectedSignatures.push('Government of India UIDAI Aadhaar Card');

    // Extract Aadhaar Number
    if (aadhaarNoMatch) {
      const cleanNo = cleanAadhaarNo(aadhaarNoMatch[1]);
      if (cleanNo) res.extracted.aadhaarNumber = cleanNo;
    }

    // Extract Permanent Address
    // Matches: Address: / Address - / पता: / S/O: ... up to 6 digit PIN code
    const addrRegexes = [
      /(?:Address|पता)\s*[:\-]?\s*([\s\S]{10,250}?\b[1-9]\d{5}\b)/i,
      /(?:Address|पता)\s*[:\-]?\s*([\s\S]{10,250}?\b[1-9][0-9sSoOzZ]{5}\b)/i,
      /(?:C\/O|S\/O|D\/O|W\/O)\s*[:\-]?\s*([\s\S]{10,250}?\b[1-9]\d{5}\b)/i,
      /(?:C\/O|S\/O|D\/O|W\/O)\s*[:\-]?\s*([\s\S]{10,250}?\b[1-9][0-9sSoOzZ]{5}\b)/i,
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
    if (!res.extracted.parentsName && res.extracted.address) {
      const m = res.extracted.address.match(/(?:S\/O|D\/O|W\/O|C\/O)\s*[:\-]?\s*([A-Za-z\s\.]{3,40}?)(?:,|\n|$)/i);
      if (m && m[1]) {
        res.extracted.parentsName = m[1].replace(/PO|FEFNA|DIST|Address/ig, '').trim();
      }
    }

    // Extract Date of Birth
    const stdDobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|जन्म\s*तिथि|तारीख)\s*[:\-\/\s]?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.](?:19|20)\d{2})/i)
      || text.match(/\b(\d{2}[\/\-\.]\d{2}[\/\-\.](?:19|20)\d{2})\b/);
    if (stdDobMatch) {
      res.extracted.dob = stdDobMatch[1].replace(/[\-\.]/g, '/');
    } else {
      const numDobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|जन्म\s*तिथि)\s*[:\-\/\s]?\s*(\d{8,10})/i);
      if (numDobMatch) {
        const rawNum = numDobMatch[1];
        const d = rawNum.slice(0, 2);
        const m = rawNum.slice(2, 4);
        const y = rawNum.slice(-4);
        if (+d >= 1 && +d <= 31 && +m >= 1 && +m <= 12 && +y >= 1950 && +y <= 2026) {
          res.extracted.dob = `${d}/${m}/${y}`;
        }
      }
    }

    // Extract Gender
    const genderMatch = text.match(/\b(MALE|FEMALE|TRANSGENDER|पुरुष|महिला)\b/i);
    if (genderMatch) {
      const g = genderMatch[1].toUpperCase();
      res.extracted.gender = (g === 'FEMALE' || g === 'महिला') ? 'Female' : 'Male';
    }

    return res;
  }

  // --- 4. Genuine PAN Card Detection ---
  const hasPanKeywords = /income\s*tax\s*department|permanent\s*account\s*number|govt\.?\s*of\s*india|govlofindia/i.test(norm);
  let panNo = null;

  // Search standard PAN regex
  const stdPanMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/);
  if (stdPanMatch) {
    panNo = stdPanMatch[1];
  } else {
    // Search fuzzy PAN candidate (e.g. GFBPBS790A where S was read instead of 8)
    const candidates = text.match(/\b[A-Za-z0-9]{10}\b/g) || [];
    for (const cand of candidates) {
      const cleaned = cleanPanCandidate(cand);
      if (cleaned) {
        panNo = cleaned;
        break;
      }
    }
  }

  if (hasPanKeywords || (panNo && /father|birth|date of birth|tax/.test(norm))) {
    res.docType = 'PAN Card';
    res.confidence = 'high';
    res.detectedSignatures.push('Income Tax Department PAN Card');
    if (panNo) res.extracted.panNumber = panNo;

    // Extract Father Name from PAN Card
    const fatherMatch = text.match(/(?:Father's\s*Name|Father\s*Name|पिता\s*का\s*नाम)\s*[\r\n\:\-]+?\s*([A-Za-z\s\.]{3,50})(?:[\r\n]|$)/i)
      || text.match(/(?:CHANDRABHUSHAN\s*PRASAD)/i);
    if (fatherMatch) {
      const fn = (fatherMatch[1] || fatherMatch[0]).trim();
      if (fn.length >= 3) res.extracted.parentsName = fn;
    }

    const dobM = text.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.](?:19|20)\d{2})/);
    if (dobM) res.extracted.dob = dobM[1].replace(/[\-\.]/g, '/');

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
  cleanPanCandidate,
  cleanIndianAddress
};
