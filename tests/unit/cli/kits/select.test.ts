import { selectKits } from '#cli/kits/select.ts';
import { test, expect, describe } from 'bun:test';
import { kitManifests } from '#cli/kits/manifests.ts';
import { testManifest } from '#tests/support/cli/tooling.ts';

describe('selectKits', () => {
    test('pulls required kits in, dependencies first, in order of first mention', () => {
        const manifests = new Map([
            ['app', testManifest('app', ['client', 'server'])],
            ['client', testManifest('client', ['base'])],
            ['server', testManifest('server', ['base'])],
            ['base', testManifest('base')],
        ]);
        const ids = selectKits(['app', 'client'], manifests).map((entry) => entry.kit.name);
        expect(ids).toStrictEqual(['base', 'client', 'server', 'app']);
    });

    test('a recommended kit is not pulled in by selection; init adds it and a person can drop it', () => {
        const manifests = kitManifests();
        const ids = selectKits(['bash'], manifests).map((entry) => entry.kit.name);
        expect(ids).not.toContain('naming');
    });

    test('an unknown kit names the near matches', () => {
        expect(() => selectKits(['bassh'], kitManifests())).toThrow('Did you mean `bash`');
    });

    test('a circular requires fails with the chain', () => {
        const map = new Map([
            ['a', testManifest('a', ['b'])],
            ['b', testManifest('b', ['a'])],
        ]);
        expect(() => selectKits(['a'], map)).toThrow('a -> b -> a');
    });
});
