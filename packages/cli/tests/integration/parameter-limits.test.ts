import { join } from 'node:path';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { ESLint } from 'eslint';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';

const modules = join(import.meta.dir, '../../../../node_modules');

for (const language of ['javascript', 'typescript', 'python', 'swift']) {
    test.each([7, 8])(`${language} counts declared parameters with maximum %i`, async (maximum) => {
        await using directory = await testdir();
        const extension = { javascript: 'js', typescript: 'ts', python: 'py', swift: 'swift' }[language]!;
        const source = [7, 8]
            .map((count) => {
                const names = Array.from({ length: count }, (_, index) => `value${index}`);
                const name = count === 7 ? 'seven' : 'eight';
                if (language === 'python')
                    return `def ${name}(${names.join(', ')}):\n    return ${names.join(' + ')}\n`;
                if (language === 'swift')
                    return `func ${name}(${names.map((name) => `${name}: Int = 0`).join(', ')}) -> Int { return ${names.join(' + ')} }`;
                const parameters =
                    language === 'typescript' ? ['this: void', ...names.map((name) => `${name}: number`)] : names;
                return `export function ${name}(${parameters.join(', ')}) { return ${names.join(' + ')}; }`;
            })
            .join('\n');
        await createFileTree(directory.path, {
            'gspot.toml': `version = 1\npresets = ["${language}"]\n${maximum === 7 ? '' : `[limits.${language}]\nfunction_parameters = ${maximum}\n`}`,
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            [`example.${extension}`]: source,
        });
        symlinkSync(modules, join(directory.path, 'node_modules'));
        const files = emitAll(await openSession(directory.path)).files;
        const configName =
            language === 'python'
                ? '.gspot/ruff.toml'
                : language === 'swift'
                  ? '.gspot/swiftlint.yml'
                  : '.gspot/eslint.config.mjs';
        const config = files.find(({ path }) => path === configName)!;
        mkdirSync(join(directory.path, '.gspot'));
        writeFileSync(join(directory.path, configName), config.content);
        if (language === 'javascript' || language === 'typescript') {
            const results = await new ESLint({
                cwd: directory.path,
                overrideConfigFile: join(directory.path, configName),
            }).lintFiles([`example.${extension}`]);
            expect(
                results.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'max-params'),
            ).toHaveLength(maximum === 7 ? 1 : 0);
        } else {
            const command =
                language === 'python'
                    ? ['ruff', 'check', '--config', configName, '--output-format', 'json', `example.${extension}`]
                    : [
                          'swiftlint',
                          'lint',
                          '--config',
                          configName,
                          '--reporter',
                          'json',
                          '--quiet',
                          '--no-cache',
                          `example.${extension}`,
                      ];
            const result = Bun.spawnSync(command, { cwd: directory.path, stdout: 'pipe', stderr: 'pipe' });
            expect(result.exitCode, result.stderr.toString()).toBeLessThan(3);
            const findings = JSON.parse(result.stdout.toString()) as { code?: string; rule_id?: string }[];
            expect(
                findings.filter(
                    (finding) => finding.code === 'PLR0913' || finding.rule_id === 'function_parameter_count',
                ),
            ).toHaveLength(maximum === 7 ? 1 : 0);
        }
    });
}
