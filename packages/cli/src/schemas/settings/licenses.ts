import { z } from 'zod';
import semver from 'semver';
import { isTable } from '#cli/system/tables.ts';
import parseExpression from 'spdx-expression-parse';
import { nonemptyStringSchema } from '#cli/schemas/manifests/fields.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

const allowedPackageSchema = z.strictObject({
    name: nonemptyStringSchema.meta(SETTING_DEFINITIONS['licenses.allowed_package.name']),
    version: z
        .string()
        .refine(
            (range) => semver.validRange(range) !== null,
            'Name an exact version, a semver range such as ^1.2.0, or * for every version.',
        )
        .meta(SETTING_DEFINITIONS['licenses.allowed_package.version']),
    reason: z.string().meta(SETTING_DEFINITIONS['licenses.allowed_package.reason']),
});

export const licensesSchema = z.strictObject({
    allowed: nonemptyStringSchema
        .refine((id) => {
            try {
                const expression = parseExpression(id);
                return isTable(expression) && 'license' in expression;
            } catch {
                return false;
            }
        }, 'Use one SPDX license ID, such as MIT or Apache-2.0, not an AND or OR expression.')
        .array()
        .default(SETTING_DEFINITIONS['licenses.allowed'].default)
        .meta(SETTING_DEFINITIONS['licenses.allowed']),
    allowed_package: allowedPackageSchema
        .array()
        .default(SETTING_DEFINITIONS['licenses.allowed_package'].default)
        .meta(SETTING_DEFINITIONS['licenses.allowed_package']),
});
