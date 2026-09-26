import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { run } from '#tests/support/cli/command.ts';
import { openSession } from '#cli/execution/session.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/execution/report.ts';
import { existsSync, chmodSync, statSync } from 'node:fs';
import { containing } from '#tests/support/expectations.ts';

test.each([false, true])(
    'JavaScript checking preserves repository resolution and excludes private ambient types (authored: %s)',
    async (authored) => {
        await using sandbox = await testdir();
        const config = '{"extends":"./base.json"}\n';
        const source = `import { format } from '${authored ? '@shape/value' : './value.js'}';\nexport const text = format(42);\nexport const total = accepted;\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n',
            'source/main.js': source,
            'source/value.js':
                '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n',
            'node_modules/@types/domain/index.d.ts': 'declare const accepted: number;\n',
            '.gspot/node_modules/@types/private/index.d.ts': 'This is invalid private tooling input.\n',
            'authored/cache.tsbuildinfo': 'Preserve this authored metadata.\n',
            ...(authored
                ? {
                      'jsconfig.json': config,
                      'base.json': JSON.stringify({
                          compilerOptions: {
                              target: 'ES2022',
                              module: 'ESNext',
                              moduleResolution: 'Bundler',
                              baseUrl: '.',
                              paths: { '@shape/*': ['source/*'] },
                              types: ['domain'],
                              incremental: true,
                              tsBuildInfoFile: 'authored/cache.tsbuildinfo',
                          },
                          include: ['source/**/*.js'],
                          exclude: ['excluded'],
                      }),
                      'excluded/source.js': 'UnknownDependency();\n',
                  }
                : {}),
        });
        const renderSession7 = await openSession(sandbox.path);
        const generated = emitAll(renderSession7.policyFiles.policy, renderSession7.repository, renderSession7.scopes, {
            version: renderSession7.version,
            packageManager: renderSession7.packageManager,
        }).files.find(({ path }) => path === '.gspot/config/jsconfig.json')!;
        await Bun.write(join(sandbox.path, generated.path), generated.content);
        chmodSync(join(sandbox.path, generated.path), 0o444);
        const command = ['check', '--only', 'javascript/checkjs', '--no-cache', '--json'];
        const env = { PATH: toolsPath(['tsc']) };
        const broken = await run(sandbox.path, command, env);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect((JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'source/main.js', line: 2, column: 28, rule: 'TS2345' },
        ]);
        expect((JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toHaveLength(1);
        await Bun.write(join(sandbox.path, 'source/main.js'), source.replace('format(42)', 'format("42")'));
        const corrected = await run(sandbox.path, command, env);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'authored/cache.tsbuildinfo')).text()).toBe(
            'Preserve this authored metadata.\n',
        );
        expect(await Bun.file(join(sandbox.path, generated.path)).text()).toBe(generated.content);
        expect(statSync(join(sandbox.path, generated.path)).mode & 0o777).toBe(0o444);
        // An authored jsconfig is read, never rewritten, and a broken one stops the check with its name.
        const jsconfig = join(sandbox.path, 'jsconfig.json');
        expect(existsSync(jsconfig) ? await Bun.file(jsconfig).text() : undefined).toBe(authored ? config : undefined);
        if (authored) await Bun.write(jsconfig, '{');
        const invalid = authored ? await run(sandbox.path, command, env) : undefined;
        expect(invalid?.code, (invalid?.stdout ?? '') + (invalid?.stderr ?? '')).toBe(authored ? 2 : undefined);
        expect(invalid?.stderr.includes('jsconfig.json')).toBe(authored ? true : undefined);
        expect(existsSync(jsconfig) ? await Bun.file(jsconfig).text() : undefined).toBe(authored ? '{' : undefined);
    },
    60_000,
);

test('JavaScript projects retain nested compiler options and isolate the deepest scope', async () => {
    await using sandbox = await testdir();
    const policy =
        'version = 1\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';
    const bad = '/** @type {string} */\nexport const name = 42;\n';
    const corrected = bad.replace('42', '"name"');
    const config = '{"extends":"./base.json"}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'source.js': corrected,
        'app/source.js': 'export const value = localValue;\n',
        'app/node_modules/@types/domain/index.d.ts': 'declare const localValue: string;\n',
        'app/jsconfig.json': config,
        'app/base.json':
            '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","types":["domain"],"incremental":true,"tsBuildInfoFile":"authored.cache"},"include":["**/*.js"],"exclude":["excluded"]}',
        'app/excluded/ignored.js': 'unknownValue();\n',
        'app/authored.cache': 'Preserve this cache.\n',
        'app/child/source.js': bad,
        'sibling/source.js': corrected,
    });
    const renderSession8 = await openSession(sandbox.path);
    const outputs = emitAll(renderSession8.policyFiles.policy, renderSession8.repository, renderSession8.scopes, {
        version: renderSession8.version,
        packageManager: renderSession8.packageManager,
    }).files.filter(({ path }) => path.endsWith('/jsconfig.json'));
    expect(outputs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/child/jsconfig.json',
        '.gspot/config/app/jsconfig.json',
        '.gspot/config/jsconfig.json',
        '.gspot/config/sibling/jsconfig.json',
    ]);
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    const command = ['check', '--only', 'javascript/checkjs', '--no-cache', '--json'];
    const env = { PATH: toolsPath(['tsc']) };
    const broken = await run(sandbox.path, command, env);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = JSON.parse(broken.stdout) as RunReport;
    expect(
        report.checks.flatMap(({ scope, findings }) => findings.map((finding) => ({ scope, finding }))),
    ).toStrictEqual([
        {
            scope: 'app/child',
            finding: containing({ file: 'app/child/source.js', line: 2, column: 14, rule: 'TS2322' }),
        },
    ]);
    await Bun.write(join(sandbox.path, 'app/child/source.js'), corrected);
    const fixed = await run(sandbox.path, command, env);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'app/jsconfig.json')).text()).toBe(config);
    expect(await Bun.file(join(sandbox.path, 'app/authored.cache')).text()).toBe('Preserve this cache.\n');
    for (const output of outputs) expect(await Bun.file(join(sandbox.path, output.path)).text()).toBe(output.content);
    await Bun.write(join(sandbox.path, 'app/jsconfig.json'), '{');
    const invalid = await run(sandbox.path, command, env);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect(invalid.stderr).toContain('app/jsconfig.json');
    expect(await Bun.file(join(sandbox.path, 'app/jsconfig.json')).text()).toBe('{');
}, 60_000);
