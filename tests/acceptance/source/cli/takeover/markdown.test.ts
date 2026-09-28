// Takeover at init: an adopted Markdown configuration keeps its native defaults through checks, fixes, and uninstall.
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { initArgs } from '#tests/support/cli/init.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import { containing } from '#tests/support/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/cli.ts';
import { run, runProcess } from '#tests/support/cli/command.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs';
import type { MarkdownAdoption } from '#tests/types/acceptance/source/cli.ts';

async function expectMarkdownCorrections({
    root,
    scope,
    prefix,
    literalFiles,
    command,
}: MarkdownAdoption): Promise<void> {
    const structured = await run(root, [...command, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(1);
    const findings = reportSchema.parse(JSON.parse(structured.stdout)).checks.flatMap((check) => check.findings);
    for (const name of literalFiles) {
        expect(findings).toContainEqual(
            containing({
                file: `${prefix}nested/${name}`,
                rule: 'MD033',
                line: 3,
                column: 1,
                fixable: false,
            }),
        );
        expect(findings).toContainEqual(
            containing({ file: `${prefix}nested/${name}`, rule: 'MD009', line: 1, fixable: true }),
        );
    }
    const failed = await run(root, [...command, '--fix']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.stdout).toContain('MD033');
    expect(failed.stdout).not.toContain('MD041');
    expect(existsSync(join(root, 'discovered.txt'))).toBe(false);
    expect(readFileSync(join(root, scope, 'sample.md'), 'utf8')).toBe('A paragraph.\n\n<span>Content</span>\n');
    for (const name of literalFiles) {
        // A name with a line break cannot be printed on one line; every other file is named in the output.
        expect(name.includes('\n') || failed.stdout.includes(`nested/${name}`)).toBe(true);
        expect(readFileSync(join(root, scope, 'nested', name), 'utf8')).toBe('A paragraph.\n\n<span>Content</span>\n');
        await Bun.write(join(root, scope, 'nested', name), 'A paragraph.\n\nContent\n');
    }
    await Bun.write(join(root, scope, 'sample.md'), 'A paragraph.\n\nContent\n');
    const corrected = await run(root, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const native = await runProcess(
        [join(root, '.gspot/node_modules/.bin/markdownlint-cli2'), '--no-globs', 'sample.md'],
        {
            cwd: join(root, scope),
        },
    );
    expect(native.code, native.stderr).toBe(0);
}

async function expectStagedMarkdown({
    root,
    scope,
    prefix,
    configuration,
    original,
    parent,
    inherited,
    command,
}: MarkdownAdoption): Promise<void> {
    commitAll(root);
    await Bun.write(join(root, scope, 'nested/sample.md'), '<span>Staged content</span>\n');
    expect(git(root, ['add', '--', `${prefix}nested/sample.md`]).code).toBe(0);
    await Bun.write(join(root, scope, 'nested/sample.md'), 'Working content\n');
    const staged = await run(root, [...command, '--staged']);
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    expect(staged.stdout).toContain('MD033');
    expect(readFileSync(join(root, scope, 'nested/sample.md'), 'utf8')).toBe('Working content\n');
    expect(existsSync(join(root, 'discovered.txt'))).toBe(false);
    const removed = await run(root, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readFileSync(join(root, configuration), 'utf8')).toBe(original);
    expect(statSync(join(root, configuration)).mode & 0o777).toBe(0o640);
    expect(readFileSync(join(root, parent), 'utf8')).toBe(inherited);
    expect(statSync(join(root, parent)).mode & 0o777).toBe(0o640);
}

test.each(
    (['', 'guide[1]', 'native-defaults'] as const).flatMap((scope) => [
        {
            scope,
            scenario: 'preserves native defaults and corrects literal file names',
            verify: expectMarkdownCorrections,
        },
        {
            scope,
            scenario: 'checks staged content and restores configuration on uninstall',
            verify: expectStagedMarkdown,
        },
    ]),
)(
    'Markdown adoption in $scope $scenario',
    async ({ scope, verify }) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        const configuration = `${prefix}.markdownlint.jsonc`;
        const original = {
            'native-defaults': '{"MD009":true,"MD041":false}\n',
            '': '{"default":false,"MD033":true,"MD009":true}\n',
            'guide[1]': '{"extends":"./config/base.jsonc","MD033":true,"MD009":true}\n',
        }[scope];
        const inherited = '{"default":false,"MD033":false}\n';
        const parent = `${prefix}config/base.jsonc`;
        await createFileTree(sandbox.path, {
            [configuration]: original,
            [parent]: inherited,
            [`${prefix}sample.md`]: 'A paragraph.   \n\n<span>Content</span>\n',
        });
        chmodSync(join(sandbox.path, configuration), 0o640);
        chmodSync(join(sandbox.path, parent), 0o640);
        commitAll(sandbox.path);
        const initialized = await run(sandbox.path, initArgs(['markdown'], ['docs', 'spelling']));
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(readFileSync(join(sandbox.path, parent), 'utf8')).toBe(inherited);
        expect(statSync(join(sandbox.path, parent)).mode & 0o777).toBe(0o640);
        const selected = await run(sandbox.path, ['set', 'level', 'all']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const literalFiles = [
            'sample.md',
            '#notes.md',
            '[notes].md',
            '-notes.md',
            ...(process.platform === 'win32' ? [] : ['name:5.md', 'line\nbreak.md']),
        ];
        await createFileTree(sandbox.path, {
            [`${prefix}nested/.markdownlint.jsonc`]: '{"default":false,"MD033":false,"MD009":false}\n',
            [`${prefix}nested/.markdownlint-cli2.mjs`]:
                'import { writeFileSync } from "node:fs"; writeFileSync("discovered.txt", "executed"); export default {};\n',
            ...Object.fromEntries(
                literalFiles.map((name) => [`${prefix}nested/${name}`, 'A paragraph.   \n\n<span>Content</span>\n']),
            ),
        });
        const command = ['check', '--only', 'markdown/markdownlint', '--no-cache'];
        await verify({
            root: sandbox.path,
            scope,
            prefix,
            configuration,
            original,
            parent,
            inherited,
            literalFiles,
            command,
        });
    },
    PLANTED_TIMEOUT_MS * 5,
);
