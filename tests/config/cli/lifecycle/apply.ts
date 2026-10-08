/** External inputs are refused at their own policy or private-file boundary. */
export const EXTERNAL_INPUT_CASES = [
    {
        path: 'gspot.toml',
        outside: 'configurations = []\n',
        files: {},
        diagnostic: 'Source link leaves the repository',
    },
    {
        path: '.gspot/version',
        outside: '0.0.1\n',
        files: { 'project/gspot.toml': 'configurations = []\n' },
        diagnostic: 'private regular file',
    },
];
