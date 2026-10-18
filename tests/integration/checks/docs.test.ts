import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { LinkFailure } from '#tests/types/tool-output.ts';
import { LINK_PAGE, LINK_TEXT_CASES, LINK_SCOPE_SETTINGS } from '#tests/data/checks/docs.ts';

// Checks the exit code, and the status and finding positions of the root and child scopes.
async function assertLinkFailures(root: string, check: string, failures: readonly LinkFailure[]): Promise<void> {
    const checked = await spawnGspot(root, ['check', '--only', check, '--json'], { PATH: buildSandboxPath() });
    expect(checked.code, checked.stdout + checked.stderr).toBe(failures.length === 0 ? 0 : 1);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject(
        ['', 'app'].map((scope) => {
            const expected = failures.filter((failure) => failure.scope === scope);
            return {
                check,
                scope,
                status: expected.length === 0 ? 'passed' : 'failed',
                findings: expected.map(({ file, rule }) => matchFields({ file, rule, line: 3, column: 6 })),
            };
        }),
    );
}

// The link check must reject a missing text fragment and accept one that exists.
async function assertTextFragments(root: string, check: string, target: string): Promise<void> {
    for (const { fragment, failures } of LINK_TEXT_CASES) {
        await Bun.write(join(root, 'root.md'), `# Links\n\nRead [the page](${target}#:~:text=${fragment}).\n`);
        await assertLinkFailures(root, check, failures);
    }
}

test('docs/lychee checks local links, and docs/lychee-external checks web links, fragments, and allowed URLs per scope', async () => {
    await using sandbox = await testdir();
    const requests: string[] = [];
    const server = Bun.serve({
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
    try {
        const url = server.url.toString();
        const child = `# Links\n\nRead [the page](${url}page#setup).\n\n[Child endpoint](${url}child-only)\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText([], { tables: LINK_SCOPE_SETTINGS }),
            'root.md': `# Links\n\nRead [the page](${url}missing).\n\n[Root endpoint](${url}root-only)\n`,
            'app/guide.md': child,
            'page.html': LINK_PAGE,
        });
        commitAll(sandbox.path);
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await assertLinkFailures(sandbox.path, 'docs/lychee', []);
        expect(requests).toStrictEqual([]);
        await assertLinkFailures(sandbox.path, 'docs/lychee-external', [{ scope: '', file: 'root.md', rule: '404' }]);
        expect(requests).toContain('/missing');
        expect(requests).not.toContain('/root-only');
        expect(requests).not.toContain('/child-only');
        await Bun.write(join(sandbox.path, 'root.md'), `# Links\n\nRead [the page](${url}child-only).\n`);
        await assertLinkFailures(sandbox.path, 'docs/lychee-external', [{ scope: '', file: 'root.md', rule: '404' }]);
        await Bun.write(join(sandbox.path, 'root.md'), `# Links\n\nRead [the page](${url}page#setup).\n`);
        await assertLinkFailures(sandbox.path, 'docs/lychee-external', []);
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await assertTextFragments(sandbox.path, 'docs/lychee-external', `${url}page`);
        requests.length = 0;
        await assertTextFragments(sandbox.path, 'docs/lychee', 'page.html');
        expect(requests).toStrictEqual([]);
    } finally {
        await server.stop(true);
    }
});
