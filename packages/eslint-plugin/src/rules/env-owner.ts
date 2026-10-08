import { lintedPath, isAnyGlobMatch } from '#plugin/public.ts';
import { createRule, optionsSchema } from '#plugin/create-rule.ts';
import type { EnvOwnerOptions } from '#plugin/types/environment.ts';
import { ENVIRONMENT_ALLOWED } from '#plugin/config/environment.ts';
import { environmentNames, environmentReads } from '#plugin/environment.ts';

export const envOwner = createRule<EnvOwnerOptions, 'owner'>({
    name: 'env-owner',
    meta: {
        defaultOptions: [{ owners: [], allowed: ENVIRONMENT_ALLOWED }],
        type: 'suggestion',
        docs: {
            requiresOptions: true,
            level: 'all',
            title: 'Environment access owner',
            example:
                'With `owners: ["src/env/**"]`, `const port = process.env.PORT;` in `src/turn/build.ts` reports an owner finding. Move the environment read to `src/env/index.ts` and pass the value to the build function.',
            description:
                'Finds an environment variable read outside the owners the options name. With no owners, it reports nothing.',
            why: 'When any file reads the environment, nobody can list what the program needs to run; one owner can.',
            fix: 'Name the files that may read environment variables in `owners`, and pass their values into other modules.',
        },
        schema: [
            optionsSchema({
                owners: {
                    description: 'File patterns allowed to read environment variables.',
                    type: 'array',
                    items: { type: 'string' },
                },
                allowed: {
                    description: 'Environment variable names allowed outside those files.',
                    type: 'array',
                    items: { type: 'string' },
                },
            }),
        ],
        messages: { owner: 'Environment variables are read in {{owners}} only. Read it there and pass the value in.' },
    },
    create(context, [options]) {
        const file = lintedPath(context);
        if (file === undefined) return {};
        const owners = options.owners;
        if (owners.length === 0 || isAnyGlobMatch(file.relative, owners)) return {};
        const allowed = new Set(options.allowed);
        return environmentReads(context, (node) => {
            const names = environmentNames(node);
            if (names.length > 0 && names.every((name) => name !== null && allowed.has(name))) return;
            context.report({ node, messageId: 'owner', data: { owners: owners.join(', ') } });
        });
    },
});
