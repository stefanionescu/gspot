import { join } from 'node:path';
import { testdir } from 'testdirs';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { rejection } from '#tests/support/expectations.ts';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { useRevision } from '#cli/repository/revisions/contents.ts';
import { prepareEditableSnapshot } from '#tests/support/cli/python/snapshot.ts';

test.each([
    ['index', 'hatchling'],
    ['commit', 'hatchling'],
    ['index', 'hatchling-exact'],
    ['commit', 'hatchling-exact'],
    ['index', 'setuptools'],
    ['commit', 'setuptools'],
] as const)(
    'editable imports and entry points read selected source while preserving the working checkout through %s and %s',
    async (kind, backend) => {
        await using repository = await testdir();
        const root = join(repository.path, "editable's project");
        const { source, packageDirectory, working } = await prepareEditableSnapshot(root, kind, backend);
        await useRevision(root, source, async (snapshot) => {
            for (const command of [
                [join(snapshot, '.venv/bin/python'), '-I', '-c', 'from editable_fixture import main; main()'],
                [join(snapshot, '.venv/bin/fixture-entry')],
            ]) {
                const result = await run(command, { cwd: snapshot });
                expect(result.code, result.stdout + result.stderr).toBe(0);
                expect(result.stdout.trim()).toBe('selected source');
            }
        });
        expect(readFileSync(join(root, packageDirectory, '__init__.py'), 'utf8')).toBe(working);
        const original = await run([join(root, '.venv/bin/fixture-entry')], { cwd: root });
        expect(original.code, original.stderr).toBe(0);
        expect(original.stdout.trim()).toBe('working source');
    },
    90_000,
);

test.each([
    ['index', 'setuptools'],
    ['commit', 'setuptools'],
] as const)(
    'setuptools namespace imports read selected source through %s and %s',
    async (kind, backend) => {
        await using repository = await testdir();
        const root = join(repository.path, "editable's project");
        const { source } = await prepareEditableSnapshot(root, kind, backend);
        await useRevision(root, source, async (snapshot) => {
            const result = await run(
                [join(snapshot, '.venv/bin/python'), '-I', '-c', 'from namespace_fixture.child import main; main()'],
                { cwd: snapshot },
            );
            expect(result.code, result.stderr).toBe(0);
            expect(result.stdout.trim()).toBe('selected namespace');
        });
    },
    90_000,
);

test.each([
    ['index', 'hatchling-exact'],
    ['commit', 'hatchling-exact'],
    ['index', 'setuptools'],
    ['commit', 'setuptools'],
] as const)(
    'malformed editable mappings refuse snapshots until restored through %s and %s',
    async (kind, backend) => {
        await using repository = await testdir();
        const root = join(repository.path, "editable's project");
        const { source, siteDirectory } = await prepareEditableSnapshot(root, kind, backend);
        const finder = readdirSync(siteDirectory).find(
            (name) => name.endsWith('_finder.py') || (name.startsWith('_editable_impl_') && name.endsWith('.py')),
        )!;
        const mappingPath = join(siteDirectory, finder);
        const originalMapping = readFileSync(mappingPath);
        writeFileSync(
            mappingPath,
            originalMapping.toString('utf8') +
                (backend === 'setuptools' ? '\nMAPPING = dict()\n' : '\nF.map_module("bad", str())\n'),
        );
        expect(await rejection(useRevision(root, source, () => Promise.resolve(undefined)))).toContain(
            'Cannot parse installed editable Python loader metadata',
        );
        writeFileSync(mappingPath, originalMapping);
        await useRevision(root, source, async (snapshot) => {
            const result = await run([join(snapshot, '.venv/bin/fixture-entry')], { cwd: snapshot });
            expect(result.code, result.stderr).toBe(0);
            expect(result.stdout.trim()).toBe('selected source');
        });
    },
    90_000,
);

test.each([
    ['index', 'hatchling'],
    ['commit', 'hatchling'],
    ['index', 'hatchling-exact'],
    ['commit', 'hatchling-exact'],
    ['index', 'setuptools'],
    ['commit', 'setuptools'],
] as const)(
    'Python path metadata refuses external or unselected source and preserves supported declarations through %s and %s',
    async (kind, backend) => {
        await using repository = await testdir();
        const root = join(repository.path, "editable's project");
        const { source, siteDirectory } = await prepareEditableSnapshot(root, kind, backend);
        const metadata = join(siteDirectory, 'fixture-path.pth');
        await using external = await testdir();
        writeFileSync(metadata, `${external.path}\n`);
        expect(await rejection(useRevision(root, source, () => Promise.resolve(undefined)))).toContain(
            'path metadata references an external directory',
        );
        writeFileSync(metadata, `${join(root, 'unselected-source')}\n`);
        expect(await rejection(useRevision(root, source, () => Promise.resolve(undefined)))).toContain(
            'source missing from the selected revision',
        );
        writeFileSync(metadata, `# Preserved comment\n\n${root}\n`);
        await useRevision(root, source, async (snapshot) => {
            const result = await run([join(snapshot, '.venv/bin/python'), '-I', '-c', 'import sys; print(sys.path)'], {
                cwd: snapshot,
            });
            expect(result.code, result.stderr).toBe(0);
            expect(result.stdout).toContain(snapshot);
            expect(readFileSync(metadata, 'utf8')).toBe(`# Preserved comment\n\n${root}\n`);
        });
    },
    90_000,
);
