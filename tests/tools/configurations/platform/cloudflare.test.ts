import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import { levelSchema } from '#cli/parsers/schema/contracts.ts';
import { WRANGLER } from '#tests/config/samples/cloudflare.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { toolPin, toolProjectPackage } from '#cli/configurations/contracts.ts';
import { installTree, readInstalledTree } from '#cli/lifecycle/ownership/state/public.ts';
import { CASES, REPOSITORY, WRANGLER_FORMATS } from '#tests/config/tools/configurations/platform/cloudflare.ts';

let repository: OwnedTestRepository;

beforeAll(async () => {
    repository = await createTestRepository(REPOSITORY, spawnGspot, async (root, scenario) => {
        await createFileTree(root, {
            ...scenario.files,
            '.gitignore': 'node_modules/\n',
            'gspot.toml': buildPolicy(scenario.configurations),
        });
        const session = await openSession(root);
        const packageDeclaration = toolProjectPackage(toolPin(session.manifests.values(), 'ajv'));
        if (packageDeclaration === undefined) throw new Error('Ajv declares no installable package.');
        const installed = await runTestCommand(
            ['npm', 'install', `${packageDeclaration.name}@${packageDeclaration.version}`],
            { cwd: root },
        );
        if (installed.code !== 0) throw new Error(installed.stdout + installed.stderr);
        using log = openOwnership(root);
        installTree(log, 'npm', readInstalledTree(join(root, 'node_modules'), 'npm'));
        return {};
    });
});

afterAll(async () => {
    await repository[Symbol.asyncDispose]();
});

test.each(CASES)('native $check retains the missing-date finding and its correction', async (entry) => {
    const outcome = await runFindingCase(repository, entry, {
        ...REPOSITORY,
        corrected: () => ({ files: { 'wrangler.jsonc': WRANGLER } }),
    });
    expect(outcome.failed.code, outcome.failed.stderr).toBe(1);
    expect(outcome.failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
    expect(outcome.failed.report.checks[0]?.findings).toContainEqual(
        containing({ check: entry.check, ...entry.expected }),
    );
    expect(outcome.passed.code, outcome.passed.stderr).toBe(0);
    expect(outcome.passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
});

test.each(levelSchema.options)('native Wrangler schema validates root and child values at %s', async (level) => {
    await createFileTree(repository.root, {
        'gspot.toml': buildPolicy(['cloudflare'], { level, tables: '[scope.app]\nconfigurations = ["cloudflare"]\n' }),
        'wrangler.jsonc': '{"name":"root","compatibility_date":"2026-01-15","workers_dev":"wrong"}\n',
        'app/wrangler.json':
            '{"name":"app","compatibility_date":"2026-01-15","env":{"production":{"workers_dev":"wrong"}}}\n',
    });
    for (const scope of ['', 'app']) {
        const path = scope === '' ? 'wrangler.jsonc' : 'app/wrangler.json';
        const session = await openSession(repository.root);
        const findings = await BUILT_IN_CALCULATIONS['cloudflare/wrangler'](
            buildCheckInput(session, 'cloudflare/wrangler', { scope }),
        );
        expect(findings).toMatchObject([
            {
                file: path,
                rule: 'schema',
                line: 1,
                message: scope === '' ? '/workers_dev must be boolean' : '/env/production/workers_dev must be boolean',
            },
        ]);
        await Bun.write(
            join(repository.root, path),
            '{"name":"fixed","compatibility_date":"2026-01-15","workers_dev":true}\n',
        );
        expect(
            await BUILT_IN_CALCULATIONS['cloudflare/wrangler'](
                buildCheckInput(await openSession(repository.root), 'cloudflare/wrangler', { scope }),
            ),
        ).toStrictEqual([]);
    }
});

test.each(levelSchema.options)(
    'native Wrangler reports every scalar error in all formats and scopes at %s',
    async (level) => {
        await createFileTree(repository.root, {
            'gspot.toml': buildPolicy(['cloudflare'], {
                level,
                tables: '[scope.app]\nconfigurations = ["cloudflare"]\n',
            }),
        });
        for (const { name, broken, corrected } of WRANGLER_FORMATS) {
            for (const scope of ['', 'app']) {
                const path = scope === '' ? name : `${scope}/${name}`;
                await createFileTree(repository.root, { [path]: broken });
                const findings = await BUILT_IN_CALCULATIONS['cloudflare/wrangler'](
                    buildCheckInput(await openSession(repository.root), 'cloudflare/wrangler', { scope }),
                );
                expect(findings).toStrictEqual([
                    containing({
                        file: path,
                        line: 1,
                        rule: 'missing-name',
                        message: 'The configuration names no worker.',
                    }),
                    containing({ file: path, line: 1, rule: 'schema', message: '/name must be string' }),
                    containing({ file: path, line: 1, rule: 'schema', message: '/workers_dev must be boolean' }),
                ]);
                await Bun.write(join(repository.root, path), corrected);
                expect(
                    await BUILT_IN_CALCULATIONS['cloudflare/wrangler'](
                        buildCheckInput(await openSession(repository.root), 'cloudflare/wrangler', { scope }),
                    ),
                ).toStrictEqual([]);
            }
        }
    },
);
