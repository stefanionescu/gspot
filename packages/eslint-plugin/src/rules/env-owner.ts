import type { EnvOwnerOptions } from '#plugin/types/rules.ts';
import { lintedPath, isAnyGlobMatch } from '#plugin/files.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { ENVIRONMENT_ALLOWED } from '#plugin/config/environment.ts';
import { environmentNames, environmentReads } from '#plugin/environment.ts';

export const envOwner = createRule<EnvOwnerOptions, 'owner'>({
    name: 'env-owner',
    meta: {
        defaultOptions: [{ owners: [], allowed: ENVIRONMENT_ALLOWED }],
        type: 'suggestion',
        docs: {
            level: 'all',
            title: 'Environment access owner',
            example:
                'With `owners: ["src/env/**"]`, `const port = process.env.PORT;` in `src/turn/build.ts` reports an owner finding. Move the environment read to `src/env/index.ts` and pass the value to the build function.',
            description:
                'Finds an environment variable read outside the owners the options name. With no owners, it reports nothing.',
            why: 'When any file reads the environment, nobody can list what the program needs to run; one owner can.',
            fix: 'Set the owners rule option to the files that read environment variables, and pass their values to consumers. In gspot, set architecture.roles.env.',
        },
        schema: [
            optionsSchema({
                owners: { type: 'array', items: { type: 'string' } },
                allowed: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: { owner: 'Environment variables are read in {{owners}} only. Read it there and pass the value in.' },
    },
    create(context, [configured]) {
        // RuleCreator merges the declared defaults before this listener is created.
        const options = configured as Required<EnvOwnerOptions[0]>;
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
