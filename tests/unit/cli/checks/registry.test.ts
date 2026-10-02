import { test, expect } from 'bun:test';
import { kitManifests } from '#cli/kits/manifests.ts';
import { ENGINES, RUNNERS } from '#cli/checks/registry.ts';

test('the registry names exactly the shipped checks that run no command', () => {
    // A kit that references another kit's check lists it too, so each name counts once.
    const builtIn = new Set(
        [...kitManifests().values()]
            .flatMap((manifest) => manifest.checks)
            .filter((check) => check.command === undefined)
            .map((check) => check.name),
    );
    const registered = [...Object.keys(ENGINES), ...Object.keys(RUNNERS)];
    expect(registered.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(
        [...builtIn].toSorted((a, b) => a.localeCompare(b)),
    );
});
