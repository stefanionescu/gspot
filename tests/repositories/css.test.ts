import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
// Planted repository for the css preset: an unknown property, a class nobody reads, and a class the code reads that does not exist.
import { delimiter, join } from 'node:path';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'css',
    '--without',
    'spelling',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const SHEET = '.card {\n    color: #333;\n}\n\n.card-title {\n    font-weight: 700;\n}\n';
const CODE = "import styles from './card.module.css';\n\nexport const names = [styles.card, styles.cardTitle];\n";

// A property no browser knows, in two halves because the spelling fixer corrects it when it is whole.
const UNKNOWN_PROPERTY = ['col', 'our'].join('');

const CASES: PlantedCase[] = [
    {
        check: 'css/stylelint',
        files: { 'src/site.css': `a {\n    ${UNKNOWN_PROPERTY}: red;\n}\n` },
        expected: 'property-no-unknown',
    },
    {
        check: 'integrity/css-usage',
        files: { 'src/card.module.css': `${SHEET}\n.card-footer {\n    margin: 0;\n}\n` },
        expected: 'No importer reads the class card-footer',
    },
    {
        check: 'integrity/css-usage',
        files: { 'src/card.js': `${CODE}\nexport const extra = styles.cardBadge;\n` },
        expected: 'card.module.css defines no class cardBadge',
    },
];

describe('the css preset', () => {
    test(
        'stylelint and the CSS module check fire on their planted defects',
        async () => {
            await using fixture = await createFixture({
                '.gitignore': 'node_modules\n',
                'package.json':
                    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module"\n}\n',
                'src/site.css': 'a {\n    color: red;\n}\n',
                'src/card.module.css': SHEET,
                'src/card.js': CODE,
            });
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec'])}` };
            await install(fixture.path, INIT, environment);
            for (const planted of CASES) {
                const clean = await run(fixture.path, ['check', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
