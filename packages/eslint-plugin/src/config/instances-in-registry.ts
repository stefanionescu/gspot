/** JavaScript value constructors do not imply a shared application service. */
export const VALUE_CONSTRUCTORS = new Set(['Set', 'Map', 'WeakMap', 'WeakSet', 'RegExp', 'URL', 'Date', 'Error']);

/** Registry files accepted by the explicitly selected singleton rule. */
export const REGISTRY_FILES = ['**/registry.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
