// The literal values integration/tools/hooks reads: names, patterns, limits, and tables.

export const SIMPLE_GIT_HOOKS_POLICY =
    'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "simple-git-hooks"\n';
export const PRE_COMMIT_POLICY =
    'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "pre-commit"\n';
export const VERSIONS = { lefthook: '2.0.13', husky: '9.1.7', 'simple-git-hooks': '2.13.1', 'pre-commit': '4.5.1' };
export const SYSTEM_BASH = '/bin/bash';
