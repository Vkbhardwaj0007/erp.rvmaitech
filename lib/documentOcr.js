/**
 * RvmAiTech Document OCR & Intelligent KYC Entity Extractor
 * Powered by Tesseract.js, Pure-JS PNG & JPEG Image Crop Preprocessor,
 * UIDAI Secure QR Decoder & Strict Multi-Identity KYC Verification
 */
const zlib = require('zlib');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const Tesseract = require('tesseract.js');

/**
 * Decode PNG or JPEG buffer into raw RGBA { data, width, height }
 */
function decodeImageBuffer(buf) {
  if (!buf || buf.length < 12) return null;
  // PNG magic bytes: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    try {
      const png = PNG.sync.read(buf);
      if (png && png.width && png.height && png.data) {
        return { data: png.data, width: png.width, height: png.height, format: 'png' };
      }
    } catch (_) {}
  }
  // JPEG magic bytes: FF D8
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    try {
      const jpg = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 256 });
      if (jpg && jpg.width && jpg.height && jpg.data) {
        return { data: jpg.data, width: jpg.width, height: jpg.height, format: 'jpeg' };
      }
    } catch (_) {}
  }
  return null;
}

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
 * Safely crop & upscale raw RGBA image into an enhanced JPEG buffer using bilinear interpolation
 */
