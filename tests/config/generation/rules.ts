export const RUNTIME_RULE_CASES = [
    { name: 'a Deno script', runtime: 'deno', dependency: undefined, rules: ['DENO.md'] },
    { name: 'a Node.js script', runtime: 'node', dependency: undefined, rules: ['NODE.md'] },
    { name: 'a Node.js script in a React Native package', runtime: 'node', dependency: 'react-native', rules: [] },
    { name: 'a Node.js script in an Expo package', runtime: 'node', dependency: 'expo', rules: [] },
] as const;

export const COMMANDS_HEADING = '## Commands';
