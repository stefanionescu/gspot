import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { ALLOWED_VERSION } from '#cli/config/checks/licenses.ts';
import { nonemptyStrings } from '#cli/schemas/settings/parts.ts';
import { type WrittenLicenses } from '#cli/types/settings/file.ts';
import { type TableSettings } from '#cli/types/settings/tables.ts';
import { nonemptyString } from '#cli/schemas/configurations/parts.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';

const allowedPackageSchema = z.strictObject({
    name: nonemptyString.describe(SETTING_DECLARATIONS['licenses.allowed_package.name'].description),
    version: z
        .string()
        .regex(ALLOWED_VERSION, 'Name an exact version, a semver range such as ^1.2.0, or * for every version.')
        .describe(SETTING_DECLARATIONS['licenses.allowed_package.version'].description),
    reason: z.string().describe(SETTING_DECLARATIONS['licenses.allowed_package.reason'].description),
} satisfies SchemaShape<TableSettings<'licenses'>['allowed_package'][number]>);

const licensesSchema = z.strictObject({
    allowed: nonemptyStrings
        .default(SETTING_DECLARATIONS['licenses.allowed'].default)
        .meta(SETTING_DECLARATIONS['licenses.allowed']),
    allowed_package: z
        .array(allowedPackageSchema)
        .default(SETTING_DECLARATIONS['licenses.allowed_package'].default)
        .meta(SETTING_DECLARATIONS['licenses.allowed_package']),
} satisfies SchemaShape<TableSettings<'licenses'>, WrittenLicenses>);

export { licensesSchema };
