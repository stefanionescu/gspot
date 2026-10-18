/** Runtime guidance keeps Node assumptions out of React Native and Expo applications. */
export const RUNTIME_RULE_CASES = [
    { runtime: 'deno', dependency: undefined, hasNode: false },
    { runtime: 'node', dependency: undefined, hasNode: true },
    { runtime: 'node', dependency: 'react-native', hasNode: false },
    { runtime: 'node', dependency: 'expo', hasNode: false },
] as const;

export const RULE_CONFIGURATIONS = ['typescript', 'css', 'vitest', 'swift', 'bash', 'drizzle', 'openapi'] as const;

/** A scope in app/ with the javascript configuration. */
export const JAVASCRIPT_IN_APP = '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n';
