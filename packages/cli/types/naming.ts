// The naming engine's records.

export type IdentifierCategory =
    | 'files'
    | 'directories'
    | 'types'
    | 'classes'
    | 'functions'
    | 'methods'
    | 'parameters'
    | 'variables'
    | 'constants'
    | 'properties'
    | 'attributes'
    | 'modules'
    | 'packages'
    | 'exceptions'
    | 'routes'
    | 'path_parameters'
    | 'operation_ids'
    | 'enum_cases'
    | 'schemas'
    | 'tables'
    | 'columns'
    | 'indexes'
    | 'triggers'
    | 'policies'
    | 'type_aliases';

export type Identifier = {
    name: string;
    category: IdentifierCategory;
    file: string;
    line: number;
    column: number;
    language: string;
    context?: string;
    declaredType?: string;
    position?: 'loop' | 'lambda' | 'callback' | 'selector' | 'signal';
};

export type NamingGroup = { removable: boolean; terms: string[] };

export type NamingPolicy = {
    version: number;
    matching: { wholeParts: boolean; caseInsensitive: boolean };
    banDigits: boolean;
    banDuplicateWords: boolean;
    groups: Record<string, NamingGroup>;
    reserved: { term: string; allowedFor: string[] }[];
    external: string[];
    languages: Record<string, LanguageNamingTable>;
    rules: PathRule[];
};

export type LanguageNamingTable = {
    maxChars: number;
    maxWords: number;
    acronyms: 'word' | 'initialism' | 'lower';
    categories: Record<string, { case: string[]; maxChars?: number; maxWords?: number }>;
};

export type PathRule = {
    paths: string[];
    languages?: string[];
    categories?: string[];
    names?: string[];
    structuralPrefix?: string;
    allowDigits?: boolean;
    allowDuplicateWords?: boolean;
    exclude?: boolean;
    case?: string[];
    reason?: string;
};
