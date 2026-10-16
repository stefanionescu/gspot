import { test, expect } from 'bun:test';
import { NON_RECORD_JSON } from '#tests/config/formatting.ts';
import { parseJsonc, parseJsonFile } from '#cli/parsers/json.ts';

test.each(NON_RECORD_JSON)('JSON configuration rejects a non-object root %s', (text) => {
    expect(() => parseJsonFile('example.json', text)).toThrow('example.json');
});

test('JSON with comments names the error offset', () => {
    expect(() => parseJsonc('{"value": }')).toThrow('Invalid JSON configuration at offset 10: ValueExpected.');
});
