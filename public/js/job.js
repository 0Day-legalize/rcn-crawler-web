const jobId = new URLSearchParams(location.search).get("id");
if (!jobId) location.href = "/";

let logOffset = 0;
let polling   = null;

const badgeEl     = document.getElementById("badge");
const statusText  = document.getElementById("status-text");
const metaEl      = document.getElementById("meta");
const logEl       = document.getElementById("log");
const resultsList = document.getElementById("results-list");
const emptyEl     = document.getElementById("empty");
const exportRow   = document.getElementById("export-row");

document.getElementById("btn-download").href = `/api/jobs/${jobId}/download`;

const BADGE_MAP = {
  pending: ["badge-pending", "Waiting in queue…"],
  running: ["badge-running", "Crawl in progress…"],
  done:    ["badge-done",    "Operation complete"],
  failed:  ["badge-failed",  "Operation failed"],
};

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function colorLog(line) {
  if (/error|fail/i.test(line))                   return `<span style="color:#c0392b">${line}</span>`;
  if (/warn/i.test(line))                         return `<span style="color:#f39c12">${line}</span>`;
  if (/✓|done|success|graph|circuit/i.test(line)) return `<span style="color:#2ecc71">${line}</span>`;
  return `<span style="color:#3a3a3a">${line}</span>`;
}

function renderPage(p) {
  const isOnion = (p.baseHost ?? "").endsWith(".onion");
  const terms   = p.matchedTerms ?? [];
  const dls     = p.downloads ?? [];
  const title   = p.meta?.title ?? p.url;
  return `<div class="result-item">
    <div class="result-title">${esc(title)}</div>
    <div class="result-url">${esc(p.url)}</div>
    <div class="result-meta">
      ${isOnion ? '<span class="rbadge rb-onion">.onion</span>' : '<span class="rbadge rb-clear">clearnet</span>'}
      ${terms.map(t => `<span class="rbadge rb-term">${esc(t)}</span>`).join("")}
      ${dls.length ? `<span class="rbadge rb-dl">&#8659; ${dls.length} files</span>` : ""}
    </div>
  </div>`;
}

async function poll() {
  try {
    const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());

    const [cls, text] = BADGE_MAP[job.status] ?? ["badge-pending", job.status];
    badgeEl.className = `badge ${cls}`;
    badgeEl.innerHTML = job.status === "running"
      ? `<div class="dot-live"></div>${job.status}`
      : job.status;
    statusText.textContent = text;

    metaEl.innerHTML = [
      `<span>Target:</span> ${esc(job.url)}`,
      job.search_terms ? `<span>Terms:</span> ${esc(job.search_terms)}` : "",
      job.started_at   ? `<span>Started:</span> ${new Date(job.started_at).toLocaleTimeString()}` : "",
      job.finished_at  ? `<span>Finished:</span> ${new Date(job.finished_at).toLocaleTimeString()}` : "",
      job.page_count   ? `<span>Pages:</span> ${job.page_count}` : "",
      job.error        ? `<span style="color:#c0392b">Error:</span> ${esc(job.error)}` : "",
    ].filter(Boolean).join(" &nbsp;&middot;&nbsp; ");

    const log     = job.log ?? "";
    const newPart = log.slice(logOffset);
    if (newPart) {
      logOffset = log.length;
      const atBottom = logEl.scrollHeight - logEl.scrollTop <= logEl.clientHeight + 20;
      const lines = newPart.split("\n").filter(Boolean).map(colorLog).join("\n");
      if (logEl.textContent === "Waiting for job to start…") logEl.innerHTML = "";
      logEl.innerHTML += lines + "\n";
      if (atBottom) logEl.scrollTop = logEl.scrollHeight;
    }

    if (job.status === "done" || job.status === "failed") {
      clearInterval(polling);
      if (job.status === "done") {
        const r = await fetch(`/api/jobs/${jobId}/results`).then(res => res.json());
        const pages = r.pages ?? [];
        if (pages.length) {
          emptyEl.style.display = "none";
          exportRow.style.display = "flex";
          resultsList.innerHTML = pages.map(renderPage).join("");
        } else {
          emptyEl.textContent = "No matching pages found.";
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

poll();
polling = setInterval(poll, 3000);
