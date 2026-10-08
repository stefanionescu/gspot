/** Turn off agent-rule installation when a sandbox exercises another contract. */
export const NO_AGENT_RULES = '[agent_rules]\nenabled = false\n';

/** Explicit native selection and direct package execution. */
export const RUNNER_POLICY = { mise: 'runner = "mise"\n', none: '' };
