import { test, expect, describe } from 'bun:test';
import { parseExpoDoctor } from '#cli/parsers/expo.ts';
import { PASSING_REPORT } from '#tests/config/samples/expo.ts';
import { REPORT, EXPECTED_ISSUES } from '#tests/config/cli/parsers/expo.ts';

describe('parseExpoDoctor', () => {
    test('each failed check retains its complete issues without advice', () => {
        expect(parseExpoDoctor(REPORT)).toStrictEqual(EXPECTED_ISSUES);
    });
    test('a passing report yields nothing', () => {
        expect(parseExpoDoctor(PASSING_REPORT)).toStrictEqual([]);
    });
});
