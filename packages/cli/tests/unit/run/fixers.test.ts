import * as os from 'node:os';
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { planRun } from '#cli/run/plan.ts';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { prepareCommand } from '#cli/run/tool-runner.ts';
import type { Session, PlannedCheck } from '#types/run.ts';
import { applyFixers, runFixer } from '#cli/run/fixers.ts';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const policy = `version = 1
presets = []
[[check]]
id = "fixture/correction"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 3'])}
paths = ["source.txt"]
stage = "commit"
`;

function correction(session: Session, script: string): PlannedCheck {
    const [planned] = planRun(session, { stage: 'all', skips: [], localSkips: [] });
    if (planned === undefined) throw new Error('The fixture has no planned correction.');
    return { ...planned, spec: { ...planned.spec, fix_command: [process.execPath, '-e', script] } };
}

describe('correction outcomes', () => {
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
        await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(fixture.path);
        const result = await runFixer(session, correction(session, script), fixture.path);
        expect(result.status).toBe(status);
        expect(readFileSync(join(fixture.path, 'source.txt'), 'utf8')).toBe(after);
        expect(result.changed).toEqual(after === 'original' ? [] : ['source.txt']);
        if (result.status === 'failed') expect(result.note).toContain('exited 3');
    });

    test('compares bytes that decode to the same replacement character', async () => {
        await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(fixture.path);
        writeFileSync(join(fixture.path, 'source.txt'), Buffer.from([0xff]));
        const planned = correction(session, "await Bun.write('source.txt', new Uint8Array([0xfe]))");
        const result = await runFixer(session, planned, fixture.path);
        expect(result.status).toBe('changed');
        expect(result.changed).toEqual(['source.txt']);
        expect(readFileSync(join(fixture.path, 'source.txt'))).toEqual(Buffer.from([0xfe]));
    });

    test('counts deletion of an empty file as a change', async () => {
        await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': '' });
        const session = await openSession(fixture.path);
        const planned = correction(session, "require('node:fs').unlinkSync('source.txt')");
        const result = await runFixer(session, planned, fixture.path);
        expect(result.status).toBe('changed');
        expect(result.changed).toEqual(['source.txt']);
        expect(existsSync(join(fixture.path, 'source.txt'))).toBe(false);
    });

    test('distinguishes a skipped correction from an unavailable tool', async () => {
        await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(fixture.path);
        const planned = correction(session, "await Bun.write('source.txt', 'wrong')");
        const skipped = await runFixer(
            session,
            { ...planned, skip: { source: 'flag', note: 'Not selected.' } },
            fixture.path,
        );
        const failed = await runFixer(
            session,
            { ...planned, tool: { name: join(fixture.path, 'absent-tool'), installers: {}, windows: true } },
            fixture.path,
        );
        expect(skipped.status).toBe('skipped');
        expect(failed.status).toBe('failed');
        expect(readFileSync(join(fixture.path, 'source.txt'), 'utf8')).toBe('original');
    });

    test('fails the run when a correction exits nonzero even though its check passes', async () => {
        await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(fixture.path);
        const outcome = await executeRun(session, {
            stage: 'all',
            skips: [],
            localSkips: [],
            fix: true,
            isDryRun: false,
            noCache: true,
        });
        expect(outcome.record.checks[0]?.status).toBe('ok');
        expect(outcome.record.exitCode).toBe(1);
        expect(outcome.record.failed).toContain('fixture/correction');
        expect(outcome.fixes?.results[0]?.status).toBe('failed');
    });

    test('removes the scratch directory after a failed correction and preserves source bytes', async () => {
        await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(fixture.path);
        const planned = correction(
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
        expect(readFileSync(join(fixture.path, 'source.txt'), 'utf8')).toBe('original');
        expect(report.changed).toEqual(['source.txt']);
        expect(report.diffs.join('\n')).toContain('+partial');
    });

    test('splits 20,000 correction paths without losing or reordering arguments', async () => {
        await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(fixture.path);
        const planned = correction(session, 'process.exitCode = 0');
        const source = planned.files[0];
        if (source === undefined) throw new Error('The fixture has no selected source.');
        const paths = Array.from({ length: 20_000 }, (_, index) => `long folder/café/${String(index)}/source.txt`);
        const files = paths.map((path) => ({ ...source, path }));
        const prepared = prepareCommand(session, { ...planned, files }, ['tool', '{files}'], process.execPath);
        expect(prepared.commands.length).toBeGreaterThan(1);
        expect(prepared.commands.flatMap((command) => command.slice(1))).toEqual(paths);
        for (const command of prepared.commands) expect(Buffer.byteLength(command.join(' '))).toBeLessThan(100_000);
    });
});

test.each(['copy', 'read'])('cleans the scratch directory after a failed %s', async (operation) => {
    await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(fixture.path);
    const planned = correction(
        session,
        "const fs = require('node:fs'); fs.unlinkSync('source.txt'); fs.mkdirSync('source.txt');",
    );
    if (operation === 'copy') {
        rmSync(join(fixture.path, 'source.txt'));
        mkdirSync(join(fixture.path, 'source.txt'));
    }
    const temporary = join(fixture.path, 'scratch');
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
        expect(readdirSync(temporary)).toEqual([]);
    } finally {
        temporaryDirectory.mockRestore();
    }
    if (operation === 'read') expect(readFileSync(join(fixture.path, 'source.txt'), 'utf8')).toBe('original');
});
