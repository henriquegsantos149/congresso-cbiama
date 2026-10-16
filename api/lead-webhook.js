const WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/CjEOBshy5Npf1Ri3eL4n/webhook-trigger/f0c49ef6-827f-4f91-8f28-204be8d7209b';
const FIELDS = [
  'name', 'email', 'phone', 'area', 'graduacao',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'utm_possui_graduacao', 'utm_area_de_formacao'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;
  if (!body || typeof body.email !== 'string' || !body.email.trim()) {
    return res.status(400).json({ error: 'Missing email field' });
  }

  const payload = Object.fromEntries(FIELDS.map(key => [
    key, typeof body[key] === 'string' ? body[key] : ''
  ]));

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      console.warn('Lead webhook returned status:', response.status);
      return res.status(502).json({ success: false });
    }
    return res.status(200).json({ success: true });
  } catch {
    console.warn('Lead webhook delivery failed');
    return res.status(502).json({ success: false });
  }
}
