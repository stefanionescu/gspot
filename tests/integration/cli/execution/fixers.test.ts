import { planRun } from '#cli/execution/plan.ts';
import { waitForExit } from '#tests/support/cli/process.ts';
import * as os from 'node:os';
import { join } from 'node:path';

import { executeRun } from '#cli/execution/execute.ts';

import type { PlannedCheck } from '#cli/execution/plan.ts';
import type { Session } from '#cli/execution/session.ts';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';

import { scratchCopy } from '#cli/execution/file-workspace.ts';
import { applyFixers, runFixer } from '#cli/execution/fixers.ts';
import { prepareCommand, runToolCheck } from '#cli/execution/tool-runner.ts';
import { expect, spyOn, test } from 'bun:test';

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

const policy = `version = 1
configurations = []
[[check]]
name = "sandbox/correction"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix_order = "codemod"
fix_command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 3'])}
paths = ["source.txt"]
stage = "commit"
`;

async function correction(session: Session, script: string): Promise<PlannedCheck> {
    const [planned] = await planRun(session, { stage: 'all', skips: [] });
    if (planned === undefined) throw new Error('The sandbox has no planned correction.');
    return { ...planned, spec: { ...planned.spec, fix_command: [process.execPath, '-e', script] } };
}

test.each([false, true].flatMap((preview) => [false, true].map((isolated) => ({ preview, isolated }))))(
    'corrections reject a replaced external source before execution (preview $preview, isolated $isolated)',
    async ({ preview, isolated }) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        await createFileTree(external.path, { 'source.txt': 'external original' });
        const session = await openSession(sandbox.path);
        const planned = await correction(session, "await Bun.write('source.txt', 'changed')");
        planned.spec.isolated_files = isolated;
        rmSync(join(sandbox.path, 'source.txt'));
        symlinkSync(join(external.path, 'source.txt'), join(sandbox.path, 'source.txt'));
        await expect(applyFixers(session, [planned], preview)).rejects.toThrow('Source link leaves the repository');
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
            'gspot.toml': policy,
            'source.txt': 'original',
            'unowned.json': '{}',
        });
        const session = await openSession(sandbox.path);
        const trace = join(sandbox.path, 'workspace-path');
        const planned = await correction(
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
        if (preview) expect(result.diffs[0]).toContain('+corrected');
    },
);

