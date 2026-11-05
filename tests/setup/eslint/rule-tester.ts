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
A rule tester using the TypeScript parser and a fixed repository root.

@param options the repository root and language options for the cases.
@param options.root the folder the rules resolve paths against.
@param options.languageOptions the parser and runtime settings for the cases.
*/
export function buildRuleTester({
    root = RULE_TESTER_ROOT,
    languageOptions = {},
}: { root?: string; languageOptions?: RuleTesterConfig['languageOptions'] } = {}): RuleTester {
    return new RuleTester({
        languageOptions: {
            ...languageOptions,
            parser,
            parserOptions: {
                ...RULE_TESTER_PARSER_OPTIONS,
                ...languageOptions.parserOptions,
            },
        },
        settings: { gspot: { root } },
    });
}

/**
A rule tester whose cases get TypeScript types from a strict project in a temporary folder.

@returns a tester for rules that read types. Each case lints a file of that project.
*/
export function buildTypedRuleTester(): RuleTester {
    const root = mkdtempSync(join(tmpdir(), TYPED_RULE_FOLDER_PREFIX));
    writeFileSync(join(root, 'tsconfig.json'), TYPED_RULE_TSCONFIG);
    for (const file of TYPED_RULE_FILES) writeFileSync(join(root, file), '');
    return buildRuleTester({
        root,
        languageOptions: { parserOptions: { project: './tsconfig.json', tsconfigRootDir: root } },
    });
}

/**
Write package.json files into a new folder of the test run, for the rules that read the dependencies of a project.

@param manifests the package.json content of each folder, by its path in the new folder.
*/
export function writePackageFolders(manifests: Record<string, Record<string, unknown>>): string {
    const root = mkdtempSync(join(TEST_RUN_FOLDER, 'rule-tester-'));
    for (const [folder, manifest] of Object.entries(manifests)) {
        mkdirSync(join(root, folder), { recursive: true });
        writeFileSync(join(root, folder, 'package.json'), JSON.stringify(manifest));
    }
    return root;
}
