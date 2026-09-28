import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import { collectKept } from '#cli/policy/adoption/collect.ts';
import { PRETTIER_TOOLING } from '#tests/support/cli/tooling.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { writeAdoptedMarkdown } from '#tests/support/cli/markdown.ts';

// Runs the pinned markdownlint over the planted sample with one configuration file.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Six native runs of markdownlint share the command line; one owner keeps its flags.
function native(root: string, config: string): Bun.SyncSubprocess<'pipe', 'pipe'> {
    return Bun.spawnSync(['markdownlint-cli2', '--no-globs', '--config', config, 'sample.md'], {
        cwd: root,
        stdout: 'pipe',
        stderr: 'pipe',
    });
}

test('directory-local Markdown adoption preserves sibling rules and descendant editor configurations', async () => {
    await using sandbox = await testdir();
    const original = '{"default":false,"MD033":true}\n';
    await createFileTree(sandbox.path, {
        'guide/.markdownlint.jsonc': original,
        'reference/.markdownlint.jsonc': '{"default":false,"MD041":true}\n',
        'guide/sample.md': '<span>Content</span>\n',
        'guide/deep/sample.md': '<span>Content</span>\n',
        'reference/sample.md': '<span>Content</span>\n',
    });
    const tree = await readRepository(sandbox.path, [], [], []);
    const discovered = existingTooling(sandbox.path, tree.files, []);
    const kept = await collectKept(sandbox.path, discovered, new Set(['markdown']), []);
    expect(kept.unread).toStrictEqual([]);
    expect(kept.removed.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'guide/.markdownlint.jsonc',
        'reference/.markdownlint.jsonc',
    ]);
    expect(kept.tools.has('markdownlint')).toBe(false);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        proposeText({
            kits: ['markdown'],
            scopes: [{ path: 'guide/deep', kits: ['markdown'] }],
            kept,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        }),
    );
    const session = await openSession(sandbox.path);
    const configurations = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter((file) => file.kind === 'config' || file.path.endsWith('.markdownlint-cli2.jsonc'));
    for (const file of configurations) await Bun.write(join(sandbox.path, file.path), file.content);
    for (const { path } of kept.removed) unlinkSync(join(sandbox.path, path));
    for (const [scope, rule] of [
        ['guide', 'MD033'],
        ['guide/deep', 'MD033'],
        ['reference', 'MD041'],
    ]) {
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: Two runs per case share the command line; one owner keeps its flags.
        const native = () =>
            Bun.spawnSync(['markdownlint-cli2', '--no-globs', 'sample.md'], {
                cwd: join(sandbox.path, scope!),
                stdout: 'pipe',
                stderr: 'pipe',
            });
        const failed = native();
        expect(failed.exitCode, failed.stderr.toString()).toBe(1);
        expect(failed.stderr.toString()).toContain(rule!);
        expect(failed.stderr.toString()).not.toContain(rule === 'MD033' ? 'MD041' : 'MD033');
        await Bun.write(join(sandbox.path, scope!, 'sample.md'), '# Content\n');
        const corrected = native();
        expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    }
});

test.each([
    {
        inherited: false,
        original: '{"default":false,"MD033":true,"MD009":true}\n',
        expected: { removed: ['.markdownlint.jsonc'], retained: [], base: undefined, parent: undefined },
    },
    {
        inherited: true,
        original: '{"extends":"./config/parent.yaml","MD013":false,"MD033":true,"MD009":true}\n',
        expected: {
            removed: ['.markdownlint.jsonc'],
            retained: ['config/base.jsonc', 'config/parent.yaml'],
            base: true,
            parent: true,
        },
    },
])(
    'Markdown adoption preserves native rules and corrections with inheritance=$inherited',
    async ({ original, expected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.markdownlint.jsonc': original,
            'config/parent.yaml': 'extends: ./base.jsonc\nMD013: {line_length: 3}\nMD033: false\n',
            'config/base.jsonc': '{// Base rules\n"default":false,"MD033":true,"MD009":false}\n',
            'sample.md': 'A paragraph.\n\n<span>Content</span>\n',
        });
        const before = native(sandbox.path, '.markdownlint.jsonc');
        expect(before.exitCode).toBe(1);
        expect(before.stderr.toString()).toContain('MD033');
        const kept = await collectKept(
            sandbox.path,
            {
                ...PRETTIER_TOOLING,
                configs: [{ tool: 'markdownlint-cli2', path: '.markdownlint.jsonc', keeps: 'rules-table' }],
            },
            new Set(['markdown']),
            ['sample.md'],
        );
        expect(kept.unread).toStrictEqual([]);
        // An inherited configuration keeps its parents in place and reads their settings; a flat one has no parents.
        expect({
            removed: kept.removed.map(({ path }) => path),
            retained: kept.retained.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right)),
            base: kept.observed.get('config/base.jsonc')?.bytes.toString().includes('"default":false'),
            parent: kept.observed.get('config/parent.yaml')?.bytes.toString().includes('line_length: 3'),
        }).toStrictEqual({ ...expected, removed: [...expected.removed], retained: [...expected.retained] });
        await writeAdoptedMarkdown(sandbox.path, kept);
        // Remove discovery input so the generated file alone determines the native result.
        unlinkSync(join(sandbox.path, '.markdownlint.jsonc'));
        const after = native(sandbox.path, 'generated.jsonc');
        expect(after.exitCode).toBe(1);
        expect(after.stderr.toString()).toBe(before.stderr.toString());
        await Bun.write(join(sandbox.path, 'sample.md'), 'A paragraph.\n\nContent\n');
        const corrected = native(sandbox.path, 'generated.jsonc');
        expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
        await Bun.write(join(sandbox.path, 'sample.md'), 'A paragraph.   \n');
        const fixed = Bun.spawnSync(
            ['markdownlint-cli2', '--fix', '--no-globs', '--config', 'generated.jsonc', 'sample.md'],
            {
                cwd: sandbox.path,
                stdout: 'pipe',
                stderr: 'pipe',
            },
        );
        expect(fixed.exitCode, fixed.stderr.toString()).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'sample.md')).text()).toBe('A paragraph.\n');
    },
);

test.each([{}, { default: true }])('Markdown adoption preserves native enabled defaults %j', async (defaults) => {
    await using sandbox = await testdir();
    const original = JSON.stringify({ ...defaults, MD009: false });
    await createFileTree(sandbox.path, {
        '.markdownlint.jsonc': original,
        'sample.md': `# Title\n\n<span>${'Long paragraph '.repeat(12)}</span>\n`,
    });
    const before = native(sandbox.path, '.markdownlint.jsonc');
    expect(before.exitCode).toBe(1);
    expect(before.stderr.toString()).toContain('MD013');
    expect(before.stderr.toString()).toContain('MD033');
    const kept = await collectKept(
        sandbox.path,
        {
            ...PRETTIER_TOOLING,
            configs: [{ tool: 'markdownlint-cli2', path: '.markdownlint.jsonc', keeps: 'rules-table' }],
        },
        new Set(['markdown']),
        ['sample.md'],
    );
    expect(kept.unread).toStrictEqual([]);
    await writeAdoptedMarkdown(sandbox.path, kept);
    unlinkSync(join(sandbox.path, '.markdownlint.jsonc'));
    const after = native(sandbox.path, 'generated.jsonc');
    expect(after.exitCode).toBe(1);
    expect(after.stderr.toString()).toBe(before.stderr.toString());
    await Bun.write(join(sandbox.path, 'sample.md'), '# Title\n\nContent\n');
    const corrected = native(sandbox.path, 'generated.jsonc');
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});
