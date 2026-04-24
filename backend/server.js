require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });

const express   = require("express");
const rateLimit = require("express-rate-limit");
const { v4: uuid } = require("uuid");
const zlib      = require("node:zlib");
const path      = require("node:path");
const db        = require("./db");

require("./worker");

const app  = express();
const PORT = process.env.PORT ?? 4000;

app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));

// ── Security headers ──────────────────────────────────────────────────────────

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.setHeader(
        "Content-Security-Policy",
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
        ].join("; ")
    );
    next();
});

app.use(express.static(path.join(__dirname, "..", "public")));

// ── Rate limiting ─────────────────────────────────────────────────────────────

const jobLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max:      5,
    message:  { error: "Too many requests — max 5 crawls per hour per IP." },
    standardHeaders: true,
    legacyHeaders:   false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIp(req) {
    return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

const PRIVATE_IP = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^fc/i,
    /^fe80:/i,
];

function validateUrl(raw) {
    try {
        const u = new URL(raw);
        if (!["http:", "https:"].includes(u.protocol)) return false;

        const h = u.hostname.toLowerCase();

        // always allow .onion — they route through Tor, never reach localhost
        if (h.endsWith(".onion")) return true;

        if (h === "localhost") return false;
        if (PRIVATE_IP.some(r => r.test(h))) return false;

        return true;
    } catch { return false; }
}

const MAX_URL_LEN         = 2048;
const MAX_SEARCH_TERM_LEN = 500;
const SAFE_TERMS          = /^[a-zA-Z0-9 ,.\-_'"]+$/;

// ── API ───────────────────────────────────────────────────────────────────────

app.post("/api/jobs", jobLimit, (req, res) => {
    const { url, searchTerms, onionOnly, tosAccepted } = req.body;

    if (!tosAccepted)                        return res.status(400).json({ error: "You must accept the Terms of Service." });
    if (!url)                                return res.status(400).json({ error: "A seed URL is required." });
    if (url.length > MAX_URL_LEN)            return res.status(400).json({ error: `URL too long (max ${MAX_URL_LEN} chars).` });
    if (!validateUrl(url))                   return res.status(400).json({ error: "Invalid or disallowed URL." });

    if (searchTerms) {
        if (searchTerms.length > MAX_SEARCH_TERM_LEN)
            return res.status(400).json({ error: `Search terms too long (max ${MAX_SEARCH_TERM_LEN} chars).` });
        if (!SAFE_TERMS.test(searchTerms))
            return res.status(400).json({ error: "Search terms contain invalid characters." });
    }

    const ip     = getIp(req);
    const active = db.getActiveByIp(ip);
    if (active) return res.status(409).json({ error: "You already have a job running. Wait for it to finish.", jobId: active.id });

    const id = uuid();
    db.createJob({
        id,
        url:          url.trim(),
        search_terms: searchTerms?.trim() ?? "",
        onion_only:   onionOnly ? true : false,
        status:       "pending",
        created_at:   new Date().toISOString(),
        started_at:   null,
        finished_at:  null,
        ip,
        log:          "",
        results:      null,
        page_count:   0,
        error:        null,
    });

    res.json({ jobId: id });
});

app.get("/api/jobs/:id", (req, res) => {
    const job = db.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const { results, ip, ...safe } = job;
    res.json(safe);
});

app.get("/api/jobs/:id/results", (req, res) => {
    const job = db.getJob(req.params.id);
    if (!job)                   return res.status(404).json({ error: "Job not found" });
    if (job.status !== "done")  return res.status(202).json({ status: job.status });

    const pages = job.results ? JSON.parse(job.results) : [];
    res.json({ pages, pageCount: job.page_count });
});

app.get("/api/jobs/:id/download", (req, res) => {
    const job = db.getJob(req.params.id);
    if (!job)                  return res.status(404).json({ error: "Job not found" });
    if (job.status !== "done") return res.status(202).json({ error: "Job not finished yet" });

    const pages      = job.results ? JSON.parse(job.results) : [];
    const payload    = JSON.stringify({ url: job.url, crawledAt: job.created_at, pages }, null, 2);
    const compressed = zlib.gzipSync(Buffer.from(payload, "utf-8"));
    const ts         = job.created_at.slice(0, 19).replace(/[T:]/g, "-");

    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="rcn-results-${ts}.json.gz"`);
    res.setHeader("Content-Length", compressed.length);
    res.send(compressed);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`RCN Crawler Web → http://0.0.0.0:${PORT}`);
});
