import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { DYNAMIC_READS } from '#tests/config/cli/checks/css-usage.ts';

const options = buildRunOptions({ only: ['css/module-classes'] });

test('global CSS classes are not module exports and explicitly local classes still require a use', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['css'], { level: 'all' }),
        'styles.module.css':
            ':global(.external) .card { color: red; }\n:global .external-child { color: blue; }\n:global .external :local(.local) { color: green; }\n',
        'view.ts': 'import styles from "./styles.module.css";\nexport const card = styles.card;\n',
    });
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.checks[0]?.findings).toMatchObject([
        { file: 'styles.module.css', line: 3, rule: 'unused-class', message: textContaining('local') },
    ]);
    await Bun.write(
        join(sandbox.path, 'view.ts'),
        'import styles from "./styles.module.css";\nexport const card = [styles.card, styles.local];\n',
    );
    const corrected = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(corrected).toStrictEqual([]);
});

test.each(['card-title', 'card_title', 'card--title'])(
    'CSS module class %s supports camel-case and literal access while a Sass module is not read',
    async (className) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['css'], { level: 'all' }),
            'styles.module.css': `.${className} { color: red; }\n`,
            'view.tsx': `import styles from './styles.module.css';\nexport const card = [styles.cardTitle, styles['${className}']];\n`,
            'theme.module.scss': '.panel { color: red; }\n',
            'panel.tsx': "import styles from './theme.module.scss';\nexport const panel = styles.missing;\n",
        });
        const result = BUILT_IN_CHECKS['css/module-classes'].input(
            buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
        );
        expect(result).toStrictEqual([]);

        await Bun.write(
            join(sandbox.path, 'panel.tsx'),
            "import styles from './styles.module.css';\nexport const panel = styles.missing;\n",
        );
        const failed = BUILT_IN_CHECKS['css/module-classes'].input(
            buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
        );
        expect(failed).toMatchObject([{ file: 'panel.tsx', rule: 'undefined-class' }]);
    },
);

test.each([
    { name: 'comment', verbatim: '// styles.missing\n/* styles["absent"] */\n' },
    { name: 'string', verbatim: 'export const text = "styles.missing";\n' },
    {
        name: 'shadowed parameter',
        verbatim: 'export function label(styles: { missing: string }) { return styles.missing; }\n',
    },
    { name: 'shadowed local', verbatim: '{ const styles = { missing: "local" }; console.log(styles.missing); }\n' },
])('CSS usage ignores property-looking text in a $name', async ({ verbatim }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['css'], { level: 'all' }),
        'styles.module.css': '.card { color: red; }\n',
        'view.ts': `import styles from './styles.module.css';\nexport const card = styles.card;\n${verbatim}`,
    });
    const result = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(result).toStrictEqual([]);
});

test('identically named stylesheets keep their own bindings and correct exact findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['css'], { level: 'all' }),
        'left/styles.module.css': '.left { color: red; }\n',
        'right/styles.module.css': '.right { color: blue; }\n',
        'left/view.ts': "import styles from './styles.module.css';\nexport const value = styles.right;\n",
        'right/view.ts': "import styles from './styles.module.css';\nexport const value = styles.right;\n",
    });
    const failed = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(failed.length).toBeGreaterThan(0);
    expect(failed).toMatchObject([
        { check: 'css/module-classes', file: 'left/styles.module.css', rule: 'unused-class', line: 1 },
        { check: 'css/module-classes', file: 'left/view.ts', rule: 'undefined-class', line: 2 },
    ]);
    await Bun.write(
        join(sandbox.path, 'left/view.ts'),
        "import styles from './styles.module.css';\nexport const value = styles.left;\n",
    );
    const corrected = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(corrected).toStrictEqual([]);
});

test('ignored importers cannot satisfy a selected stylesheet class', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['css'], { level: 'all' }),
        '.gitignore': 'ignored.ts\n',
        'styles.module.css': '.card { color: red; }\n.unused { color: blue; }\n',
        'view.ts': "import styles from './styles.module.css';\nexport const card = styles.card;\n",
        'ignored.ts':
            "import styles from './styles.module.css';\nexport const hidden = [styles.unused, styles.missing];\n",
    });
    const failed = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(failed.length).toBeGreaterThan(0);
    expect(failed).toMatchObject([
        {
            file: 'styles.module.css',
            rule: 'unused-class',
            line: 2,
            message: 'No importer reads the class unused.',
        },
    ]);
    await Bun.write(join(sandbox.path, 'styles.module.css'), '.card { color: red; }\n');
    const corrected = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(corrected).toStrictEqual([]);
});

