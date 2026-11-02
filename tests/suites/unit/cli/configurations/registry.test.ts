import { test, expect } from 'bun:test';
import { readConfigurations } from '#cli/manifests/read.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';

test('every shipped check without a command has runnable code', () => {
    const checks = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.checks)
        .toArray();
    const missing = checks.filter(
        (check) =>
            check.command === undefined &&
            check.generator_outputs === undefined &&
            CHECK_CODE[check.id]?.check === undefined &&
            CHECK_CODE[check.id]?.run === undefined,
    );
    expect(missing.map((check) => check.id)).toStrictEqual([]);
});
