// Helpers to build Postman v2.1 collection items for WoodWing Studio JSON-RPC calls.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSdk } from './sdk-schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SDK = loadSdk(process.env.STUDIO_SDK_DIR || path.join(here, '..', 'sdk'));

const BASE = '{{Studio_Server_URL}}/{{Studio_Server_Directory}}';
export const URLS = {
    wfl: `${BASE}/index.php?protocol=JSON`,
    adm: `${BASE}/adminindex.php?protocol=JSON`,
    sys: `${BASE}/sysadminindex.php?protocol=JSON`,
    pln: `${BASE}/editorialplan.php?protocol=JSON`,
    whreg: `${BASE}/pluginindex.php?plugin=Webhooks&interface=reg&protocol=JSON`,
    cwhreg: `${BASE}/pluginindex.php?plugin=ConnectWebhooks&interface=reg&protocol=JSON`,
};
export const TRANSFER_URL = `${BASE}/transferindex.php`;

const PREFIX = { wfl: 'Wfl', adm: 'Adm', sys: 'Sys', pln: 'Pln', whreg: 'WhReg', cwhreg: 'CwhReg' };

// Numeric variables must be sent unquoted: n('X') is serialized as {{X}} without quotes.
// raw('X') does the same for a variable that holds a whole JSON value (array/object) filled in by a script.
export const n = name => `#{${name}}`;
export const raw = n;
export const s = name => `{{${name}}}`;

export function toUrl(rawUrl) {
    const [base, query = ''] = rawUrl.split('?');
    const hostEnd = base.indexOf('}}') + 2;
    const pathPart = base.slice(hostEnd + 1);
    return {
        raw: rawUrl,
        host: [base.slice(0, hostEnd)],
        path: pathPart ? pathPart.split('/') : [],
        ...(query ? {
            query: query.split('&').map(kv => {
                const [key, ...rest] = kv.split('=');
                return { key, value: rest.join('=') };
            }),
        } : {}),
    };
}

const lines = code => (Array.isArray(code) ? code : code.trim().split('\n'));

function events(o) {
    const event = [];
    if (o.prerequest) event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: lines(o.prerequest) } });
    if (o.test) event.push({ listen: 'test', script: { type: 'text/javascript', exec: lines(o.test) } });
    return event.length ? { event } : {};
}

export function serializeBody(body) {
    return JSON.stringify(body, null, 4).replace(/"#\{(\w+)\}"/g, '{{$1}}');
}

/**
 * Returns an rpc(name, method, fields, options) builder for one interface.
 * The Ticket is added when the SDK request class has a Ticket field (unless options.ticket === false).
 * options: { description, prerequest, test, ticket }
 */
export function rpcBuilder(ns, ticketVar) {
    return function rpc(name, method, fields, o = {}) {
        const schema = SDK[ns === 'cwhreg' ? 'whreg' : ns];
        const reqIface = schema?.interfaces[`${method}Request`];
        const hasTicket = reqIface ? 'Ticket' in reqIface.fields : true;
        const params = {
            ...(hasTicket && o.ticket !== false ? { Ticket: s(ticketVar) } : {}),
            ...fields,
            __classname__: `${PREFIX[ns]}${method}Request`,
        };
        const body = { method, id: '1', params: [params], jsonrpc: '2.0' };
        return {
            name,
            ...events(o),
            request: {
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: { mode: 'raw', raw: serializeBody(body), options: { raw: { language: 'json' } } },
                url: toUrl(URLS[ns]),
                ...(o.description ? { description: o.description } : {}),
            },
            response: [],
        };
    };
}

// A plain (non JSON-RPC) HTTP request.
export function httpRequest(name, method, url, o = {}) {
    return {
        name,
        ...events(o),
        request: {
            method,
            header: o.header ?? [],
            ...(o.body ? { body: o.body } : {}),
            url: toUrl(url),
            ...(o.description ? { description: o.description } : {}),
        },
        response: [],
    };
}

export function folder(name, items, o = {}) {
    return { name, ...(o.description ? { description: o.description } : {}), ...events(o), item: items };
}

// ---- Test script snippets -----------------------------------------------------------------------------------------

/** Stores the value of a JS expression (evaluated against `result`) into a collection variable and asserts it is set. */
export const captureExpr = (expr, varName, label = expr) => `
{
    const result = pm.response.json().result || {};
    let value;
    try { value = ${expr}; } catch (e) { value = undefined; }
    if (value !== undefined && value !== null && value !== '') {
        pm.collectionVariables.set('${varName}', typeof value === 'object' ? JSON.stringify(value) : value);
    }
    pm.test(${JSON.stringify(`${label} captured in ${varName}`)}, () => {
        pm.expect(pm.collectionVariables.get('${varName}'), '${varName}').to.not.be.oneOf([undefined, null, '']);
    });
}`.trim();

// Some services return a list as a JSON object keyed by ID ({"12": {...}}) instead of an array (e.g. Adm
// CreateRoutings / GetRoutings). list() in test scripts normalizes both shapes to an array.
const LIST = `var list = v => (Array.isArray(v) ? v : Object.values(v || {}));`;

