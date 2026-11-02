import type { TSESTree } from '@typescript-eslint/utils';

export type ImportBoundariesOptions = [
    { folders: readonly string[]; aliases: Record<string, string>; externals: readonly string[] },
];

export type RelativeImport = { target: string; query: string };

export type RenamedValue = { node: TSESTree.Node; name: string; source: string };

export type RestrictedSyntaxOptions = ReadonlyArray<{
    selector: string;
    message: string;
    files?: readonly string[];
    ignores?: readonly string[];
}>;

export type TrivialFilesOptions = [
    { reexports: 'none' | 'index-only'; indexExports: number; forwardingFiles: readonly string[] },
];

export type ImportBlock = { first: TSESTree.Statement; last: TSESTree.Statement };

export type CommentGroup = { first: TSESTree.Comment; last: TSESTree.Comment; comments: TSESTree.Comment[] };
