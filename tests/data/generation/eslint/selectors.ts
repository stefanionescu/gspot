const RESPONSE_MESSAGES = 'response.json({ message: `Item ${identifier}` });\ncustom.info(`Item ${identifier}`);\n';

const ALIAS_IMPORT = 'import value from "#owner";\n';

const SCOPE_CONFIGURATIONS = ['javascript', 'react'] as const;

export { ALIAS_IMPORT, RESPONSE_MESSAGES, SCOPE_CONFIGURATIONS };
