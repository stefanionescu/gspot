// Required rules retain their declared level and route applicability in the generated configuration.
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { validateEslintPresets } from '#cli/generation/eslint/public.ts';
import { CHECK_LEVELS, PROJECT_FILES } from '#tests/config/cli/generation/eslint/required-rules.ts';

const allRules = new Set([...configurationManifests().values()].flatMap((manifest) => [...manifest.eslint_all_rules]));
const contracts = [...configurationManifests().values()].flatMap((manifest) =>
    Object.entries(manifest.required_eslint_rules).map(([ending, rules]) => ({
        configuration: manifest.configuration.name,
        ending,
        rules,
    })),
);
const cases = contracts.flatMap((contract) =>
    CHECK_LEVELS.flatMap((level) =>
        (contract.configuration === 'nextjs' ? ['pages', 'app'] : ['src']).map((route) => ({
            ...contract,
            level,
            route,
        })),
    ),
);

test.each(cases)(
    '$configuration $level $route $ending rules keep their applicability',
    async ({ configuration, ending, rules, level, route }) => {
        await using sandbox = await testdir();
        const path = `${route}/page.${ending}`;
        await createFileTree(sandbox.path, {
            ...PROJECT_FILES,
            'gspot.toml': buildPolicy([configuration], { level }),
            [path]: '',
        });
        const eslint = await createEslint(sandbox.path);
        const configured = (await eslint.calculateConfigForFile(path)) as Linter.Config;
        expect(configured.rules).toBeDefined();
        for (const rule of rules) {
            const enabledAtLevel = level === 'all' || !allRules.has(rule);
            const appliesToRoute = rule !== '@next/next/no-html-link-for-pages' || route === 'pages';
            const entry = configured.rules![rule];
            const severity = Array.isArray(entry) ? entry[0] : entry;
            expect(severity === 1 || severity === 2, `${level}/${route}/${ending}/${rule}`).toBe(
                enabledAtLevel && appliesToRoute,
            );
        }
    },
);

test('manifest preset metadata agrees with its captured exports', () => {
    const manifests = new Map(configurationManifests());
    const original = manifests.get('javascript')!;
    expect(() => {
        validateEslintPresets(manifests);
    }).not.toThrow();
    manifests.set('javascript', {
        ...original,
        eslint_presets: Object.fromEntries(Object.entries(original.eslint_presets).toReversed()),
    });
    expect(() => {
        validateEslintPresets(manifests);
    }).not.toThrow();
    manifests.set('javascript', { ...original, eslint_presets: {} });
    expect(() => {
        validateEslintPresets(manifests);
    }).not.toThrow();
    manifests.set('javascript', {
        ...original,
        eslint_presets: {
            ...original.eslint_presets,
            extra: { package: 'eslint-plugin-unicorn', source: 'configs.recommended' },
        },
    });
    expect(() => {
        validateEslintPresets(manifests);
    }).toThrow('Refresh the javascript ESLint presets: the source exports changed.');
    manifests.set('javascript', {
        ...original,
        eslint_presets: {
            ...original.eslint_presets,
            unicorn: { package: 'eslint-plugin-unicorn', source: 'configs.missing' },
        },
    });
    expect(() => {
        validateEslintPresets(manifests);
    }).toThrow('Refresh javascript/unicorn: its ESLint preset must use eslint-plugin-unicorn@');
});
