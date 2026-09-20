import { rejects } from 'node:assert/strict';
import { createSandbox } from '@gspot/testing';
import { expect, spyOn, test } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import { openSession } from '#cli/run/session.ts';
import { swiftAnalyze, swiftBuild } from '#cli/apple/build.ts';

async function inputFor(root: string, check: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selection = session.scopes[0]!;
    const spec = selection.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === check)!;
    return { session, root, scope: '', view: selection.view, spec, files: session.repository.files };
}

test.each([0, 7])('a silent Swift build with exit %i retains its verdict', async (code) => {
    await using sandbox = await createSandbox({ 'gspot.toml': 'version = 1\npresets = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({ code, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        const findings = await swiftBuild(input);
        if (code === 0) expect(findings).toEqual([]);
        else expect(findings).toMatchObject([{ rule: 'build', message: expect.stringContaining(String(code)) }]);
    } finally {
        run.mockRestore();
    }
});

test('Swift compiler diagnostics retain their source location on a failed build', async () => {
    await using sandbox = await createSandbox({ 'gspot.toml': 'version = 1\npresets = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: '/project/Main.swift:4:2: error: Missing value',
        missing: false,
        duration: 1,
    });
    try {
        expect(await swiftBuild(input)).toMatchObject([
            { file: '/project/Main.swift', line: 4, column: 2, message: 'Missing value' },
        ]);
    } finally {
        run.mockRestore();
    }
});

test('analysis refuses an incomplete compiler log after a failed build', async () => {
    await using sandbox = await createSandbox({ 'gspot.toml': 'version = 1\npresets = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 7, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        await rejects(swiftAnalyze(input), /build exited 7/u);
    } finally {
        run.mockRestore();
    }
});

test.each([0, 7])('a silent SwiftLint analyzer with exit %i retains its verdict', async (code) => {
    await using sandbox = await createSandbox({ 'gspot.toml': 'version = 1\npresets = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        if (code === 0) expect(await swiftAnalyze(input)).toEqual([]);
        else await rejects(swiftAnalyze(input), new RegExp(`analyzer exited ${String(code)}`, 'u'));
    } finally {
        run.mockRestore();
    }
});

test.each(['build', 'analyzer'])('a timed-out Swift %s reports an error', async (step) => {
    await using sandbox = await createSandbox({ 'gspot.toml': 'version = 1\npresets = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run');
    if (step === 'analyzer')
        run.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    run.mockResolvedValue({ code: 1, stdout: '', stderr: '', missing: false, duration: 1, isTimedOut: true });
    try {
        await rejects(swiftAnalyze(input), /timed out/u);
    } finally {
        run.mockRestore();
    }
});
