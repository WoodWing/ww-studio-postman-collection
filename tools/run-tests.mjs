#!/usr/bin/env node
// Runs the self-cleaning test folders of the collection against a live Studio Server with Newman.
//
// Usage: node run-tests.mjs [folder ...] [--env studio.postman_environment.json] [--collection build/...json]
//   Folders default to: Administration, "System Administration", Workflow, Planning, Webhooks, "Connect Webhooks".
//
// Each folder is a separate Newman run (each one sets up and tears down its own test data). A JSON report per
// folder is written to build/reports/, and a summary table is printed at the end.

import fs from 'node:fs';
import path from 'node:path';
import newman from 'newman';

const args = process.argv.slice(2);
const opt = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 ? args.splice(i, 2)[1] : def;
};
const envPath = opt('--env', 'studio.postman_environment.json');
const collectionPath = opt('--collection', 'build/WoodWing Studio.postman_collection.json');
const folders = args.length ? args : ['Administration', 'System Administration', 'Workflow', 'Planning', 'Webhooks', 'Connect Webhooks'];

if (!fs.existsSync(envPath)) {
    console.error(`Environment file ${envPath} not found. Copy studio.postman_environment.example.json and fill it in.`);
    process.exit(2);
}
fs.mkdirSync('build/reports', { recursive: true });

const collectionJson = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
function countRequests(items) {
    return items.reduce((sum, it) => sum + (it.item ? countRequests(it.item) : 1), 0);
}

function run(folder) {
    const folderItem = collectionJson.item.find(it => it.name === folder);
    const total = folderItem ? countRequests(folderItem.item) : 0;
    return new Promise(resolve => {
        const reportFile = path.join('build/reports', `${folder.replace(/\W+/g, '-')}.json`);
        newman.run({
            collection: collectionJson,
            environment: JSON.parse(fs.readFileSync(envPath, 'utf8')),
            folder,
            reporters: ['cli', 'json'],
            reporter: { json: { export: reportFile }, cli: { noSummary: false } },
            timeoutRequest: 120000,
            insecure: process.env.STUDIO_INSECURE === '1',
        }, (err, summary) => {
            if (err) {
                resolve({ folder, error: err.message });
                return;
            }
            const executions = summary.run.executions;
            // Count requests, not executions: Newman can report more than one execution for a request.
            const skipped = total - new Set(executions.map(e => e.item.id)).size;
            const failedRequests = new Set(summary.run.failures.map(f => f.source && f.source.name));
            resolve({
                folder,
                requests: total,
                skipped,
                assertions: summary.run.stats.assertions.total,
                failedAssertions: summary.run.stats.assertions.failed,
                failedRequests: [...failedRequests].filter(Boolean),
                reportFile,
            });
        });
    });
}

const results = [];
for (const folder of folders) {
    console.log(`\n==================== ${folder} ====================`);
    results.push(await run(folder));
}

console.log('\nSummary');
console.log('Folder'.padEnd(24), 'Requests', 'Skipped', 'Assertions', 'Failed');
for (const r of results) {
    if (r.error) {
        console.log(r.folder.padEnd(24), `ERROR: ${r.error}`);
        continue;
    }
    console.log(r.folder.padEnd(24), String(r.requests).padStart(8), String(r.skipped).padStart(7), String(r.assertions).padStart(10), String(r.failedAssertions).padStart(6));
    if (r.failedRequests.length) console.log(' '.repeat(25) + 'failing: ' + r.failedRequests.join(', '));
}
process.exit(results.some(r => r.error || r.failedAssertions) ? 1 : 0);
