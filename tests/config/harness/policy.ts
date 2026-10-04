/** Turn off agent-rule installation when a fixture exercises another contract. */
export const NO_AGENT_RULES = '[agent_rules]\nenabled = false\n';

/** Explicit native selection and direct package execution. */
export const RUNNER_POLICY = { mise: 'run_with = "mise"\n', none: '' };
