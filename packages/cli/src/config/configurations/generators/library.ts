export const DRIZZLE_RULES = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'] as const;

export const TESTING_LIBRARY_SCOPE = '@testing-library/';

export const TESTING_LIBRARY_DEFAULT_PRESET = 'dom';

export const TESTING_LIBRARY_PRESETS: readonly string[] = ['angular', 'dom', 'marko', 'react', 'svelte', 'vue'];

export const ZUSTAND_STORE_IMPORTS = [
    { name: 'zustand', importNames: ['create', 'createStore'] },
    { name: 'zustand/vanilla', importNames: ['createStore'] },
] as const;

export const CREATE_STORE_MESSAGE =
    'Create the store inside a factory that a provider owns, not as a module-level store.';
