// Required rules retain their declared level and route applicability in the generated configuration.
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readAsset } from '#cli/platform/assets.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { eslintAllRulesSchema } from '#cli/parsers/schema/eslint.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { CHECK_LEVELS, PROJECT_FILES } from '#tests/config/cli/generation/eslint/required-rules.ts';

const allRules = eslintAllRulesSchema.parse(
    JSON.parse(readAsset('configurations/language/javascript/eslint-all-rules.json')),
);
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
