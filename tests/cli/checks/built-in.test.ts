import { test, expect } from 'bun:test';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test('every shipped check can run and every built-in check has a declared owner', () => {
    // A configuration that references another configuration's check lists it too, so each name counts once.
    const declared = [...configurationManifests().values()].flatMap((manifest) => manifest.checks);
    const builtIn = new Set(declared.map((check) => check.name));
    expect(
        declared
            .filter((check) => check.command === undefined && !Object.hasOwn(BUILT_IN_CHECKS, check.name))
            .map((check) => check.name),
    ).toStrictEqual([]);
    expect(Object.keys(BUILT_IN_CHECKS).filter((name) => !builtIn.has(name))).toStrictEqual([]);
});
