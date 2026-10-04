import { test, expect, describe } from 'bun:test';
import { parseExpoDoctor } from '#cli/parsers/expo.ts';
import { REPORT, EXPECTED_ISSUES } from '#tests/config/cli/parsers/expo.ts';

describe('parseExpoDoctor', () => {
    test('each failed check retains its complete issues without advice', () => {
        expect(parseExpoDoctor(REPORT)).toStrictEqual(EXPECTED_ISSUES);
    });
    test('a passing report yields nothing', () => {
        expect(parseExpoDoctor('✔ Check package.json\n15/15 checks passed. No issues detected!\n')).toStrictEqual([]);
    });
});
