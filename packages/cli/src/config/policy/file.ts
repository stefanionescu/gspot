/** Root values precede every concern table in an authored policy. */
export const POLICY_ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'runner',
    'test_files',
    'exclude',
    'tool_timeout_seconds',
];

/** Concern tables before tool options and authored exceptions. */
export const POLICY_SECTIONS = [
    'scope',
    'hooks',
    'ci',
    'agent_rules',
    'format',
    'limits',
    'naming',
    'architecture',
    'structure',
    'dependencies',
    'docs',
    'licenses',
    'prose',
    'words',
];

/** The final sections keep declarations and custom checks before ignores. */
export const POLICY_TAIL = ['tools', 'reasons', 'generated', 'vendored', 'check', 'ignore'];

/** Native value encoding and concrete syntax tree array layout. */
export const POLICY_EMIT_FORMAT = { updateOrder: true, bracketSpacing: true, trailingComma: false };

/** Document metadata stays before every semantic policy section. */
export const POLICY_PROVENANCE_PREFIXES = ['#:schema ', '# Copied from template '];

/** Native parse diagnostics show the location, source line, and caret. */
export const POLICY_PARSE_CONTEXT_LINES = 3;