test('isolated correction refuses to overwrite source changed during execution and cleans up', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const trace = join(sandbox.path, 'workspace-path');
    const planned = await correction(
        session,
        `
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write(${JSON.stringify(join(sandbox.path, 'source.txt'))}, 'new working content');
            await Bun.write('source.txt', 'isolated correction');
        `,
    );
    planned.spec.isolated_files = true;
    await expect(runFixer(session, planned, sandbox.path)).rejects.toThrow('changed while its correction was running');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('new working content');
    expect(existsSync(readFileSync(trace, 'utf8'))).toBe(false);
    const corrected = await correction(session, "await Bun.write('source.txt', 'corrected')");
    corrected.spec.isolated_files = true;
    expect(await runFixer(session, corrected, sandbox.path)).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test.each([0, 3])('a declared fatal diagnostic overrides correction exit %s', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(
        session,
        `console.error('Fatal: cannot write'); process.exitCode = ${String(code)}`,
    );
    planned.spec.fix_findings_exit_codes = [3];
    planned.spec.tool_errors = '^Fatal:';
    const failed = await runFixer(session, planned, sandbox.path);
    expect(failed).toMatchObject({
        status: 'failed',
        changed: [],
        note: expect.stringContaining('Fatal: cannot write'),
    });
    const corrected = await correction(session, "await Bun.write('source.txt', 'corrected')");
    corrected.spec.tool_errors = planned.spec.tool_errors;
    expect(await runFixer(session, corrected, sandbox.path)).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test.each([
    { code: 3, content: 'original', status: 'unchanged' },
    { code: 3, content: 'corrected', status: 'changed' },
    { code: 4, content: 'partial', status: 'failed' },
])('declared finding exit $code retains the $status correction outcome', async ({ code, content, status }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(
        session,
        `await Bun.write('source.txt', ${JSON.stringify(content)}); process.exitCode = ${String(code)}`,
    );
    planned.spec.fix_findings_exit_codes = [3];
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe(status);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(content);
    expect(result.changed).toStrictEqual(content === 'original' ? [] : ['source.txt']);
});
test.each([
    { script: 'process.exitCode = 0', status: 'unchanged', after: 'original' },
    { script: "await Bun.write('source.txt', 'corrected')", status: 'changed', after: 'corrected' },
    { script: 'process.exitCode = 3', status: 'failed', after: 'original' },
    {
        script: "await Bun.write('source.txt', 'partial'); process.exitCode = 3",
        status: 'failed',
        after: 'partial',
    },
])('classifies $status from execution and resulting bytes', async ({ script, status, after }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const result = await runFixer(session, await correction(session, script), sandbox.path);
    expect(result.status).toBe(status);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(after);
    expect(result.changed).toStrictEqual(after === 'original' ? [] : ['source.txt']);
    if (result.status === 'failed') expect(result.note).toContain('exited 3');
});

test('compares bytes that decode to the same replacement character', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    writeFileSync(join(sandbox.path, 'source.txt'), Buffer.from([0xff]));
    const planned = await correction(session, "await Bun.write('source.txt', new Uint8Array([0xfe]))");
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe('changed');
    expect(result.changed).toStrictEqual(['source.txt']);
    expect(readFileSync(join(sandbox.path, 'source.txt'))).toStrictEqual(Buffer.from([0xfe]));
});

test('counts deletion of an empty file as a change', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': '' });
    const session = await openSession(sandbox.path);
    const planned = await correction(session, "require('node:fs').unlinkSync('source.txt')");
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe('changed');
    expect(result.changed).toStrictEqual(['source.txt']);
    expect(existsSync(join(sandbox.path, 'source.txt'))).toBe(false);
});

test('distinguishes a skipped correction from an unavailable tool', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(session, "await Bun.write('source.txt', 'wrong')");
    const skipped = await runFixer(
        session,
        { ...planned, skip: { source: 'flag', note: 'Not selected.' } },
        sandbox.path,
    );
    const failed = await runFixer(
        session,
        { ...planned, spec: { ...planned.spec, fix_command: [join(sandbox.path, 'absent-tool')] } },
        sandbox.path,
    );
    expect(skipped.status).toBe('skipped');
    expect(failed.status).toBe('failed');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('runs the correction executable when it differs from the check executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(session, "await Bun.write('source.txt', 'corrected')");
    const result = await runFixer(
        session,
        { ...planned, tool: { name: join(sandbox.path, 'absent-check-tool'), installers: {}, windows: true } },
        sandbox.path,
    );
    expect(result.status).toBe('changed');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('fails the run when a correction exits nonzero even though its check passes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, {
        stage: 'all',
        skips: [],
        fix: true,
        isDryRun: false,
        noCache: true,
    });
    expect(outcome.report.checks[0]?.status).toBe('ok');
    expect(outcome.report.exitCode).toBe(2);
    expect(outcome.report.failed).toContain('sandbox/correction');
    expect(outcome.fixes?.results[0]?.status).toBe('failed');
});

test('removes the scratch directory after a failed correction and preserves source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(
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

test('splits 20,000 correction paths without losing or reordering arguments', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(session, 'process.exitCode = 0');
    const source = planned.files[0];
    if (source === undefined) throw new Error('The sandbox has no selected source.');
    const paths = Array.from({ length: 20_000 }, (_, index) => `long folder/café/${String(index)}/source.txt`);
    const files = paths.map((path) => ({ ...source, path }));
    const prepared = prepareCommand(session, { ...planned, files }, ['tool', '{files}'], process.execPath);
    expect(prepared.commands.length).toBeGreaterThan(1);
    expect(prepared.commands.flatMap((command) => command.argv.slice(1))).toStrictEqual(paths);
    for (const command of prepared.commands) expect(Buffer.byteLength(command.argv.join(' '))).toBeLessThan(100_000);
});

