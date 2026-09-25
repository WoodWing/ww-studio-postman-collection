#!/usr/bin/env node
// Lints a WoodWing Studio Postman collection against the TypeScript SDK (generated from the WSDL).
//
// Usage: node lint-collection.mjs <collection.json> [--sdk <sdk/typescript dir>] [--folder <name>] [--json]
//
// Checks per JSON-RPC request:
//   - body is valid JSON (after stripping // comments and substituting {{variables}})
//   - endpoint (adminindex.php, index.php, ...) matches the interface the method belongs to
//   - method exists in that interface
//   - params is [ {..} ] or { "req": {..} }
//   - request __classname__ is correct (server overrides it, so this is a warning)
//   - required fields present, no unknown fields, types and enum values match
//   - nested objects carry the right __classname__ (without it the server gets arrays, not typed objects)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSNAME_ALIASES, endpointKey, loadSdk, NAMESPACES, serviceMethods } from './lib/sdk-schema.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
};
const collectionPath = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
if (!collectionPath) {
    console.error('Usage: node lint-collection.mjs <collection.json> [--sdk dir] [--folder name] [--json]');
    process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = opt('--sdk', process.env.STUDIO_SDK_DIR || path.join(here, 'sdk'));
const folderFilter = opt('--folder', null);
const asJson = args.includes('--json');

const sdk = loadSdk(sdkDir);
const endpointToNs = Object.fromEntries(Object.entries(NAMESPACES).map(([ns, v]) => [v.endpoint, ns]));

// Remove // comments that are outside of string literals.
function stripComments(src) {
    let out = '';
    let inStr = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inStr) {
            out += c;
            if (c === '\\') { out += src[++i] ?? ''; continue; }
            if (c === '"') inStr = false;
        } else if (c === '"') {
            inStr = true; out += c;
        } else if (c === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i++;
            out += '\n';
        } else {
            out += c;
        }
    }
    return out;
}

// Unquoted {{var}} is used for numeric ids (or for a whole JSON value filled in by a script).
// Substitute a marker string so the JSON parses; checkValue() accepts the marker for any field type.
const VAR_MARKER = '\u0000unquoted-variable';
function substituteVars(src) {
    let out = '';
    let inStr = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inStr) {
            out += c;
            if (c === '\\') { out += src[++i] ?? ''; continue; }
            if (c === '"') inStr = false;
        } else if (c === '"') {
            inStr = true; out += c;
        } else if (c === '{' && src[i + 1] === '{') {
            const end = src.indexOf('}}', i);
            out += JSON.stringify(VAR_MARKER);
            i = end + 1;
        } else {
            out += c;
        }
    }
    return out;
}

function jsType(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
}

function checkValue(nsSchema, fieldPath, spec, value, issues) {
    const { type } = spec;
    const add = (level, msg) => issues.push({ level, path: fieldPath, msg });
    if (value === VAR_MARKER) return;
    if (value === null) {
        if (!spec.optional) add('error', `required field is null`);
        return;
    }
    if (spec.isArray) {
        if (!Array.isArray(value)) { add('error', `expected ${type}[] but got ${jsType(value)}`); return; }
        value.forEach((item, i) => {
            if (item === VAR_MARKER) return;
            if (item === null) { add('error', `array item [${i}] is null`); return; }
            checkValue(nsSchema, `${fieldPath}[${i}]`, { type, isArray: false, optional: false }, item, issues);
        });
        return;
    }
    if (type === 'number') {
        if (typeof value === 'string') {
            if (value === '') add('error', `empty string for number field (omit it or use a number)`);
            else if (/^\{\{.*\}\}$/.test(value)) add('warn', `quoted variable ${value} for number field sends a string; use it unquoted`);
            else if (/^-?\d+$/.test(value)) add('warn', `number sent as string "${value}"`);
            else add('error', `expected number but got string "${value}"`);
        } else if (typeof value !== 'number') add('error', `expected number but got ${jsType(value)}`);
        return;
    }
    if (type === 'string') {
        if (typeof value !== 'string') add('warn', `expected string but got ${jsType(value)}`);
        return;
    }
    if (type === 'boolean') {
        if (typeof value !== 'boolean') add('error', `expected boolean but got ${jsType(value)}`);
        return;
    }
    if (nsSchema.enums[type]) {
        if (typeof value !== 'string' || !nsSchema.enums[type].includes(value)) {
            add('error', `invalid ${type} value ${JSON.stringify(value)}; allowed: ${nsSchema.enums[type].join(', ')}`);
        }
        return;
    }
    const iface = nsSchema.interfaces[type];
    if (iface) {
        if (jsType(value) !== 'object') { add('error', `expected ${iface.classname} object but got ${jsType(value)}`); return; }
        checkObject(nsSchema, fieldPath, iface, value, issues, true);
        return;
    }
    // Types we can't resolve (e.g. 'any', unions) are skipped.
}

function checkObject(nsSchema, objPath, iface, obj, issues, nested) {
    const add = (level, msg, p = objPath) => issues.push({ level, path: p, msg });
    if (!('__classname__' in obj)) {
        add(nested ? 'error' : 'warn', `missing "__classname__": "${iface.classname}"`);
    } else if (obj.__classname__ !== iface.classname && !(CLASSNAME_ALIASES[iface.classname] || []).includes(obj.__classname__)) {
        add(nested ? 'error' : 'warn', `__classname__ is "${obj.__classname__}", expected "${iface.classname}"`);
    }
    for (const [name, spec] of Object.entries(iface.fields)) {
        if (!(name in obj)) {
            if (!spec.optional) add('error', `missing required field "${name}"`);
            continue;
        }
        checkValue(nsSchema, `${objPath}.${name}`, spec, obj[name], issues);
    }
    for (const key of Object.keys(obj)) {
        if (key !== '__classname__' && !(key in iface.fields)) {
            add('error', `unknown field "${key}" (not in ${iface.classname}; the server silently drops it)`, `${objPath}.${key}`);
        }
    }
}