/** Stores result.<list>[index].<idField> into a collection variable. */
export const capture = (list, varName, index = 0, idField = 'Id') =>
    `${LIST}\n` + captureExpr(`list(result.${list})[${index}].${idField}`, varName, `${list}[${index}].${idField}`);

/** Asserts that the array (JS expression against `result`, mapped to ids by `idOf`) contains the variable's value. */
export const expectIncludes = (expr, varName, idOf = 'x => x.Id', label = expr) => `
pm.test(${JSON.stringify(`${label} contains {{${varName}}}`)}, () => {
    const result = pm.response.json().result || {};
    const items = (${expr}) || [];
    const ids = items.map(${idOf}).map(String);
    pm.expect(ids).to.include(String(pm.collectionVariables.get('${varName}')));
});`.trim();

export const expectIdIn = (list, varName, idField = 'Id') =>
    `${LIST}\n` + expectIncludes(`list(result.${list})`, varName, `x => x.${idField}`, `result.${list}`);

/** Asserts that a JS expression (against `result`) equals an expected string (after variable substitution). */
export const expectEquals = (expr, expected, label = expr) => `
pm.test(${JSON.stringify(`${label} is ${expected}`)}, () => {
    const result = pm.response.json().result || {};
    let actual;
    try { actual = ${expr}; } catch (e) { actual = undefined; }
    pm.expect(String(actual)).to.eql(pm.variables.replaceIn(${JSON.stringify(expected)}));
});`.trim();

export const expectProp = (list, prop, expected) =>
    `${LIST}\n` + expectEquals(`list(result.${list})[0].${prop}`, expected, `result.${list}[0].${prop}`);

/** Pre-request script that starts a new test run for a prefix: clears <P>_*Id vars and sets <P>_Run_Tag. */
export const startRun = prefix => `
// Start a new test run: forget the IDs of the previous run and pick a unique name suffix.
Object.keys(pm.collectionVariables.toObject())
    .filter(key => /^${prefix}_.*(Id|Ids|Guid)$/.test(key))
    .forEach(key => pm.collectionVariables.unset(key));
pm.collectionVariables.set('${prefix}_Run_Tag', Date.now().toString(36));`;

/** Test script for LogOn calls: stores the ticket in an environment variable. */
export const storeTicket = ticketVar => `
const result = pm.response.json().result;
if (result && result.Ticket) {
    pm.environment.set('${ticketVar}', result.Ticket);
}
pm.test('Ticket stored in ${ticketVar}', () => {
    pm.expect(result && result.Ticket, 'result.Ticket').to.be.a('string').and.not.empty;
});`;

// Runs in front of every request of a folder that uses test-run variables.
export const GUARD_PREREQUEST = `
// Skip a request when one of the test-run variables ({{Adm_*}}, {{Wfl_*}}, {{Pln_*}}, {{Wh_*}}, {{Cwh_*}}) it uses
// is not set, for example because the Create call that should have produced the ID failed, or because an optional
// sample needs a value you have not configured. This keeps Delete calls from ever running with empty filters.
const text = [pm.request.url.toString(), (pm.request.body && pm.request.body.raw) || ''].join('\\n');
const names = [...new Set((text.match(/\\{\\{((?:Adm|Wfl|Pln|Wh|Cwh)_\\w+)\\}\\}/g) || []).map(v => v.slice(2, -2)))];
const missing = names.filter(name => [undefined, null, ''].includes(pm.variables.get(name)));
if (missing.length) {
    console.warn('Skipping "' + pm.info.requestName + '": variable(s) not set: ' + missing.join(', '));
    pm.execution.skipRequest();
}`;

// Runs after every request of a folder: generic checks for JSON-RPC calls (HTTP status only for other calls).
export const RPC_TEST = `
const url = pm.request.url.toString();
const methodMatch = ((pm.request.body && pm.request.body.raw) || '').match(/"method"\\s*:\\s*"(\\w+)"/);
if (!methodMatch) {
    pm.test(pm.info.requestName + ': HTTP 2xx', () => pm.expect(pm.response.code).to.be.within(200, 299));
} else {
    const method = methodMatch[1];
    const prefix = url.includes('sysadminindex.php') ? 'Sys'
        : url.includes('adminindex.php') ? 'Adm'
        : url.includes('editorialplan.php') ? 'Pln'
        : /plugin=ConnectWebhooks/.test(url) ? 'CwhReg'
        : /plugin=Webhooks/.test(url) ? 'WhReg'
        : 'Wfl';
    let body;
    try { body = pm.response.json(); } catch (e) { body = undefined; }

    pm.test(method + ': HTTP 200', () => pm.response.to.have.status(200));
    pm.test(method + ': JSON-RPC response without error', () => {
        pm.expect(body, 'response is not JSON').to.be.an('object');
        pm.expect(body.error, body.error ? JSON.stringify(body.error) : '').to.be.undefined;
        pm.expect(body).to.have.property('result');
    });
    pm.test(method + ': result is ' + prefix + method + 'Response', () => {
        pm.expect(body && body.result && body.result.__classname__).to.eql(prefix + method + 'Response');
    });
}`;

/** Pre-request script that generates a GUID into a collection variable (for transfer server uploads). */
export const newGuid = varName => `
const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
pm.collectionVariables.set('${varName}', guid);`;
