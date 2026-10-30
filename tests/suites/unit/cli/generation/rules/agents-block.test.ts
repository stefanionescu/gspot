import { join } from 'node:path';
import { format } from 'prettier';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { buildAgentsBlock } from '#cli/generation/rules.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { COMMANDS_HEADING } from '#tests/config/generation/rules.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

function listIndexPaths(block: string): (string | undefined)[] {
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
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents.split('\n').filter((line) => line.includes('app/'))).toStrictEqual([
        '- `.gspot/configurations/language/javascript/rules/JAVASCRIPT.md` in `app/`: when you change JavaScript or TypeScript code.',
    ]);
});

test('with no configurations the block still lists the general rules', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { rules: true }) });
    const block = generateFiles(await openSession(sandbox.path)).blocks.find(({ path }) => path === 'AGENTS.md')!.body;
    const paths = listIndexPaths(block);
    expect(paths.slice(0, 3)).toStrictEqual([
        '.gspot/configurations/general/engineering/rules/WORKING.md',
        '.gspot/configurations/general/prose/rules/WRITING.md',
        '.gspot/configurations/general/engineering/rules/TALKING.md',
    ]);
    expect(paths).toContain('.gspot/configurations/general/engineering/rules/TESTING.md');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('a rule file that rules.exclude names leaves the index', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: `[rules]\nexclude = ["${getRuleFilePath('engineering', 'CLI.md')}"]\n`,
        }),
    });

    const block = generateFiles(await openSession(sandbox.path)).blocks.find(({ path }) => path === 'AGENTS.md')!.body;
    const paths = listIndexPaths(block);
    expect(paths).not.toContain('.gspot/configurations/general/engineering/rules/CLI.md');
    expect(paths).toContain('.gspot/configurations/general/engineering/rules/TESTING.md');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('the AGENTS.md block moves its headings one level down in a file with its own title', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'AGENTS.md': '# Shop\n\nHow agents work here.\n\n```bash\n# not a heading\n```\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents.split('\n').filter((line) => /^#+ /u.test(line))).toStrictEqual([
        '# Shop',
        '# not a heading',
        '## Rules',
        '### General',
        '### Commands',
        '### Generated files',
    ]);
    const again = await runGspot(sandbox.path, ['apply']);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(agents);
});

test('the AGENTS.md Commands section names the start command and leaves the staged check to the hooks', () => {
    const command = 'pnpm exec gspot';
    const block = buildAgentsBlock({
        files: [],
        managedKeys: [],
        hasOwnTitle: false,
        startCommand: command,
    });
    const commands = block.slice(block.indexOf(COMMANDS_HEADING), block.indexOf('\n## Generated files'));
    expect(commands).toContain(`The rules write \`gspot\` for \`${command}\`.`);
    expect(commands).not.toContain('check --staged');
});

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
        managedKeys: [],
        hasOwnTitle: false,
        startCommand: 'gspot',
    });
    expect(block).toContain('/SAFETY.md`: when a shell script deletes files, or parses JSON or YAML.\n');
});
