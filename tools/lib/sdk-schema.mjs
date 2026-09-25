// Parses the WoodWing Studio TypeScript SDK (.d.ts, generated from WSDL) into a lookup schema.
import fs from 'node:fs';
import path from 'node:path';

export const NAMESPACES = {
    adm: { prefix: 'Adm', endpoint: 'adminindex.php' },
    wfl: { prefix: 'Wfl', endpoint: 'index.php' },
    pln: { prefix: 'Pln', endpoint: 'editorialplan.php' },
    sys: { prefix: 'Sys', endpoint: 'sysadminindex.php' },
    // Server plug-in interfaces are served by pluginindex.php?plugin=<plugin>&interface=<interface>.
    whreg: { prefix: 'WhReg', endpoint: 'pluginindex.php?plugin=Webhooks&interface=reg' },
};

// JSON classnames the server accepts as aliases (WW_JSON_Services maps 'Object' to 'WflObject' and back).
export const CLASSNAME_ALIASES = { WflObject: ['Object'] };

// Returns the endpoint key of a request URL: 'index.php', 'adminindex.php', 'pluginindex.php?plugin=X&interface=Y', ...
export function endpointKey(url) {
    const m = url.match(/\/([a-z]+\.php)(\?[^#]*)?/);
    if (!m) return null;
    if (m[1] !== 'pluginindex.php') return m[1];
    const q = new URLSearchParams((m[2] || '').slice(1));
    return `pluginindex.php?plugin=${q.get('plugin')}&interface=${q.get('interface')}`;
}

export function parseDts(src) {
    const enums = {};
    const interfaces = {};
    for (const m of src.matchAll(/export type (\w+)\s*=([^;]+);/g)) {
        enums[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1]);
    }
    for (const m of src.matchAll(/export interface (\w+)\s*\{([^}]*)\}/g)) {
        const fields = {};
        let classname = null;
        for (const line of m[2].split('\n')) {
            const f = line.trim().match(/^(\w+)(\?)?:\s*(.+);$/);
            if (!f) continue;
            if (f[1] === '__classname__') { classname = f[3].replace(/'/g, ''); continue; }
            let type = f[3].trim();
            const isArray = type.endsWith('[]');
            if (isArray) type = type.slice(0, -2);
            fields[f[1]] = { optional: !!f[2], type, isArray };
        }
        interfaces[m[1]] = { name: m[1], classname, fields };
    }
    return { enums, interfaces };
}

export function loadSdk(sdkDir) {
    const schema = {};
    for (const ns of Object.keys(NAMESPACES)) {
        const file = path.join(sdkDir, ns, 'index.d.ts');
        if (fs.existsSync(file)) schema[ns] = parseDts(fs.readFileSync(file, 'utf8'));
    }
    return schema;
}

// Service method names = interfaces named <X>Request that have a matching <X>Response.
export function serviceMethods(nsSchema) {
    return Object.keys(nsSchema.interfaces)
        .filter(n => n.endsWith('Request') && nsSchema.interfaces[n.replace(/Request$/, 'Response')])
        .map(n => n.replace(/Request$/, ''));
}
