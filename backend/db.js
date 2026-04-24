/**
 * Simple JSON-file job store. Replaces SQLite for Node v25 compatibility.
 * All operations are synchronous and atomic (write-to-temp + rename).
 */

const fs   = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE  = path.join(DATA_DIR, "jobs.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE))  fs.writeFileSync(DB_FILE, "[]", "utf-8");

function readAll() {
    try { return JSON.parse(fs.readFileSync(DB_FILE, "utf-8")); }
    catch { return []; }
}

function writeAll(jobs) {
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(jobs, null, 2), "utf-8");
    fs.renameSync(tmp, DB_FILE);
}

const db = {
    createJob(job) {
        const jobs = readAll();
        jobs.push(job);
        writeAll(jobs);
    },

    getJob(id) {
        return readAll().find(j => j.id === id) ?? null;
    },

    updateJob(id, updates) {
        const jobs = readAll();
        const idx  = jobs.findIndex(j => j.id === id);
        if (idx === -1) return;
        jobs[idx] = { ...jobs[idx], ...updates };
        writeAll(jobs);
    },

    appendLog(id, text) {
        const jobs = readAll();
        const idx  = jobs.findIndex(j => j.id === id);
        if (idx === -1) return;
        jobs[idx].log = (jobs[idx].log ?? "") + text;
        writeAll(jobs);
    },

    getPendingJob() {
        return readAll().find(j => j.status === "pending") ?? null;
    },

    getActiveByIp(ip) {
        return readAll().find(j => j.ip === ip && ["pending", "running"].includes(j.status)) ?? null;
    },
};

module.exports = db;
