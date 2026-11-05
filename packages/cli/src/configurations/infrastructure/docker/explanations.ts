import { DOCKER_RULES, INSTRUCTION_RULES } from '#cli/config/configurations/infrastructure.ts';
import { SYNTAX_EXPLANATIONS } from '#cli/configurations/explanations.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

export const DOCKERIGNORE_EXPLANATIONS = {
    [DOCKER_RULES.missingFile]: {
        description: 'Each Dockerfile has an ignore file, beside it or in its build context.',
        why: 'Without one, the build sends `.git`, `.env`, and other local files to the builder.',
        fix: 'Add a `.dockerignore` that lists `.git`, `.env`, and the paths that the configurations mark local.',
        example: 'A `Dockerfile` without `.dockerignore` or `Dockerfile.dockerignore` reports `missing-file`.',
    },
    [DOCKER_RULES.missingEntry]: {
        description: 'The ignore file lists `.git`, `.env`, and the local paths of the selected configurations.',
        why: 'A path that the ignore file leaves out can end up in the image.',
        fix: 'List each path that the finding names in the ignore file.',
        example: 'A `.dockerignore` without `.env` reports `missing-entry`.',
    },
    [DOCKER_RULES.ignoredSource]: {
        description: 'No `COPY` names a source that the ignore file excludes.',
        why: 'The builder never receives an excluded path, so the build fails or the image lacks the file.',
        fix: 'Remove the path from the ignore file, or remove it from the `COPY`.',
        example: '`COPY dist/ ./` with `dist` in `.dockerignore` reports `ignored-source`.',
    },
    ...SYNTAX_EXPLANATIONS,
} as const satisfies RuleExplanations;

export const INSTRUCTION_EXPLANATIONS = {
    [INSTRUCTION_RULES.lockfile]: {
        description: 'No `RUN` installs packages in a way that can rewrite the lockfile.',
        why: 'The image then holds other versions than the lockfile records.',
        fix: 'Install with `npm ci`, `pnpm install --frozen-lockfile`, or the locked mode of the package manager.',
        example: '`RUN npm install` reports `lockfile-install`; `RUN npm ci` does not.',
    },
    [INSTRUCTION_RULES.pipedDownload]: {
        description: 'No `RUN` pipes a download into a shell or an interpreter.',
        why: 'Nobody can review a script that runs as it downloads, and a cut-off download runs half a script.',
        fix: 'Fetch a fixed version to a file, compare its checksum, and run the file.',
        example: '`RUN curl -fsSL https://example.com/install.sh | sh` reports `piped-download`.',
    },
    [INSTRUCTION_RULES.nginxTag]: {
        description: 'A `FROM` of nginx pins a full version tag or a digest.',
        why: 'A floating tag such as `nginx:alpine` changes the server on the next build.',
        fix: 'Use a tag with major, minor, and patch versions, or pin the digest.',
        example: '`FROM nginx:1.27-alpine` reports `nginx-tag`; `FROM nginx:1.27.3-alpine` does not.',
    },
    [INSTRUCTION_RULES.shellEntrypoint]: {
        description: 'An `ENTRYPOINT` in exec form starts the program itself, not a shell.',
        why: 'The shell then runs as process 1, and it does not pass the stop signal to the program.',
        fix: 'Name the program as the first element, such as `ENTRYPOINT ["node", "server.js"]`.',
        example: '`ENTRYPOINT ["sh", "-c", "node server.js"]` reports `shell-entrypoint`.',
    },
} as const satisfies RuleExplanations;
