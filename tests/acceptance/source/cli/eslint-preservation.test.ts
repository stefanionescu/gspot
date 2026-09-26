import { ESLint } from 'eslint';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { chmodSync, readFileSync, statSync, writeFileSync } from 'node:fs';

import {
    ESLINT_PRESERVATION_CONFIG,
    ESLINT_PRESERVATION_POLICY,
    ESLINT_PRESERVATION_SOURCE,
} from '#tests/constants/acceptance/source/cli/cli.ts';

test.each(['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'])(
    'apply preserves authored %s and native ESLint path behavior',
    async (path) => {
        await using repository = await testdir();
        const text = `module.exports = ${JSON.stringify(ESLINT_PRESERVATION_CONFIG)};\n`;
        const original = path.endsWith('.mjs') ? text.replace('module.exports =', 'export default') : text;
        await createFileTree(repository.path, {
            'gspot.toml': ESLINT_PRESERVATION_POLICY.replace('[rules]', `exclude = [${JSON.stringify(path)}]\n[rules]`),
            [path]: original,
            'source.js': ESLINT_PRESERVATION_SOURCE,
            'tests/source.js': ESLINT_PRESERVATION_SOURCE,
        });
        chmodSync(join(repository.path, path), 0o640);
        const preview = await run(repository.path, ['apply', '--dry-run', '--json']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect((JSON.parse(preview.stdout) as ApplyPreviewJson).notes.join('\n')).toContain(
            `retained ${path}: authored ESLint configuration remains active`,
        );
        const applied = await run(repository.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        for (const file of ['source.js', 'tests/source.js', 'future.js']) {
            writeFileSync(join(repository.path, file), ESLINT_PRESERVATION_SOURCE);
            const eslint = new ESLint({ cwd: repository.path });
            const [defective] = await eslint.lintFiles([file]);
            expect(
                defective!.messages.map(({ ruleId, severity, line, column }) => ({ ruleId, severity, line, column })),
            ).toStrictEqual([
                file.startsWith('tests/')
                    ? { ruleId: 'no-alert', severity: 1, line: 1, column: 1 }
                    : { ruleId: 'eqeqeq', severity: 2, line: 1, column: 12 },
            ]);
            writeFileSync(join(repository.path, file), 'void (left === right);\n');
            const [corrected] = await eslint.lintFiles([file]);
            expect(corrected!.messages).toStrictEqual([]);
        }
        expect(readFileSync(join(repository.path, path), 'utf8')).toBe(original);
        expect(statSync(join(repository.path, path)).mode & 0o777).toBe(0o640);
        const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect((JSON.parse(repeated.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'apply retires its owned ESLint pointer when a later authored config is introduced',
    async () => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': ESLINT_PRESERVATION_POLICY,
            'source.js': ESLINT_PRESERVATION_SOURCE,
        });
        const initial = await run(repository.path, ['apply']);
        expect(initial.code, initial.stdout + initial.stderr).toBe(0);
        const original = `module.exports = ${JSON.stringify(ESLINT_PRESERVATION_CONFIG)};\n`;
        writeFileSync(join(repository.path, 'eslint.config.cjs'), original);
        const applied = await run(repository.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const [result] = await new ESLint({ cwd: repository.path }).lintFiles(['source.js']);
        expect(result!.messages.map(({ ruleId }) => ruleId)).toStrictEqual(['eqeqeq']);
        expect(readFileSync(join(repository.path, 'eslint.config.cjs'), 'utf8')).toBe(original);
        const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect((JSON.parse(repeated.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
    },
    PLANTED_TIMEOUT_MS,
);
