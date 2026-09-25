import { proposeText } from '#cli/commands/init/propose.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { expect, test } from 'bun:test';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';

const tooling: ExistingTooling = {
    configs: [{ tool: 'prettier', path: '.prettierrc.json', carries: 'rules-table' as const }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};

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
    const discovered = existingTooling(sandbox.path, (await readRepository(sandbox.path, [], [], [])).files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set(['markdown']), []);
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map(({ path }) => path).sort()).toStrictEqual([
        'guide/.markdownlint.jsonc',
        'reference/.markdownlint.jsonc',
    ]);
    expect(carried.tools.has('markdownlint')).toBe(false);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        proposeText({
            configurations: ['markdown'],
            scopes: [{ path: 'guide/deep', configurations: ['markdown'] }],
            carried,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        }),
    );
    const session = await openSession(sandbox.path);
    const configurations = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.filter((file) => file.kind === 'config' || file.path.endsWith('.markdownlint-cli2.jsonc'));
    for (const file of configurations) await Bun.write(join(sandbox.path, file.path), file.content);
    for (const { path } of carried.removed) unlinkSync(join(sandbox.path, path));
    for (const [scope, rule] of [
        ['guide', 'MD033'],
        ['guide/deep', 'MD033'],
        ['reference', 'MD041'],
    ]) {
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

test.each([false, true])(
    'Markdown adoption preserves native rules and corrections with inheritance=%s',
    async (inherited) => {
        await using sandbox = await testdir();
        const original = inherited
            ? '{"extends":"./config/parent.yaml","MD013":false,"MD033":true,"MD009":true}\n'
            : '{"default":false,"MD033":true,"MD009":true}\n';
        await createFileTree(sandbox.path, {
            '.markdownlint.jsonc': original,
            'config/parent.yaml': 'extends: ./base.jsonc\nMD013: {line_length: 3}\nMD033: false\n',
            'config/base.jsonc': '{// Base rules\n"default":false,"MD033":true,"MD009":false}\n',
            'sample.md': 'A paragraph.\n\n<span>Content</span>\n',
        });
        const native = (config: string) =>
            Bun.spawnSync(['markdownlint-cli2', '--no-globs', '--config', config, 'sample.md'], {
                cwd: sandbox.path,
                stdout: 'pipe',
                stderr: 'pipe',
            });
        const before = native('.markdownlint.jsonc');
        expect(before.exitCode).toBe(1);
        expect(before.stderr.toString()).toContain('MD033');
        const carried = await collectCarried(
            sandbox.path,
            {
                ...tooling,
                configs: [{ tool: 'markdownlint-cli2', path: '.markdownlint.jsonc', carries: 'rules-table' }],
            },
            new Set(['markdown']),
            ['sample.md'],
        );
        expect(carried.unread).toStrictEqual([]);
        if (inherited) {
            expect(carried.removed.map(({ path }) => path)).toStrictEqual(['.markdownlint.jsonc']);
            expect(carried.retained.map(({ path }) => path).toSorted()).toStrictEqual([
                'config/base.jsonc',
                'config/parent.yaml',
            ]);
            expect(carried.observed.get('config/base.jsonc')?.bytes.toString()).toContain('"default":false');
            expect(carried.observed.get('config/parent.yaml')?.bytes.toString()).toContain('line_length: 3');
        }
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            proposeText({
                configurations: ['markdown'],
                scopes: [],
                carried,
                hooks: 'none',
                ci: 'none',
                rules: false,
                runner: 'none',
            }),
        );
        const renderSession1 = await openSession(sandbox.path);
        const configuration = emitAll(
            renderSession1.policyFiles.policy,
            renderSession1.repository,
            renderSession1.scopes,
            { version: renderSession1.version, packageManager: renderSession1.packageManager },
        ).files.find(({ path }) => path === '.gspot/config/markdownlint.jsonc')!;
        await Bun.write(join(sandbox.path, 'generated.jsonc'), configuration.content);
        // Remove discovery input so the generated file alone determines the native result.
        unlinkSync(join(sandbox.path, '.markdownlint.jsonc'));
        const after = native('generated.jsonc');
        expect(after.exitCode).toBe(1);
        expect(after.stderr.toString()).toBe(before.stderr.toString());
        await Bun.write(join(sandbox.path, 'sample.md'), 'A paragraph.\n\nContent\n');
        const corrected = native('generated.jsonc');
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
    const native = (config: string) =>
        Bun.spawnSync(['markdownlint-cli2', '--no-globs', '--config', config, 'sample.md'], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const before = native('.markdownlint.jsonc');
    expect(before.exitCode).toBe(1);
    expect(before.stderr.toString()).toContain('MD013');
    expect(before.stderr.toString()).toContain('MD033');
    const carried = await collectCarried(
        sandbox.path,
        {
            ...tooling,
            configs: [{ tool: 'markdownlint-cli2', path: '.markdownlint.jsonc', carries: 'rules-table' }],
        },
        new Set(['markdown']),
        ['sample.md'],
    );
    expect(carried.unread).toStrictEqual([]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        proposeText({
            configurations: ['markdown'],
            scopes: [],
            carried,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        }),
    );
    const renderSession2 = await openSession(sandbox.path);
    const generated = emitAll(renderSession2.policyFiles.policy, renderSession2.repository, renderSession2.scopes, {
        version: renderSession2.version,
        packageManager: renderSession2.packageManager,
    }).files.find(({ path }) => path === '.gspot/config/markdownlint.jsonc')!;
    await Bun.write(join(sandbox.path, 'generated.jsonc'), generated.content);
    unlinkSync(join(sandbox.path, '.markdownlint.jsonc'));
    const after = native('generated.jsonc');
    expect(after.exitCode).toBe(1);
    expect(after.stderr.toString()).toBe(before.stderr.toString());
    await Bun.write(join(sandbox.path, 'sample.md'), '# Title\n\nContent\n');
    const corrected = native('generated.jsonc');
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});

test.each([false, true])(
    'nested spelling adoption writes a local policy table with an existing scope of %s',
    async (existing) => {
        await using sandbox = await testdir();
        const original =
            '[default]\nlocale = "en-gb"\n[default.extend-words]\n# An imported name requires its exact spelling.\nteh = "teh"\n[files]\nextend-exclude = ["src/**", "*.skip", "!keep.skip"]\n';
        await createFileTree(sandbox.path, {
            'nested/typos.toml': original,
            'nested/sample.txt': 'colour teh\n',
            'nested/src/ignored.txt': 'recieve\n',
            'nested/ignored.skip': 'recieve\n',
            'nested/keep.skip': 'recieve\n',
            'sample.txt': 'colour teh\n',
        });
        const native = (path: string) =>
            Bun.spawnSync(['typos', '--force-exclude', path], {
                cwd: join(sandbox.path, 'nested'),
                stdout: 'pipe',
                stderr: 'pipe',
            });
        const expected = [
            ['src/ignored.txt', 0],
            ['ignored.skip', 0],
            ['keep.skip', 2],
        ] as const;
        for (const [path, status] of expected) expect(native(path).exitCode).toBe(status);
        const repository = await readRepository(sandbox.path, [], [], []);
        const discovered = existingTooling(sandbox.path, repository.files, []);
        const carried = await collectCarried(sandbox.path, discovered, new Set(['spelling']), []);
        expect(carried.unread).toStrictEqual([]);
        expect(carried.tools.has('typos')).toBe(false);
        expect(carried.removed.map(({ path }) => path)).toStrictEqual(['nested/typos.toml']);
        const policy = proposeText({
            configurations: ['spelling'],
            scopes: existing ? [{ path: 'nested', configurations: ['markdown'] }] : [],
            carried,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        });
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
        const session = await openSession(sandbox.path);
        expect(session.policyFiles.policy.scopes).toStrictEqual([
            { path: 'nested', configurations: existing ? ['markdown', 'spelling'] : ['spelling'] },
        ]);
        const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }).files.filter(({ path }) => path.startsWith('.gspot/') && path.endsWith('typos.toml'));
        for (const config of outputs) await Bun.write(join(sandbox.path, config.path), config.content);
        const run = (config: string, path: string) =>
            Bun.spawnSync(
                [
                    'typos',
                    '--isolated',
                    '--config',
                    config,
                    '--force-exclude',
                    '--format',
                    'brief',
                    '--color',
                    'never',
                    path,
                ],
                { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
            );
        const child = run('.gspot/config/nested/typos.toml', 'nested/sample.txt');
        expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
        expect(run('.gspot/config/nested/typos.toml', 'nested/src/ignored.txt').exitCode).toBe(0);
        expect(run('.gspot/config/nested/typos.toml', 'nested/ignored.skip').exitCode).toBe(0);
        expect(run('.gspot/config/nested/typos.toml', 'nested/keep.skip').exitCode).toBe(2);
        const root = run('.gspot/config/typos.toml', 'sample.txt');
        expect(root.exitCode, root.stdout.toString() + root.stderr.toString()).toBe(2);
        expect(root.stdout.toString()).toContain('teh');
        await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
        expect(run('.gspot/config/typos.toml', 'sample.txt').exitCode).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'nested/typos.toml')).text()).toBe(original);
        const editor = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }).files.find(({ path }) => path === 'nested/typos.toml')!;
        await Bun.write(join(sandbox.path, editor.path), editor.content);
        for (const [path, status] of expected) {
            const checked = native(path);
            expect(checked.exitCode, checked.stdout.toString() + checked.stderr.toString()).toBe(status);
        }
        await Bun.write(join(sandbox.path, 'nested/keep.skip'), 'receive\n');
        expect(native('keep.skip').exitCode).toBe(0);
    },
);
