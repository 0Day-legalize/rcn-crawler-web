const tosEl     = document.getElementById('tos');
const submitBtn = document.getElementById('btn-submit');
const errorEl   = document.getElementById('error-msg');

tosEl.addEventListener('change', () => { submitBtn.disabled = !tosEl.checked; });

function showError(msg) { errorEl.textContent = msg; errorEl.style.display = 'block'; }

submitBtn.addEventListener('click', async () => {
  errorEl.style.display = 'none';
  const url         = document.getElementById('url').value.trim();
  const searchTerms = document.getElementById('terms').value.trim();
  const onionOnly   = document.getElementById('onion-only').checked;

  if (!url) { showError('Target URL is required.'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Initializing...';

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, searchTerms, onionOnly, tosAccepted: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error ?? 'Failed to submit job.');
      if (data.jobId) window.location.href = `/job.html?id=${data.jobId}`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Execute Crawl →';
      return;
    }
    window.location.href = `/job.html?id=${data.jobId}`;
  } catch (err) {
    showError(`Connection failed: ${err.message}`);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Execute Crawl →';
  }
});
