import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { nonemptyStrings } from '#cli/schemas/settings/fields.ts';
import { ALLOWED_VERSION } from '#cli/config/settings/licenses.ts';
import { nonemptyString } from '#cli/schemas/configurations/fields.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { type TableSettings, type WrittenLicenses } from '#cli/types/settings/file.ts';

const allowedPackageSchema = z.strictObject({
    name: nonemptyString.describe(SETTING_DEFINITIONS['licenses.allowed_package.name'].description),
    version: z
        .string()
        .regex(ALLOWED_VERSION, 'Name an exact version, a semver range such as ^1.2.0, or * for every version.')
        .describe(SETTING_DEFINITIONS['licenses.allowed_package.version'].description),
    reason: z.string().describe(SETTING_DEFINITIONS['licenses.allowed_package.reason'].description),
} satisfies SchemaShape<TableSettings<'licenses'>['allowed_package'][number]>);

export const licensesSchema = z.strictObject({
    allowed: nonemptyStrings
        .default(SETTING_DEFINITIONS['licenses.allowed'].default)
        .meta(SETTING_DEFINITIONS['licenses.allowed']),
    allowed_package: z
        .array(allowedPackageSchema)
        .default(SETTING_DEFINITIONS['licenses.allowed_package'].default)
        .meta(SETTING_DEFINITIONS['licenses.allowed_package']),
} satisfies SchemaShape<TableSettings<'licenses'>, WrittenLicenses>);
