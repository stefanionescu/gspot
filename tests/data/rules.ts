/** Runtime guidance keeps Node assumptions out of React Native and Expo applications. */
export const RUNTIME_RULE_CASES = [
    { runtime: 'deno', dependency: undefined, hasNode: false },
    { runtime: 'node', dependency: undefined, hasNode: true },
    { runtime: 'node', dependency: 'react-native', hasNode: false },
    { runtime: 'node', dependency: 'expo', hasNode: false },
] as const;

export const DRIZZLE_DRIVERS = [
    { driver: 'pg', postgres: true },
    { driver: 'mysql2', postgres: false },
] as const;

export const RULE_CONFIGURATIONS = ['typescript', 'css', 'vitest', 'swift', 'bash', 'drizzle', 'openapi'] as const;

/** The `CLAUDE.md` block that gspot 0.2.0 and 0.2.1 wrote. */
export const EARLIER_CLAUDE_BLOCK = '<!-- >>> gspot managed >>> -->\n\n@AGENTS.md\n\n<!-- <<< gspot managed <<< -->\n';

/** Your own `CLAUDE.md` text after that block. */
export const OWN_CLAUDE_TEXT = '# Your instructions\n\nKeep this text.\n';

/** A scope in app/ with the javascript configuration. */
export const JAVASCRIPT_IN_APP = '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n';
