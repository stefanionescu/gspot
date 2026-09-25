import { assertPinMatches, pinnedVersion, writePin } from '#cli/lifecycle/version-pin.ts';
import { describe, expect, test } from 'bun:test';
import { testdir } from 'testdirs';
import packageManifest from '../../../../packages/cli/package.json' with { type: 'json' };

const { version: GSPOT_VERSION } = packageManifest;

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
        }).toThrow('gspot apply');
    });
});
