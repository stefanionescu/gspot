import { ESLint } from 'eslint';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { chmodSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const POLICY = 'version = 1\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n';
const SOURCE = 'alert(left == right);\n';
const CONFIG = [
    { files: ['**/*.js'], rules: { eqeqeq: 'error' } },
    { files: ['tests/**'], rules: { eqeqeq: 'off', 'no-alert': 'warn' } },
];

test.each(['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'])(
    'apply preserves authored %s and native ESLint path behavior',
    async (path) => {
        await using repository = await testdir();
        const text = `module.exports = ${JSON.stringify(CONFIG)};\n`;
        const original = path.endsWith('.mjs') ? text.replace('module.exports =', 'export default') : text;
        await createFileTree(repository.path, {
            'gspot.toml': POLICY.replace('[rules]', `exclude = [${JSON.stringify(path)}]\n[rules]`),
            [path]: original,
            'source.js': SOURCE,
            'tests/source.js': SOURCE,
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
            writeFileSync(join(repository.path, file), SOURCE);
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
        await createFileTree(repository.path, { 'gspot.toml': POLICY, 'source.js': SOURCE });
        const initial = await run(repository.path, ['apply']);
        expect(initial.code, initial.stdout + initial.stderr).toBe(0);
        const original = `module.exports = ${JSON.stringify(CONFIG)};\n`;
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
