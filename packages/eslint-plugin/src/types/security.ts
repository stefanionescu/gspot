import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type ClearTextListener = {
    kind: 'call' | 'construct';
    position: number;
    protocols: readonly string[];
    omission: { path: readonly string[]; required: boolean; invalid?: readonly unknown[] };
};

export type ClearTextReport = TSESLint.ReportDescriptor<
    'clearText' | 'transitEncryption' | 'streamEncryption' | 'noTls'
>;

export type MethodCall = { call: TSESTree.CallExpression; method: string | null };

export type EscapingSetting = { argument: number; property: string; value: boolean };

export type UploadForm = { node: TSESTree.Node; hasFolder: boolean; keepsExtensions: boolean };

export type SizedForm = { node: TSESTree.Node; size: number };

export type ClientEnvironmentOptions = [
    { client: boolean; publicPrefixes: readonly string[]; allowedNames: readonly string[] },
];

export type ScriptSettings = { sources: number; isVersioned: boolean; hasIntegrity: boolean; isAnonymous: boolean };

export type IntegrityMessage = 'missingBoth' | 'missingIntegrity' | 'missingCrossOrigin';
