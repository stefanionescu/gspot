export const ZUSTAND_STORE_IMPORTS = [
    { name: 'zustand', importNames: ['create', 'createStore'] },
    { name: 'zustand/vanilla', importNames: ['createStore'] },
] as const;

export const CREATE_STORE_MESSAGE =
    'Create the store inside a factory that a provider owns, not as a module-level store.';
