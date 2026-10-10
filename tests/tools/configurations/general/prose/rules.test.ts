import { join } from 'node:path';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { runBuiltInCheck } from '#cli/execution/contracts.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { installValePackages } from '#cli/lifecycle/install/contracts.ts';
import { installTree, readInstalledTree } from '#cli/lifecycle/ownership/state/public.ts';
import { PACKAGE_STYLE_CASES } from '#tests/config/tools/configurations/general/prose/rules.ts';

const directory = testdir();

beforeAll(async () => {
    const sandbox = await directory;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['prose'], { level: 'all' }),
        'sample.md': '# Guide\n',
    });
    const session = await openSession(sandbox.path);
    using ownership = openOwnership(sandbox.path);
    writeGeneratedFiles(session, emitAll(session), ownership);
    expect(
        await installValePackages({
            search: session,
            owner: {
                read: (path) => ownership.files.read(path),
                installTree: (kind, output) => {
                    installTree(ownership, kind, readInstalledTree(output, kind));
                },
            },
            level: 'all',
            tool: toolPin(session.manifests.values(), 'vale'),
            timeoutSeconds: Number(session.scopes[0]!.view.settings['tool_timeout_seconds']),
        }),
    ).toBeUndefined();
    expect(await pathExists(join(sandbox.path, '.gspot/vale/Microsoft'))).toBe(false);
    expect(await pathExists(join(sandbox.path, '.gspot/vale/RedHat'))).toBe(false);
});

afterAll(async () => {
    const sandbox = await directory;
    await sandbox[Symbol.asyncDispose]();
});

test.each(['recommended', 'all'] as const)(
    '%s preserves unique package rules at root and child scopes',
    async (level) => {
        const sandbox = await directory;
        const sample = PACKAGE_STYLE_CASES.map(({ sample }) => sample).join('\n\n') + '\n';
        for (const scope of ['', 'child', 'child/deep', 'sibling']) {
            const path = scope === '' ? 'sample.md' : `${scope}/sample.md`;
            const policy = buildPolicy(['prose'], {
                level,
                tables: '[scope.child]\nconfigurations = ["prose"]\n[scope."child/deep"]\nconfigurations = ["prose"]\n[scope.sibling]\nconfigurations = ["prose"]\n',
            });
            await createFileTree(sandbox.path, { 'gspot.toml': policy, [path]: sample });
            const session = await openSession(sandbox.path);
            using ownership = openOwnership(sandbox.path);
            writeGeneratedFiles(session, emitAll(session), ownership);
            const planned = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] }).find(
                (entry) => entry.scope.scope.path === scope,
            )!;
            const result = await runBuiltInCheck(BUILT_IN_CALCULATIONS['prose/vale'])(session, planned);
            const rules = result.findings.map(({ rule }) => rule);
            for (const entry of PACKAGE_STYLE_CASES) {
                expect(rules.includes(entry.rule), entry.rule).toBe(level === 'all');
            }
            expect(
                rules.some((rule) => rule?.startsWith('Microsoft.') === true || rule?.startsWith('RedHat.') === true),
            ).toBe(false);
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(sample);
            expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
            await Bun.write(join(sandbox.path, path), '# Guide\n\nRead the guide.\n');
            const corrected = await runBuiltInCheck(BUILT_IN_CALCULATIONS['prose/vale'])(
                await openSession(sandbox.path),
                planned,
            );
            expect(corrected.status, corrected.note).toBe('passed');
            expect(corrected.findings).toStrictEqual([]);
        }
    },
);

test('an authored rule ignore selects its scope without disabling the root rule', async () => {
    const sandbox = await directory;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['prose'], {
            level: 'all',
            tables: '[scope.child]\nconfigurations = ["prose"]\n[[ignore]]\ncheck = "prose/vale"\nrule = "gspot.ampm"\npaths = ["child/**"]\nreason = "The child sample documents a literal time suffix."\n',
        }),
        'sample.md': 'Meet at 1 pmsuffix.\n',
        'child/sample.md': 'Meet at 1 pmsuffix.\n',
    });
    const session = await openSession(sandbox.path);
    using ownership = openOwnership(sandbox.path);
    writeGeneratedFiles(session, emitAll(session), ownership);
    const result = await executeRun(session, buildRunOptions({ only: ['prose/vale'] }));
    for (const row of result.report.checks) {
        expect(row.findings.some(({ rule }) => rule === 'gspot.ampm')).toBe(row.scope === '');
    }
    expect(result.report.ignores).toMatchObject([{ rule: 'gspot.ampm', matched: 1 }]);
});
