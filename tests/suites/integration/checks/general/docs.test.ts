import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import type { LinkFailure } from '#tests/types/reports.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, runGspotStep, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { LINK_PAGE, ROOT_LINK_FILES, LINK_SCOPE_TABLES } from '#tests/config/integration/checks/general/docs.ts';

async function assertLinkFailures(root: string, checkId: string, failures: readonly LinkFailure[]): Promise<void> {
    const checked = parseCheckReport(await spawnGspot(root, ['check', '--only', checkId, '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(failures.length === 0 ? 0 : 1);
    expect(checked.report.checks).toMatchObject(
        ['', 'app'].map((scope) => {
            const expected = failures.filter((failure) => failure.scope === scope);
            return {
                check: checkId,
                scope,
                status: expected.length === 0 ? 'passed' : 'failed',
                findings: expected.map(({ file, rule }) => matchFields({ file, rule, line: 3, column: 6 })),
            };
        }),
    );
}

async function assertTextLinks(root: string, checkId: string, target: string): Promise<void> {
    for (const { text, failures } of [
        { text: 'absent', failures: [{ scope: '', file: 'root.md', rule: 'ERROR' }] },
        { text: 'Current%20setup', failures: [] },
    ] as const) {
        await writeFile(join(root, 'root.md'), `# Links\n\nRead [the page](${target}#:~:text=${text}).\n`);
        await assertLinkFailures(root, checkId, failures);
    }
}

test('docs/lychee checks local links, and docs/lychee-external checks web links, fragments, and allowed URLs per scope', async () => {
    const requests: string[] = [];
    using server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            const { pathname } = new URL(request.url);
            requests.push(pathname);
            return pathname === '/page'
                ? new Response(LINK_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
                : new Response('Missing endpoint', { status: 404 });
        },
    });
    const url = server.url.href;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: LINK_SCOPE_TABLES }),
        'root.md': `# Links\n\nRead [the page](${url}missing).\n\n[Root endpoint](${url}root-only)\n`,
        'app/guide.md': `# Links\n\nRead [the page](${url}page#setup).\n\n[Child endpoint](${url}child-only)\n`,
        'page.html': LINK_PAGE,
    });
    commitAll(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    await assertLinkFailures(sandbox.path, 'docs/lychee', []);
    expect(requests).toStrictEqual([]);
    await assertLinkFailures(sandbox.path, 'docs/lychee-external', [{ scope: '', file: 'root.md', rule: '404' }]);
    expect(requests.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(['/missing', '/page']);
    await writeFile(join(sandbox.path, 'root.md'), `# Links\n\nRead [the page](${url}child-only).\n`);
    await assertLinkFailures(sandbox.path, 'docs/lychee-external', [{ scope: '', file: 'root.md', rule: '404' }]);
    await writeFile(join(sandbox.path, 'root.md'), `# Links\n\nRead [the page](${url}page#setup).\n`);
    await assertLinkFailures(sandbox.path, 'docs/lychee-external', []);
    const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    await assertTextLinks(sandbox.path, 'docs/lychee-external', `${url}page`);
    requests.length = 0;
    await assertTextLinks(sandbox.path, 'docs/lychee', 'page.html');
    expect(requests).toStrictEqual([]);
});

test('docs/lychee reads a root-relative link from the repository root, and leaves a site route to the site', async () => {
    await using sandbox = await testdir({
        ...ROOT_LINK_FILES,
        'gspot.toml': buildSandboxSettings([], {
            level: 'basic',
            rules: true,
            scopes: [{ path: 'web', configurations: ['site'] }],
            tables: '[scope.site]\nbuild_command = ["node", "build.mjs"]\n',
        }),
    });

    commitAll(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    const command = ['check', '--only', 'docs/lychee', '--json'];
    const passed = await spawnGspot(sandbox.path, command);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    await writeFile(join(sandbox.path, 'root.md'), '# Links\n\nRead [the setup guide](/guides/missing.md).\n');
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
        matchFields({ file: 'root.md', line: 3, column: 6 }),
    ]);
});
