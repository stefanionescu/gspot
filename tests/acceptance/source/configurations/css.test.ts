import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
// Planted repository for the css configuration: an unknown property, a class nobody reads, and a class the code reads that does not exist.
import { reportSchema } from '#cli/execution/report.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { PLANTED_TIMEOUT_MS, run, runProcess } from '#tests/support/cli/command.ts';
import { chmodSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { install, installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--configurations',
    'css',
    '--without',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const SHEET = '.card {\n    color: #333;\n}\n\n.card-title {\n    font-weight: 700;\n}\n';
const CODE = "import styles from './card.module.css';\n\nexport const names = [styles.card, styles.cardTitle];\n";

// A property no browser knows, in two halves because the spelling fixer corrects it when it is whole.
const UNKNOWN_PROPERTY = ['col', 'our'].join('');

test(
    'Stylelint applies nested settings through each generated configuration and editor pointer',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["css"]\n[runner]\ntool = "mise"\n[rules]\ninstall = false\n[tools.stylelint.rules]\ncolor-named = "never"\nselector-max-id = 0\n[[scope]]\npath = "app"\nconfigurations = []\n[scope.tools.stylelint.rules]\ncolor-named = "always-where-possible"\n',
            'package.json': '{"private":true}\n',
            'site.css': 'a {\n    color: red;\n}\n',
            'app/site.css': '#example {\n    color: #f00;\n}\n',
        });
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const command = ['check', '--only', 'css/stylelint', '--no-cache', '--json'];
        const failed = await run(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const failedReport = reportSchema.parse(JSON.parse(failed.stdout));
        expect(failedReport.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'fail' },
            { check: 'css/stylelint', scope: 'app', status: 'fail' },
        ]);
        expect(failedReport.checks.flatMap(({ findings }) => findings)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ file: 'site.css', rule: 'color-named', line: 2 }),
                expect.objectContaining({ file: 'app/site.css', rule: 'color-named', line: 2 }),
                expect.objectContaining({ file: 'app/site.css', rule: 'selector-max-id', line: 1 }),
            ]),
        );
        await Bun.write(join(sandbox.path, 'site.css'), 'a {\n    color: #f00;\n}\n');
        await Bun.write(join(sandbox.path, 'app/site.css'), 'a {\n    color: red;\n}\n');
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toContainEqual(
            expect.objectContaining({ check: 'css/stylelint', status: 'ok', findings: [] }),
        );
        for (const folder of ['', 'app']) {
            const native = await runProcess([join(sandbox.path, '.gspot/node_modules/.bin/stylelint'), 'site.css'], {
                cwd: join(sandbox.path, folder),
            });
            expect(native.code, native.stdout + native.stderr).toBe(0);
        }
    },
    PLANTED_TIMEOUT_MS * 5,
);

