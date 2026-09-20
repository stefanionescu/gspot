import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createFixture } from 'fs-fixture';
import { rejects } from 'node:assert/strict';
import * as processes from '#cli/platform/spawn.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { findRoot, trackedEntries } from '#cli/repository/tracked.ts';

describe('repository file discovery', () => {
    test('finds the nearest policy in a non-Git directory', async () => {
        await using fixture = await createFixture({
            'gspot.toml': 'version = 1\n',
            'nested/source.ts': 'export {};\n',
        });
        expect(findRoot(join(fixture.path, 'nested'))).toBe(fixture.path);
    });

    test('keeps the requested directory when no Git root or policy exists', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        expect(findRoot(fixture.path)).toBe(fixture.path);
    });

    test('walks a non-Git directory while honoring its ignore file', async () => {
        await using fixture = await createFixture({
            '.gitignore': 'ignored.ts\n',
            'source.ts': 'export {};\n',
            'ignored.ts': 'export {};\n',
        });
        const entries = await trackedEntries(fixture.path);
        expect(entries.map((entry) => entry.path)).toEqual(['.gitignore', 'source.ts']);
    });

    test('reports a corrupt Git index instead of switching to a directory walk', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        const cwd = fixture.path;
        expect(processes.runBlocking(['git', 'init'], { cwd }).code).toBe(0);
        expect(processes.runBlocking(['git', 'add', 'source.ts'], { cwd }).code).toBe(0);
        expect(resolve(findRoot(cwd))).toBe(resolve(cwd));
        const entries = await trackedEntries(cwd);
        expect(entries.map((entry) => entry.path)).toEqual(['source.ts']);
        writeFileSync(join(cwd, '.git', 'index'), 'corrupt index');
        await rejects(trackedEntries(cwd), { message: /Git ls-files failed/u });
    });

    test('reports invalid Git metadata instead of treating the directory as non-Git', async () => {
        await using fixture = await createFixture({
            '.git/sentinel': 'incomplete metadata',
            'source.ts': 'export {};\n',
        });
        await rejects(trackedEntries(fixture.path), { message: /Git ls-files failed/u });
        expect(() => findRoot(fixture.path)).toThrow('Git root discovery failed');
    });

    test('reports a missing Git executable instead of returning a successful walk', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        const missing = spyOn(processes, 'runBlocking').mockReturnValue({
            code: 127,
            stdout: '',
            stderr: 'git executable not found',
            missing: true,
            duration: 0,
        });
        try {
            await rejects(trackedEntries(fixture.path), { message: /git executable not found/u });
            expect(() => findRoot(fixture.path)).toThrow('git executable not found');
        } finally {
            missing.mockRestore();
        }
    });
});
