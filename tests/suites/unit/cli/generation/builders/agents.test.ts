import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { format } from 'prettier';

import { COMMANDS_HEADING } from '#cli/config/generation/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildAgentsBlock } from '#cli/generation/builders/agents.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function buildAgentsBody(files: Record<string, string>): Promise<string> {
    await using sandbox = await createGitSandbox(files);
    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    return generated.blocks.find(({ path }) => path === 'AGENTS.md')!.body;
}

function listIndexPaths(block: string): Array<string | undefined> {
    const index = block.slice(0, block.indexOf(COMMANDS_HEADING));
    return index
        .matchAll(/^- `([^`]+)`/gmu)
        .map(([, path]) => path)
        .toArray();
}

test('the AGENTS.md block names the folders of a scoped rule without parentheses', async () => {
    const block = await buildAgentsBody({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n',
        }),
        'app/main.js': 'console.log("ready");\n',
    });
    expect(block.split('\n').find((line) => line.includes('/JAVASCRIPT.md`'))).toContain('` in `app/`: ');
});

test('with no configurations the block still lists the general rules', async () => {
    const block = await buildAgentsBody({ 'gspot.toml': buildSandboxSettings([], { rules: true }) });
    const paths = listIndexPaths(block);
    expect(paths).toContain('.gspot/rules/TESTING.md');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('a rule file that rule_files.exclude names leaves the index', async () => {
    const block = await buildAgentsBody({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: `[rule_files]\nexclude = ["${getRuleFilePath('agents', 'CLI.md')}"]\n`,
        }),
    });
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
        '### Commands',
    ]);
});

test('the AGENTS.md Commands section names its launcher once', () => {
    const command = 'pnpm exec gspot';
    const block = buildAgentsBlock({ files: [], hasOwnTitle: false, startCommand: command, hooksEnabled: true });
    const commands = block.slice(block.indexOf(COMMANDS_HEADING)).split('\n');
    expect(commands.filter((line) => line.includes(command))).toHaveLength(1);
});

test.each([true, false])(
    'with hooks enabled %p, the AGENTS.md block names the check before a push only without hooks',
    (hooksEnabled) => {
        const block = buildAgentsBlock({ files: [], hasOwnTitle: false, startCommand: 'gspot', hooksEnabled });
        expect(block.includes('gspot check --base origin/HEAD')).toBe(!hooksEnabled);
    },
);

test('the AGENTS.md index keeps a rule opening that wraps onto a second line', () => {
    const block = buildAgentsBlock({
        files: [
            {
                path: 'SAFETY.md',
                target: '.gspot/rules/SAFETY.md',
                content:
                    '# Bash Safety\n\nRead this rule when a shell script deletes files, or parses JSON or\nYAML.\n\n## Calling\n',
                scopes: [''],
            },
        ],
        hasOwnTitle: false,
        startCommand: 'gspot',
        hooksEnabled: true,
    });
    expect(block).toContain('/SAFETY.md`: when a shell script deletes files, or parses JSON or YAML.\n');
});
