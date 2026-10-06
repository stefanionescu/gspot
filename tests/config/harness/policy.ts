/** Turn off agent-rule installation when a fixture exercises another contract. */
export const NO_AGENT_RULES = '[agent_rules]\nenabled = false\n';

/** Explicit native selection and direct package execution. */
export const RUNNER_POLICY = { mise: 'run_with = "mise"\n', none: '' };

/** General coverage applies even when manual language and framework lists are empty. */
export const AUTOMATIC_GENERAL_CONFIGURATIONS = [
    'dependencies',
    'docs',
    'duplication',
    'engineering',
    'files',
    'gspot',
    'naming',
    'prose',
    'secrets',
    'security',
    'spelling',
    'structure',
];
