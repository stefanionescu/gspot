import { join } from 'node:path';
import { format } from 'prettier';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildAgentsBlock } from '#cli/generation/rules.ts';
import { START_RUNNERS } from '#cli/config/repository/npm.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { JAVASCRIPT_IN_APP_TABLES } from '#tests/config/generation/rules.ts';

test('the AGENTS.md block names the folders of a scoped rule without parentheses', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: JAVASCRIPT_IN_APP_TABLES }),
        'app/main.js': 'console.log("ready");\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('/JAVASCRIPT.md` in `app/`: ');
    expect(agents).not.toContain('(app/)');
});

test('with no configurations the block still lists the general rules and the check command', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([], { rules: true }) });

    const block = generate(await openSession(sandbox.path)).blocks.find(({ path }) => path === 'AGENTS.md')!.block;
    expect(block).toContain('engineering/rules/WORKING.md');
    expect(block).toContain('gspot check --staged');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('with a check selected the block names the command, and an excluded file leaves the index', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: `[rules]\nexclude = ["${findRuleFilePath('engineering', 'ACCESSIBILITY.md')}"]\n`,
        }),
    });

    const block = generate(await openSession(sandbox.path)).blocks.find(({ path }) => path === 'AGENTS.md')!.block;
    expect(block).toContain('gspot check --staged');
    expect(block).not.toContain('ACCESSIBILITY.md');
    expect(block).toContain('engineering/rules/TESTING.md');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('the AGENTS.md block moves its headings one level down in a file with its own title', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'AGENTS.md': '# Shop\n\nHow agents work here.\n\n```bash\n# not a heading\n```\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents.split('\n').filter((line) => line.startsWith('# '))).toStrictEqual(['# Shop', '# not a heading']);
    expect(agents).toContain('## Rules\n');
    expect(agents).toContain('### Commands\n');
    const again = await runGspot(sandbox.path, ['apply']);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(agents);
});

test.each(
    Object.values(START_RUNNERS).flatMap(({ command }) => [true, false].map((hasChecks) => ({ command, hasChecks }))),
)(
    'the AGENTS.md block explains the short gspot command as $command with checks=$hasChecks',
    ({ command, hasChecks }) => {
        const block = buildAgentsBlock({
            files: [],
            generatedPaths: [],
            managedKeys: [],
            hasOwnTitle: false,
            hasChecks,
            startCommand: command,
        });
        expect(block).toContain(`## Commands\n\nThe rules write \`gspot\` for \`${command}\`.\n\n`);
    },
);

test('the AGENTS.md index keeps a rule opening that wraps onto a second line', () => {
    const block = buildAgentsBlock({
        files: [
            {
                path: 'language/bash/rules/SAFETY.md',
                target: '.gspot/configurations/language/bash/rules/SAFETY.md',
                content:
                    '# Bash Safety\n\nRead this rule when a shell script deletes files, or parses JSON or\nYAML.\n\n## Calling\n',
                scopes: [''],
                group: 'language',
            },
        ],
        generatedPaths: [],
        managedKeys: [],
        hasOwnTitle: false,
        hasChecks: true,
        startCommand: 'gspot',
    });
    expect(block).toContain('/SAFETY.md`: when a shell script deletes files, or parses JSON or YAML.\n');
});
