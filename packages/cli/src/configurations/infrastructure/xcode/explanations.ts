import type { LintRuleDocs } from '#cli/types/tools.ts';
import { SYNTAX_RULE_DOCS } from '#cli/configurations/explanations.ts';
import { XCODE_RULES } from '#cli/config/configurations/infrastructure.ts';

export const ASSET_RULE_DOCS = {
    [XCODE_RULES.emptySet]: {
        description: 'Each image set names at least one image file.',
        why: 'An empty set builds an asset that shows nothing.',
        fix: 'Add the image files to the set, or delete the set.',
        example: 'A `Logo.imageset/Contents.json` whose `images` entries have no `filename` reports `empty-set`.',
    },
    [XCODE_RULES.missingImage]: {
        description: 'Each image file that a set names exists in the set folder.',
        why: 'The app ships without that image, so the asset shows nothing at that size.',
        fix: 'Add the file to the set folder, or remove its entry from `Contents.json`.',
        example: 'A `Contents.json` that names `logo@2x.png` beside no such file reports `missing-image`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const BUILD_SETTING_RULE_DOCS = {
    [XCODE_RULES.strictConcurrency]: {
        description: 'Each target sets `SWIFT_STRICT_CONCURRENCY = complete` or builds with Swift 6.',
        why: 'Without it, the compiler lets data races through.',
        fix: 'Set `SWIFT_STRICT_CONCURRENCY = complete`, or move the target to Swift 6.',
        example: 'A target with `SWIFT_STRICT_CONCURRENCY = minimal` reports `strict-concurrency`.',
    },
    [XCODE_RULES.undeclaredScript]: {
        description: 'Each run-script phase declares its input or output files.',
        why: 'Without them, Xcode runs the script on every build and cannot order it with the other steps.',
        fix: 'List the files that the script reads and writes in the phase.',
        example: 'A run-script phase with empty input and output file lists reports `undeclared-script`.',
    },
    [XCODE_RULES.lintScript]: {
        description: 'No run-script phase runs SwiftLint or SwiftFormat.',
        why: 'gspot runs them at commit, so a build phase runs them twice and slows each build.',
        fix: 'Remove the lint step from the build phase.',
        example: 'A run-script phase that calls `swiftlint` reports `lint-script`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const XCSTRINGS_RULE_DOCS = {
    [XCODE_RULES.missingTranslation]: {
        description: 'Each string of a catalog has a translation for each locale that the catalog uses.',
        why: 'A string without a translation shows the source language to the users of that locale.',
        fix: 'Translate the string, or set `shouldTranslate` to false for it.',
        example:
            'A string with `de` and `fr` translations in a catalog that also uses `es` reports `missing-translation`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
