// Backend URL — change this if you deploy the backend somewhere else
const BACKEND_URL = 'https://forms-production-0a37.up.railway.app';

async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function submitForm(formData, pdfBuffer, photos) {
  const data = new FormData();

  // Core metadata
  data.append('foremanName', formData.foremanName);
  data.append('project', formData.project);
  data.append('submissionType', formData.submissionType);
  data.append('date', formData.date);
  data.append('workersOnSite', formData.workersOnSite || '');
  data.append('formFields', JSON.stringify(formData.fields));

  // PDF blob
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const pdfName = buildFileName(formData);
  data.append('pdf', pdfBlob, pdfName);

  // Photos
  for (let i = 0; i < photos.length; i++) {
    data.append('photos', photos[i], photos[i].name || `photo_${i + 1}.jpg`);
  }

  const res = await fetch(`${BACKEND_URL}/submit`, {
    method: 'POST',
    body: data,
    signal: AbortSignal.timeout(120000) // 2-minute timeout for large uploads
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.details || err.error || `Server error ${res.status}`);
  }

  return res.json();
}

