import type { RuleExplanations } from '#cli/types/tools.ts';
import { TRIVIAL_FUNCTION_RULES, IMPORT_RULE_CHECK_RULES } from '#cli/config/configurations/structure.ts';

export const IMPORT_EXPLANATIONS = {
    [IMPORT_RULE_CHECK_RULES.refusedImport]: {
        description:
            'A Python or Swift file imports only from its own import rule and from those that `can_import` lists, or every rule above it when the rule has no `can_import`. A Swift file also names only the types of those rules, because files of one target use each other with no `import`.',
        why: 'An import or a type from a higher layer breaks the order that the import rules describe.',
        fix: 'Move the code into a layer that the file may import, or move the importing code up a layer.',
        example:
            'A file of the `system` rule that imports a module of the `engine` rule reports `refused-import`, and so does a Swift file of the `system` rule that names a type from a file of the `engine` rule.',
    },
    [IMPORT_RULE_CHECK_RULES.uncoveredFile]: {
        description: 'Each code file matches the `paths` of an `[[import_rule]]` record.',
        why: 'A file outside every import rule may import anything, so its imports escape the layers.',
        fix: 'Extend the `paths` of the import rule that the file belongs to.',
        example: 'A new `scripts/seed.ts` that no `paths` entry matches reports `uncovered-file`.',
    },
} as const satisfies RuleExplanations;

export const TRIVIAL_FUNCTION_EXPLANATIONS = {
    [TRIVIAL_FUNCTION_RULES.trivialFunction]: {
        description:
            'A named function has `limits.<language>.trivial_function_statements` statements or fewer, and one place in the scope calls it at most.',
        why: 'A function of one or two statements adds a name to read and hides the code that it calls.',
        fix: 'Move the body into its caller, and delete the function. When a framework calls it by name, ignore the finding.',
        example: 'A Python `def full_name(user): return user.name` that one line calls reports `trivial-function`.',
    },
    [TRIVIAL_FUNCTION_RULES.trivialFile]: {
        description: 'A file holds only imports, re-exports, and aliases, and no code of its own.',
        why: 'A file that only forwards code adds a step between the caller and the code.',
        fix: 'Point each import at the module that defines the code, then delete the file.',
        example: 'A Python `shop/models.py` that holds only `from .cart import Cart` reports `trivial-file`.',
    },
} as const satisfies RuleExplanations;
