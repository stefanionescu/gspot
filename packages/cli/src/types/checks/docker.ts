import type { ComposeService } from '#cli/types/parsers/docker.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';

/** One ordered Compose invocation, with the final file owned by native output attribution. */
export type ComposeFiles = { last: TrackedFile; before: TrackedFile[] };

/** One authored service declaration retains its service name and finding path. */
export type ComposeDeclaration = { name: string; path: string; service: ComposeService };

/** Parsed service declarations and conservative ignore candidates share one project read. */
export type ComposeDocuments = { declarations: ComposeDeclaration[]; contexts: Map<string, string[]> };
