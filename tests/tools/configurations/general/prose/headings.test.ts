import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { planRun, isActive } from '#cli/planning/public.ts';
import { runBuiltInCheck } from '#cli/execution/contracts.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { installValePackages } from '#cli/lifecycle/install/contracts.ts';
import type { HeadingCase } from '#tests/types/tools/configurations/general/prose.ts';
import { installTree, readInstalledTree } from '#cli/lifecycle/ownership/state/public.ts';
import { HEADING_SCOPES } from '#tests/config/tools/configurations/general/prose/headings.ts';

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
});

afterAll(async () => {
    const sandbox = await directory;
    await sandbox[Symbol.asyncDispose]();
});

async function checkHeadings({ scope, level }: HeadingCase): Promise<void> {
    const sandbox = await directory;
    const policy = buildPolicy(['prose', 'docs'], {
        level,
        tables: '[agent_rules]\nenabled = false\n[docs]\nbanned_headings = ["Root [map]"]\n[scope.child.docs]\nbanned_headings = ["Child [map]"]\n[scope."child/deep"]\nconfigurations = ["prose", "docs"]\n[scope.sibling]\nconfigurations = ["prose", "docs"]\n',
    });
    const path = scope === '' ? 'sample.md' : `${scope}/sample.md`;
    const lines = scope.startsWith('child') ? [1, 3] : [1];
    const source = '# Root [map]\n\n## Child [map]\n\n## Table of contents\n\nRead [here](sample.md).\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy, [path]: source });
    const session = await openSession(sandbox.path);
    using ownership = openOwnership(sandbox.path);
    const output = emitAll(session);
    writeGeneratedFiles(session, output, ownership);
    expect(output.files.find(({ path }) => path === '.gspot/config/vale-scoped.ini')!.content).toBe(
        output.files.find(({ path }) => path === '.gspot/config/vale.ini')!.content,
    );
    const planned = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] }).find(
        (entry) => entry.scope.scope.path === scope,
    )!;
    const failed = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned);
    expect(failed.status, failed.note).toBe('failed');
    const { findings } = failed;
    expect(
        findings.filter(({ rule }) => rule === 'gspot.banned-headings').map(({ file, line }) => ({ file, line })),
    ).toStrictEqual(level === 'all' ? lines.map((line) => ({ file: path, line })) : []);
    expect(
        findings.filter(({ rule }) => rule === 'gspot.link-text').map(({ file, line }) => ({ file, line })),
    ).toStrictEqual([{ file: path, line: 7 }]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    await Bun.write(join(sandbox.path, path), '# Guide\n\nRead [request guide](sample.md).\n');
    const corrected = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(
        await openSession(sandbox.path),
        planned,
    );
    expect(corrected.status, corrected.note).toBe('passed');
    expect(corrected.findings).toStrictEqual([]);
}

describe('effective native heading lists', () => {
    test.each(HEADING_SCOPES.map((scope) => ({ ...scope, level: 'recommended' as const })))(
        'recommended $name uses its effective heading list and shared styles',
        checkHeadings,
    );
    test.each(HEADING_SCOPES.map((scope) => ({ ...scope, level: 'all' as const })))(
        'all $name uses its effective heading list and shared styles',
        checkHeadings,
    );
});

describe('child-only native prose inputs', () => {
    test.each(['recommended', 'all'] as const)(
        '%s retains shared styles with only child prose inputs',
        async (level) => {
            const sandbox = await directory;
            const path = 'child/only.md';
            await Promise.all(
                HEADING_SCOPES.map(({ scope }) => rm(join(sandbox.path, scope, 'sample.md'), { force: true })),
            );
            await createFileTree(sandbox.path, {
                'gspot.toml': buildPolicy([], {
                    level,
                    tables: '[scope.child]\nconfigurations = ["prose", "docs"]\n[scope.child.docs]\nbanned_headings = ["Local map"]\n',
                }),
                [path]: '# Local map\n\nRead [here](only.md).\n',
            });
            const session = await openSession(sandbox.path);
            using ownership = openOwnership(sandbox.path);
            writeGeneratedFiles(session, emitAll(session), ownership);
            const checks = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
            expect(
                checks
                    .filter(isActive)
                    .filter(({ skip }) => skip === undefined)
                    .map(({ scope }) => scope.scope.path),
            ).toStrictEqual(['child']);
            const planned = checks.find(({ scope }) => scope.scope.path === 'child')!;
            const result = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned);
            expect(result.status, result.note).toBe('failed');
            expect(
                result.findings
                    .filter(({ rule }) => rule === 'gspot.banned-headings')
                    .map(({ file, line }) => ({ file, line })),
            ).toStrictEqual(level === 'all' ? [{ file: path, line: 1 }] : []);
            expect(
                result.findings
                    .filter(({ rule }) => rule === 'gspot.link-text')
                    .map(({ file, line }) => ({ file, line })),
            ).toStrictEqual([{ file: path, line: 3 }]);
        },
    );
});
