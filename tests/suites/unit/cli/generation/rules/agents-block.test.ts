import { join } from 'node:path';
import { format } from 'prettier';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import { buildAgentsBlock } from '#cli/generation/rules.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { COMMANDS_HEADING } from '#tests/config/generation/generate.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

function listIndexPaths(block: string): Array<string | undefined> {
    const index = block.slice(0, block.indexOf(COMMANDS_HEADING));
    return index
        .matchAll(/^- `([^`]+)`/gmu)
        .map(([, path]) => path)
        .toArray();
}

test('the AGENTS.md block names the folders of a scoped rule without parentheses', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n',
        }),
        'app/main.js': 'console.log("ready");\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents.split('\n').find((line) => line.includes('/JAVASCRIPT.md`'))).toContain('` in `app/`: ');
});

test('with no configurations the block still lists the general rules', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { rules: true }) });
    const block = buildGeneratedFiles(await openSession(sandbox.path)).blocks.find(
        ({ path }) => path === 'AGENTS.md',
    )!.body;
    const paths = listIndexPaths(block);
    expect(paths).toContain('.gspot/rules/TESTING.md');
    expect(block).toContain('- `.gspot/rules/WORKING.md`');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('a rule file that rule_files.exclude names leaves the index', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: `[rule_files]\nexclude = ["${getRuleFilePath('engineering', 'CLI.md')}"]\n`,
        }),
    });

    const block = buildGeneratedFiles(await openSession(sandbox.path)).blocks.find(
        ({ path }) => path === 'AGENTS.md',
    )!.body;
    const paths = listIndexPaths(block);
    expect(paths).not.toContain('.gspot/rules/CLI.md');
    expect(paths).toContain('.gspot/rules/TESTING.md');
});

test('the AGENTS.md block moves its headings one level down in a file with its own title', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'AGENTS.md': '# Shop\n\nHow agents work here.\n\n```bash\n# not a heading\n```\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents.split('\n').filter((line) => /^#+ /u.test(line))).toStrictEqual([
        '# Shop',
        '# not a heading',
        '## Rules',
        '### General',
        '### Commands',
        '### Generated files',
    ]);
    await applyGeneratedFiles(sandbox.path);
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(agents);
});

test('the AGENTS.md Commands section names its launcher once', () => {
    const command = 'pnpm exec gspot';
    const block = buildAgentsBlock({
        files: [],
        managedKeys: [],
        hasOwnTitle: false,
        startCommand: command,
    });
    const commands = block.slice(block.indexOf(COMMANDS_HEADING), block.indexOf('\n## Generated files'));
    expect(commands).toContain(`The rules write \`gspot\` for \`${command}\`.`);
    expect(commands.match(/pnpm exec gspot/gu)).toHaveLength(1);
});

test('the AGENTS.md index keeps a rule opening that wraps onto a second line', () => {
    const block = buildAgentsBlock({
        files: [
            {
                path: 'SAFETY.md',
                target: '.gspot/rules/SAFETY.md',
                content:
                    '# Bash Safety\n\nRead this rule when a shell script deletes files, or parses JSON or\nYAML.\n\n## Calling\n',
                scopes: [''],
                group: 'language',
            },
        ],
        managedKeys: [],
        hasOwnTitle: false,
        startCommand: 'gspot',
    });
    expect(block).toContain('/SAFETY.md`: when a shell script deletes files, or parses JSON or YAML.\n');
});
