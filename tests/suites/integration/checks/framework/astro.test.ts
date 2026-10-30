import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { runCheckOnChanges } from '#tests/setup/cli/samples.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { ASTRO_PAGE, ASTRO_PAGE_PATH } from '#tests/config/integration/checks/framework/astro.ts';
import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/config/integration/checks/component-samples.ts';

const installedSandbox = shareInstalledSandbox({
    configurations: ['typescript', 'astro', 'format'],
    dependencies: { astro: SANDBOX_PACKAGES.astro },
    json: { 'tsconfig.json': COMPONENT_TSCONFIG },
    files: { 'src/answer.ts': ANSWER_MODULE, [ASTRO_PAGE_PATH]: ASTRO_PAGE },
});

test('ESLint, astro check, and Prettier each report a finding in one Astro project and pass after each fix', async () => {
    const { root } = installedSandbox();
    const linted = parseCheckReport(
        await runCheckOnChanges(installedSandbox(), {
            check: 'javascript/eslint',
            files: {
                [ASTRO_PAGE_PATH]:
                    ASTRO_PAGE +
                    `{[title].map((text) => <b>{text}</b>)}
<div set:html={title} />
<script>
    import './answer';
</script>
`,
                'src/pages/answer.ts': ANSWER_MODULE,
            },
        }),
    );
    expect(linted.code, linted.stdout + linted.stderr).toBe(1);
    expect(listFindingRows(linted.report)).toStrictEqual([
        { file: ASTRO_PAGE_PATH, line: 8, rule: 'astro/no-set-html-directive' },
    ]);
    const typed = parseCheckReport(
        await runCheckOnChanges(installedSandbox(), {
            check: 'astro/astro-check',
            files: { [ASTRO_PAGE_PATH]: ASTRO_PAGE.replace('const title: string', 'const title: number') },
        }),
    );
    expect(typed.code, typed.stdout + typed.stderr).toBe(1);
    expect(typed.report.checks[0]!.findings).toMatchObject([
        {
            file: ASTRO_PAGE_PATH,
            line: 2,
            column: 7,
            rule: 'ts(2322)',
        },
    ]);
    await writeFile(join(root, ASTRO_PAGE_PATH), ASTRO_PAGE.replace('<h1>{title}</h1>', '<h1>{title}</h1   >'));
    const loose = parseCheckReport(await spawnGspot(root, ['check', '--only', 'format/prettier', '--json']));
    expect(loose.code, loose.stdout + loose.stderr).toBe(1);
    expect(loose.report.checks[0]!.findings.map(({ file }) => file)).toStrictEqual([ASTRO_PAGE_PATH]);
    const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, ASTRO_PAGE_PATH), 'utf8')).toBe(ASTRO_PAGE);
    const clean = await spawnGspot(root, ['check', '--json', '--only', 'javascript/eslint,astro/astro-check']);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
});
