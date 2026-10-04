// Repository project declarations share validation before inventory and native configuration readers use them.
import { z } from 'zod';

export const workspacePatternsSchema = z
    .object({ packages: z.array(z.string()).default(['packages/*']) })
    .transform((value) => value.packages);

export const rushProjectsSchema = z
    .object({ projects: z.array(z.object({ projectFolder: z.string() })) })
    .transform((value) => value.projects.map((project) => project.projectFolder));
