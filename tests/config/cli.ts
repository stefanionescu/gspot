// The CLI arguments and policies many tests start from.
import { policyOf } from '#tests/harness/cli/policy.ts';

/** The flags that keep init from touching the runner, hooks, CI, agent rules, and tool installation. */
export const QUIET_INIT = ['--no-runner', '--no-hooks', '--no-ci', '--no-rules', '--no-install'];

/** The first line every planted policy starts from. */
export const MINIMAL_POLICY = policyOf(['bash']);
