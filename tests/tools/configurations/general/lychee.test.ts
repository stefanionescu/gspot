import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { LinkFailure } from '#tests/types/tools/configurations/general/lychee.ts';
import { LINK_PAGE, LINK_TEXT_CASES, LINK_SCOPE_TABLES } from '#tests/config/tools/configurations/general/lychee.ts';

// Every phase distinguishes root and child exits, statuses, and native source positions.
async function expectLinks(root: string, check: string, failures: readonly LinkFailure[]): Promise<void> {
    const checked = await spawnGspot(root, ['check', '--only', check, '--json'], { PATH: buildToolsPath(['lychee']) });
    expect(checked.code, checked.stdout + checked.stderr).toBe(failures.length === 0 ? 0 : 1);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject(
        ['', 'app'].map((scope) => {
            const expected = failures.filter((failure) => failure.scope === scope);
            return {
                check,
                scope,
                status: expected.length === 0 ? 'passed' : 'failed',
                findings: expected.map(({ file, rule }) => containing({ file, rule, line: 3, column: 6 })),
            };
        }),
    );
}

// Native checks must reject a missing text fragment and accept its existing replacement.
async function expectTextFragments(root: string, check: string, target: string): Promise<void> {
    for (const { fragment, failures } of LINK_TEXT_CASES) {
        await Bun.write(join(root, 'root.md'), `# Links\n\nRead [the page](${target}#:~:text=${fragment}).\n`);
        await expectLinks(root, check, failures);
    }
}

test(
    'native documentation links keep offline, network, fragments and exclusions in their owning scopes',
    async () => {
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
                'gspot.toml': buildPolicy([], { tables: LINK_SCOPE_TABLES }),
                'root.md': `# Links\n\nRead [the page](${url}missing).\n\n[Root endpoint](${url}root-only)\n`,
                'app/guide.md': child,
                'page.html': LINK_PAGE,
            });
            commitAll(sandbox.path);
            const applied = await spawnGspot(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            await expectLinks(sandbox.path, 'docs/lychee', []);
            expect(requests).toStrictEqual([]);
            await expectLinks(sandbox.path, 'docs/lychee-external', [{ scope: '', file: 'root.md', rule: '404' }]);
            expect(requests).toContain('/missing');
            expect(requests).not.toContain('/root-only');
            expect(requests).not.toContain('/child-only');
            await Bun.write(join(sandbox.path, 'root.md'), `# Links\n\nRead [the page](${url}child-only).\n`);
            await expectLinks(sandbox.path, 'docs/lychee-external', [{ scope: '', file: 'root.md', rule: '404' }]);
            await Bun.write(join(sandbox.path, 'root.md'), `# Links\n\nRead [the page](${url}page#setup).\n`);
            await expectLinks(sandbox.path, 'docs/lychee-external', []);
            for (const level of ['recommended', 'all', 'recommended']) {
                const selected = await spawnGspot(sandbox.path, ['set', 'level', level]);
                expect(selected.code, selected.stdout + selected.stderr).toBe(0);
                await expectTextFragments(sandbox.path, 'docs/lychee-external', `${url}page`);
                requests.length = 0;
                await expectTextFragments(sandbox.path, 'docs/lychee', 'page.html');
                expect(requests).toStrictEqual([]);
            }
        } finally {
            await server.stop(true);
        }
    },
    NATIVE_TEST_TIMEOUT_MS,
);
