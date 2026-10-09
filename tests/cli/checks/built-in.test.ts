import { test, expect } from 'bun:test';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { POLICY_CHECK } from '#cli/config/execution/runtime.ts';
import { configurationManifests } from '#cli/configurations/public.ts';

test('every shipped check can run and every built-in check has a declared owner', () => {
    // A configuration that references another configuration's check lists it too, so each name counts once.
    const declared = [...configurationManifests().values()].flatMap((manifest) => manifest.checks);
    const builtIn = new Set(declared.map((check) => check.name));
    // Policy diagnostics run before callback planning and have one manifest-owned check name.
    expect(declared.filter(({ name }) => name === POLICY_CHECK).map(({ name }) => name)).toStrictEqual([POLICY_CHECK]);
    expect(
        declared
            .filter(
                (check) =>
                    check.command === undefined &&
                    check.name !== POLICY_CHECK &&
                    !Object.hasOwn(BUILT_IN_CHECKS, check.name),
            )
            .map((check) => check.name),
    ).toStrictEqual([]);
    expect(Object.keys(BUILT_IN_CHECKS).filter((name) => !builtIn.has(name))).toStrictEqual([]);
});
