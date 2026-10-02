// Planted Astro components: ESLint reads their markup, astro check their types, and Prettier their layout.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runPlanted } from '#tests/harness/planted/cases.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { installSandbox } from '#tests/harness/planted/sandbox.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG } from '#tests/samples/components.ts';

const CLEAN = `---\nconst title: string = 'Home';\n---\n\n<h1>{title}</h1>\n<img src="logo.png" alt="The logo" />\n`;
const PAGE = 'src/pages/index.astro';

// Astro types the markup a template callback returns as any. A script that only imports a module is how Astro bundles
// client code. ESLint reports neither, and it does report the set:html directive.
const BUNDLED = `${CLEAN}{[title].map((text) => <b>{text}</b>)}\n<div set:html={title} />\n<script>\n    import '../answer.ts';\n</script>\n`;

test(
    'one Astro project reaches ESLint, astro check, and Prettier, and accepts each correction',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const environment = await installSandbox(root, {
            kits: ['typescript', 'astro', 'format'],
            dependencies: { astro: '7.3.2' },
            files: { 'tsconfig.json': COMPONENT_TSCONFIG, 'src/answer.ts': COMPONENT_SOURCE, [PAGE]: CLEAN },
        });
        const linted = await runPlanted(root, { check: 'javascript/eslint', files: { [PAGE]: BUNDLED } }, environment);
        expect(linted.code, linted.stdout + linted.stderr).toBe(1);
        const findings = (JSON.parse(linted.stdout) as RunReport).checks[0]!.findings;
        expect(findings).toContainEqual(containing({ rule: 'astro/no-set-html-directive', file: PAGE, line: 8 }));
        const rules = new Set(findings.map((finding) => finding.rule));
        expect(
            ['@typescript-eslint/no-unsafe-return', 'gspot/no-trivial-files'].filter((name) => rules.has(name)),
        ).toStrictEqual([]);
        const typed = await runPlanted(
            root,
            { check: 'astro/check', files: { [PAGE]: CLEAN.replace('const title: string', 'const title: number') } },
            environment,
        );
        expect(typed.code, typed.stdout + typed.stderr).toBe(1);
        expect((JSON.parse(typed.stdout) as RunReport).checks[0]!.findings).toContainEqual(
            containing({ rule: 'ts(2322)', file: PAGE, line: 2, column: 7 }),
        );
        await Bun.write(join(root, PAGE), CLEAN.replace('<h1>{title}</h1>', '<h1>{title}</h1   >'));
        const loose = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json'], environment);
        expect(loose.code, loose.stdout + loose.stderr).toBe(1);
        const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(root, PAGE)).text()).toBe(CLEAN);
        const clean = await spawnGspot(
            root,
            ['check', '--json', '--only', 'javascript/eslint', 'astro/check'],
            environment,
        );
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS * 8,
);
