import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as parser from '@typescript-eslint/parser';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { RuleTester, type RuleTesterConfig } from '@typescript-eslint/rule-tester';

import {
    TYPED_RULE_FILES,
    RULE_TESTER_ROOT,
    TYPED_RULE_TSCONFIG,
    TYPED_RULE_FOLDER_PREFIX,
    RULE_TESTER_PARSER_OPTIONS,
} from '#tests/config/setup/eslint.ts';

/**
A rule tester using the TypeScript parser and a fixed repository root.

@param options the repository root and language options for the cases.
@param options.root the folder the rules resolve paths against.
@param options.languageOptions the parser and runtime settings for the cases.
@returns a tester that runs the ESLint plugin rules.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Rule tests share the parser and runtime options through it.
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