test.each([
    { scope: '', inherited: false },
    { scope: '', inherited: true },
    { scope: 'app', inherited: true },
])(
    'Stylelint adoption enforces carried options through private installation and restores original configuration (scope: $scope, inherited: $inherited)',
    async ({ scope, inherited }) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        const configuration = `${prefix}.stylelintrc.json`;
        const parent = '{"rules":{"color-named":"never","color-no-invalid-hex":null,"block-no-empty":null}}\n';
        const original = inherited
            ? '{"extends":"./styles/config.json","rules":{"selector-max-id":0}}\n'
            : '{"rules":{"color-named":"never","selector-max-id":0,"color-no-invalid-hex":null,"block-no-empty":null}}\n';
        const manifest = '{"name":"stylelint-adoption","private":true,"devDependencies":{"stylelint":"16.23.1"}}\n';
        await createFileTree(sandbox.path, {
            '.gitignore': 'node_modules\n',
            'package.json': manifest,
            [configuration]: original,
            [`${prefix}site.css`]: 'a {\n    color: #abc;\n}\n',
            ...(inherited ? { [`${prefix}styles/config.json`]: parent } : {}),
            [`${prefix}empty.css`]: 'a {}\n',
        });
        chmodSync(join(sandbox.path, configuration), 0o640);
        const mode = statSync(join(sandbox.path, configuration)).mode;
        symlinkSync(MODULES, join(sandbox.path, 'node_modules'), 'dir');
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath([]) };
        await install(
            sandbox.path,
            [...INIT.filter((argument) => argument !== '--no-runner'), '--runner', 'mise'],
            environment,
        );
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await Bun.write(join(sandbox.path, prefix, 'future.css'), '#example {\n    color: red;\n}\n');
        const failed = await run(
            sandbox.path,
            ['check', '--only', 'css/stylelint', '--no-cache', '--json'],
            environment,
        );
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const failedReport = reportSchema.parse(JSON.parse(failed.stdout));
        expect(failedReport.checks).toContainEqual(
            expect.objectContaining({ check: 'css/stylelint', scope, status: 'fail' }),
        );
        expect(failedReport.checks.flatMap(({ findings }) => findings)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ rule: 'color-named', file: `${prefix}future.css`, line: 2 }),
                expect.objectContaining({ rule: 'selector-max-id', file: `${prefix}future.css`, line: 1 }),
            ]),
        );
        await Bun.write(join(sandbox.path, prefix, 'future.css'), 'a {\n    color: #abc;\n}\n');
        const corrected = await run(
            sandbox.path,
            ['check', '--only', 'css/stylelint', '--no-cache', '--json'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toContainEqual(
            expect.objectContaining({ check: 'css/stylelint', status: 'ok', findings: [] }),
        );
        const native = await runProcess(
            [join(sandbox.path, '.gspot/node_modules/.bin/stylelint'), 'empty.css', 'future.css'],
            {
                cwd: join(sandbox.path, scope),
            },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        const removed = await run(sandbox.path, ['uninstall', '--yes'], environment);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(readFileSync(join(sandbox.path, configuration), 'utf8')).toBe(original);
        expect(statSync(join(sandbox.path, configuration)).mode).toBe(mode);
        expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe(manifest);
        if (inherited) expect(readFileSync(join(sandbox.path, prefix, 'styles/config.json'), 'utf8')).toBe(parent);
    },
    PLANTED_TIMEOUT_MS * 5,
);

const CASES: FindingCase[] = [
    {
        check: 'css/stylelint',
        files: { 'src/site.css': `a {\n    ${UNKNOWN_PROPERTY}: red;\n}\n` },
        expected: { file: 'src/site.css', rule: 'property-no-unknown', line: 2 },
    },
    {
        check: 'integrity/css-usage',
        files: { 'src/card.module.css': `${SHEET}\n.card-footer {\n    margin: 0;\n}\n` },
        expected: {
            file: 'src/card.module.css',
            rule: 'unused-class',
            line: 1,
            message: 'No importer reads the class card-footer.',
        },
    },
    {
        check: 'integrity/css-usage',
        files: { 'src/card.js': `${CODE}\nexport const extra = styles.cardBadge;\n` },
        expected: {
            file: 'src/card.js',
            rule: 'undefined-class',
            line: 1,
            message: 'card.module.css defines no class cardBadge.',
        },
    },
];

describe('the css configuration', () => {
    test.each(CASES)(
        '$check rejects $expected.rule in $expected.file and accepts corrected source',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': 'node_modules\n',
                'package.json':
                    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module"\n}\n',
                'src/site.css': 'a {\n    color: red;\n}\n',
                'src/card.module.css': SHEET,
                'src/card.js': CODE,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec'])}` };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            {
                const clean = await run(
                    sandbox.path,
                    ['check', '--only', planted.check, '--no-cache', '--json'],
                    environment,
                );
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                const failedReport = reportSchema.parse(
                    await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
                );
                expect(failedReport.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
                expect(failedReport.checks[0]?.findings).toContainEqual(
                    expect.objectContaining({ check: planted.check, ...planted.expected }),
                );
                const corrected = await run(
                    sandbox.path,
                    ['check', '--only', planted.check, '--no-cache', '--json'],
                    environment,
                );
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                    { check: planted.check, status: 'ok', findings: [] },
                ]);
            }
            const selectors = await runPlanted(
                sandbox.path,
                {
                    check: 'integrity/css-usage',
                    files: {
                        'src/card.module.css':
                            '.card\\:active { content: ".unused"; }\n/* .fake {} */\n[data-name=".not-a-class"] .card-title { color: red; }\n',
                        'src/card.js':
                            "import styles from './card.module.css';\nexport const names = [styles['card:active'], styles.cardTitle];\n",
                        'src/panel.module.scss': '// .fake {}\n.panel { $label: ".unused"; color: red; }\n',
                        'src/panel.js':
                            "import styles from './panel.module.scss';\nexport const name = styles.panel;\n",
                    },
                },
                environment,
            );
            expect(selectors.code, selectors.stdout + selectors.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
