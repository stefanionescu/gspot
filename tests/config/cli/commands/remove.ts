/** Markdown remains applicable after either scope mutation, so both commands must acquire npm tools. */
export const INSTALLATION_MUTATIONS = [
    {
        name: 'add',
        argv: ['add', 'bash', '--scope', 'api'],
        policy: 'configurations = ["markdown"]\n[agent_rules]\nenabled = false\n[[scope]]\npath = "api"\nconfigurations = []\n',
        configurations: ['bash'],
    },
    {
        name: 'remove',
        argv: ['remove', 'bash', '--scope', 'api'],
        policy: 'configurations = ["markdown"]\n[agent_rules]\nenabled = false\n[[scope]]\npath = "api"\nconfigurations = ["bash"]\n',
        configurations: [],
    },
];
