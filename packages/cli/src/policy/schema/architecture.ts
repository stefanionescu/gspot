import { z } from 'zod';
import { authoredDefault } from '#cli/policy/schema/contracts.ts';
import { settingValueSchemas } from '#cli/policy/schema/native/public.ts';

/** Module fields derive from their declaration; import edges refer to declared identities. */
export const architectureSchema = z
    .strictObject({
        modules: authoredDefault(settingValueSchemas['architecture.modules'].default([])),
        roles: authoredDefault(settingValueSchemas['architecture.roles'].default({})),
    })
    .superRefine((architecture, context) => {
        const modules = architecture.modules;
        if (modules === undefined) return;
        const names = new Set(modules.map((module) => module.name));
        for (const [index, module] of modules.entries()) {
            for (const [edge, name] of (module.may_import ?? []).entries()) {
                if (names.has(name)) continue;
                context.addIssue({
                    code: 'custom',
                    path: ['modules', index, 'may_import', edge],
                    message: `There is no architecture module named ${name}.`,
                });
            }
        }
    });
