/**
 * Serverless function to sync contact in ActiveCampaign and add tag
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ACTIVE_API_KEY;
  const apiBase = 'https://ambientalpro.api-us1.com/api/3';

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing ACTIVE_API_KEY environment variable' });
  }

  try {
    const {
      name,
      email,
      phone,
      area,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      utm_possui_graduacao,
      utm_graduacao,
      utm_grad,
      utm_area_de_formacao,
      utm_area
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email field' });
    }

    console.log('--- Novo Registro recebido em api/subscribe ---');
    console.log('Dados do lead:', { name, email, phone, area });

    // Split name into first and last
    const nameParts = name ? name.trim().split(' ') : [''];
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // Map custom fields (fieldValues)
    const fieldValues = [];

    // [C1][CBIAMA] UTM Term -> 780
    if (utm_term) {
      fieldValues.push({ field: '780', value: utm_term });
    }

    // [C1][CBIAMA] UTM Possui Graduação -> 782
    const possuiGrad = utm_possui_graduacao || utm_graduacao || utm_grad;
    if (possuiGrad) {
      fieldValues.push({ field: '782', value: possuiGrad });
    }

    // [C1][CBIAMA] UTM Área de Formação -> 783 (fallback to the selected 'area' form field)
    const areaFormacao = utm_area_de_formacao || utm_area || area;
    if (areaFormacao) {
      fieldValues.push({ field: '783', value: areaFormacao });
    }

    // [C1][CBIAMA] UTM Campaign -> 784
    if (utm_campaign) {
      fieldValues.push({ field: '784', value: utm_campaign });
    }

    // [C1][CBIAMA] UTM Source -> 785
    if (utm_source) {
      fieldValues.push({ field: '785', value: utm_source });
    }

    // [C1][CBIAMA] UTM Medium -> 786
    if (utm_medium) {
      fieldValues.push({ field: '786', value: utm_medium });
    }

    // [C1][CBIAMA] UTM Content -> 787
    if (utm_content) {
      fieldValues.push({ field: '787', value: utm_content });
    }

    // UTM Data de Inscrição (Preencha com new Date().toISOString()) -> 781
    fieldValues.push({ field: '781', value: new Date().toISOString() });

    const contactPayload = {
      contact: {
        email,
        firstName,
        lastName,
        phone: phone || '',
        fieldValues
      }
    };

    // 1. Sync Contact
    const syncResponse = await fetch(`${apiBase}/contact/sync`, {
      method: 'POST',
      headers: {
        'Api-Token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });

    const syncData = await syncResponse.json();

    if (!syncResponse.ok) {
      throw new Error(syncData.message || 'Error syncing contact in ActiveCampaign');
    }

    const contactId = syncData.contact.id;
    console.log(`Contato sincronizado com sucesso. ID: ${contactId}`);

    // 2. Add Tag [C1][CBIAMA] Lead (ID: 454) to Contact
    const tagResponse = await fetch(`${apiBase}/contactTags`, {
      method: 'POST',
      headers: {
        'Api-Token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactTag: {
          contact: contactId,
          tag: '454'
        }
      }),
    });

    if (!tagResponse.ok) {
      const tagData = await tagResponse.json();
      console.warn(`Aviso: Falha ao adicionar tag ao contato. ${tagData.message || ''}`);
    } else {
      console.log(`Tag [C1][CBIAMA] Lead adicionada com sucesso ao contato ${contactId}`);
    }

    return res.status(200).json({
      success: true,
      contactId,
      email
    });

  } catch (error) {
    console.error('Erro na integração com ActiveCampaign:', error);
    return res.status(500).json({ error: error.message });
  }
}
