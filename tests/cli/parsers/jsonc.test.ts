import { test, expect } from 'bun:test';
import { jsoncValue, parseJsonc } from '#cli/parsers/jsonc.ts';
import { JSONC_ENTRIES, JSONC_FAILURES } from '#tests/config/cli/parsers/jsonc.ts';

for (const entry of JSONC_FAILURES)
    test(`JSONC rejects partial results and names the fault in ${entry.source}`, () => {
        expect(() => parseJsonc(entry.source)).toThrow(entry.message);
        expect(jsoncValue(entry.source)).toBeUndefined();
    });

for (const entry of JSONC_ENTRIES)
    test(`JSONC retains comments, trailing commas, and authored values in ${entry.source}`, () => {
        expect(parseJsonc(entry.source)).toStrictEqual(entry.value);
        expect(jsoncValue(entry.source)).toStrictEqual(entry.value);
    });
