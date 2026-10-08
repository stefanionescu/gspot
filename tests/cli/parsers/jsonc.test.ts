import { test, expect } from 'bun:test';
import { parseJsonc } from '#cli/parsers/public.ts';
import { parseWrangler } from '#cli/parsers/tool/public.ts';
import { JSONC_ENTRIES, JSONC_FAILURES } from '#tests/config/cli/parsers/jsonc.ts';

for (const entry of JSONC_FAILURES)
    test(`JSONC rejects partial results and names the fault in ${entry.source}`, () => {
        expect(() => parseJsonc(entry.source)).toThrow(entry.message);
    });

for (const entry of JSONC_ENTRIES)
    test(`JSONC retains comments, trailing commas, and authored values in ${entry.source}`, () => {
        expect(parseJsonc(entry.source)).toStrictEqual(entry.value);
    });

for (const entry of JSONC_FAILURES)
    test(`Wrangler returns the syntax diagnostic without partial fields in ${entry.source}`, () => {
        expect(parseWrangler(entry.source, 'wrangler.jsonc')).toStrictEqual({
            table: undefined,
            problem: entry.message,
        });
    });

for (const entry of JSONC_ENTRIES)
    test(`Wrangler accepts only an object from ${entry.source}`, () => {
        expect(parseWrangler(entry.source, 'wrangler.jsonc')).toStrictEqual(
            typeof entry.value === 'object' && entry.value !== null
                ? { table: entry.value, problem: undefined }
                : { table: undefined, problem: 'The file does not parse as JSON with comments.' },
        );
    });
