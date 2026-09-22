import { join } from 'node:path';
import { chmodSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import prettier from 'prettier';
import { createFileTree, testdir } from 'testdirs';
import { run, PLANTED_TIMEOUT_MS } from '#tests/harness/planted.ts';
import { reportSchema } from '#cli/run/report-schema.ts';

const SOURCE = 'export const greeting="hello";\n';
const FILES = ['source.js', 'generated/authored.js', 'generated/skipped.js', 'space name.js'];

test(
    'init carries current native Prettier ignores and preserves negated and future patterns',
    async () => {
        await using repository = await testdir();
        const original =
            '# Generated files except the authored entry\ngenerated/*\n!generated/authored.js\nspace\\ name.js\n';
        await createFileTree(repository.path, {
            '.prettierignore': original,
            '.prettierrc.json': '{"semi":false}\n',
            ...Object.fromEntries(FILES.map((file) => [file, SOURCE])),
        });
        chmodSync(join(repository.path, '.prettierignore'), 0o640);
        symlinkSync(join(import.meta.dir, '../../../node_modules'), join(repository.path, 'node_modules'));
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--presets',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(
            JSON.parse(result.stdout).plan.remove.some((entry: { path: string }) => entry.path === '.prettierignore'),
        ).toBe(true);
        const level = await run(repository.path, ['set', 'level', 'all']);
        expect(level.code, level.stdout + level.stderr).toBe(0);
        const args = ['check', '--only', 'formatting/prettier', '--fix', '--no-cache', '--json', '--'];
        const corrected = await run(repository.path, [...args, ...FILES]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = reportSchema.parse(JSON.parse(corrected.stdout));
        expect(report.checks[0]).toMatchObject({ check: 'formatting/prettier', status: 'ok', files: 2, findings: [] });
        for (const file of ['source.js', 'generated/authored.js'])
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe('export const greeting = "hello"\n');
        for (const file of ['generated/skipped.js', 'space name.js'])
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe(SOURCE);
        const ignored = await run(repository.path, [...args, 'generated/skipped.js']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(ignored.stdout)).skips).toEqual([
            { check: 'formatting/prettier', source: 'ignore' },
        ]);
        const future = join(repository.path, 'generated/future.js');
        writeFileSync(future, SOURCE);
        expect(
            (
                await prettier.getFileInfo(future, {
                    ignorePath: join(repository.path, '.prettierignore'),
                    resolveConfig: false,
                })
            ).ignored,
        ).toBe(true);
        const skippedFuture = await run(repository.path, [...args, 'generated/future.js']);
        expect(skippedFuture.code, skippedFuture.stdout + skippedFuture.stderr).toBe(0);
        const futureReport = reportSchema.parse(JSON.parse(skippedFuture.stdout));
        expect(futureReport.skips).toEqual([{ check: 'formatting/prettier', source: 'ignore' }]);
        expect(futureReport.coverage.checked).toBe(0);
        expect(readFileSync(future, 'utf8')).toBe(SOURCE);
        const generated = readFileSync(join(repository.path, '.prettierignore'), 'utf8');
        expect(generated).toContain(original);
        const changed = generated + '!generated/future.js\n';
        chmodSync(join(repository.path, '.prettierignore'), 0o640);
        writeFileSync(join(repository.path, '.prettierignore'), changed);
        const included = await run(repository.path, [...args, 'generated/future.js']);
        expect(included.code, included.stdout + included.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(included.stdout)).checks[0]).toMatchObject({
            status: 'ok',
            files: 1,
            findings: [],
        });
        expect(readFileSync(future, 'utf8')).toBe('export const greeting = "hello"\n');
        expect(readFileSync(join(repository.path, '.prettierignore'), 'utf8')).toBe(changed);
        const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect(JSON.parse(repeated.stdout).drift).toContainEqual(expect.objectContaining({ path: '.prettierignore' }));
    },
    PLANTED_TIMEOUT_MS,
);
