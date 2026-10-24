export const RUNTIME_RULE_CASES = [
    { name: 'a Deno script', runtime: 'deno', dependency: undefined, rules: ['DENO.md'] },
    { name: 'a Node.js script', runtime: 'node', dependency: undefined, rules: ['NODE.md'] },
    { name: 'a Node.js script in a React Native package', runtime: 'node', dependency: 'react-native', rules: [] },
    { name: 'a Node.js script in an Expo package', runtime: 'node', dependency: 'expo', rules: [] },
] as const;

export const RULE_INDEX_PATHS = [
    '.gspot/configurations/general/engineering/rules/WORKING.md',
    '.gspot/configurations/general/prose/rules/WRITING.md',
    '.gspot/configurations/general/engineering/rules/TALKING.md',
    '.gspot/configurations/general/commits/rules/GIT.md',
    '.gspot/configurations/general/data-files/rules/YAML.md',
    '.gspot/configurations/general/dependencies/rules/DEPENDENCIES.md',
    '.gspot/configurations/general/docs/rules/DOCS.md',
    '.gspot/configurations/general/engineering/rules/CLI.md',
    '.gspot/configurations/general/engineering/rules/COMMENTS.md',
    '.gspot/configurations/general/engineering/rules/ERRORS.md',
    '.gspot/configurations/general/engineering/rules/PLANNING.md',
    '.gspot/configurations/general/engineering/rules/SETTINGS.md',
    '.gspot/configurations/general/engineering/rules/TASKS.md',
    '.gspot/configurations/general/engineering/rules/TESTING.md',
    '.gspot/configurations/general/gspot/rules/GENERATED.md',
    '.gspot/configurations/general/gspot/rules/SUPPRESSIONS.md',
    '.gspot/configurations/general/secrets/rules/SECRETS.md',
    '.gspot/configurations/general/security/rules/SECURITY.md',
];
