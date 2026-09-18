// What the integrity checks refuse: logic in configuration modules, suppressions without a reason, files above the size limit. Literals only.
import type { SuppressionForm } from '#types/integrity.ts';

/** Top-level statement types a configuration module may hold. */
export const CONFIG_STATEMENTS = [
    'import_statement',
    'export_statement',
    'lexical_declaration',
    'type_alias_declaration',
    'comment',
    'empty_statement',
];

/** Node types that are logic, anywhere in a configuration module. */
export const CONFIG_LOGIC_NODES = [
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
    'arrow_function',
    'class_declaration',
    'if_statement',
    'for_statement',
    'for_in_statement',
    'while_statement',
    'do_statement',
    'switch_statement',
    'try_statement',
    'await_expression',
    'ternary_expression',
];

/** A call is logic unless it is a tagged template (`String.raw` on a pattern) or a constructor of a plain collection. */
export const CONFIG_CALL_ALLOWED = ['Set', 'Map', 'RegExp'];

/** Modules a configuration module may import values from: none but its own roots; type imports are free. */
export const CONFIG_IMPORT_PREFIXES = ['#config/'];

/** The default ceiling on a tracked file, in kilobytes, when the limit is unset. */
export const FILE_SIZE_KB_DEFAULT = 1024;

/** The inline suppression forms per comment style: the directive, how its reason is written, and the rule name. Only the comment part of a line is searched. */
export const COMMENT_OPENERS: Record<string, string[]> = { slash: ['//', '/*'], hash: ['#'] };
export const SUPPRESSION_FORMS: Record<string, SuppressionForm[]> = {
    slash: [
        { form: 'eslint-disable', marker: /\beslint-disable(?:-next-line|-line)?\b/u, reason: / -- \S/u },
        { form: 'ts-expect-error', marker: /@ts-expect-error\b/u, reason: /@ts-expect-error: \S/u },
        { form: 'ts-ignore', marker: /@ts-ignore\b/u, reason: /@ts-ignore: \S/u },
        { form: 'swiftlint-disable', marker: /swiftlint:disable\b/u, reason: / - \S/u },
        { form: 'lint-justify', marker: /\blint:justify\b/u, reason: /reason: \S/u },
        { form: 'gspot-ignore', marker: /gspot-ignore +[a-z0-9-]+\/[a-z0-9-]+/u, reason: / -- \S/u },
        { form: 'nosemgrep', marker: /\bnosemgrep\b/u, reason: /$^/u, isForbidden: true },
    ],
    hash: [
        {
            form: 'shellcheck-disable',
            marker: /shellcheck disable=/u,
            reason: /(?:# ?reason:|lint:justify reason:) \S/u,
        },
        { form: 'noqa', marker: /# ?noqa\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'nosec', marker: /# ?nosec\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'type-ignore', marker: /# ?type: ?ignore\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'pyright-ignore', marker: /# ?pyright: ?ignore\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'no-cover', marker: /# ?pragma: ?no cover\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'gspot-ignore', marker: /gspot-ignore +[a-z0-9-]+\/[a-z0-9-]+/u, reason: / -- \S/u },
        { form: 'nosemgrep', marker: /\bnosemgrep\b/u, reason: /$^/u, isForbidden: true },
    ],
};

/** The tasks each runner surface must hold. */
export const REQUIRED_TASKS: Record<string, string[]> = {
    mise: ['gspot:check', 'gspot:fix', 'gspot:apply', 'gspot:doctor', 'gspot:setup'],
    npm: ['check', 'check:fix', 'apply', 'prepare'],
    bun: ['check', 'check:fix', 'apply', 'prepare'],
    pnpm: ['check', 'check:fix', 'apply', 'prepare'],
};

/** The hook files gspot installs. */
export const HOOK_FILES = ['pre-commit', 'pre-push', 'commit-msg'];
