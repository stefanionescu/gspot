import { policyOf } from '#tests/support/cli/policy/text.ts';
// The literal values integration/cli/lifecycle reads: names, patterns, limits, and tables.

export const PRE_COMMIT_POLICY = policyOf([], '[guides]\ninstall = false\n[hooks]\ntool = "pre-commit"\n');
export const SIMPLE_HOOKS_POLICY = policyOf([], '[guides]\ninstall = false\n[hooks]\ntool = "simple-git-hooks"\n');