test.each([
    {
        name: 'default',
        declaration: 'import styles from "./styles.module.css";',
        bound: true,
    },
    {
        name: 'namespace',
        declaration: 'import * as styles from "./styles.module.css";',
        bound: true,
    },
    {
        name: 'combined default',
        declaration: 'import styles, { other } from "./styles.module.css";',
        bound: true,
    },
    {
        name: 'type-only',
        declaration: 'import type styles from "./styles.module.css";',
        bound: false,
    },
    {
        name: 'named',
        declaration: 'import { styles } from "./styles.module.css";',
        bound: false,
    },
    {
        name: 'side-effect',
        declaration: 'import "./styles.module.css";',
        bound: false,
    },
    { name: 'package', declaration: 'import styles from "styles.module.css";', bound: false },
])('CSS usage resolves a $name import without inferring unsupported bindings', async ({ declaration, bound }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['css'], { level: 'all' }),
        'styles.module.css': '.card { color: red; }\n',
        'view.ts': `${declaration}\nexport const value = styles.missing;\n`,
    });
    const result = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(result.length > 0).toBe(bound);
    expect(result.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
        bound
            ? [
                  { file: 'styles.module.css', line: 1, rule: 'unused-class' },
                  { file: 'view.ts', line: 2, rule: 'undefined-class' },
              ]
            : [],
    );
});

test.each(DYNAMIC_READS)(
    'CSS module $name does not guess unused classes and still reports literal missing reads',
    async ({ source }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['css'], { level: 'all' }),
            'styles.module.css': '.card { color: red; }\n.unused { color: blue; }\n',
            'view.ts': `import styles from './styles.module.css';\n${source}\nexport const absent = styles.missing;\n`,
        });
        const failed = BUILT_IN_CHECKS['css/module-classes'].input(
            buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
        );
        expect(failed.length).toBeGreaterThan(0);
        expect(failed).toMatchObject([{ file: 'view.ts', line: 3, rule: 'undefined-class' }]);
        await Bun.write(join(sandbox.path, 'view.ts'), `import styles from './styles.module.css';\n${source}\n`);
        const corrected = BUILT_IN_CHECKS['css/module-classes'].input(
            buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
        );
        expect(corrected).toStrictEqual([]);
    },
);

test('CSS destructuring resolves aliases and reports unused definitions and missing reads at their lines', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['css'], { level: 'all' }),
        'styles.module.css': '\n.card { color: red; }\n.unused { color: blue; }\n',
        'view.ts': "import styles from './styles.module.css';\nexport const { card: label, missing } = styles;\n",
    });
    const failed = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(failed.length).toBeGreaterThan(0);
    expect(failed).toMatchObject([
        { file: 'styles.module.css', line: 3, rule: 'unused-class' },
        { file: 'view.ts', line: 2, rule: 'undefined-class' },
    ]);
    await Bun.write(
        join(sandbox.path, 'view.ts'),
        "import styles from './styles.module.css';\nexport const { card: label, unused } = styles;\n",
    );
    const corrected = BUILT_IN_CHECKS['css/module-classes'].input(
        buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
    );
    expect(corrected).toStrictEqual([]);
});

test.each(['mts', 'cts'])(
    'CSS modules report undefined classes in %s importers and read corrections',
    async (extension) => {
        await using sandbox = await testdir();
        const path = `view.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['css'], { level: 'all' }),
            'styles.module.css': '.card { color: red; }\n',
            [path]: 'import styles from "./styles.module.css";\nexport const card = styles.missing;\n',
        });
        const failed = BUILT_IN_CHECKS['css/module-classes'].input(
            buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
        );
        expect(failed.length).toBeGreaterThan(0);
        expect(failed.find((finding) => finding.file === path)).toMatchObject({
            file: path,
            rule: 'undefined-class',
        });
        await Bun.write(
            join(sandbox.path, path),
            'import styles from "./styles.module.css";\nexport const card = styles.card;\n',
        );
        const corrected = BUILT_IN_CHECKS['css/module-classes'].input(
            buildCheckInput(await openSession(sandbox.path), 'css/module-classes'),
        );
        expect(corrected).toStrictEqual([]);
    },
);
