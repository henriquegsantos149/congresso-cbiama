/**
 * Serverless function to sync contact in ActiveCampaign and add tag
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ACTIVE_API_KEY || process.env.API_KEY_ACTIVE;
  const apiBase = (process.env.API_URL_ACTIVE ? `${process.env.API_URL_ACTIVE}/api/3` : null) || 'https://ambientalpro.api-us1.com/api/3';

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing ACTIVE_API_KEY or API_KEY_ACTIVE environment variable' });
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

    // Cache or fetch custom field IDs from ActiveCampaign
    let fieldMap = {};
    try {
      const fieldsRes = await fetch(`${apiBase}/fields?limit=100`, {
        method: 'GET',
        headers: { 'Api-Token': apiKey }
      });
      const fieldsData = await fieldsRes.json();
      if (fieldsData.fields && Array.isArray(fieldsData.fields)) {
        fieldsData.fields.forEach(f => {
          fieldMap[f.title.trim().toLowerCase()] = f.id;
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar campos customizados do ActiveCampaign:', e);
    }

    const getFieldId = (title, fallbackId) => {
      const lower = title.trim().toLowerCase();
      return fieldMap[lower] || fallbackId;
    };

    // Map custom fields (fieldValues) com os IDs exatos de [C2][CBIAMA] no ActiveCampaign
    const fieldValues = [];

    // [C2][CBIAMA] UTM Term -> ID 908
    if (utm_term) {
      const fieldId = getFieldId('[C2][CBIAMA] UTM Term', '908');
      fieldValues.push({ field: fieldId, value: utm_term });
    }

    // [C2][CBIAMA] UTM Possui Graduação -> ID 910
    const possuiGrad = utm_possui_graduacao || utm_graduacao || utm_grad;
    if (possuiGrad) {
      const fieldId = getFieldId('[C2][CBIAMA] UTM Possui Graduação', '910');
      fieldValues.push({ field: fieldId, value: possuiGrad });
    }

    // [C2][CBIAMA] UTM Área de Formação -> ID 911 (fallback para a área selecionada no form)
    const areaFormacao = utm_area_de_formacao || utm_area || area;
    if (areaFormacao) {
      const fieldId = getFieldId('[C2][CBIAMA] UTM Área de Formação', '911');
      fieldValues.push({ field: fieldId, value: areaFormacao });
    }

    // [C2][CBIAMA] UTM Campaign -> ID 912
    if (utm_campaign) {
      const fieldId = getFieldId('[C2][CBIAMA] UTM Campaign', '912');
      fieldValues.push({ field: fieldId, value: utm_campaign });
    }

    // [C2][CBIAMA] UTM Source -> ID 913
    if (utm_source) {
      const fieldId = getFieldId('[C2][CBIAMA] UTM Source', '913');
      fieldValues.push({ field: fieldId, value: utm_source });
    }

    // [C2][CBIAMA] UTM Medium -> ID 914
    if (utm_medium) {
      const fieldId = getFieldId('[C2][CBIAMA] UTM Medium', '914');
      fieldValues.push({ field: fieldId, value: utm_medium });
    }

    // [C2][CBIAMA] UTM Content -> ID 915
    if (utm_content) {
      const fieldId = getFieldId('[C2][CBIAMA] UTM Content', '915');
      fieldValues.push({ field: fieldId, value: utm_content });
    }

    // [C2][CBIAMA] UTM Data de Inscrição -> ID 909
    const dataInscricaoFieldId = getFieldId('[C2][CBIAMA] UTM Data de Inscrição', '909');
    fieldValues.push({ field: dataInscricaoFieldId, value: new Date().toISOString() });

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

    // 2. Add Tag [C2][CBIAMA] Lead (ID: 488) to Contact
    const targetTagName = '[C2][CBIAMA] Lead';
    let tagId = '488';

    try {
      const searchRes = await fetch(`${apiBase}/tags?search=${encodeURIComponent(targetTagName)}`, {
        method: 'GET',
        headers: { 'Api-Token': apiKey }
      });
      const searchData = await searchRes.json();
      if (searchData.tags && searchData.tags.length > 0) {
        const found = searchData.tags.find(t => t.tag === targetTagName);
        if (found) tagId = found.id;
      }
    } catch (errTagSearch) {
      console.warn('Erro ao buscar tag no ActiveCampaign:', errTagSearch);
    }

    if (tagId) {
      const tagResponse = await fetch(`${apiBase}/contactTags`, {
        method: 'POST',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactTag: {
            contact: contactId,
            tag: tagId
          }
        }),
      });

      if (!tagResponse.ok) {
        const tagData = await tagResponse.json();
        console.warn(`Aviso: Falha ao adicionar tag ao contato. ${tagData.message || ''}`);
      } else {
        console.log(`Tag ${targetTagName} (ID: ${tagId}) adicionada com sucesso ao contato ${contactId}`);
      }
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
