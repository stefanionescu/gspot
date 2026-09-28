// The literal values integration/cli/lifecycle reads: names, patterns, limits, and tables.

export const PRE_COMMIT_POLICY = 'version = 1\nkits = []\n[guides]\ninstall = false\n[hooks]\ntool = "pre-commit"\n';
export const SIMPLE_HOOKS_POLICY =
    'version = 1\nkits = []\n[guides]\ninstall = false\n[hooks]\ntool = "simple-git-hooks"\n';
