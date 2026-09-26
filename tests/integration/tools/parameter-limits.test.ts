import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';

for (const language of ['python', 'swift']) {
    test.each([7, 8])(`${language} counts declared parameters with maximum %i`, async (maximum) => {
        await using directory = await testdir();
        const extension = { python: 'py', swift: 'swift' }[language]!;
        const source = [7, 8]
            .map((count) => {
                const names = Array.from({ length: count }, (_, index) => `value${String(index)}`);
                const name = count === 7 ? 'seven' : 'eight';
                if (language === 'python')
                    return `def ${name}(${names.join(', ')}):\n    return ${names.join(' + ')}\n`;
                const parameters = names.map((parameter) => `${parameter}: Int = 0`).join(', ');
                return `func ${name}(${parameters}) -> Int { return ${names.join(' + ')} }`;
            })
            .join('\n');
        const limits = maximum === 7 ? '' : `[limits.${language}]\nfunction_parameters = ${String(maximum)}\n`;
        await createFileTree(directory.path, {
            'gspot.toml': `version = 1\nconfigurations = ["${language}"]\n${limits}`,
            [`example.${extension}`]: source,
        });
        const renderSession1 = await openSession(directory.path);
        const files = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
            version: renderSession1.version,
            packageManager: renderSession1.packageManager,
        }).files;
        const configName = language === 'python' ? '.gspot/config/ruff.toml' : '.gspot/config/swiftlint.yml';
        const config = files.find(({ path }) => path === configName)!;
        mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
        writeFileSync(join(directory.path, configName), config.content);
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
        const result = Bun.spawnSync(command, {
            cwd: directory.path,
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: 10_000,
        });
        const findings = JSON.parse(result.stdout.toString()) as {
            code?: string;
            rule_id?: string;
            severity?: string;
            line?: number;
            location?: { row: number };
        }[];
        expect(result.exitCode, result.stderr.toString()).toBe(
            language === 'python'
                ? findings.length === 0
                    ? 0
                    : 1
                : findings.some((finding) => finding.severity === 'Error')
                  ? 2
                  : 0,
        );
        expect(
            findings.filter((finding) => finding.code === 'PLR0913' || finding.rule_id === 'function_parameter_count'),
        ).toMatchObject(
            maximum === 7
                ? [
                      language === 'python'
                          ? { code: 'PLR0913', location: { row: 4 } }
                          : { rule_id: 'function_parameter_count', line: 2 },
                  ]
                : [],
        );
    });
}
