// A framework allows its own one-file folders through the setting default it declares; the repository adds its own.
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

const PAGE = '<script>\n    let count = 0;\n</script>\n<p>{count}</p>\n';

async function loneFiles(root: string): Promise<string[]> {
    const result = await executeRun(await openSession(root), {
        stage: 'all',
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/single-file-folder'],
    });
    return result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file));
}

test('SvelteKit route folders hold one page each without a finding, and other lone files still report', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["javascript", "svelte"]\n',
        'package.json': '{"name":"planted","private":true,"type":"module"}\n',
        'src/routes/about/+page.svelte': PAGE,
        'src/routes/blog/[slug]/+page.svelte': PAGE,
        'src/lib/lone/util.js': 'export const answer = 42;\n',
    });
    expect(await loneFiles(sandbox.path)).toStrictEqual(['src/lib/lone/util.js']);
});

test('the repository allowance joins the framework allowance instead of replacing it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["javascript", "svelte"]\n[structure]\nsingle_file_folder_allowed = [{ paths = ["src/lib/lone/**"], reason = "Required entry directory." }]\n',
        'package.json': '{"name":"planted","private":true,"type":"module"}\n',
        'src/routes/about/+page.svelte': PAGE,
        'src/lib/lone/util.js': 'export const answer = 42;\n',
        'src/lib/other/util.js': 'export const answer = 42;\n',
    });
    expect(await loneFiles(sandbox.path)).toStrictEqual(['src/lib/other/util.js']);
});
