export const POLICY =
    'configurations = ["markdown", "structure"]\n[agent_rules]\nenabled = false\n[scope."api"]\nconfigurations = ["bash"]\n';

/** Mutually exclusive setting operations are refused before policy input is read. */
export const SET_ARGUMENT_CONFLICTS = [
    {
        name: 'replacement with removal',
        argv: ['set', 'naming.banned', 'dispatcher', '--replace', '--remove'],
        message: "option '--replace' cannot be used with option '--remove'",
    },
    {
        name: 'removal with replacement',
        argv: ['set', 'naming.banned', 'dispatcher', '--remove', '--replace'],
        message: "option '--replace' cannot be used with option '--remove'",
    },
    {
        name: 'default with replacement',
        argv: ['set', 'naming.banned', '--default', '--replace'],
        message: "option '--default' cannot be used with option '--replace'",
    },
    {
        name: 'replacement with default',
        argv: ['set', 'naming.banned', '--replace', '--default'],
        message: "option '--default' cannot be used with option '--replace'",
    },
    {
        name: 'default with removal',
        argv: ['set', 'naming.banned', '--default', '--remove'],
        message: "option '--default' cannot be used with option '--remove'",
    },
    {
        name: 'removal with default',
        argv: ['set', 'naming.banned', '--remove', '--default'],
        message: "option '--default' cannot be used with option '--remove'",
    },
    {
        name: 'default with a setting value',
        argv: ['set', 'level', 'all', '--default'],
        message: '--default cannot be used with setting values.',
    },
    {
        name: 'default with an empty setting value',
        argv: ['set', 'level', '', '--default'],
        message: '--default cannot be used with setting values.',
    },
];

/** Conflicts preserve valid authored settings and precede invalid policy parsing. */
export const SET_CONFLICT_POLICIES = [
    { name: 'invalid policy input', policy: 'malformed = [' },
    {
        name: 'valid authored settings',
        policy: 'level = "all"\nconfigurations = ["naming"]\n[naming]\nbanned = ["dispatcher"]\n[agent_rules]\nenabled = false\n',
    },
];
