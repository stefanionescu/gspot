import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { installGeneratedPythonTools } from '#tests/harness/python-installation.ts';

import {
    APP_SEMGREP,
    SWIFT_DEFECTS,
    FASTAPI_SOURCE,
    FRAMEWORK_FILES,
    FRAMEWORK_FINDINGS,
    EXPRESS_SOURCE_CASES,
    PLATFORM_SOURCE_CASES,
    SEMGREP_PROJECT_FILES,
    EXPRESS_SOURCE_FINDINGS,
    PLATFORM_SOURCE_FINDINGS,
    PLATFORM_SOURCE_CORRECTIONS,
} from '#tests/config/tools/generation/semgrep.ts';

test.skipIf(!hasToolBuild('semgrep'))(
    'framework security packs stay within inherited scopes and preserve sibling input',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript', 'security'], { tables: APP_SEMGREP }),
            ...FRAMEWORK_FILES,
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const environment = await installGeneratedPythonTools(sandbox.path);
        const appliedPolicy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const broken = await spawnGspot(sandbox.path, command, environment);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const findingsByScope = (JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ scope, findings }) =>
            findings.map(({ file, line, rule }) => ({ scope, file, line, rule })),
        );
        expect(findingsByScope).toStrictEqual(FRAMEWORK_FINDINGS);
        for (const path of ['app/source.js', 'app/child/source.js'])
            await Bun.write(join(sandbox.path, path), 'res.json({ message: "Accepted" });\n');
        await Bun.write(join(sandbox.path, 'sibling/ignored.js'), 'JSON.parse(input);\n');
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect({
            root: await Bun.file(join(sandbox.path, 'source.js')).text(),
            sibling: await Bun.file(join(sandbox.path, 'sibling/source.js')).text(),
            policy: await Bun.file(join(sandbox.path, 'gspot.toml')).text(),
        }).toStrictEqual({
            root: FRAMEWORK_FILES['source.js'],
            sibling: FRAMEWORK_FILES['source.js'],
            policy: appliedPolicy,
        });
        expect(appliedPolicy).toContain('[scope.tools.semgrep]');
        const invalidRule = join(sandbox.path, '.gspot/config/app/semgrep/broken.yml');
        await Bun.write(invalidRule, 'rules: [');
        const invalid = await spawnGspot(sandbox.path, command, environment);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect((JSON.parse(invalid.stdout) as RunReport).checks.find((check) => check.scope === 'app')?.status).toBe(
            'error',
        );
        expect(await Bun.file(invalidRule).text()).toBe('rules: [');
        await Bun.file(invalidRule).delete();
        const recovered = await spawnGspot(sandbox.path, command, environment);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
    },
);

