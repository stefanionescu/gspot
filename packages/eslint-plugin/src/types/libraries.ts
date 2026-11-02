import type { TSESTree } from '@typescript-eslint/utils';

export type PackageFacts = { dependencies: ReadonlyMap<string, string>; manifests: number };

export type VersionCeiling = { version: number[]; isInclusive: boolean };

export type Isolation = 'deep' | 'shallow' | 'written';

export type LibraryCall = { method: string; library: string };

export type NativeReplacement = {
    alternative: string;
    year: number;
    reason?: string | undefined;
    example?: string | undefined;
};

export type StateHook = {
    call: TSESTree.CallExpression;
    value: TSESTree.Identifier;
    setter: TSESTree.Identifier;
    name: TSESTree.Node;
};
