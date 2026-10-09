import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';

import {
    OWN_RULE,
    APP_SEMGREP,
    BEARER_FILES,
    SWIFT_SAMPLE,
    FASTAPI_SOURCE,
    SECURITY_CLEAN,
    FRAMEWORK_FILES,
    SEMGREP_COMMAND,
    FRAMEWORK_FINDINGS,
    BASH_DOWNLOAD_SAMPLE,
    EXPRESS_SOURCE_CASES,
    PLATFORM_SOURCE_CASES,
    SEMGREP_PROJECT_FILES,
    EXPRESS_SOURCE_FINDINGS,
    PLATFORM_SOURCE_FINDINGS,
    PLATFORM_SOURCE_CORRECTIONS,
    PLATFORM_ALL_SOURCE_FINDINGS,
    PLATFORM_ALL_SOURCE_CORRECTIONS,
} from '#tests/config/tools/generation/semgrep.ts';

function findingRows(report: RunReport) {
    return report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule })));
}

test.skipIf(!hasToolBuild('semgrep'))('framework security packs stay within inherited scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript', 'security'], { tables: APP_SEMGREP }),
        ...FRAMEWORK_FILES,
    });
    const environment = await sharePythonTools(sandbox.path);
    const appliedPolicy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    const broken = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const findingsByScope = (JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ scope, findings }) =>
        findings.map(({ file, line, rule }) => ({ scope, file, line, rule })),
    );
    expect(findingsByScope).toStrictEqual(FRAMEWORK_FINDINGS);
    for (const path of ['app/source.js', 'app/child/source.js'])
        await Bun.write(join(sandbox.path, path), 'res.json({ message: "Accepted" });\n');
    await Bun.write(join(sandbox.path, 'sibling/ignored.js'), 'JSON.parse(input);\n');
    const corrected = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(appliedPolicy).toMatch(/\[\[ignore\]\][\s\S]*app\/\*\*\/ignored\.js/);
    const invalidRule = join(sandbox.path, '.gspot/config/app/semgrep/express.yml');
    const originalRule = await Bun.file(invalidRule).text();
    await Bun.write(invalidRule, 'rules: [');
    const invalid = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect((JSON.parse(invalid.stdout) as RunReport).checks.find((check) => check.scope === 'app')?.status).toBe(
        'error',
    );
    await Bun.write(invalidRule, originalRule);
});

test.skipIf(!hasToolBuild('semgrep'))('Semgrep rules follow the level', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'swift', 'security'], {
            level: 'recommended',
        }),
        'script.sh': BASH_DOWNLOAD_SAMPLE,
        'Value.swift': SWIFT_SAMPLE,
    });
    const environment = await sharePythonTools(sandbox.path);
    const recommended = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
    expect(recommended.code, recommended.stdout + recommended.stderr).toBe(1);
    expect(
        (JSON.parse(recommended.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .flatMap(({ rule }) => (rule?.startsWith('gspot.swift.') === true ? [rule] : [])),
    ).toStrictEqual(['gspot.swift.keychain-accessible-always', 'gspot.swift.weak-hash-algorithm']);
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['bash', 'swift', 'security'], { level: 'all' }));
    await sharePythonTools(sandbox.path);
    const all = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
    expect(all.code, all.stdout + all.stderr).toBe(1);
    expect(findingRows(JSON.parse(all.stdout) as RunReport)).toStrictEqual([
        { file: 'Value.swift', line: 1, rule: 'gspot.swift.keychain-accessible-always' },
        { file: 'Value.swift', line: 2, rule: 'gspot.swift.weak-hash-algorithm' },
        { file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 3, rule: 'gspot.bash.eval' },
        { file: 'script.sh', line: 4, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 5, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 6, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 7, rule: 'gspot.bash.curl-pipe-shell' },
    ]);
    await Bun.write(join(sandbox.path, 'script.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n');
    await Bun.write(
        join(sandbox.path, 'Value.swift'),
        SWIFT_SAMPLE.replace('kSecAttrAccessibleAlways', 'kSecAttrAccessibleWhenUnlockedThisDeviceOnly').replace(
            'Insecure.MD5',
            'SHA256',
        ),
    );
    const clean = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
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
        const environment = await sharePythonTools(sandbox.path);
        const failed = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = findingRows(JSON.parse(failed.stdout) as RunReport);
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            EXPRESS_SOURCE_FINDINGS,
        );
        for (const path of ['execute-template.js', 'query-template.js'])
            await Bun.write(join(sandbox.path, path), EXPRESS_SOURCE_CASES['parameterized.js']);
        for (const path of ['field.js', 'response-template.js'])
            await Bun.write(join(sandbox.path, path), EXPRESS_SOURCE_CASES['json.js']);
        const corrected = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
    },
);

