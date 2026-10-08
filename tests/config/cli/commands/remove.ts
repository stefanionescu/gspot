/** Markdown remains applicable after either scope mutation; both commands apply outputs without acquiring tools. */
export const INSTALLATION_MUTATIONS = [
    {
        name: 'add',
        argv: ['add', 'bash', '--scope', 'api'],
        policy: 'configurations = ["markdown"]\n[agent_rules]\nenabled = false\n[scope."api"]\nconfigurations = []\n',
        configurations: ['bash'],
    },
    {
        name: 'remove',
        argv: ['remove', 'bash', '--scope', 'api'],
        policy: 'configurations = ["markdown"]\n[agent_rules]\nenabled = false\n[scope."api"]\nconfigurations = ["bash"]\n',
        configurations: [],
    },
];
