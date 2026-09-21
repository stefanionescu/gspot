import { describe, expect, test } from 'bun:test';
import { selectPresets } from '#cli/presets/select.ts';
import { parsePolicyText } from '#cli/policy/read-policy.ts';
import { validateAgainstSurface } from '#cli/policy/audit.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { exposedSettings, settingValue, specFor } from '#cli/policy/settings.ts';

const selected = selectPresets(['bash', 'naming', 'formatting', 'spelling'], presetManifests());
const surface = exposedSettings(selected);

describe('the settings surface', () => {
    test('maps a per-language key back to its base spec', () => {
        expect(specFor(surface, 'limits.bash.function_lines')?.spec.name).toBe('limits.bash.function_lines');
        expect(specFor(surface, 'limits.python.file_lines')?.language).toBe('python');
        expect(specFor(surface, 'naming.python.parameters.max_words')?.category).toBe('parameters');
        expect(specFor(surface, 'limits.nope')).toBeUndefined();
    });

    test('resolves preset default, root table, then scope table', () => {
        const policy = parsePolicyText(
            'version = 1\npresets = ["bash"]\n[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\n[scope.limits]\nfile_lines = 200\n',
            'gspot.toml',
        );
        expect(settingValue(surface, policy, 'limits.file_lines')?.value).toBe(250);
        expect(settingValue(surface, policy, 'limits.file_lines', 'api')?.value).toBe(200);
        expect(settingValue(surface, policy, 'limits.function_lines')?.source).toBe('preset structure');
    });

    test('lists append and deduplicate across layers', () => {
        const policy = parsePolicyText(
            'version = 1\npresets = ["bash"]\n[naming]\nbanned_terms = ["dispatcher"]\n[[scope]]\npath = "api"\n[scope.naming]\nbanned_terms = ["dispatcher", "orchestrator"]\n',
            'gspot.toml',
        );
        expect(settingValue(surface, policy, 'naming.banned_terms', 'api')?.value).toEqual([
            'dispatcher',
            'orchestrator',
        ]);
    });

    test('raising a ceiling without a reason is a problem that names the command', () => {
        const policy = parsePolicyText(
            'version = 1\nrequire_reasons = true\npresets = ["bash"]\n[limits]\nfile_lines = 400\n',
            'gspot.toml',
        );
        const problems = validateAgainstSurface(surface, policy);
        expect(problems[0]).toContain('gspot set limits.file_lines 400 --reason');
    });

    test('lowering a ceiling needs no reason', () => {
        const policy = parsePolicyText('version = 1\npresets = ["bash"]\n[limits]\nfile_lines = 200\n', 'gspot.toml');
        expect(validateAgainstSurface(surface, policy)).toEqual([]);
    });

    test('a setting no preset exposes is refused with the keys that exist', () => {
        const policy = parsePolicyText(
            'version = 1\npresets = ["bash"]\n[tools.shellcheck]\nseverity = "style"\n',
            'gspot.toml',
        );
        expect(validateAgainstSurface(surface, policy)[0]).toContain(
            'No selected preset exposes `tools.shellcheck.severity`',
        );
    });

    test('the marketing group cannot be removed', () => {
        const policy = parsePolicyText(
            'version = 1\npresets = ["bash"]\n[naming]\nremove_groups = [{ group = "marketing", reason = "We like adjectives here." }]\n',
            'gspot.toml',
        );
        expect(validateAgainstSurface(surface, policy)[0]).toContain('`marketing` term group cannot be removed');
    });
});

test.each(['min_lines', 'min_tokens'])(
    'raising duplication %s requires a reason, while lowering it tightens detection',
    (name) => {
        const selected = selectPresets(['duplication'], presetManifests());
        const settings = exposedSettings(selected);
        const key = `limits.duplication.${name}`;
        const shipped = settings.defaults.get(key)!.value as number;
        const policy = (value: number) =>
            parsePolicyText(
                `version = 1\nrequire_reasons = true\npresets = ["duplication"]\n[limits.duplication]\n${name} = ${String(value)}\n`,
                'gspot.toml',
            );
        expect(validateAgainstSurface(settings, policy(shipped + 1)).some((problem) => problem.includes(key))).toBe(
            true,
        );
        expect(validateAgainstSurface(settings, policy(shipped - 1))).toEqual([]);
    },
);
