// Pure Organic Orders – API (Vercel Serverless Function)
// ทุกคำขอ (ยกเว้น config) ต้องมี Google ID token ของอีเมลที่อยู่ใน ALLOWED_EMAILS
const crypto = require('crypto');

const SHEET_ID = process.env.SHEET_ID || '1LaPd2vaFbApi1CmRymHFHtoiVT5AwWcFzdQQMpCTm4c';
const ALLOWED = (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const R_ORDERS = "'ออเดอร์'!A1:R";
const R_VISITS = "'ผู้เข้าชม'!A1:J";
const R_QUOTES = "'ใบเสนอราคา'!A1:O";
const STATUSES = ['ใหม่', 'ติดต่อแล้ว', 'เสนอราคา', 'ทำตัวอย่าง', 'ผลิต', 'เสร็จ', 'ยกเลิก'];

let saCache = null;
async function saToken() {
  if (saCache && saCache.exp > Date.now() + 60000) return saCache.token;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('service account ใช้งานไม่ได้: ' + (j.error_description || j.error || r.status));
  saCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return saCache.token;
}

async function sheets(method, path, body) {
  const t = await saToken();
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID + path, {
    method,
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Google Sheets error ' + r.status);
  return j;
}
const enc = encodeURIComponent;
const getRange = async (range) => (await sheets('GET', '/values/' + enc(range))).values || [];
const setRange = (range, values) => sheets('PUT', '/values/' + enc(range) + '?valueInputOption=RAW', { values });
const appendRow = (range, values) => sheets('POST', '/values/' + enc(range) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { values });

async function verify(req) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok || !process.env.GOOGLE_CLIENT_ID || !ALLOWED.length) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + enc(tok));
  if (!r.ok) return null;
  const p = await r.json();
  if (p.aud !== process.env.GOOGLE_CLIENT_ID) return null;
  if (!(p.email_verified === true || p.email_verified === 'true')) return null;
  if (Number(p.exp) * 1000 < Date.now()) return null;
  const email = String(p.email || '').toLowerCase();
  return ALLOWED.includes(email) ? email : null;
}

const str = (v, max) => String(v == null ? '' : v).slice(0, max || 2000);
function today() {
  const d = new Date(Date.now() + 7 * 3600 * 1000); // เวลาไทย
  return { d: d.getUTCDate(), m: d.getUTCMonth() + 1, y: d.getUTCFullYear() };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const action = String((req.query && req.query.action) || '');
  try {
    if (action === 'config') return res.status(200).json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
    const who = await verify(req);
    if (!who) return res.status(401).json({ ok: false, error: 'unauthorized' });
    let b = req.body || {};
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }

    if (action === 'data') {
      const [orders, visits, quotes] = await Promise.all([getRange(R_ORDERS), getRange(R_VISITS), getRange(R_QUOTES).catch(() => [])]);
      return res.status(200).json({ ok: true, who, orders, visits, quotes });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    if (action === 'status') {
      const row = parseInt(b.row, 10);
      const value = str(b.value, 40);
      if (!(row >= 2) || !STATUSES.includes(value)) return res.status(400).json({ ok: false, error: 'bad_request' });
      const cur = await getRange("'ออเดอร์'!A" + row + ':P' + row);
      if (!cur[0] || String(cur[0][0]) !== String(b.submitted)) return res.status(409).json({ ok: false, error: 'row_changed' });
      await setRange("'ออเดอร์'!B" + row, [[value]]);
      let note = null;
      if (b.reason) {
        const prev = String(cur[0][15] || '');
        const t = today();
        note = (prev ? prev + '\n' : '') + 'Not Done: ' + str(b.reason, 300) + ' (' + t.d + '/' + t.m + '/' + t.y + ')';
        await setRange("'ออเดอร์'!P" + row, [[note]]);
      }
      return res.status(200).json({ ok: true, note });
    }

    if (action === 'quote') {
      const t = today();
      const pre = 'QT-' + String(t.y).slice(2) + String(t.m).padStart(2, '0') + '-';
      const nos = (await getRange("'ใบเสนอราคา'!A2:A")).map((r) => String(r[0] || ''));
      const n = nos.filter((x) => x.startsWith(pre)).map((x) => parseInt(x.slice(pre.length), 10) || 0);
      const no = pre + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
      const row = (Array.isArray(b.row) ? b.row : []).slice(0, 15).map((v) => (typeof v === 'number' && isFinite(v) ? v : str(v, 45000)));
      while (row.length < 15) row.push('');
      row[0] = no;
      try { const j = JSON.parse(row[14]); j.no = no; row[14] = JSON.stringify(j); } catch (e) {}
      await appendRow("'ใบเสนอราคา'!A1", [row]);
      return res.status(200).json({ ok: true, no });
    }

    if (action === 'quoteStatus') {
      const nos = (await getRange("'ใบเสนอราคา'!A2:A")).map((r) => String(r[0] || ''));
      const i = nos.indexOf(str(b.no, 40));
      if (i < 0) return res.status(404).json({ ok: false, error: 'not_found' });
      await setRange("'ใบเสนอราคา'!N" + (i + 2), [[str(b.status, 60)]]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'bad_action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
