import { expect, test } from 'bun:test';

import { CHECK_CODE, CONFIG_BUILDERS } from '#cli/configurations/registry.ts';
import { readConfigurations } from '#cli/manifests/read.ts';

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

test('every key of the check code table is the ID of a shipped check', () => {
    const shipped = new Set(
        readConfigurations()
            .values()
            .flatMap((configuration) => configuration.checks.map((check) => check.id)),
    );
    expect(Object.keys(CHECK_CODE).filter((id) => !shipped.has(id))).toStrictEqual([]);
});

test('every key of the config builder table names a shipped config file that has a source', () => {
    const shipped = new Set(
        readConfigurations()
            .values()
            .flatMap((configuration) =>
                configuration.configs
                    .filter((config) => config.source !== undefined)
                    .map((config) => `${configuration.name}/${config.file}`),
            ),
    );
    expect(Object.keys(CONFIG_BUILDERS).filter((key) => !shipped.has(key))).toStrictEqual([]);
});
