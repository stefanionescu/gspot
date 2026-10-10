import { z } from 'zod';
import semver from 'semver';

// npm declares ESLint compatibility here. Other registries need a release document.
export const releaseDocumentSchema = z.object({
    peerDependencies: z.record(z.string(), z.string()).optional(),
});

/** A stable GitHub release tag usable for the declared semantic version comparison. */
export const githubReleaseSchema = z.object({ tag_name: z.string() }).transform(({ tag_name: tag }, context) => {
    const version = semver.coerce(tag, { includePrerelease: true })?.version;
    if (version === undefined) {
        context.addIssue({ code: 'custom', path: ['tag_name'], message: 'Release tag has no semantic version.' });
        return z.NEVER;
    }
    return { tag_name: tag, version };
});

export const githubCommitSchema = z.object({ sha: z.string().min(1) });

export const githubReadmeSchema = z.object({ content: z.string(), encoding: z.literal('base64') });

export const nodeReleasesSchema = z
    .array(
        z.object({
            version: z.string().refine((version) => semver.valid(version) !== null),
            lts: z.union([z.string(), z.literal(false)]),
        }),
    )
    .refine((releases) => releases.some((release) => release.lts !== false));
