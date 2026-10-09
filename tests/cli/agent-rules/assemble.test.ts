import { testdir } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { excludeErrors } from '#cli/policy/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readAsset } from '#cli/platform/root/public.ts';
import { FIRST_READ } from '#cli/config/policy/settings.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { textAtLevel, selectRuleFiles } from '#cli/agent-rules/public.ts';
import { everyManifest, configurationManifests } from '#cli/configurations/public.ts';

import {
    UPSTREAM_GUIDES,
    CHECKED_RULE_LINES,
    RUNTIME_RULE_CASES,
    RULE_CONFIGURATIONS,
} from '#tests/config/cli/agent-rules.ts';

describe('[agent_rules] exclude', () => {
    test('a file path and a category folder are accepted', () => {
        expect(excludeErrors(['general/engineering/code/ACCESSIBILITY.md', 'library'])).toStrictEqual([]);
    });

    test('an entry that matches no rule file names the near match', () => {
        const [problem] = excludeErrors(['general/engineering/code/ACCESIBILITY.md']);
        expect(problem).toMatchObject({ index: 0 });
        expect(problem!.message).toContain('matches no rule');
        expect(problem!.message).toContain('general/engineering/code/ACCESSIBILITY.md');
    });

    test.each([...FIRST_READ, 'general/engineering/agent', 'general/prose'])(
        'the required first-read entry %s cannot be left out',
        (entry) => {
            const [problem] = excludeErrors([entry]);
            expect(problem!.message).toContain('every agent opens first');
        },
    );
});

test('level filtering respects fenced examples, nested sections, and the next peer heading', () => {
    const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
    const omitted =
        '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
    const after = '## Safety\n\nKeep this requirement.\n';
    const text = before + omitted + after;
    expect(textAtLevel(text, 'recommended')).toBe(before + after);
    expect(textAtLevel(text, 'all')).toBe(text);
    expect(textAtLevel(textAtLevel(text, 'recommended'), 'recommended')).toBe(before + after);
});

test.each(
    (['recommended', 'all'] as const).flatMap((level) =>
        ['', 'app'].flatMap((scope) => RUNTIME_RULE_CASES.map((row) => ({ ...row, level, scope }))),
    ),
)(
    '$runtime guidance with $dependency in $scope preserves native rules at $level',
    async ({ level, scope, runtime, dependency, hasNode }) => {
        const prefix = scope === '' ? '' : scope + '/';
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(scope === '' ? ['javascript'] : [], {
                agentRules: true,
                level,
                tables: scope === '' ? '' : '[scope.app]\nconfigurations = ["javascript"]\n',
            }),
            [`${prefix}main.js`]: `#!/usr/bin/env ${runtime}\nconsole.log("ready");\n`,
            [`${prefix}package.json`]: JSON.stringify({
                engines: { [runtime]: '>=1' },
                dependencies: dependency === undefined ? {} : { [dependency]: '1.0.0' },
            }),
        });
        const session = await openSession(sandbox.path);
        const files = selectRuleFiles(
            session.policyFiles.policy.agent_rules,
            everyManifest(session.scopes),
            session.repository,
            level,
            session.packageManifests,
        );
        const paths = files.map((file) => file.path);
        expect(paths.includes('language/javascript/DENO.md')).toBe(runtime === 'deno');
        expect(paths.includes('language/javascript/NODE.md')).toBe(hasNode);
        expect(paths).not.toContain('platform/supabase/DENO.md');
        expect(paths).toContain('general/engineering/agent/TALKING.md');
    },
);

test.each(
    (['recommended', 'all'] as const).flatMap((level) =>
        ['astro', 'svelte', 'vue', 'react', 'unrelated'].map((dependency) => ({ level, dependency })),
    ),
)('$dependency dependency selects component guidance at $level', async ({ level, dependency }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['javascript'], { agentRules: true, level }),
        'package.json': JSON.stringify({ dependencies: { [dependency]: '1.0.0' } }),
    });
    const session = await openSession(sandbox.path);
    const files = selectRuleFiles(
        session.policyFiles.policy.agent_rules,
        everyManifest(session.scopes),
        session.repository,
        level,
        session.packageManifests,
    );
    const components = files.find((file) => file.path === 'language/javascript/COMPONENTS.md');
    if (dependency === 'unrelated') expect(components).toBeUndefined();
    else {
        expect(components?.content).toContain('Pass the fields a child reads');
        expect(components?.content).toContain('Test a component through what the user sees');
        expect(components?.content.includes('One component has one job')).toBe(level === 'all');
    }
});

