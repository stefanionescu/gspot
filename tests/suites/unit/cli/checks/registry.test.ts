import { test, expect } from 'bun:test';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';

test('every shipped check without a command has runnable code', () => {
    const checks = [...readConfigurations().values()].flatMap((configuration) => configuration.checks);
    const missing = checks.filter(
        (check) =>
            check.command === undefined &&
            check.generator_outputs === undefined &&
            CHECK_CODE[check.id]?.check === undefined &&
            CHECK_CODE[check.id]?.run === undefined,
    );
    expect(missing.map((check) => check.id)).toStrictEqual([]);
});

test('every registered check names a shipped check', () => {
    const shipped = new Set(
        [...readConfigurations().values()].flatMap((configuration) => configuration.checks.map((check) => check.id)),
    );
    expect(Object.keys(CHECK_CODE).filter((id) => !shipped.has(id))).toStrictEqual([]);
});
