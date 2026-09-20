import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { readFileSync, symlinkSync } from 'node:fs';
import { treeContents } from '#tests/harness/contents.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ENTRIES = ['packages/cli/schemas.ts', 'docs/reference-pages.ts'];
const LINKS = [
    'node_modules',
    'docs/node_modules',
    'packages/cli/node_modules',
    'packages/cli/src',
    'packages/cli/config',
];
const SOURCES = [...ENTRIES, 'packages/cli/package.json', 'docs/package.json'];

const OUTPUTS = ['schema', 'docs/public/schema', 'docs/src/content/docs/reference'];

const INVALID = [['--checks'], ['unexpected'], ['--check', 'unexpected'], ['--check=true']];

describe('read-only script arguments', () => {
    test.each(ENTRIES)('%s rejects malformed invocations before changing files', async (entry) => {
        const sources = Object.fromEntries(SOURCES.map((path) => [path, readFileSync(join(ROOT, path), 'utf8')]));
        await using fixture = await createFixture({
            ...sources,
            'schema/gspot.schema.json': '{"sentinel": true}\n',
            'schema/run-record.schema.json': '{"sentinel": true}\n',
            'docs/public/schema/gspot.schema.json': '{"sentinel": true}\n',
            'docs/public/schema/run-record.schema.json': '{"sentinel": true}\n',
            'docs/src/content/docs/reference/sentinel.md': '# Authored reference\n',
        });
        for (const path of LINKS) symlinkSync(join(ROOT, path), join(fixture.path, path), 'dir');
        const before = OUTPUTS.map((path) => treeContents(join(fixture.path, path)));
        for (const args of INVALID) {
            const result = Bun.spawnSync([process.execPath, join(fixture.path, entry), ...args], {
                cwd: fixture.path,
                env: { ...environmentVariables(), NO_COLOR: '1' },
                stdout: 'pipe',
                stderr: 'pipe',
                timeout: 10_000,
            });
            expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(2);
            expect(result.stderr.toString()).toMatch(/unknown option|too many arguments/u);
            expect(OUTPUTS.map((path) => treeContents(join(fixture.path, path)))).toEqual(before);
        }
        for (const flag of ['--help', '--version']) {
            const result = Bun.spawnSync([process.execPath, join(fixture.path, entry), flag], {
                cwd: fixture.path,
                stdout: 'pipe',
                stderr: 'pipe',
                timeout: 10_000,
            });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            expect(result.stdout.toString().trim().length).toBeGreaterThan(0);
            expect(OUTPUTS.map((path) => treeContents(join(fixture.path, path)))).toEqual(before);
        }
    });
});