test('renamed library guidance retains its native contents and removes the former filenames', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['react-hook-form', 'tanstack-query', 'translations'], { agentRules: true }),
        'package.json': '{"dependencies":{"next-intl":"*"}}',
    });
    const session = await openSession(sandbox.path);
    const files = selectRuleFiles(
        session.policyFiles.policy.agent_rules,
        everyManifest(session.scopes),
        session.repository,
        'all',
        session.packageManifests,
    );
    const paths = files.map((file) => file.path);
    expect(paths).toContain('library/react-hook-form/REACT-HOOK-FORM.md');
    expect(paths).toContain('library/tanstack-query/TANSTACK-QUERY.md');
    expect(paths).toContain('library/translations/NEXT-INTL.md');
    expect(paths.some((path) => /REACTHOOKFORM|TANSTACKQUERY|NEXTINTL/u.test(path))).toBe(false);
});

describe.each(
    (['recommended', 'all'] as const).flatMap((level) =>
        ['', 'app'].map((scope) => ({ level, scope, name: scope || 'root' })),
    ),
)('shortened guidance installs at $level in $name', ({ level, scope }) => {
    const resources = new AsyncDisposableStack();
    let rules: Map<string, string>;
    beforeAll(async () => {
        const sandbox = resources.use(
            await testdir({
                'gspot.toml': buildPolicy(scope === '' ? RULE_CONFIGURATIONS : [], {
                    agentRules: true,
                    level,
                    tables:
                        scope === '' ? '' : `[scope.app]\nconfigurations = ${JSON.stringify(RULE_CONFIGURATIONS)}\n`,
                }),
                [`${scope === '' ? '' : scope + '/'}package.json`]: JSON.stringify({ dependencies: { pg: '8.13.1' } }),
            }),
        );
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        rules = new Map(
            output.files
                .filter((file) => file.kind === 'rules')
                .map((file) => [
                    file.path.slice(session.policyFiles.policy.agent_rules.folder.length + 1),
                    file.content,
                ]),
        );
    });
    afterAll(() => resources.disposeAsync());

    test('TALKING and level filtering retain their original content', () => {
        expect(rules.get('general/engineering/agent/TALKING.md')).toBe(
            readAsset('configurations/general/engineering/rules/agent/TALKING.md'),
        );
        expect(rules.get('language/bash/SAFETY.md')).toContain(
            'accept that script with an `[[ignore]]` record for `bash/safety`',
        );
        expect(rules.get('general/prose/DOCS-FORMAT.md')?.includes('Delete obsolete content')).toBe(level === 'all');
        expect(rules.get('general/prose/WRITING.md')?.includes('Use active voice')).toBe(level === 'all');
    });
    test.each(CHECKED_RULE_LINES)('%s omits the checked instruction %s', (path, omitted) => {
        expect(rules.has(path)).toBe(true);
        expect(rules.get(path)).not.toContain(omitted);
    });
    test.each(UPSTREAM_GUIDES)('%s retains the primary reference %s', (path, destination) => {
        expect(rules.get(path)).toContain(destination);
    });
});

test.each(['recommended', 'all'] as const)(
    'always-selected instructions use manifest metadata at %s',
    async (level) => {
        await using sandbox = await testdir({ 'gspot.toml': buildPolicy([], { agentRules: true, level }) });
        const session = await openSession(sandbox.path);
        const manifests = configurationManifests();
        const original = manifests.get('zod')!;
        const selected = { ...original, configuration: { ...original.configuration, always_selected: true } };
        const paths = () =>
            selectRuleFiles(
                session.policyFiles.policy.agent_rules,
                [],
                session.repository,
                level,
                session.packageManifests,
            ).map((file) => file.path);
        try {
            expect(paths()).not.toContain('library/zod/ZOD.md');
            manifests.set('zod', selected);
            expect(paths()).toContain('library/zod/ZOD.md');
            expect(paths()).toContain('general/engineering/agent/TALKING.md');
            const files = selectRuleFiles(
                session.policyFiles.policy.agent_rules,
                [selected],
                session.repository,
                level,
                session.packageManifests,
            );
            expect(files.filter((file) => file.path === 'library/zod/ZOD.md')).toHaveLength(1);
        } finally {
            manifests.set('zod', original);
        }
    },
);
