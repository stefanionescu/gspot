import { testdir } from 'testdirs';
import { test, expect, describe } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { readAsset } from '#cli/platform/assets.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { FIRST_READ } from '#cli/config/policy/settings.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { excludeErrors } from '#cli/policy/errors/selection.ts';
import { textAtLevel, selectRuleFiles } from '#cli/agent-rules/assemble.ts';
import { UPSTREAM_GUIDES, CHECKED_RULE_LINES, RULE_CONFIGURATIONS } from '#tests/config/cli/agent-rules.ts';

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

    test.each([...FIRST_READ, 'general/engineering/agent', 'general/engineering/prose'])(
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

test.each(['recommended', 'all'] as const)('conditional agent guidance preserves native rules at %s', async (level) => {
    for (const runtime of ['deno', 'node']) {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['javascript'], { level }),
            'main.js': `#!/usr/bin/env ${runtime}\nconsole.log("ready");\n`,
        });
        const session = await openSession(sandbox.path);
        const files = selectRuleFiles(
            session.policyFiles.policy.agent_rules,
            everyManifest(session.scopes),
            session.repository,
            level,
        );
        const paths = files.map((file) => file.path);
        expect(paths.includes('language/javascript/DENO.md')).toBe(runtime === 'deno');
        expect(paths).not.toContain('platform/supabase/DENO.md');
        expect(paths).toContain('general/engineering/agent/TALKING.md');
    }
    for (const dependency of ['astro', 'svelte', 'vue', 'react', 'unrelated']) {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['javascript'], { level }),
            'package.json': JSON.stringify({ dependencies: { [dependency]: '1.0.0' } }),
        });
        const session = await openSession(sandbox.path);
        const files = selectRuleFiles(
            session.policyFiles.policy.agent_rules,
            everyManifest(session.scopes),
            session.repository,
            level,
        );
        const components = files.find((file) => file.path === 'language/javascript/COMPONENTS.md');
        if (dependency === 'unrelated') expect(components).toBeUndefined();
        else {
            expect(components?.content).toContain('Pass the fields a child reads');
            expect(components?.content).toContain('Test a component through what the user sees');
            expect(components?.content.includes('One component has one job')).toBe(level === 'all');
        }
    }
});

test('renamed library guidance retains its native contents and removes the former filenames', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['react-hook-form', 'tanstack-query', 'i18n']),
    });
    const session = await openSession(sandbox.path);
    const files = selectRuleFiles(
        session.policyFiles.policy.agent_rules,
        everyManifest(session.scopes),
        session.repository,
        'all',
    );
    const paths = files.map((file) => file.path);
    expect(paths).toContain('library/react-hook-form/REACT-HOOK-FORM.md');
    expect(paths).toContain('library/tanstack-query/TANSTACK-QUERY.md');
    expect(paths).toContain('library/i18n/NEXT-INTL.md');
    expect(paths.some((path) => /REACTHOOKFORM|TANSTACKQUERY|NEXTINTL/u.test(path))).toBe(false);
});

test.each(
    (['recommended', 'all'] as const).flatMap((level) =>
        ['', 'app'].map((scope) => ({ level, scope, name: scope || 'root' })),
    ),
)('shortened guidance installs at $level in $name', async ({ level, scope }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(scope === '' ? RULE_CONFIGURATIONS : [], {
            level,
            tables: scope === '' ? '' : `[scope.app]\nconfigurations = ${JSON.stringify(RULE_CONFIGURATIONS)}\n`,
        }),
        [`${scope === '' ? '' : scope + '/'}package.json`]: JSON.stringify({ dependencies: { pg: '8.13.1' } }),
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const rules = new Map(
        output.files
            .filter((file) => file.kind === 'rules')
            .map((file) => [file.path.slice(session.policyFiles.policy.agent_rules.folder.length + 1), file.content]),
    );
    expect(rules.get('general/engineering/agent/TALKING.md')).toBe(
        readAsset('configurations/general/engineering/rules/agent/TALKING.md'),
    );
    for (const [path, omitted] of CHECKED_RULE_LINES) {
        expect(rules.has(path)).toBe(true);
        expect(rules.get(path)).not.toContain(omitted);
    }
    expect(rules.get('language/bash/SAFETY.md')).toContain(
        'accept that script with an `[[ignore]]` record for `bash/safety`',
    );
    for (const [path, destination] of UPSTREAM_GUIDES) expect(rules.get(path)).toContain(destination);
    expect(rules.get('general/engineering/prose/DOCS-FORMAT.md')?.includes('Delete obsolete content')).toBe(
        level === 'all',
    );
    expect(rules.get('general/engineering/prose/WRITING.md')?.includes('Use active voice')).toBe(level === 'all');
});
