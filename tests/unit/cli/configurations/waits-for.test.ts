// A check that reads a setting nobody has filled in yet waits for it instead of running with nothing (K-157).
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { SettingSpec } from '#cli/configurations/schema.ts';
import { expect, test } from 'bun:test';

// A {setting:...} value is needed where it stands; an {each:...} list repeats a flag and an empty list adds nothing.
const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z0-9_.]+)\}/gu;

function isEmpty(spec: SettingSpec): boolean {
    const value = spec.default;
    return value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
}

const manifests = [...configurationManifests().values()];
const specs = new Map(manifests.flatMap((manifest) => manifest.settings.map((spec) => [spec.name, spec] as const)));

test('every check whose command needs a setting with an empty default waits for that setting', () => {
    const missing = manifests.flatMap((manifest) =>
        manifest.checks.flatMap((check) => {
            const parts = [...(check.command ?? []), ...(check.fix_command ?? [])];
            const read = [
                ...new Set(
                    parts.flatMap((part) =>
                        [...part.matchAll(SETTING_PLACEHOLDER)].map((match) => match.groups!['name']!),
                    ),
                ),
            ];
            return read
                .filter((name) => {
                    const spec = specs.get(name);
                    return spec !== undefined && isEmpty(spec) && check.waits_for !== name;
                })
                .map((name) => `${check.name} reads ${name}`);
        }),
    );
    expect(missing).toStrictEqual([]);
});

test('every waits_for names a setting some manifest declares', () => {
    const unknown = manifests.flatMap((manifest) =>
        manifest.checks
            .filter((check) => check.waits_for !== undefined && !specs.has(check.waits_for))
            .map((check) => `${check.name} waits for ${check.waits_for ?? ''}`),
    );
    expect(unknown).toStrictEqual([]);
});