test.each(['copy', 'read'])('cleans the scratch directory after a failed %s', async (operation) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(
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
    if (operation === 'read') expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('Correction environment paths expand against the execution root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'source.txt': 'original',
        'café settings.txt': 'corrected',
    });
    const session = await openSession(sandbox.path);
    const planned = await correction(
        session,
        "await Bun.write('source.txt', await Bun.file(process.env['SANDBOX_SETTINGS']).text())",
    );
    planned.spec.env = { SANDBOX_SETTINGS: '{root}/café settings.txt' };
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe('changed');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('a failed version probe blocks a check and its correction without changing source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(session, "await Bun.write('source.txt', 'changed')");
    planned.tool = {
        name: 'version-teller',
        version: '3.8.1',
        windows: true,
        installers: {},
        version_command: ['-e', 'console.log("3.8.1"); process.exitCode = 7;'],
    };
    planned.spec.fix_command![0] = 'version-teller';
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const checked = await runToolCheck(session, planned);
        expect(checked.status).toBe('error');
        expect(checked.note).toContain('exited 7');
        const fixed = await runFixer(session, planned, sandbox.path);
        expect(fixed.status).toBe('failed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    } finally {
        which.mockRestore();
    }
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

test.each(['canceled', 'timeout'].flatMap((failure) => [false, true].map((isolated) => ({ failure, isolated }))))(
    'a $failure correction retains partial changes and reports the process failure (isolated $isolated)',
    async ({ failure, isolated }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `${policy}\n[limits]\ntool_seconds = 1\n`,
            'source.txt': 'original',
        });
        const session = await openSession(sandbox.path);
        const controller = new AbortController();
        const ready = join(sandbox.path, 'ready.pid');
        const planned = await correction(
            session,
            `await Bun.write('source.txt', 'partial'); await Bun.write(${JSON.stringify(ready)}, String(process.pid)); await Bun.sleep(10000);`,
        );
        planned.spec.isolated_files = isolated;
        const execution = runFixer({ ...session, cancelSignal: controller.signal }, planned, sandbox.path);
        try {
            const readyDeadline = performance.now() + 2000;
            while (!existsSync(ready) && performance.now() < readyDeadline) await Bun.sleep(10);
            expect(existsSync(ready)).toBe(true);
            const pid = Number(readFileSync(ready, 'utf8'));
            expect(pid).toBeGreaterThan(0);
            if (failure === 'canceled') controller.abort();
            const result = await execution;
            await waitForExit(pid);
            expect(result.status).toBe('failed');
            if (result.status !== 'failed') throw new Error('The correction did not report its process failure.');
            expect(result.note).toContain(failure === 'canceled' ? 'was canceled' : 'ran past 1 seconds');
            expect(result.changed).toStrictEqual(['source.txt']);
            expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('partial');
        } finally {
            controller.abort();
            await execution;
        }
        const corrected = await runFixer(
            session,
            await correction(session, "await Bun.write('source.txt', 'corrected')"),
            sandbox.path,
        );
        expect(corrected.status).toBe('changed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    },
);

test('checks refresh the file inventory after a fixer creates a source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'input',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/inventory"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = process.argv.includes("added.txt") ? 0 : 1', '{files}'])}
fix_command = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("added.txt", "created")'])}
fix_order = "codemod"
`,
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], fix: true, isDryRun: false, noCache: true };
    const outcome = await executeRun(session, options);
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks[0]!.files).toBe(2);
    expect(session.repository.files.map((file) => file.path)).toContain('added.txt');
});
