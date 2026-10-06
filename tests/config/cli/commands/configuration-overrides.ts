/** Authored root and scope choices whose source languages are not detected. */
export const AUTHORED_OVERRIDES = `configurations = ["css", "react"]
[agent_rules]
enabled = false
[[scope]]
path = "api"
configurations = ["python"]
`;

/** Minimal script sources for detection changes. */
export const SCRIPT_SOURCE = 'echo example\n';

/** Root and scope initialization overrides with literal authored source fixtures. */
export const INITIAL_OVERRIDES = [
    {
        name: 'root',
        source: 'run.sh',
        files: { 'run.sh': SCRIPT_SOURCE },
        argv: ['--configurations', 'bash'],
        scope: '',
    },
    {
        name: 'scope',
        source: 'api/run.sh',
        files: { 'api/run.sh': SCRIPT_SOURCE },
        argv: ['--scope-configurations', 'api=bash'],
        scope: 'api',
    },
];

/** Named language choices also remain explicit in a template that detects other configurations. */
export const DETECT_TEMPLATE = 'template = "example"\nselection = "detect"\nconfigurations = ["bash"]\n';

/** An authored shell scope without an earlier private selection history. */
export const AUTHORED_SCRIPT_SCOPE = `configurations = []
[agent_rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;
