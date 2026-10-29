import { join } from 'node:path';
import { format } from 'prettier';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { buildAgentsBlock } from '#cli/generation/rules.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { RULE_INDEX_PATHS, COMMANDS_HEADING, COMMIT_CHECK_LINE } from '#tests/config/generation/rules.ts';

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

test('with no configurations the block still lists the general rules and the check command', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { rules: true }) });
    const block = generateFiles(await openSession(sandbox.path)).blocks.find(({ path }) => path === 'AGENTS.md')!.body;
    expect(listIndexPaths(block)).toStrictEqual(RULE_INDEX_PATHS);
    expect(block).toContain(COMMIT_CHECK_LINE);
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('with a check selected the block names the command, and an excluded file leaves the index', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: `[rules]\nexclude = ["${getRuleFilePath('engineering', 'CLI.md')}"]\n`,
        }),
    });

    const block = generateFiles(await openSession(sandbox.path)).blocks.find(({ path }) => path === 'AGENTS.md')!.body;
    expect(listIndexPaths(block)).toStrictEqual(
        RULE_INDEX_PATHS.filter((path) => path !== '.gspot/configurations/general/engineering/rules/CLI.md'),
    );
    expect(block).toContain(COMMIT_CHECK_LINE);
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

test.each([true, false])(
    'the AGENTS.md Commands section names the start command, and the staged check only when checks run (%p)',
    (hasChecks) => {
        const command = 'pnpm exec gspot';
        const block = buildAgentsBlock({
            files: [],
            generatedPaths: [],
            managedKeys: [],
            hasOwnTitle: false,
            hasChecks,
            startCommand: command,
        });
        expect(block.slice(block.indexOf(COMMANDS_HEADING), block.indexOf('\n## Generated files'))).toBe(
            `## Commands\n\nThe rules write \`gspot\` for \`${command}\`.\n\n` +
                (hasChecks ? `Before you commit, run \`${command} check --staged\`.\n\n` : '') +
                `After you add code in a new language, framework or tool, run \`${command} add\`, then \`${command} install\`.\n\n` +
                `To change \`gspot.toml\`, run \`${command} set\`, \`unset\`, \`add\`, \`remove\`, \`ignore\`, or \`unignore\`.\n` +
                `After you edit \`gspot.toml\` by hand, run \`${command} apply\`.\n`,
        );
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
