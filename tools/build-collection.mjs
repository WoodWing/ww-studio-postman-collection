#!/usr/bin/env node
// Rebuilds the WoodWing Studio Postman collection from code (folders/*.mjs).
//
// Usage: node build-collection.mjs <in-collection.json> <out-collection.json>
//
// The input collection is only used for its "info" block and the descriptions of the webhook folders;
// every request is generated. Run lint-collection.mjs on the output to check it against the SDK.

import fs from 'node:fs';
import { administration, systemAdministration, variables as admVars } from './folders/administration.mjs';
import { digitalArticles, printArticles } from './folders/articles.mjs';
import { planning, variables as plnVars } from './folders/planning.mjs';
import { connectWebhooks, variables as whVars, webhooks } from './folders/webhooks.mjs';
import { variables as wflVars, workflow } from './folders/workflow.mjs';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
    console.error('Usage: node build-collection.mjs <in-collection.json> <out-collection.json>');
    process.exit(2);
}

const original = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const descriptionOf = name => original.item.find(it => it.name === name)?.description;

const collection = {
    info: {
        ...original.info,
        description: [
            'Postman collection for the WoodWing Studio Server JSON-RPC interfaces: Workflow (`index.php`), Administration (`adminindex.php`), System Administration (`sysadminindex.php`), Planning (`editorialplan.php`) and the Webhooks / Connect Webhooks plug-ins (`pluginindex.php`).',
            '',
            'The Workflow, Administration, Planning and webhook folders can each be run top to bottom as a self-cleaning test (Collection Runner or Newman) against a **test** server. See the folder descriptions.',
            '',
            'Requests are generated and checked against the Studio Server TypeScript SDK. Variable naming: IDs end in `_Id`; test-run variables are prefixed per folder (`Adm_`, `Wfl_`, `Pln_`, `Wh_`, `Cwh_`).',
        ].join('\n'),
    },
    item: [
        workflow,
        administration,
        systemAdministration,
        planning,
        connectWebhooks(descriptionOf('Connect Webhooks')),
        webhooks(descriptionOf('Webhooks')),
        digitalArticles,
        printArticles,
    ],
    variable: Object.entries({ ...admVars, ...wflVars, ...plnVars, ...whVars })
        .map(([key, value]) => ({ key, value, type: 'string' })),
};

fs.writeFileSync(outPath, JSON.stringify(collection, null, '\t') + '\n');

let requests = 0;
(function count(items) { for (const it of items) it.item ? count(it.item) : requests++; })(collection.item);
console.log(`Wrote ${outPath} (${requests} requests)`);
