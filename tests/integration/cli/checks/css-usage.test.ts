import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { executeRun } from '#cli/execution/execute.ts';

const options = {
    stage: 'all' as const,
    only: ['integrity/css-usage'],
    skips: [],
    fix: false,
    isDryRun: true,
    noCache: true,
};

test('CSS module imports and literal access bind to the selected stylesheet, and a Sass module is not read', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["css"]\n',
        'styles.module.css': '.card-title { color: red; }\n',
        'view.tsx':
            "import styles from './styles.module.css';\nexport const card = [styles.cardTitle, styles['card-title']];\n",
        'theme.module.scss': '.panel { color: red; }\n',
        'panel.tsx': "import styles from './theme.module.scss';\nexport const panel = styles.missing;\n",
    });
    const result = await executeRun(await openSession(sandbox.path), { ...options, skips: [] });
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'integrity/css-usage', status: 'ok', findings: [] }]);
    await Bun.write(
        join(sandbox.path, 'panel.tsx'),
        "import styles from './styles.module.css';\nexport const panel = styles.missing;\n",
    );
    const failed = await executeRun(await openSession(sandbox.path), { ...options, skips: [] });
    expect(failed.report.checks[0]?.findings).toMatchObject([{ file: 'panel.tsx', rule: 'undefined-class' }]);
});

test.each([
    { name: 'comment', extra: '// styles.missing\n/* styles["absent"] */\n' },
    { name: 'string', extra: 'export const text = "styles.missing";\n' },
    {
        name: 'shadowed parameter',
        extra: 'export function label(styles: { missing: string }) { return styles.missing; }\n',
    },
    { name: 'shadowed local', extra: '{ const styles = { missing: "local" }; console.log(styles.missing); }\n' },
])('CSS usage ignores property-looking text in a $name', async ({ extra }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["css"]\n',
        'styles.module.css': '.card { color: red; }\n',
        'view.ts': `import styles from './styles.module.css';\nexport const card = styles.card;\n${extra}`,
    });
    const result = await executeRun(await openSession(sandbox.path), { ...options, skips: [] });
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'integrity/css-usage', status: 'ok', findings: [] }]);
});

test('identically named stylesheets keep their own bindings and correct exact findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["css"]\n',
        'left/styles.module.css': '.left { color: red; }\n',
        'right/styles.module.css': '.right { color: blue; }\n',
        'left/view.ts': "import styles from './styles.module.css';\nexport const value = styles.right;\n",
        'right/view.ts': "import styles from './styles.module.css';\nexport const value = styles.right;\n",
    });
    const failed = await executeRun(await openSession(sandbox.path), { ...options, skips: [] });
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'integrity/css-usage',
            status: 'fail',
            findings: [
                { check: 'integrity/css-usage', file: 'left/styles.module.css', rule: 'unused-class', line: 1 },
                { check: 'integrity/css-usage', file: 'left/view.ts', rule: 'undefined-class', line: 1 },
            ],
        },
    ]);
    await Bun.write(
        join(sandbox.path, 'left/view.ts'),
        "import styles from './styles.module.css';\nexport const value = styles.left;\n",
    );
    const corrected = await executeRun(await openSession(sandbox.path), { ...options, skips: [] });
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'ok', findings: [] }]);
});

test('ignored importers cannot satisfy a selected stylesheet class', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["css"]\n',
        '.gitignore': 'ignored.ts\n',
        'styles.module.css': '.card { color: red; }\n.unused { color: blue; }\n',
        'view.ts': "import styles from './styles.module.css';\nexport const card = styles.card;\n",
        'ignored.ts':
            "import styles from './styles.module.css';\nexport const hidden = [styles.unused, styles.missing];\n",
    });
    const failed = await executeRun(await openSession(sandbox.path), { ...options, skips: [] });
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'integrity/css-usage',
            status: 'fail',
            findings: [
                {
                    file: 'styles.module.css',
                    rule: 'unused-class',
                    line: 1,
                    message: 'No importer reads the class unused.',
                },
            ],
        },
    ]);
    await Bun.write(join(sandbox.path, 'styles.module.css'), '.card { color: red; }\n');
    const corrected = await executeRun(await openSession(sandbox.path), { ...options, skips: [] });
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'integrity/css-usage', status: 'ok', findings: [] }]);
});
