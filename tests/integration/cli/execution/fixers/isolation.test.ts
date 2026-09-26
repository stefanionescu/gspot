import * as os from 'node:os';
import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { scratchCopy } from '#cli/execution/file-workspace.ts';
import { applyFixers, runFixer } from '#cli/execution/fixers.ts';
import { rejection, textContaining } from '#tests/support/expectations.ts';
import { CORRECTION_POLICY, plannedCorrection } from '#tests/support/cli/correction.ts';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

test.each([false, true].flatMap((preview) => [false, true].map((isolated) => ({ preview, isolated }))))(
    'corrections reject a replaced external source before execution (preview $preview, isolated $isolated)',
    async ({ preview, isolated }) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
        await createFileTree(external.path, { 'source.txt': 'external original' });
        const session = await openSession(sandbox.path);
        const planned = await plannedCorrection(session, "await Bun.write('source.txt', 'changed')");
        planned.spec.isolated_files = isolated;
        rmSync(join(sandbox.path, 'source.txt'));
        symlinkSync(join(external.path, 'source.txt'), join(sandbox.path, 'source.txt'));
        expect(await rejection(applyFixers(session, [planned], preview))).toContain(
            'Source link leaves the repository',
        );
        expect(readFileSync(join(external.path, 'source.txt'), 'utf8')).toBe('external original');
        rmSync(join(sandbox.path, 'source.txt'));
        writeFileSync(join(sandbox.path, 'source.txt'), 'original');
        const corrected = await applyFixers(session, [planned], preview);
        expect(corrected.changed).toStrictEqual(['source.txt']);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'changed');
    },
);
test.each([false, true])(
    'isolated corrections publish selected bytes and remove their workspace (preview %s)',
    async (preview) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': CORRECTION_POLICY,
            'source.txt': 'original',
            'unowned.json': '{}',
        });
        const session = await openSession(sandbox.path);
        const trace = join(sandbox.path, 'workspace-path');
        const planned = await plannedCorrection(
            session,
            `
            if (require('node:fs').existsSync('unowned.json')) throw new Error('Unowned configuration was copied.');
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write('source.txt', 'corrected');
            process.exitCode = 3;
        `,
        );
        planned.spec.isolated_files = true;
        planned.spec.fix_findings_exit_codes = [3];
        const result = await applyFixers(session, [planned], preview);
        expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'corrected');
        expect(readFileSync(join(sandbox.path, 'unowned.json'), 'utf8')).toBe('{}');
        expect(existsSync(readFileSync(trace, 'utf8'))).toBe(false);
        // A preview shows the correction as a diff instead of writing it.
        const withCorrected = textContaining('+corrected');
        expect(result.diffs).toStrictEqual(preview ? [withCorrected] : []);
    },
);

test('isolated correction refuses to overwrite source changed during execution and cleans up', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const trace = join(sandbox.path, 'workspace-path');
    const planned = await plannedCorrection(
        session,
        `
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write(${JSON.stringify(join(sandbox.path, 'source.txt'))}, 'new working content');
            await Bun.write('source.txt', 'isolated correction');
        `,
    );
    planned.spec.isolated_files = true;
    expect(await rejection(runFixer(session, planned, sandbox.path))).toContain(
        'changed while its correction was running',
    );
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('new working content');
    expect(existsSync(readFileSync(trace, 'utf8'))).toBe(false);
    const corrected = await plannedCorrection(session, "await Bun.write('source.txt', 'corrected')");
    corrected.spec.isolated_files = true;
    expect(await runFixer(session, corrected, sandbox.path)).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test('removes the scratch directory after a failed correction and preserves source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await plannedCorrection(
        session,
        "await Bun.write('source.txt', 'partial'); process.stdout.write(process.cwd()); process.exitCode = 3",
    );
    const report = await applyFixers(session, [planned], true);
    const result = report.results[0];
    expect(result?.status).toBe('failed');
    if (result?.status !== 'failed') throw new Error('The correction did not report its failure.');
    const scratch = result.note.slice(result.note.indexOf(': ') + 2);
    expect(scratch).toContain('gspot-fix-');
    expect(existsSync(scratch)).toBe(false);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(report.changed).toStrictEqual(['source.txt']);
    expect(report.diffs.join('\n')).toContain('+partial');
});

test.each(['copy', 'read'])('cleans the scratch directory after a failed %s', async (operation) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await plannedCorrection(
        session,
        "const fs = require('node:fs'); fs.unlinkSync('source.txt'); fs.mkdirSync('source.txt');",
    );
    if (operation === 'copy') {
        rmSync(join(sandbox.path, 'source.txt'));
        mkdirSync(join(sandbox.path, 'source.txt'));
    }
    const temporary = join(sandbox.path, 'scratch');
    mkdirSync(temporary);
    const temporaryDirectory = spyOn(os, 'tmpdir').mockReturnValue(temporary);
    try {
        let failure: unknown;
        try {
            await applyFixers(session, [planned], true);
        } catch (error) {
            failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        expect(readdirSync(temporary)).toStrictEqual([]);
    } finally {
        temporaryDirectory.mockRestore();
    }
    // A failed read leaves the source untouched; a failed copy had already replaced it with a directory.
    expect(operation !== 'read' || readFileSync(join(sandbox.path, 'source.txt'), 'utf8') === 'original').toBe(true);
});

test('preview copies workspace dependencies and preserves executable links without writing through either', async () => {
    await using repository = await testdir();
    await using external = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/core/package.json': '{"name":"core"}',
        'packages/core/value.js': 'export default "original";',
        'node_modules/tool/package.json': '{"name":"tool"}',
        'node_modules/tool/bin/tool.js': 'console.log(require("../lib/value.cjs"));',
        'node_modules/tool/lib/value.cjs': 'module.exports = "tool works";',
    });
    await createFileTree(external.path, { 'value.js': 'external original' });
    mkdirSync(join(repository.path, 'node_modules/.bin'));
    symlinkSync('../tool/bin/tool.js', join(repository.path, 'node_modules/.bin/tool'));
    symlinkSync('../packages/core', join(repository.path, 'node_modules/core'));
    symlinkSync(external.path, join(repository.path, 'node_modules/external'));
    const session = await openSession(repository.path);
    const scratch = scratchCopy(
        session.root,
        ['packages/core/value.js'],
        session.repository.scopes.map((scope) => scope.path),
    );
    try {
        const result = Bun.spawnSync(['node', 'node_modules/.bin/tool'], {
            cwd: scratch,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(result.stdout.toString().trim()).toBe('tool works');
        writeFileSync(join(scratch, 'node_modules/core/value.js'), 'preview edit');
        writeFileSync(join(scratch, 'node_modules/external/value.js'), 'external preview edit');
        expect(readFileSync(join(repository.path, 'packages/core/value.js'), 'utf8')).toBe(
            'export default "original";',
        );
        expect(readFileSync(join(external.path, 'value.js'), 'utf8')).toBe('external original');
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});
