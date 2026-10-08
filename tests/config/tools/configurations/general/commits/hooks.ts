/** Derived scope names retain the case of project folders; messages may omit a scope. */
export const DERIVED_SCOPE_POLICY = '[agent_rules]\nenabled = false\n[scope."Packages/Core"]\nconfigurations = []\n';

/** Native commit messages that expose scope and conventional type ownership. */
export const COMMIT_MESSAGES = [
    { message: 'fix(Core): repair the parser', rule: undefined },
    { message: 'fix: repair the parser', rule: undefined },
    { message: 'style(Core): format source', rule: undefined },
    { message: 'revert(Core): restore source', rule: undefined },
    { message: 'fix(root): repair the parser', rule: 'scope-enum' },
    { message: 'fix(hooks): repair the parser', rule: 'scope-enum' },
    { message: 'fix(deps): repair the parser', rule: 'scope-enum' },
    { message: 'fix(core): repair the parser', rule: 'scope-enum' },
    { message: 'fix(Core): repair the parser.', rule: 'subject-full-stop' },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: undefined },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: 'header-max-length' },
];

/** Native preparation commands shared by the four installed commit scenarios. */
export const COMMITS_SETUP = [
    ['init', '--yes', '--configurations', 'commits', '--no-runner', '--no-ci', '--no-agent-rules', '--no-install'],
    ['set', 'level', 'all'],
    ['install'],
];
