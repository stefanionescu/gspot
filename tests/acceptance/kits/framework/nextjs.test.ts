// One installed Next.js project: its type check, the framework rules the configuration requires, the delegation of
// type checking to the Next.js check, and the i18n rules.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { rmSync, chmodSync, writeFileSync } from 'node:fs';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import type { InstalledRepository } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { INSTALLED_MODULES } from '#tests/harness/cli/modules.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/platform.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { NEXT_PAGE, NEXT_CONFIG, NEXT_LAYOUT } from '#tests/samples/nextjs.ts';

const COUNT = '// A planted file.\n\n/** A number that holds text. */\nexport const count: number = "three";\n';

const TSCONFIG = {
    compilerOptions: {
        strict: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        exactOptionalPropertyTypes: true,
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        types: [],
        skipLibCheck: true,
        jsx: 'react-jsx',
        lib: ['DOM', 'DOM.Iterable', 'ES2022'],
        noEmit: true,
        plugins: [{ name: 'next' }],
    },
    include: ['app'],
};

const MANIFEST = {
    name: 'planted',
    version: '1.0.0',
    description: 'A planted Next.js app for the tests.',
    private: true,
    type: 'module',
    dependencies: { next: '16.3.5', 'next-intl': '4.3.9', react: '19.1.1', 'react-dom': '19.1.1' },
};

// Runs the named checks alone, expects the exit code, and returns the report.
async function checked(planted: InstalledRepository, checks: string[], code: number): Promise<RunReport> {
    // The Next.js type check runs the type generation and then the compiler, which is slow on Windows.
    const outcome = await spawnGspot(
        planted.root,
        ['check', '--only', ...checks, '--json'],
        planted.environment,
        PLANTED_TIMEOUT_MS * 4,
    );
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(code);
    return JSON.parse(outcome.stdout) as RunReport;
}

// The framework rules reject a disabled requirement and accept its restoration.
async function requiredRules(planted: InstalledRepository): Promise<void> {
    const config = join(planted.root, '.gspot/config/eslint.config.mjs');
    const written = await Bun.file(config).text();
    await checked(planted, ['javascript/rules-off'], 0);
    chmodSync(config, OWNER_WRITABLE_FILE);
    // A later block that turns a required rule off is what javascript/rules-off exists to see.
    await Bun.write(config, written.replace("'react/no-danger': 'error'", "'react/no-danger': 'off'"));
    try {
        const seen = await checked(planted, ['javascript/rules-off'], 1);
        expect(seen.checks[0]!.findings).toContainEqual(
            containing({
                file: '.gspot/config/eslint.config.mjs',
                rule: 'rule-off',
                line: 1,
                message:
                    'react/no-danger is off for app/layout.tsx, and the configurations require it for every .tsx file.',
            }),
        );
    } finally {
        await Bun.write(config, written);
    }
    await checked(planted, ['javascript/rules-off'], 0);
}

// Type checking delegates to the Next.js check only when that check runs.
async function delegation(planted: InstalledRepository): Promise<void> {
    const build = await checked(planted, ['nextjs/build'], 0);
    expect(build.checks).toMatchObject([
        { check: 'nextjs/build', status: 'skipped', note: textContaining('tools.next.build_on_push') },
    ]);
    const direct = await checked(planted, ['typescript/tsc'], 0);
    expect(direct.checks).toMatchObject([{ check: 'typescript/tsc', status: 'passed' }]);
    const delegated = await checked(planted, ['typescript/tsc', 'nextjs/tsc'], 0);
    expect(delegated.checks.find(({ check }) => check === 'nextjs/tsc')?.status).toBe('passed');
    expect(delegated.checks.find(({ check }) => check === 'typescript/tsc')).toMatchObject({
        status: 'skipped',
        note: 'nextjs/tsc runs it here',
    });
}

// The TypeScript check still finds defects when the Next.js check is skipped.
async function skippedReplacement(planted: InstalledRepository): Promise<void> {
    const path = join(planted.root, 'app/count.ts');
    const checks = ['typescript/tsc', 'nextjs/tsc', '--skip', 'nextjs/tsc'];
    writeFileSync(path, COUNT);
    try {
        const failed = await checked(planted, checks, 1);
        expect(failed.checks.find(({ check }) => check === 'typescript/tsc')).toMatchObject({
            status: 'failed',
            findings: [{ check: 'typescript/tsc', file: 'app/count.ts', rule: 'TS2322', line: 4 }],
        });
        expect(failed.skips.some(({ check, source }) => check === 'nextjs/tsc' && source === 'flag')).toBe(true);
        writeFileSync(path, COUNT.replace('"three"', '3'));
        await checked(planted, checks, 0);
    } finally {
        rmSync(path);
    }
}

// The i18n rules reject literal markup, and the corrected layout passes. A page component of one statement passes
// too, because the React kit lets components be that small.
async function literalMarkup(planted: InstalledRepository): Promise<void> {
    const layout = join(planted.root, 'app/layout.tsx');
    // Text written into the markup is what the i18n rule exists for, and a rule that runs proves its plugin works.
    await Bun.write(layout, NEXT_LAYOUT.replace('<body>{children}</body>', '<body>Welcome{children}</body>'));
    try {
        const literal = await checked(planted, ['javascript/eslint'], 1);
        expect(literal.checks[0]!.findings).toContainEqual(
            containing({ rule: 'i18next/no-literal-string', file: 'app/layout.tsx', line: 13 }),
        );
    } finally {
        await Bun.write(layout, NEXT_LAYOUT);
    }
    const corrected = await checked(planted, ['javascript/eslint'], 0);
    expect(corrected.checks[0]!.findings).toStrictEqual([]);
}

plantedCases(
    'the nextjs kit',
    {
        kits: ['nextjs'],
        without: ['naming', 'spelling', 'css', 'files'],
        // Webpack requires the linked dependencies and the sandbox to share a drive.
        dirname: join(INSTALLED_MODULES, '../..', `gspot-test-${randomUUID()}`),
        files: {
            '.gitignore': 'node_modules\n.next\n',
            'package.json': `${JSON.stringify(MANIFEST, null, 4)}\n`,
            'tsconfig.json': `${JSON.stringify(TSCONFIG, null, 4)}\n`,
            'next.config.mjs': NEXT_CONFIG,
            'app/page.tsx': NEXT_PAGE,
            'app/layout.tsx': NEXT_LAYOUT,
            'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
            'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
        },
    },
    [
        {
            check: 'nextjs/tsc',
            files: { 'app/count.ts': COUNT },
            expected: { file: 'app/count.ts', rule: 'TS2322', line: 4 },
            corrected: { files: { 'app/count.ts': COUNT.replace('"three"', '3') } },
        },
    ],
    (installed) => {
        test(
            'the framework rules reject a disabled requirement',
            () => requiredRules(installed()),
            PLANTED_TIMEOUT_MS * 8,
        );
        test(
            'type checking delegates to the Next.js check only when it runs',
            () => delegation(installed()),
            PLANTED_TIMEOUT_MS * 8,
        );
        test(
            'the TypeScript check finds defects when the Next.js check is skipped',
            () => skippedReplacement(installed()),
            PLANTED_TIMEOUT_MS * 8,
        );
        test('the i18n rules reject literal markup', () => literalMarkup(installed()), PLANTED_TIMEOUT_MS * 8);
    },
);
