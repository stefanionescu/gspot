import { test, expect } from 'bun:test';
import { parseJsonRecord } from '#cli/parsers/json.ts';
import { INVALID_JSON, NON_RECORD_JSON } from '#tests/config/cli/parsers/json.ts';

test('strict JSON configuration parsing preserves field values and empty objects', () => {
    expect(parseJsonRecord('{"empty":null,"values":[0,false,""],"__proto__":{"setting":true}}')).toStrictEqual({
        empty: null,
        values: [0, false, ''],
        ['__proto__']: { setting: true },
    });
    expect(parseJsonRecord('{}')).toStrictEqual({});
});

for (const text of NON_RECORD_JSON)
    test(`JSON configuration rejects a non-object root ${text}`, () => {
        expect(() => parseJsonRecord(text)).toThrow('JSON configuration must contain an object.');
    });

for (const text of INVALID_JSON)
    test(`strict JSON configuration rejects syntax errors ${text}`, () => {
        expect(() => parseJsonRecord(text)).toThrow('JSON Parse error');
    });
