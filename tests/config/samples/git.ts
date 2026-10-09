/** Authored source and conflicting working-tree bytes used by native and command push selection. */
export const PUSH_CONTENT = {
    base: 'echo base\n',
    reviewed: 'echo reviewed\n',
    broken: 'if then\n',
    working: 'echo repaired only in the working tree\n',
    policy: 'invalid working policy',
};

/** Repository context and a nested policy's committed source for entry and push selection. */
export const NESTED_POLICY_FILES = {
    'outside.txt': 'repository context',
    'nested policy/source.txt': 'committed',
};
