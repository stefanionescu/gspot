import type { LintRuleDocs } from '#cli/types/tools.ts';
import { RULES as NAMING_RULES } from '#cli/config/configurations/naming.ts';
import { SYNTAX_RULE_DOCS } from '#cli/config/configurations/rule-docs/general.ts';
import { TRIVIAL_FUNCTION_RULES, IMPORT_RULE_CHECK_RULES } from '#cli/config/configurations/structure.ts';

export const NAMING_RULE_DOCS = {
    [NAMING_RULES.case]: {
        description: 'A name uses a case that `naming.<language>.<category>.cases` lists.',
        why: 'One case for each kind of name tells a reader what kind of thing the name is.',
        fix: 'Rename it in a listed case.',
        example: 'A TypeScript file `User_Profile.ts` reports `case`; `user-profile.ts` does not.',
    },
    [NAMING_RULES.digits]: {
        description: 'A name holds no digit as a word.',
        why: 'A digit, as in `summary2`, says nothing about how the two values differ.',
        fix: 'Name the difference, or set `allow_digits` in a `[[naming.override]]` record with a reason.',
        example: '`summary2` reports `digits`; `weeklySummary` does not.',
    },
    [NAMING_RULES.length]: {
        description: 'A name has at most `naming.<language>.max_characters` characters.',
        why: 'A long name is hard to read at each place that uses it.',
        fix: 'Shorten the name, or raise the limit with a reason.',
        example: 'A 40-character TypeScript name, over the default of 35, reports `length`.',
    },
    [NAMING_RULES.words]: {
        description: 'A name has at most `naming.<language>.max_words` words.',
        why: 'A name with many words often joins two concepts.',
        fix: 'Split the code, or name the one concept that it holds.',
        example: '`readUserProfileImageCache` has 5 words, over the TypeScript default of 4, so it reports `words`.',
    },
    [NAMING_RULES.duplicateWords]: {
        description: 'A name repeats no word.',
        why: 'A repeated word, as in `orderOrderLines`, adds no meaning.',
        fix: 'Remove the repeated word, or set `allow_repeated_words` in a `[[naming.override]]` record.',
        example: '`orderOrderLines` reports `duplicate-words`; `orderLines` does not.',
    },
    [NAMING_RULES.bannedWord]: {
        description: 'A name holds no word that `naming.banned_words` or the shipped word lists ban.',
        why: 'A word such as `manager` or `helper` hides what the code holds or does.',
        fix: 'Choose a word that names the role, or keep the name through `allowed_names` in a `[[naming.override]]` record.',
        example: '`sessionManager` reports `banned-word`; `sessionStore` does not.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const IDENTIFIER_RULE_DOCS = {
    ...NAMING_RULE_DOCS,
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const IMPORT_RULE_DOCS = {
    [IMPORT_RULE_CHECK_RULES.refusedImport]: {
        description:
            'A Python or Swift file imports only from the import rules that its own rule lists in `can_import`.',
        why: 'An import from a higher layer breaks the order that the import rules describe.',
        fix: 'Move the code into a layer that the file may import, or move the importing code up a layer.',
        example: 'A file of the `system` rule that imports a module of the `engine` rule reports `refused-import`.',
    },
    [IMPORT_RULE_CHECK_RULES.uncoveredFile]: {
        description: 'Each code file matches the `paths` of an `[[import_rule]]` record.',
        why: 'A file outside every import rule may import anything, so its imports escape the layers.',
        fix: 'Extend the `paths` of the import rule that the file belongs to.',
        example: 'A new `scripts/seed.ts` that no `paths` entry matches reports `uncovered-file`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const TRIVIAL_FUNCTION_RULE_DOCS = {
    [TRIVIAL_FUNCTION_RULES.trivialFunction]: {
        description: 'A named function has more statements than `limits.<language>.min_function_statements`.',
        why: 'A function of one or two statements adds a name to read and hides the code that it calls.',
        fix: 'Move the body into each caller, and delete the function. When a framework calls it by name, ignore the finding.',
        example: '`function getName(user) { return user.name; }` reports `trivial-function`.',
    },
    [TRIVIAL_FUNCTION_RULES.trivialFile]: {
        description: 'A file holds code of its own, not only imports and re-exports.',
        why: 'A file that only forwards code adds a step between the caller and the code.',
        fix: 'Point each import at the module that defines the code, then delete the file.',
        example: 'A `user/index.ts` that holds only `export * from "./user.ts";` reports `trivial-file`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
