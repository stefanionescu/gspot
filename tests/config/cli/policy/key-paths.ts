/** Authored semantic and schema failures retain their exact key locations and corrections. */
export const SEMANTIC_KEY_PATH_CASES = [
    {
        name: 'a scoped disabled rule',
        text: '[scope."api"]\n[scope."api".tools.eslint.rules]\n"no-console" = "off"\n',
        where: 'scope.api.tools.eslint.rules.no-console',
        before: '"off"',
        after: '[]',
    },
];

export const SCHEMA_KEY_PATH_CASES = [
    {
        name: 'a multiline array value',
        text: 'configurations = [\n"bash",\n12\n]\n',
        where: ['configurations.1'],
        messages: [],
        correction: ['12', '"files"'],
    },
    {
        name: 'a quoted key',
        text: '[hooks]\n"enabled" = "wrong"\n',
        where: ['hooks.enabled'],
        messages: ['expected boolean, received string'],
        correction: ['"wrong"', 'true'],
    },
    {
        name: 'an inline table value',
        text: 'coverage = { lines = "wrong" }\n',
        where: ['coverage.lines'],
        messages: [],
        correction: ['"wrong"', '90'],
    },
    {
        name: 'a repeated scope table',
        text: '[scope."api"]\n[scope."web"]\n[scope."web".coverage]\nlines = "wrong"\n',
        where: ['scope.web.coverage.lines'],
        messages: [],
        correction: ['"wrong"', '90'],
    },
    {
        name: 'a nested array of tables under a second scope',
        text: '[scope."api"]\n[[scope."api".tools.eslint.overrides]]\npaths = ["src"]\nrules = {eqeqeq = ["always"]}\n[scope."web"]\n[[scope."web".tools.eslint.overrides]]\npaths = []\nrules = {eqeqeq = ["always"]}\n',
        where: ['scope.web.tools.eslint.overrides.0.paths'],
        messages: [],
        correction: ['paths = []', 'paths = ["src"]'],
    },
] as const;