test.skipIf(!hasToolBuild('semgrep')).each(['recommended', 'all'] as const)(
    'every shipped Semgrep file validates with the native parser at level %s',
    async (level) => {
        const manifests = [...configurationManifests().values()].filter((manifest) =>
            manifest.toolFiles.some((config) => config.target.includes('/semgrep/')),
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
                    manifest.toolFiles
                        .filter((config) => config.target.includes('/semgrep/'))
                        .map((config) => config.target),
                ),
            ),
        );
        const environment = await sharePythonTools(sandbox.path);
        expect(
            await Promise.all(generated.map((file) => Bun.file(join(sandbox.path, file.path)).text())),
        ).toStrictEqual(generated.map((file) => file.content));
        const validated = await runTestCommand(
            ['semgrep', 'scan', '--validate', '--config', '.gspot/config/semgrep', '--metrics=off'],
            { cwd: sandbox.path, env: environment },
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
        const environment = await sharePythonTools(sandbox.path);
        const failed = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(findingRows(JSON.parse(failed.stdout) as RunReport)).toStrictEqual([
            { file: 'service.py', line: 7, rule: 'gspot.fastapi.exception-text-in-response' },
        ]);
        await Bun.write(
            join(sandbox.path, 'service.py'),
            FASTAPI_SOURCE.replace('detail=str(error)', 'detail="Unable to load user"'),
        );
        const corrected = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test.skipIf(!hasToolBuild('semgrep')).each(['recommended', 'all'] as const)(
    '%s security packs report raw inputs once, accept documented forms, and pass after fixes',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': SEMGREP_PROJECT_FILES['package.json'],
            'tsconfig.json': SEMGREP_PROJECT_FILES['tsconfig.json'],
            'wrangler.toml': SEMGREP_PROJECT_FILES['wrangler.toml'],
            'supabase/config.toml': SEMGREP_PROJECT_FILES['supabase/config.toml'],
            'Value.swift': SEMGREP_PROJECT_FILES['Value.swift'],
            'gspot.toml': buildPolicy(
                ['javascript', 'typescript', 'swift', 'supabase', 'cloudflare', 'security', 'xcode'],
                {
                    level: level,
                },
            ),
            ...PLATFORM_SOURCE_CASES,
        });
        const environment = await sharePythonTools(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', 'xcode/ats', '--json'];
        const failed = await spawnGspot(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = findingRows(JSON.parse(failed.stdout) as RunReport);
        const expected = PLATFORM_SOURCE_FINDINGS.filter(
            (finding) => level !== 'all' || finding.rule !== 'gspot.javascript.no-interpolated-exec',
        );
        if (level === 'all') expected.push(...PLATFORM_ALL_SOURCE_FINDINGS);
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            expected.toSorted((left, right) => left.file.localeCompare(right.file)),
        );
        const corrections = { ...PLATFORM_SOURCE_CORRECTIONS };
        if (level === 'all') Object.assign(corrections, PLATFORM_ALL_SOURCE_CORRECTIONS);
        for (const [path, source] of Object.entries(corrections)) await Bun.write(join(sandbox.path, path), source);
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test.skipIf(!hasToolBuild('semgrep'))('repository security rules report findings and pass after fixes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'security'], {
            tables: '[tools.semgrep]\nrule_files = ["security/own.yml"]\n',
        }),
        'src/index.ts': SECURITY_CLEAN,
        'src/use.ts': "import { double } from './index.ts';\n\nexport const four = double(2);\n",
        'security/own.yml': OWN_RULE,
        ...BEARER_FILES,
    });
    commitAll(sandbox.path);
    const environment = await sharePythonTools(sandbox.path);
    const own = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
    expect(own.code, own.stdout + own.stderr).toBe(1);
    const report = JSON.parse(own.stdout) as RunReport;
    expect(report.checks).toMatchObject([{ check: 'security/semgrep', status: 'failed' }]);
    expect(report.checks[0]!.findings).toContainEqual(
        containing<Finding>({ rule: 'test-no-double', file: 'src/use.ts', line: 3 }),
    );
    await Bun.write(join(sandbox.path, 'src/use.ts'), 'export const four = 4;\n');
    const corrected = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'security/semgrep', status: 'passed', findings: [] },
    ]);
});
