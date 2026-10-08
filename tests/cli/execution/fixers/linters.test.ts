import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import type { RunOptions } from '#cli/types/execution/check.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test.each([
    {
        configuration: 'javascript',
        tool: 'eslint',
        executable: 'eslint.js',
        path: 'sample.js',
        config: 'native.mjs',
        nativeConfiguration: 'export default [{ rules: { semi: ["error", "always"], "no-undef": "error" } }];',
        invalidConfiguration: 'throw new Error("Invalid native configuration");',
        formatter: ['--format', 'json'],
        sample: 'missing()\n',
        partial: 'missing();\n',
        corrected: 'export {};\n',
    },
    {
        configuration: 'css',
        tool: 'stylelint',
        executable: 'stylelint.mjs',
        path: 'sample.css',
        config: 'native.json',
        nativeConfiguration: JSON.stringify({ rules: { 'color-hex-length': 'short', 'property-no-unknown': true } }),
        invalidConfiguration: '{',
        formatter: ['--formatter', 'unix'],
        sample: 'a { color: #ffffff; unknown: 1; }\n',
        partial: 'a { color: #fff; unknown: 1; }\n',
        corrected: 'a { color: #fff; }\n',
    },
])('$configuration correction status agrees with native residual diagnostics', async (entry) => {
    await using sandbox = await testdir();
    const check = configurationManifests()
        .get(entry.configuration)!
        .checks.find((check) => check.name === `${entry.configuration}/${entry.tool}`)!;
    const executable = join(
        dirname(await Bun.resolve(`${entry.tool}/package.json`, import.meta.dir)),
        'bin',
        entry.executable,
    );
    const command = [process.execPath, executable, '--config', entry.config];
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            check: {
                'project/native': {
                    command: [...command, ...entry.formatter, '{files}'],
                    fix: [...command, '--fix', '{files}'],
                    exit_codes: check.exit_codes!,
                    output: check.output!,
                    paths: [entry.path],
                    stage: 'commit',
                },
            },
        }),
        [entry.config]: entry.nativeConfiguration,
        [entry.path]: entry.sample,
    });
    const source = await readFile(join(sandbox.path, entry.path), 'utf8');
    await writeFile(join(sandbox.path, entry.config), entry.invalidConfiguration);
    const invalid = await executeRun(await openSession(sandbox.path), buildRunOptions({ only: ['project/native'] }));
    expect(invalid.report.exitCode).toBe(2);
    expect(invalid.report.checks).toMatchObject([{ status: 'error', findings: [] }]);
    expect(await readFile(join(sandbox.path, entry.path), 'utf8')).toBe(source);
    await writeFile(join(sandbox.path, entry.config), entry.nativeConfiguration);
    const session = await openSession(sandbox.path);
    const options: RunOptions = buildRunOptions({ fix: true, only: ['project/native'] });
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode, JSON.stringify(failed)).toBe(1);
    expect(failed.fixes?.results).toMatchObject([{ status: 'changed', changed: [entry.path] }]);
    expect(await readFile(join(sandbox.path, entry.path), 'utf8')).toBe(entry.partial);
    await Bun.write(join(sandbox.path, entry.path), entry.corrected);
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected)).toBe(0);
});
