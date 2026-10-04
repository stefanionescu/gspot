import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test('the registry names exactly the shipped checks that run no command', () => {
    // A configuration that references another configuration's check lists it too, so each name counts once.
    const builtIn = new Set(
        [...configurationManifests().values()]
            .flatMap((manifest) => manifest.checks)
            .filter((check) => check.command === undefined)
            .map((check) => check.name),
    );
    const registered = Object.keys(CHECKS);
    expect(registered.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(
        [...builtIn].toSorted((a, b) => a.localeCompare(b)),
    );
});