function lintRequest(item, reqPath) {
    const issues = [];
    const add = (level, msg, p = '') => issues.push({ level, path: p, msg });
    const r = item.request;
    const url = typeof r.url === 'string' ? r.url : r.url?.raw ?? '';
    const raw = r.body?.raw;
    if (!raw || !/"jsonrpc"|"method"/.test(raw)) return null; // not a JSON-RPC call

    const endpoint = endpointKey(url);
    const ns = endpointToNs[endpoint];
    if (!/protocol=JSON/.test(url)) add('error', `URL is missing ?protocol=JSON`);
    if (/\{\{Studio_Server_Directory\}\}\/StudioServer\//.test(url)) {
        add('error', `URL has "StudioServer/" after {{Studio_Server_Directory}} (doubled directory)`);
    }
    if ((r.method || 'GET') !== 'POST') add('error', `HTTP method is ${r.method}, expected POST`);

    let body;
    try {
        body = JSON.parse(substituteVars(stripComments(raw)));
    } catch (e) {
        add('error', `body is not valid JSON: ${e.message}`);
        return { issues, method: null, endpoint };
    }
    if (/\/\/[^\n]*/.test(raw.replace(/"(?:[^"\\]|\\.)*"/g, '""'))) {
        add('warn', `body contains // comments; Postman strips them but other clients will not`);
    }
    if (body.jsonrpc !== '2.0') add('error', `"jsonrpc" should be "2.0"`);
    if (!('id' in body)) add('warn', `missing JSON-RPC "id"`);
    const method = body.method;
    if (!ns) { add('warn', `endpoint ${endpoint} is not an SDK interface; skipped schema checks`); return { issues, method, endpoint }; }
    const nsSchema = sdk[ns];
    if (!nsSchema) { add('warn', `no SDK loaded for ${ns}`); return { issues, method, endpoint }; }

    const methods = serviceMethods(nsSchema);
    if (!methods.includes(method)) {
        const other = Object.entries(sdk).find(([, s]) => serviceMethods(s).includes(method));
        add('error', `method "${method}" does not exist on ${endpoint}` + (other ? ` (it is a ${other[0]} method on ${NAMESPACES[other[0]].endpoint})` : ''));
        return { issues, method, endpoint };
    }
    if (item.name.split(/[\s-]/)[0] !== method && !item.name.startsWith(method)) {
        add('warn', `request is named "${item.name}" but calls method "${method}"`);
    }

    let req;
    if (Array.isArray(body.params)) {
        if (body.params.length !== 1) add('error', `params array should contain exactly one request object`);
        req = body.params[0];
    } else if (body.params && typeof body.params === 'object' && body.params.req) {
        req = body.params.req;
    } else {
        add('error', `params must be [ {request} ] or { "req": {request} }`);
        return { issues, method, endpoint };
    }
    const iface = nsSchema.interfaces[`${method}Request`];
    checkObject(nsSchema, `${method}Request`, iface, req, issues, false);
    return { issues, method, endpoint };
}

const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const results = [];
const seenMethods = {};
(function walk(items, trail) {
    for (const it of items) {
        const p = [...trail, it.name];
        if (it.item) {
            if (folderFilter && trail.length === 0 && it.name !== folderFilter) continue;
            walk(it.item, p);
            continue;
        }
        const res = lintRequest(it, p);
        if (!res) continue;
        results.push({ path: p.join(' / '), ...res });
        if (res.method && res.endpoint) (seenMethods[res.endpoint] ??= new Set()).add(res.method);
    }
})(collection.item, []);

// Coverage: SDK methods not present in the (filtered) collection.
const coverage = {};
for (const [ns, { endpoint }] of Object.entries(NAMESPACES)) {
    if (!sdk[ns] || !seenMethods[endpoint]) continue;
    coverage[endpoint] = serviceMethods(sdk[ns]).filter(m => !seenMethods[endpoint].has(m));
}

if (asJson) {
    console.log(JSON.stringify({ results, coverage }, null, 2));
} else {
    let errors = 0, warns = 0;
    for (const r of results) {
        if (!r.issues.length) continue;
        console.log(`\n■ ${r.path}  [${r.method ?? '?'} @ ${r.endpoint ?? '?'}]`);
        for (const i of r.issues) {
            if (i.level === 'error') errors++; else warns++;
            console.log(`   ${i.level === 'error' ? '✖' : '⚠'} ${i.path ? i.path + ': ' : ''}${i.msg}`);
        }
    }
    console.log('\nMissing SDK methods (not in collection):');
    for (const [ep, list] of Object.entries(coverage)) console.log(`   ${ep}: ${list.length ? list.join(', ') : '(none)'}`);
    const clean = results.filter(r => !r.issues.length).length;
    console.log(`\n${results.length} JSON-RPC requests, ${clean} clean, ${errors} errors, ${warns} warnings`);
    process.exit(errors ? 1 : 0);
}