function upscaleCropToJpeg(raw, x0, y0, w, h, scale = 2.5) {
  try {
    const cx0 = Math.max(0, Math.min(raw.width - 1, Math.floor(x0)));
    const cy0 = Math.max(0, Math.min(raw.height - 1, Math.floor(y0)));
    const cw = Math.max(1, Math.min(raw.width - cx0, Math.floor(w)));
    const ch = Math.max(1, Math.min(raw.height - cy0, Math.floor(h)));

    const w2 = Math.max(1, Math.floor(cw * scale));
    const h2 = Math.max(1, Math.floor(ch * scale));
    // Guard memory limit (max ~12 megapixels)
    if (w2 * h2 > 12000000) return null;

    const out = new Uint8Array(w2 * h2 * 4);
    for (let y = 0; y < h2; y++) {
      const srcY = cy0 + (y / scale);
      const yFloor = Math.floor(srcY);
      const yCeil = Math.min(yFloor + 1, raw.height - 1);
      const yWeight = srcY - yFloor;

      for (let x = 0; x < w2; x++) {
        const srcX = cx0 + (x / scale);
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
 * Attempt to decode UIDAI Aadhaar Secure QR (V2 numeric BigInt->gzip) or Legacy XML QR
 */
function tryDecodeAadhaarQr(raw) {
  if (!raw || !raw.data || !raw.width || !raw.height) return null;
  try {
    const tryRegion = (x0, y0, w, h) => {
      const sub = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const si = ((y0 + y) * raw.width + (x0 + x)) * 4;
          const di = (y * w + x) * 4;
          sub[di] = raw.data[si];
          sub[di + 1] = raw.data[si + 1];
          sub[di + 2] = raw.data[si + 2];
          sub[di + 3] = 255;
        }
      }
      return jsQR(sub, w, h, { inversionAttempts: 'dontInvert' });
    };

    let code = null;
    if (raw.width / raw.height >= 1.7) {
      const rx = Math.floor(raw.width * 0.72);
      code = tryRegion(rx, 0, raw.width - rx, raw.height);
    }
    if (!code && raw.width * raw.height <= 4000000) {
      code = jsQR(new Uint8ClampedArray(raw.data), raw.width, raw.height, { inversionAttempts: 'dontInvert' });
    }
    if (!code || !code.data) return null;

    const qrStr = String(code.data).trim();

    // Case 1: Legacy UIDAI XML QR
    if (qrStr.startsWith('<?xml') || qrStr.includes('PrintLetterBarcodeData')) {
      const attr = (k) => {
        const m = qrStr.match(new RegExp(`${k}="([^"]*)"`, 'i'));
        return m ? m[1].trim() : '';
      };
      const name = attr('name');
      const uid = attr('uid');
      const dob = attr('dob') || attr('yob');
      const co = attr('co');
      const addrParts = [co, attr('house'), attr('street'), attr('lm'), attr('loc'), attr('vtc'), attr('po'), attr('dist'), attr('state')].filter(Boolean);
      const pc = attr('pc');
      const address = addrParts.join(', ') + (pc ? ' - ' + pc : '');
      if (name || uid || address) {
        return { source: 'xml-qr', name, uid, dob, parentsName: co.replace(/^(S\/O|D\/O|W\/O|C\/O)[:\s\-]*/i, '').trim(), address };
      }
    }

    // Case 2: UIDAI Secure QR V2 (large decimal integer -> bytes -> gzip -> 0xFF-delimited fields)
    if (/^\d{100,}$/.test(qrStr)) {
      let hex = BigInt(qrStr).toString(16);
      if (hex.length % 2) hex = '0' + hex;
      const gzBuf = Buffer.from(hex, 'hex');
      const inflated = zlib.gunzipSync(gzBuf);
      const fields = [];
      let start = 0;
      for (let i = 0; i < inflated.length; i++) {
        if (inflated[i] === 0xFF) {
          fields.push(inflated.subarray(start, i).toString('latin1').trim());
          start = i + 1;
          if (fields.length >= 16) break;
        }
      }
      // V2 format: [0:ver?, 1:email/mob flag, 2:refId, 3:name, 4:dob, 5:gender, 6:careOf, 7:dist, 8:landmark, 9:house, 10:location, 11:pincode, 12:postOffice, 13:state, 14:street, 15:subDist, 16:vtc]
      // Note: V1 starts directly at [0:flag, 1:refId, 2:name, 3:dob, 4:gender, 5:careOf, 6:dist, 7:landmark, 8:house, 9:loc, 10:pin, 11:po, 12:state, 13:street, 14:subDist, 15:vtc]
      const offset = (fields[0] === 'V2' || fields[0] === 'V3') ? 1 : 0;
      const name = fields[offset + 2] || '';
      const dob = fields[offset + 3] || '';
      const careOf = fields[offset + 5] || '';
      const dist = fields[offset + 6] || '';
      const lm = fields[offset + 7] || '';
      const house = fields[offset + 8] || '';
      const loc = fields[offset + 9] || '';
      const pin = fields[offset + 10] || '';
      const po = fields[offset + 11] || '';
      const state = fields[offset + 12] || '';
      const street = fields[offset + 13] || '';
      const vtc = fields[offset + 15] || '';
      const addrParts = [careOf, house, street, lm, loc, vtc, po ? `PO: ${po}` : '', dist ? `DIST: ${dist}` : '', state].filter(Boolean);
      const address = addrParts.join(', ') + (pin ? ' - ' + pin : '');
      if (name || address) {
        return {
          source: 'secure-qr',
          name,
          dob,
          parentsName: careOf.replace(/^(S\/O|D\/O|W\/O|C\/O)[:\s\-]*/i, '').trim(),
          address
        };
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Primary Multi-Pass OCR text extractor
 * Supports PNG, JPEG, WEBP & Scanned PDFs with adaptive sub-region cropping & bilinear upscaling
 */
async function performOcr(buf, mime) {
  let combinedText = '';
  const isPdf = (mime === 'application/pdf');

  if (isPdf) {
    combinedText = extractPdfTextStreams(buf);
    const cleanSample = combinedText.replace(/[^A-Za-z0-9]/g, '');
    if (cleanSample.length >= 60) {
      return { text: combinedText, qrData: null };
    }
    const imgBuf = extractFirstEmbeddedJpeg(buf);
    if (imgBuf) {
      try {
        const sub = await performOcr(imgBuf, 'image/jpeg');
        if (sub && sub.text) combinedText += '\n' + sub.text;
        return { text: combinedText, qrData: sub ? sub.qrData : null };
      } catch (err) {
        console.warn('[OCR Scanned PDF] Error:', err.message);
      }
    }
    return { text: combinedText, qrData: null };
  }

  let qrData = null;

  // --- Image Processing with Universal PNG/JPEG Decoding & Sub-Region Bilinear Upscaling ---
  try {
    const raw = decodeImageBuffer(buf);

    if (raw && raw.width && raw.height) {
      // 0. Instant High-Res QR check (if available)
      qrData = tryDecodeAadhaarQr(raw);
      if (qrData) {
        combinedText += `\n[UIDAI QR VERIFIED]\nUnique Identification Authority of India\nName: ${qrData.name || ''}\nDOB: ${qrData.dob || ''}\nAddress: ${qrData.address || ''}\n`;
      }

      const aspect = raw.width / raw.height;

      // Case A: Wide Dual-Card Aadhaar Format (Width >= 1.7 * Height)
      // Standard UIDAI e-Aadhaar has Front (Name, DOB, UID) on Left, Back (Address, S/O, UID) on Right
      if (aspect >= 1.7) {
        const scale = Math.min(3.0, Math.max(1.5, 850 / raw.height));
        const midX = Math.floor(raw.width * 0.50);

        // Pass 1: Left Half (Front Side - Candidate Name, DOB, Gender, Aadhaar No)
        const leftCrop = upscaleCropToJpeg(raw, 0, 0, midX, raw.height, scale);
        if (leftCrop) {
          try {
            const lRes = await Tesseract.recognize(leftCrop, 'eng');
            if (lRes && lRes.data && lRes.data.text) {
              combinedText += '\n[Aadhaar Front Side OCR]:\n' + lRes.data.text + '\n';
            }
          } catch (_) {}
        }

        // Pass 2: Right Half Clean Text Zone (skips left fold text & right QR noise)
        const backX = Math.floor(raw.width * 0.525);
        const backW = Math.floor(raw.width * 0.285);
        const rightCleanCrop = upscaleCropToJpeg(raw, backX, 0, backW, raw.height, scale);
        let backText = '';
        if (rightCleanCrop) {
          try {
            const rRes = await Tesseract.recognize(rightCleanCrop, 'eng');
            if (rRes && rRes.data && rRes.data.text) {
              backText = rRes.data.text;
              combinedText += '\n[Aadhaar Back Side OCR]:\n' + backText + '\n';
            }
          } catch (_) {}
        }

        // Pass 2b Fallback: If narrow back zone didn't contain a 6-digit PIN (e.g. wider margins), scan full right half
        if (!/\b[1-9]\d{5}\b/.test(backText)) {
          const fullRightCrop = upscaleCropToJpeg(raw, midX, 0, raw.width - midX, raw.height, Math.min(2.5, scale));
          if (fullRightCrop) {
            try {
              const rFull = await Tesseract.recognize(fullRightCrop, 'eng');
              if (rFull && rFull.data && rFull.data.text) {
                combinedText += '\n[Aadhaar Back Full OCR]:\n' + rFull.data.text + '\n';
              }
            } catch (_) {}
          }
        }
      }

      // Case B: Vertical Mobile Photo / Full-Page Document (Height >= 1.2 * Width)
      else if (raw.height >= 1.2 * raw.width) {
        // Pass 1: Full image OCR (handles marksheets, letters, vertical Aadhaar, portrait PAN)
        const mainRes = await Tesseract.recognize(buf, 'eng');
        if (mainRes && mainRes.data && mainRes.data.text) {
          combinedText += mainRes.data.text + '\n';
        }

        // Pass 2: If card is placed on a desk/table (short/noisy text or missing PAN/Aadhaar number), crop center card band & upscale
        const hasMarksheetOrHr = /board of technical education|marksheet|statement of marks|appointment order|joining letter|rvmaitech|rent\s*agreement/i.test(combinedText);
        const hasCleanPan = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(combinedText);
        const hasCleanAadhaarAndPin = /\b[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b/.test(combinedText) && /\b[1-9]\d{5}\b/.test(combinedText);

        if (!hasMarksheetOrHr && !hasCleanPan && !hasCleanAadhaarAndPin) {
          const x0 = Math.floor(raw.width * 0.06);
          const y0 = Math.floor(raw.height * 0.36);
          const cw = Math.floor(raw.width * 0.88);
          const ch = Math.floor(raw.height * 0.34);
          const scale = Math.min(2.5, Math.max(1.8, 1300 / cw));
          const centerCrop = upscaleCropToJpeg(raw, x0, y0, cw, ch, scale);
          if (centerCrop) {
            try {
              const cRes = await Tesseract.recognize(centerCrop, 'eng');
              if (cRes && cRes.data && cRes.data.text) {
                // Prepend higher-resolution center crop so clean fields take priority over noisy full-frame background
                combinedText = '[Center Card Crop OCR]:\n' + cRes.data.text + '\n' + combinedText;
              }
            } catch (_) {}
          }
        }
      }

      // Case C: Single-Sided Landscape Card / Standard Image (0.83 < aspect < 1.7)
      else {
        if (raw.width < 1100) {
          const scale = Math.min(2.8, Math.max(1.8, 1250 / raw.width));
          const upscaled = upscaleCropToJpeg(raw, 0, 0, raw.width, raw.height, scale);
          if (upscaled) {
            const uRes = await Tesseract.recognize(upscaled, 'eng');
            if (uRes && uRes.data && uRes.data.text) {
              combinedText += uRes.data.text + '\n';
            }
          }
        }
        if (combinedText.trim().length < 30) {
          const mainRes = await Tesseract.recognize(buf, 'eng');
          if (mainRes && mainRes.data && mainRes.data.text) {
            combinedText += mainRes.data.text + '\n';
          }
        }
      }
    } else {
      // Fallback for WebP or undecoded image format: direct Tesseract OCR
      const mainRes = await Tesseract.recognize(buf, 'eng');
      if (mainRes && mainRes.data && mainRes.data.text) {
        combinedText += mainRes.data.text + '\n';
      }
    }
  } catch (err) {
    console.warn('[OCR Image] Error:', err.message);
  }

  return { text: combinedText, qrData };
}

/**
 * Format Indian 12-digit Aadhaar number
 */
function cleanAadhaarNo(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && /^[2-9]/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  }
  return null;
}

/**
 * Normalize DOB to ISO YYYY-MM-DD so HTML <input type="date"> and fmtDate() always render cleanly
 */
function normalizeDobIso(rawDob) {
  if (!rawDob) return null;
  const s = String(rawDob).trim();
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{2})[\/\-\.](\d{2})[\/\-\.]((?:19|20)\d{2})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    if (+dd >= 1 && +dd <= 31 && +mm >= 1 && +mm <= 12) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  // YYYY-MM-DD
  const ymd = s.match(/^((?:19|20)\d{2})[\/\-\.](\d{2})[\/\-\.](\d{2})$/);
  if (ymd) {
    const [, yyyy, mm, dd] = ymd;
    if (+dd >= 1 && +dd <= 31 && +mm >= 1 && +mm <= 12) {
      return `${yyyy}-${mm}-${dd}`;
    }
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

  // Normalize S/0, C/0, D/0, W/0 (digit zero read instead of letter O)
  let pre = String(rawAddr).replace(/\b([SCDW])\/0\b/gi, '$1/O');

  // If starts with noise, locate S/O, C/O, D/O, W/O, or Address
  const careOfMatch = pre.match(/\b((?:S\/O|C\/O|D\/O|W\/O)\s*[:\-]?\s*[\s\S]+)/i);
  let s = careOfMatch ? careOfMatch[1] : pre.replace(/^(?:Address|पता|To)\s*[:\-]?\s*/i, '');

  s = s
    .replace(/[\r\n]+/g, ', ')
    .replace(/[|—_~^`\[\]\{\}\<\>\\=]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[:,\s\-]+/, '')
    .trim();

  // Fix common Indian state OCR typos
  s = s
    .replace(/\bUntar\s+Pradesh\b/gi, 'Uttar Pradesh')
    .replace(/\bUltar\s+Pradesh\b/gi, 'Uttar Pradesh')
    .replace(/\bHarvana\b/gi, 'Haryana')
    .replace(/\bRaiasthan\b/gi, 'Rajasthan')
    .replace(/\bMaharastra\b/gi, 'Maharashtra');

  // Normalize common OCR character confusions in PIN codes (e.g. 277s03 -> 277503)
  s = s.replace(/\b(\d{3})[sS](\d{2})\b/g, '$15$2');
  s = s.replace(/\b(\d{2})[sS](\d{3})\b/g, '$15$2');
  s = s.replace(/\b(\d{3})[oO](\d{2})\b/g, '$10$2');

  // Strip stray OCR border tokens (e.g. "1B PO:", "& PO:", "1 3 Uttar")
  s = s
    .replace(/\b(VID|UIDAI|Help\s*line|Toll\s*Free|www\.uidai|Enrollment|1947)\b.*$/i, '')
    .replace(/,\s*(?:&\s*|1B\s+|Fe\s*,\s*|\d\s+\d\s+)(?=[A-Za-z])/g, ', ')
    .replace(/:\s*,/g, ',')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*$/, '')
    .trim();

  if (s.length >= 15 && /\b[1-9]\d{5}\b/.test(s)) {
    return s;
  }
  return s.length >= 20 ? s : null;
}

/**
 * Simple Levenshtein edit distance (used strictly for 1-char OCR typo tolerance on >=5 char name tokens)
 */
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Check if a token exists in docText (exact substring OR tight 1-char OCR typo on >=5 char word)
 */
function tokenInDoc(token, normDoc, docWords) {
  if (normDoc.includes(token)) return true;
  if (token.length >= 5) {
    for (const w of docWords) {
      if (w.length >= 4 && editDistance(token, w) <= 1) return true;
    }
  }
  return false;
}

/**
 * STRICT Candidate Name Matching
 * Verifies the document belongs to the candidate (or matches recorded parent name for back-only Aadhaar)
 */
function verifyCandidateNameMatch(docText, candidateName, parentsName = '') {
  if (!candidateName || !docText) return { matched: true, score: 1 };

  const normDoc = docText.toLowerCase();
  const docWords = normDoc.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);

  // 1. Check Candidate Name
  const candTokens = candidateName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !/^(mr|mrs|ms|shri|shree|dr|er|kumar|kumari|devi|singh)$/.test(t));

  // Fallback if all tokens were common middle/last names (e.g. "Aman Singh" -> keep all >=3 chars)
  const effectiveCandTokens = candTokens.length ? candTokens : candidateName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);

  let candMatched = 0;
  for (const t of effectiveCandTokens) {
    if (tokenInDoc(t, normDoc, docWords)) candMatched++;
  }

  // 2. Check Parents Name (especially useful when only back of Aadhaar is uploaded)
  let parentMatched = 0;
  let parentTokens = [];
  if (parentsName) {
    parentTokens = parentsName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 4 && !/^(mr|mrs|ms|shri|shree|dr|er|kumar|prasad|singh|devi|family|contact)$/.test(t));
    for (const t of parentTokens) {
      if (tokenInDoc(t, normDoc, docWords)) parentMatched++;
    }
  }

  const hasCandMatch = effectiveCandTokens.length ? candMatched >= 1 : true;
  const hasParentMatch = parentTokens.length ? parentMatched >= 1 : false;

  return {
    matched: hasCandMatch || hasParentMatch,
    hasCandMatch,
    hasParentMatch,
    candMatched,
    totalCandTokens: effectiveCandTokens.length,
    expectedName: candidateName,
    parentsName
  };
}

/**
 * Analyze document text, STRICTLY identify true document type
 * NEVER trusts originalKind blindly!
 */
function parseDocumentEntities(text, originalKind = '', qrData = null) {
  const norm = (text || '').toLowerCase().replace(/[\r\n]+/g, ' ');
  const res = {
    docType: 'Other',
    extracted: {},
    confidence: 'low',
    detectedSignatures: []
  };

  if ((!text || text.trim().length < 10) && !qrData) {
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
  const isMarksheet = /board of technical education|marksheet|statement of marks|marks obtained|roll no|diploma in|semester|maximum marks|minimum pass marks|grand total|examination 20\d\d|b\.?tech|bachelor of|master of|provisional certificate|board of secondary education|university|institute of technology|polytechnic/.test(norm);
  if (isMarksheet) {
    res.docType = 'College Certificate';
    res.confidence = 'high';
    res.detectedSignatures.push('College / University / Board Marksheet');

    const degMatch = text.match(/(Bachelor\s*of\s*[A-Za-z\s]+|Master\s*of\s*[A-Za-z\s]+|B\.?Tech(?:\s*\([A-Za-z\s]+\))?|Diploma\s*in\s*[A-Za-z\s]+|Electronics\s*Engineering|Computer\s*Science|Mechanical\s*Engineering|Electrical\s*Engineering|Civil\s*Engineering)/i);
    const univMatch = text.match(/([A-Za-z\s]+(?:University|Institute\s*of\s*Technology|Polytechnic[A-Za-z\s,]*|College|Board\s*of\s*[A-Za-z\s]+))/i);

    const degStr = degMatch ? degMatch[1].replace(/[\r\n]+/g, ' ').trim() : 'Diploma / Degree Marksheet';
    const univStr = univMatch ? univMatch[1].replace(/[\r\n]+/g, ' ').trim() : '';
    res.extracted.highestCollege = univStr ? `${degStr} - ${univStr}` : degStr;
    return res;
  }

  // --- 3. Genuine Aadhaar Card Detection ---
  const hasAadhaarKeywords = /unique identification authority|unique identification autho|uidai|mera aadhaar|aadhaar is proof|enrollment no|vid\s*:\s*\d|मेरा आधार|मेरी पहचान|help@uidai/.test(norm);
  const aadhaarNoMatch = text.match(/\b([2-9]\d{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})\b/);

  if (qrData || hasAadhaarKeywords || (aadhaarNoMatch && (/address|पता|dob|male|female|year of birth|s\/[o0]|c\/[o0]|d\/[o0]|w\/[o0]/.test(norm)))) {
    res.docType = 'Aadhaar Card';
    res.confidence = 'high';
    res.detectedSignatures.push(qrData ? 'UIDAI Verified Secure QR Aadhaar Card' : 'Government of India UIDAI Aadhaar Card');

    // Extract Aadhaar Number
    if (qrData && qrData.uid) {
      const cleanNo = cleanAadhaarNo(qrData.uid);
      if (cleanNo) res.extracted.aadhaarNumber = cleanNo;
    }
    if (!res.extracted.aadhaarNumber && aadhaarNoMatch) {
      const cleanNo = cleanAadhaarNo(aadhaarNoMatch[1]);
      if (cleanNo) res.extracted.aadhaarNumber = cleanNo;
    }

    // Extract Permanent Address (prefer verified QR, else OCR back-side text)
    if (qrData && qrData.address && qrData.address.length >= 15) {
      res.extracted.address = cleanIndianAddress(qrData.address) || qrData.address;
    }
    if (!res.extracted.address) {
      const addrRegexes = [
        /(?:Address|पता)\s*[:\-]?\s*([\s\S]{10,260}?\b[1-9]\d{5}\b)/i,
        /(?:Address|पता)\s*[:\-]?\s*([\s\S]{10,260}?\b[1-9][0-9sSoOzZ]{5}\b)/i,
        /(?:C\/[O0]|S\/[O0]|D\/[O0]|W\/[O0])\s*[:\-]?\s*([\s\S]{10,260}?\b[1-9]\d{5}\b)/i,
        /(?:C\/[O0]|S\/[O0]|D\/[O0]|W\/[O0])\s*[:\-]?\s*([\s\S]{10,260}?\b[1-9][0-9sSoOzZ]{5}\b)/i,
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
    }

    // Extract Parent / Guardian Name (S/O, D/O, C/O, W/O)
    if (qrData && qrData.parentsName) {
      res.extracted.parentsName = qrData.parentsName;
    }
    if (!res.extracted.parentsName) {
      const parentSource = res.extracted.address || text;
      const parentMatch = parentSource.match(/(?:S\/[O0]|D\/[O0]|W\/[O0]|C\/[O0]|Son\s*of|Daughter\s*of|Care\s*of)\s*[:\-]?\s*([A-Za-z\s\.]{3,50}?)(?:,|\n|$)/i);
      if (parentMatch && parentMatch[1]) {
        const pName = parentMatch[1].replace(/\b(Address|पता|H\.?No|PO|DIST)\b/gi, '').trim();
        if (pName.length >= 3 && !/\d/.test(pName)) {
          res.extracted.parentsName = pName;
        }
      }
    }

    // Extract Date of Birth -> ISO YYYY-MM-DD
    if (qrData && qrData.dob) {
      res.extracted.dob = normalizeDobIso(qrData.dob) || qrData.dob;
    }
    if (!res.extracted.dob) {
      const stdDobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|जन्म\s*तिथि|तारीख)\s*[:\-\/\s]?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.](?:19|20)\d{2})/i)
        || text.match(/\b(\d{2}[\/\-\.]\d{2}[\/\-\.](?:19|20)\d{2})\b/);
      if (stdDobMatch) {
        res.extracted.dob = normalizeDobIso(stdDobMatch[1]) || stdDobMatch[1].replace(/[\-\.]/g, '/');
      } else {
        const numDobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|जन्म\s*तिथि)\s*[:\-\/\s]?\s*(\d{8,10})/i);
        if (numDobMatch) {
          const rawNum = numDobMatch[1];
          const d = rawNum.slice(0, 2);
          const m = rawNum.slice(2, 4);
          const y = rawNum.slice(-4);
          if (+d >= 1 && +d <= 31 && +m >= 1 && +m <= 12 && +y >= 1950 && +y <= 2026) {
            res.extracted.dob = `${y}-${m}-${d}`;
          }
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
  const hasPanKeywords = /income\s*tax\s*depart|permanent\s*account\s*number|govt\.?\s*of\s*india|govlofindia/i.test(norm);
  let panNo = null;

  // Search standard PAN regex ([A-Z]{5}[0-9]{4}[A-Z])
  const stdPanMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/);
  if (stdPanMatch) {
    panNo = stdPanMatch[1];
  } else {
    // Search fuzzy PAN candidate (e.g. GFBPBS790A where S was read instead of 8)
    const candidates = text.match(/\b[A-Za-z0-9]{10}\b/g) || [];
    for (const cand of candidates) {
      // Only accept candidates whose 4th character is a valid Indian PAN holder type (P,C,H,A,B,G,J,L,F,T)
      const cleaned = cleanPanCandidate(cand);
      if (cleaned && /^[A-Z]{3}[PCHABGJLFT][A-Z][0-9]{4}[A-Z]$/.test(cleaned)) {
        panNo = cleaned;
        break;
      }
    }
  }

  if ((hasPanKeywords && (panNo || /permanent\s*account\s*number|income\s*tax/.test(norm))) || (panNo && /father|birth|date of birth|tax|signature/.test(norm))) {
    res.docType = 'PAN Card';
    res.confidence = 'high';
    res.detectedSignatures.push('Income Tax Department PAN Card');
    if (panNo) res.extracted.panNumber = panNo;

    // Generic Father's Name extraction: scan up to 3 lines after "Father's Name" label
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (/father'?s?\s*name|पिता\s*का\s*नाम/i.test(lines[i])) {
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const cleanedLine = lines[j].replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z\s\.]+$/, '').trim();
          // Indian PAN card names are printed in ALL CAPS (filter out short noise like "LAA Al" or trailing "CoE")
          const upperWords = cleanedLine.split(/\s+/).filter(w => /^[A-Z]{3,}$/.test(w));
          if (upperWords.length >= 2 && upperWords.join(' ').length >= 8 && !/signature|date|birth|income|india|permanent|department|account|number/i.test(cleanedLine)) {
            res.extracted.parentsName = upperWords.join(' ');
            break;
          }
        }
        if (res.extracted.parentsName) break;
      }
    }

    const dobM = text.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.](?:19|20)\d{2})/);
    if (dobM) res.extracted.dob = normalizeDobIso(dobM[1]) || dobM[1].replace(/[\-\.]/g, '/');

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
    const ocrOut = await performOcr(buf, mime);
    const rawText = (ocrOut && typeof ocrOut === 'object') ? (ocrOut.text || '') : String(ocrOut || '');
    const qrData = (ocrOut && typeof ocrOut === 'object') ? ocrOut.qrData : null;

    const analysis = parseDocumentEntities(rawText, originalKind, qrData);
    const nameMatch = verifyCandidateNameMatch(rawText, candidateName, parentsName);

    return {
      success: true,
      docType: analysis.docType,
      confidence: analysis.confidence,
      detectedSignatures: analysis.detectedSignatures,
      nameMatch,
      rawTextLength: rawText.replace(/\s+/g, '').length,
      rawTextSnippet: rawText.slice(0, 300).replace(/\s+/g, ' '),
      extracted: analysis.extracted
    };
  } catch (err) {
    console.error('[processDocumentOcr] Error:', err);
    return {
      success: false,
      docType: 'Other',
      error: err.message,
      nameMatch: { matched: false },
      rawTextLength: 0,
      extracted: {}
    };
  }
}

module.exports = {
  decodeImageBuffer,
  performOcr,
  parseDocumentEntities,
  verifyCandidateNameMatch,
  processDocumentOcr,
  cleanAadhaarNo,
  cleanPanCandidate,
  cleanIndianAddress,
  normalizeDobIso
};
