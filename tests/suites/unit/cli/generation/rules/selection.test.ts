import { beforeAll, describe, expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import type { Level } from '#cli/types/settings.ts';
import { RUNTIME_RULE_CASES } from '#tests/config/generation/generate.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function generateRuleFiles(level: Level, files: Record<string, string>): Promise<Map<string, string>> {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'css', 'vitest', 'swift', 'bash', 'drizzle', 'openapi'], {
            rules: true,
            level,
        }),
        ...files,
    });

    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    return new Map(
        output.files
            .filter((file) => file.path.includes('/rules/') && file.path.endsWith('.md'))
            .map((file) => [file.path, file.content]),
    );
}

test.each([...RUNTIME_RULE_CASES])('$name selects the runtime rules $rules', async ({ runtime, dependency, rules }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { rules: true, level: 'all' }),
        'main.js': `#!/usr/bin/env ${runtime}\nconsole.log("ready");\n`,
        'package.json': JSON.stringify({
            engines: { [runtime]: '>=1' },
            dependencies: dependency === undefined ? {} : { [dependency]: '1.0.0' },
        }),
    });
    const session = await openSession(sandbox.path);
    const paths = selectRuleFiles(session).map((file) => file.path);
    expect(paths.filter((path) => /^(?:DENO|NODE)\.md$/u.test(path))).toStrictEqual([...rules]);
});

test('a rule file shows the limit that gspot.toml sets', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], {
            rules: true,
            level: 'all',
            tables: '[prose]\nmax_sentence_words = 24\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const writing = selectRuleFiles(session).find(({ path }) => path.endsWith('WRITING.md'));
    expect(writing?.content).toContain('Keep a sentence within 24 words');
    expect(writing?.content).not.toContain('{setting:');
});

describe('which rule files gspot writes', () => {
    let defaultLevel: ReadonlyMap<string, string>;

    let all: ReadonlyMap<string, string>;

    beforeAll(async () => {
        defaultLevel = await generateRuleFiles('basic', {});
        all = await generateRuleFiles('all', {});
    });

    test('a rule file whose sections are all for level all is written only at all', () => {
        expect(defaultLevel.has(getRuleFilePath('naming', 'NAMING.md'))).toBe(false);
        expect(all.has(getRuleFilePath('naming', 'NAMING.md'))).toBe(true);
        expect(defaultLevel.has(getRuleFilePath('engineering', 'WORKING.md'))).toBe(true);
    });

    test('rule files that need a file or a dependency are written only when it is there', async () => {
        const present = await generateRuleFiles('all', {
            'bunfig.toml': '[test]\nroot = "tests"\n',
            'package.json':
                '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
        });
        for (const path of [
            getRuleFilePath('javascript', 'BUN.md'),
            getRuleFilePath('css', 'TAILWIND.md'),
            getRuleFilePath('javascript', 'PLAYWRIGHT.md'),
        ]) {
            expect(all.has(path)).toBe(false);
            expect(present.has(path)).toBe(true);
        }
    });

    test('Swift rule files need an import, not one in a comment or string', async () => {
        const absent = await generateRuleFiles('all', {
            'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n',
        });
        const present = await generateRuleFiles('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
        for (const path of [getRuleFilePath('swift', 'SWIFTUI.md'), getRuleFilePath('swift', 'UIKIT.md')]) {
            expect(absent.has(path)).toBe(false);
            expect(present.has(path)).toBe(true);
        }
    });
});

test('a Supabase project selects Deno rules without a Deno settings file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase'], { rules: true }),
        'supabase/config.toml': 'project_id = "example"\n',
    });
    const session = await openSession(sandbox.path);
    expect(selectRuleFiles(session).map(({ path }) => path)).toContain('DENO.md');
});

test.each(['pytest', 'jest'])(
    '%s selection writes its test guidance and links it from AGENTS.md',
    async (configuration) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([configuration], { rules: true }),
        });
        const generated = buildGeneratedFiles(await openSession(sandbox.path));
        const path = getRuleFilePath(configuration, `${configuration.toUpperCase()}.md`);
        expect(generated.files.find((file) => file.path === path)?.content).toContain('Read TESTING.md too.');
        const agents = generated.blocks.find((block) => block.path === 'AGENTS.md')?.body;
        expect(agents).toContain(
            `\`${path}\`: when you write or change a ${configuration === 'jest' ? 'Jest' : 'pytest'} test.`,
        );
    },
);
