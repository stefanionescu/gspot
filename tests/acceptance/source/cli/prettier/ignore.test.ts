import prettier from 'prettier';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { containing } from '#tests/support/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/cli.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { prepareIgnoredFormatter } from '#tests/support/cli/prettier.ts';

import {
    PRETTIER_FIX_ARGS,
    PRETTIER_IGNORE_FILES,
    PRETTIER_IGNORE_RULES,
    PRETTIER_IGNORE_SOURCE,
} from '#tests/constants/acceptance/source/cli/cli.ts';

test(
    'init carries current native Prettier ignores and preserves negated and future patterns',
    async () => {
        await using repository = await testdir();
        const { initialized, level } = await prepareIgnoredFormatter(repository.path);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(
            (JSON.parse(initialized.stdout) as InitJson).plan!.remove.some((entry) => entry.path === '.prettierignore'),
        ).toBe(true);
        expect(level.code, level.stdout + level.stderr).toBe(0);
        const corrected = await run(repository.path, [...PRETTIER_FIX_ARGS, ...PRETTIER_IGNORE_FILES]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = reportSchema.parse(JSON.parse(corrected.stdout));
        expect(report.checks[0]).toMatchObject({ check: 'formatting/prettier', status: 'ok', files: 2, findings: [] });
        for (const file of ['source.js', 'generated/authored.js'])
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe('export const greeting = "hello"\n');
        for (const file of ['generated/skipped.js', 'space name.js'])
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe(PRETTIER_IGNORE_SOURCE);
        const ignored = await run(repository.path, [...PRETTIER_FIX_ARGS, 'generated/skipped.js']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(ignored.stdout)).skips).toStrictEqual([
            { check: 'formatting/prettier', source: 'ignore' },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'adopted Prettier ignores match future files and preserve authored negations',
    async () => {
        await using repository = await testdir();
        const { initialized, level } = await prepareIgnoredFormatter(repository.path);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(
            (JSON.parse(initialized.stdout) as InitJson).plan!.remove.some((entry) => entry.path === '.prettierignore'),
        ).toBe(true);
        expect(level.code, level.stdout + level.stderr).toBe(0);
        const future = join(repository.path, 'generated/future.js');
        writeFileSync(future, PRETTIER_IGNORE_SOURCE);
        const fileStatus = await prettier.getFileInfo(future, {
            ignorePath: join(repository.path, '.prettierignore'),
            resolveConfig: false,
        });
        expect(fileStatus.ignored).toBe(true);
        const skippedFuture = await run(repository.path, [...PRETTIER_FIX_ARGS, 'generated/future.js']);
        expect(skippedFuture.code, skippedFuture.stdout + skippedFuture.stderr).toBe(0);
        const futureReport = reportSchema.parse(JSON.parse(skippedFuture.stdout));
        expect(futureReport.skips).toStrictEqual([{ check: 'formatting/prettier', source: 'ignore' }]);
        expect(futureReport.coverage.checked).toBe(0);
        expect(readFileSync(future, 'utf8')).toBe(PRETTIER_IGNORE_SOURCE);
        const generated = readFileSync(join(repository.path, '.prettierignore'), 'utf8');
        expect(generated).toContain(PRETTIER_IGNORE_RULES);
        const changed = generated + '!generated/future.js\n';
        chmodSync(join(repository.path, '.prettierignore'), 0o640);
        writeFileSync(join(repository.path, '.prettierignore'), changed);
        const included = await run(repository.path, [...PRETTIER_FIX_ARGS, 'generated/future.js']);
        expect(included.code, included.stdout + included.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(included.stdout)).checks[0]).toMatchObject({
            status: 'ok',
            files: 1,
            findings: [],
        });
        expect({
            source: readFileSync(future, 'utf8'),
            ignore: readFileSync(join(repository.path, '.prettierignore'), 'utf8'),
        }).toStrictEqual({ source: 'export const greeting = "hello"\n', ignore: changed });
        const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect((JSON.parse(repeated.stdout) as ApplyPreviewJson).drift).toContainEqual(
            containing({ path: '.prettierignore' }),
        );
    },
    PLANTED_TIMEOUT_MS,
);
