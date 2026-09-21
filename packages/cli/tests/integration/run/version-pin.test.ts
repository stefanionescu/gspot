import { testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { assertPinMatches, pinnedVersion, writePin, GSPOT_VERSION } from '#cli/run/version-pin.ts';

describe('the version pin', () => {
    test('is written, read, and refused when it differs', async () => {
        await using sandbox = await testdir();
        expect(pinnedVersion(sandbox.path)).toBeUndefined();
        writePin(sandbox.path);
        expect(pinnedVersion(sandbox.path)).toBe(GSPOT_VERSION);
        expect(() => {
            assertPinMatches(sandbox.path);
        }).not.toThrow();
        writePin(sandbox.path, '9.9.9');
        expect(() => {
            assertPinMatches(sandbox.path);
        }).toThrow('gspot upgrade --to');
    });
});
