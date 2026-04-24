const { spawn } = require("node:child_process");
const fs        = require("node:fs");
const path      = require("node:path");
const db        = require("./db");

const CRAWLER_PATH = path.resolve(process.env.CRAWLER_PATH ?? "../rcn-crawler");
const CRAWLER_MAIN = path.join(CRAWLER_PATH, "src", "main.js");
const CRAWLER_URLS = path.join(CRAWLER_PATH, "urls.txt");
const CRAWLER_DATA = path.join(CRAWLER_PATH, "data");
const RESULTS_FILE = path.join(CRAWLER_DATA, "results.json");

let busy = false;

function sanitizeLog(text) {
    return text
        .replace(/\x1b\[[0-9;]*m/g, "")   // strip ANSI colour codes
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function clearCrawlerState() {
    for (const f of ["visited.json", "queue.json", "results.json", "unique-links.json"]) {
        const p = path.join(CRAWLER_DATA, f);
        if (fs.existsSync(p)) fs.unlinkSync(p);
    }
}

function processJob(job) {
    busy = true;
    db.updateJob(job.id, { status: "running", started_at: new Date().toISOString() });

    clearCrawlerState();
    fs.writeFileSync(CRAWLER_URLS, job.url.trim() + "\n", "utf-8");

    const args = ["--max-pages=50", "--debug=false"];
    if (job.search_terms) args.push(`--search-terms=${job.search_terms}`);
    if (job.onion_only)   args.push("--onion-only=true");

    const proc = spawn("node", [CRAWLER_MAIN, ...args], {
        cwd:   CRAWLER_PATH,
        env:   process.env,
        stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", chunk => db.appendLog(job.id, sanitizeLog(chunk.toString())));
    proc.stderr.on("data", chunk => db.appendLog(job.id, sanitizeLog(chunk.toString())));

    proc.on("close", code => {
        let results   = null;
        let pageCount = 0;
        let error     = null;

        if (fs.existsSync(RESULTS_FILE)) {
            try {
                const raw   = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
                const pages = raw.pages ?? [];
                const terms = (job.search_terms ?? "").split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
                const filtered = terms.length
                    ? pages.filter(p => p.success && terms.some(t => (p.matchedTerms ?? []).map(m => m.toLowerCase()).includes(t)))
                    : pages.filter(p => p.success);
                results   = JSON.stringify(filtered);
                pageCount = filtered.length;
            } catch { error = "Failed to parse results"; }
        } else if (code !== 0) {
            error = "Crawl failed — check the live log for details";
        }

        db.updateJob(job.id, {
            status:      error ? "failed" : "done",
            finished_at: new Date().toISOString(),
            results,
            page_count:  pageCount,
            error,
        });

        busy = false;
    });
}

function poll() {
    if (busy) return;
    const job = db.getPendingJob();
    if (job) processJob(job);
}

function purgeOldResults() {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
    const jobs   = db.readAll();
    for (const job of jobs) {
        if (["done", "failed"].includes(job.status) && job.results !== null) {
            const finished = new Date(job.finished_at).getTime();
            if (finished < cutoff) {
                db.updateJob(job.id, { results: null, log: "" });
            }
        }
    }
}

setInterval(poll, 5000);
setInterval(purgeOldResults, 60 * 1000);
console.log("[worker] Job processor started — polling every 5s");
