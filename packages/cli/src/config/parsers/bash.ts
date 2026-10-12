/** These reads consume or examine the whole positional-argument list. */
export const ALL_POSITIONAL_PARAMETERS = new Set(['@', '*', '#']);

/** These declarations introduce local variables inside Bash functions unless they request global scope. */
export const LOCAL_DECLARATION_WORDS = new Set(['local', 'declare', 'typeset']);

export const EXPANSION_NODES = ['simple_expansion', 'expansion'] as const;
export const POSITIONAL_PARAMETER = /^[1-9]\d*$/u;
export const SHIFT_COMMAND = 'shift';
export const TEMPORARY_VALUE_NODES = ['string', 'command_substitution'] as const;
export const TEMPORARY_FILE_COMMAND = 'mktemp';
export const END_OF_OPTIONS = '--';
export const REMOVE_COMMAND = 'rm';
export const TRAP_COMMAND = 'trap';

export const BASH_BRANCH_NODES = [
    'if_statement',
    'elif_clause',
    'case_item',
    'while_statement',
    'for_statement',
    'c_style_for_statement',
] as const;
export const BASH_COMPOUND_NODES = [
    'if_statement',
    'while_statement',
    'for_statement',
    'c_style_for_statement',
    'case_statement',
] as const;
export const FOR_HEADER_FIELDS = ['initializer', 'condition', 'update'] as const;
