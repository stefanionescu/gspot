import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';

test.each([
    ['<a href="javascript:alert(1)">Link</a>', 4],
    ['<a href="jav&#x61;script&colon;alert(1)">Link</a>', 4],
    ['<a href="java&#9;script:alert(1)">Link</a>', 4],
    ['<a href=" VbScRiPt:msgbox(1)">Link</a>', 4],
    ['<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', 4],
    ['<iframe src="data:text/html,example"></iframe>', 9],
    ['<object data="data:image/svg+xml,example"></object>', 9],
    ['<script src="data:text/javascript,alert(1)"></script>', 9],
])('HTML scripts report the executable URL in %s', async (markup, column) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["html"]\n',
        'page.html': markup,
    });
    const options = {
        stage: 'commit' as const,
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['html/scripts'],
    };
    const result = await executeRun(await openSession(sandbox.path), options);
    expect(
        result.report.checks
            .flatMap((check) => check.findings)
            .map(({ rule, line, column }) => ({ rule, line, column })),
    ).toStrictEqual([{ rule: 'script-link', line: 1, column }]);
    await createFileTree(sandbox.path, { 'page.html': '<a href="/page">Link</a><script src="/app.js"></script>' });
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks.map((check) => check.check)).toStrictEqual(['html/scripts']);
    expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
});

test.each([
    '<a href="/page" title="javascript: is a scheme">Link</a>',
    '<img src="data:image/png;base64,aW1hZ2U=" alt="Image">',
    '<img src="data:image/svg+xml,example" alt="Image">',
    '<a href="data:text/plain,example" download>Download</a>',
    '<script type="application/ld+json">{"name":"example"}</script>',
])('HTML scripts preserve inert markup %s', async (markup) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["html"]\n',
        'page.html': markup,
    });
    const result = await executeRun(await openSession(sandbox.path), {
        stage: 'commit',
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['html/scripts'],
    });
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks.map((check) => check.check)).toStrictEqual(['html/scripts']);
    expect(result.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
});
