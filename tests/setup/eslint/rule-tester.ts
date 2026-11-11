import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as parser from '@typescript-eslint/parser';
import { RuleTester, type RuleTesterConfig } from '@typescript-eslint/rule-tester';

import {
    RULE_TESTER_PARSER_OPTIONS,
    RULE_TESTER_ROOT,
    TYPED_RULE_FILES,
    TYPED_RULE_FOLDER_PREFIX,
    TYPED_RULE_TSCONFIG,
} from '#tests/config/setup/sandboxes.ts';
import { TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';

/**
Build a RuleTester that parses TypeScript and JSX. The parser reads its source type only from the parser options, where
the RuleTester writes `module` unless they name one, so the run's own `sourceType` is copied into them.
*/
export function buildRuleTester({
    root = RULE_TESTER_ROOT,
    languageOptions = {},
}: { root?: string; languageOptions?: RuleTesterConfig['languageOptions'] } = {}): RuleTester {
    const { sourceType = RULE_TESTER_PARSER_OPTIONS.sourceType } = languageOptions;
    return new RuleTester({
        languageOptions: {
            ...languageOptions,
            parser,
            parserOptions: {
                ...RULE_TESTER_PARSER_OPTIONS,
                sourceType,
                ...languageOptions.parserOptions,
            },
        },
        settings: { gspot: { root } },
    });
}

export function buildTypedRuleTester(): RuleTester {
    const root = mkdtempSync(join(tmpdir(), TYPED_RULE_FOLDER_PREFIX));
    writeFileSync(join(root, 'tsconfig.json'), TYPED_RULE_TSCONFIG);
    for (const file of TYPED_RULE_FILES) writeFileSync(join(root, file), '');
    return buildRuleTester({
        root,
        languageOptions: { parserOptions: { project: './tsconfig.json', tsconfigRootDir: root } },
    });
}

export function writePackageFolders(manifests: Record<string, Record<string, unknown>>): string {
    const root = mkdtempSync(join(TEST_RUN_FOLDER, 'rule-tester-'));
    for (const [folder, manifest] of Object.entries(manifests)) {
        mkdirSync(join(root, folder), { recursive: true });
        writeFileSync(join(root, folder, 'package.json'), JSON.stringify(manifest));
    }
    return root;
}