test.skipIf(!hasToolBuild('semgrep'))('Semgrep rules follow the selected configurations and the level', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const script = '#!/usr/bin/env bash\ncurl https://example.com/setup.sh | bash\neval "$1"\n';
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['bash', 'swift', 'security'], {
            tables: '[agent_rules]\nenabled = false\n',
            level: 'recommended',
        }),
        'script.sh': script,
        'Value.swift': SWIFT_DEFECTS,
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const environment = await installGeneratedPythonTools(root);
    const command = ['check', '--only', 'security/semgrep', '--json'];
    const recommended = await spawnGspot(root, command, environment);
    expect(recommended.code, recommended.stdout + recommended.stderr).toBe(1);
    expect(
        (JSON.parse(recommended.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .flatMap(({ rule }) => (rule?.startsWith('ios-') === true ? [rule] : [])),
    ).toStrictEqual(['ios-keychain-accessible-always']);
    await Bun.write(
        join(root, 'gspot.toml'),
        buildPolicy(['bash', 'swift', 'security'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
    );
    const updated = await spawnGspot(root, ['apply']);
    expect(updated.code, updated.stdout + updated.stderr).toBe(0);
    const all = await spawnGspot(root, command, environment);
    expect(all.code, all.stdout + all.stderr).toBe(1);
    const findings = (JSON.parse(all.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(findings).toStrictEqual(
        containingAll([
            containing({ file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' }),
            containing({ file: 'script.sh', line: 3, rule: 'gspot.bash.eval' }),
            containing({ file: 'Value.swift', line: 1, rule: 'ios-keychain-accessible-always' }),
            containing({ file: 'Value.swift', line: 2, rule: 'ios-unsafe-pointer-cast' }),
        ]),
    );
    expect(await Bun.file(join(root, 'script.sh')).text()).toBe(script);
    await Bun.write(join(root, 'script.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n');
    await Bun.write(join(root, 'Value.swift'), 'let access = kSecAttrAccessibleWhenUnlockedThisDeviceOnly\n');
    const clean = await spawnGspot(root, command, environment);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
});

test.skipIf(!hasToolBuild('semgrep'))(
    'the Express pack reports SQL interpolation and raw response fields without misreporting positive cases',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['express', 'security']),
            'package.json': '{"private": true, "dependencies": {"express": "5.2.1"}}\n',
            ...EXPRESS_SOURCE_CASES,
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const environment = await installGeneratedPythonTools(sandbox.path);
        const failed = await spawnGspot(sandbox.path, ['check', '--only', 'security/semgrep', '--json'], environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings: reports }) =>
            reports.map(({ file, rule, line }) => ({ file, rule, line })),
        );
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            EXPRESS_SOURCE_FINDINGS,
        );
        for (const path of ['execute-template.js', 'query-template.js'])
            await Bun.write(join(sandbox.path, path), EXPRESS_SOURCE_CASES['parameterized.js']);
        for (const path of ['field.js', 'response-template.js'])
            await Bun.write(join(sandbox.path, path), EXPRESS_SOURCE_CASES['json.js']);
        const corrected = await spawnGspot(
            sandbox.path,
            ['check', '--only', 'security/semgrep', '--json'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
    },
);

test.skipIf(!hasToolBuild('semgrep')).each(['recommended', 'all'] as const)(
    'every shipped Semgrep file validates with the native parser at level %s',
    async (level) => {
        const manifests = [...configurationManifests().values()].filter((manifest) =>
            manifest.configs.some((config) => config.target.includes('/semgrep/')),
        );
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...SEMGREP_PROJECT_FILES,
            'gspot.toml': buildPolicy(['security', ...manifests.map((manifest) => manifest.configuration.name)], {
                level,
            }),
        });
        const generated = emitAll(await openSession(sandbox.path)).files.filter((file) =>
            file.path.includes('/semgrep/'),
        );
        expect(new Set(generated.map((file) => file.path))).toStrictEqual(
            new Set(
                manifests.flatMap((manifest) =>
                    manifest.configs
                        .filter((config) => config.target.includes('/semgrep/'))
                        .map((config) => config.target),
                ),
            ),
        );
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(
            await Promise.all(generated.map((file) => Bun.file(join(sandbox.path, file.path)).text())),
        ).toStrictEqual(generated.map((file) => file.content));
        const environment = await installGeneratedPythonTools(sandbox.path);
        const validated = await runTestCommand(
            ['semgrep', 'scan', '--validate', '--config', '.gspot/config/semgrep', '--metrics=off'],
            { cwd: sandbox.path, env: environment, timeoutMs: 60_000 },
        );
        expect(validated.code, validated.stdout + validated.stderr).toBe(0);
    },
);

test.skipIf(!hasToolBuild('semgrep'))(
    'the FastAPI pack reports exception responses and accepts a stable replacement',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['fastapi', 'security']),
            'pyproject.toml': SEMGREP_PROJECT_FILES['pyproject.toml'],
            'service.py': FASTAPI_SOURCE,
            'neighbor.py':
                'from fastapi import HTTPException\nraise HTTPException(status_code=404, detail="User not found")\n',
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const environment = await installGeneratedPythonTools(sandbox.path);
        const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const failed = await spawnGspot(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(
            (JSON.parse(failed.stdout) as RunReport).checks
                .flatMap((check) => check.findings)
                .map(({ file, line, rule }) => ({ file, line, rule })),
        ).toStrictEqual([{ file: 'service.py', line: 7, rule: 'fastapi-exception-text-in-response' }]);
        await Bun.write(
            join(sandbox.path, 'service.py'),
            FASTAPI_SOURCE.replace('detail=str(error)', 'detail="Unable to load user"'),
        );
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        expect(await Bun.file(join(sandbox.path, 'neighbor.py')).text()).toBe(
            'from fastapi import HTTPException\nraise HTTPException(status_code=404, detail="User not found")\n',
        );
    },
);

test.skipIf(!hasToolBuild('semgrep'))(
    'platform security packs report raw inputs once and accept documented forms and corrections',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': SEMGREP_PROJECT_FILES['package.json'],
            'tsconfig.json': SEMGREP_PROJECT_FILES['tsconfig.json'],
            'wrangler.toml': SEMGREP_PROJECT_FILES['wrangler.toml'],
            'supabase/config.toml': SEMGREP_PROJECT_FILES['supabase/config.toml'],
            'gspot.toml': buildPolicy(['javascript', 'supabase', 'cloudflare', 'security']),
            ...PLATFORM_SOURCE_CASES,
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const environment = await installGeneratedPythonTools(sandbox.path);
        const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const failed = await spawnGspot(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = (JSON.parse(failed.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .map(({ file, rule, line }) => ({ file, rule, line }));
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            PLATFORM_SOURCE_FINDINGS,
        );
        for (const [path, source] of Object.entries(PLATFORM_SOURCE_CORRECTIONS))
            await Bun.write(join(sandbox.path, path), source);
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const preserved = Object.entries(PLATFORM_SOURCE_CASES).filter(
            ([path]) => !Object.hasOwn(PLATFORM_SOURCE_CORRECTIONS, path),
        );
        expect(await Promise.all(preserved.map(([path]) => Bun.file(join(sandbox.path, path)).text()))).toStrictEqual(
            preserved.map(([, source]) => source),
        );
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);
