import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { PACKAGE, WRANGLER } from '#tests/config/samples/cloudflare.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const CASES: FindingCase[] = [
    {
        check: 'cloudflare/wrangler',
        files: { 'wrangler.jsonc': '{\n    "name": "example"\n}\n' },
        expected: { file: 'wrangler.jsonc', rule: 'compatibility-date', line: 1 },
    },
];

export const REPOSITORY: InstalledScenario = {
    configurations: ['cloudflare'],
    files: { 'package.json': PACKAGE, 'wrangler.jsonc': WRANGLER },
};

export const WRANGLER_FORMATS = [
    {
        name: 'wrangler.toml',
        broken: 'name = 42\ncompatibility_date = "2026-01-15"\nworkers_dev = "wrong"\n',
        corrected: 'name = "fixed"\ncompatibility_date = "2026-01-15"\nworkers_dev = true\n',
    },
    {
        name: 'wrangler.json',
        broken: '{"name":42,"compatibility_date":"2026-01-15","workers_dev":"wrong"}\n',
        corrected: '{"name":"fixed","compatibility_date":"2026-01-15","workers_dev":true}\n',
    },
    {
        name: 'wrangler.jsonc',
        broken: '{// Native JSONC input.\n"name":42,"compatibility_date":"2026-01-15","workers_dev":"wrong"}\n',
        corrected: '{// Native JSONC input.\n"name":"fixed","compatibility_date":"2026-01-15","workers_dev":true}\n',
    },
];
