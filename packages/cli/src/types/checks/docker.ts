import type { TrackedFile } from '#cli/types/repository/inventory.ts';

/** One authored service declaration: its service name and finding path. */
type ComposeDeclaration = { name: string; path: string; service: ComposeService };

/** One ordered Compose invocation, with the final file owned by output attribution. */
export type ComposeFiles = { last: TrackedFile; before: TrackedFile[] };

/** Parsed service declarations and conservative ignore candidates share one project read. */
export type ComposeDocuments = { declarations: ComposeDeclaration[]; contexts: Map<string, string[]> };

/** One validated service consumed by build-context and image checks. */
export type ComposeService = {
    image?: string | undefined;
    build?:
        | { context: string; dockerfile: undefined }
        | { context?: string | undefined; dockerfile?: string | undefined }
        | undefined;
};
