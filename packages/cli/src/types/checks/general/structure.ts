import type { Node, Tree } from 'web-tree-sitter';
import type { ScopeView } from '#cli/types/policy/settings.ts';
import type { SourceInput } from '#cli/types/parsers/source.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { CountedLanguage } from '#cli/types/parsers/statements.ts';

/** Native captures remain within the shared parsed-source ownership lifetime. */
export type HouseSource = { path: string; language: CountedLanguage; tree: Tree; captures: Map<string, Node[]> };

/** Scope selection retains inventory tags and actual language applicability. */
export type HouseSourceInput = Omit<SourceInput, 'files'> & {
    files: TrackedFile[];
    view: Pick<ScopeView, 'configurations'>;
};

/** Native imported environment identities and lexical shadows, indexed by scope node. */
export type EnvironmentKind = 'os' | 'environ' | 'getenv' | undefined;
export type EnvironmentScope = Map<string, EnvironmentKind>;
export type EnvironmentNames = Map<number, EnvironmentScope>;

/** Declaration visibility and identity from a language's native syntax. */
export type HouseDeclaration = { node: Node; name: string; visibility: string; isDunder: boolean };

export type SuppressionForm = {
    form: string;
    marker: RegExp;
    inlineMarker: RegExp;
    reason: RegExp;
    forbidden: boolean;
};

/** The native comment marker and language-specific file ceiling. */
export type CommentStyle = readonly [language: string, marker: string];
