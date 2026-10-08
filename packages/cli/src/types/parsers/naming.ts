import type { z } from 'zod';
import type { shippedNamingSchema, namingOverrideSchema } from '#cli/parsers/schema/naming.ts';

/** The validated built-in naming policy. */
export type NamingTerms = z.infer<typeof shippedNamingSchema>;

/** One language's table in the shipped policy. */
export type NamingLanguage = NamingTerms['languages'][string];

/** One path-specific naming rule in policy or shipped configuration data. */
export type NamingOverride = z.infer<typeof namingOverrideSchema>;

/** One identifier an extractor found. */
export type Identifier = {
    file: string;
    line: number;
    column: number;
    language: string;
    category: string;
    /** The label a finding prints, such as `typescript function`. */
    kind: string;
    name: string;
    /** For a directory name: the directory path, so a path rule can match it. */
    directory?: string;
};

/** A declaration before its shared file, language, and display label are attached. */
export type IdentifierDeclaration = Omit<Identifier, 'file' | 'language' | 'kind'>;

/** One name a statement declares, with its naming category. */
export type SqlNamed = { category: string; name: string };

/** Where an extractor puts what it finds. */
export type ExtractSink = { file: string; language: string; out: Identifier[] };
