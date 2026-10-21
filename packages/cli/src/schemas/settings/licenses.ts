import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import { ALLOWED_VERSION } from '#cli/config/settings/schema.ts';
import { nonemptyStrings } from '#cli/schemas/settings/parts.ts';
import { nonemptyString } from '#cli/schemas/configurations/parts.ts';
import { type TableSettings, type WrittenLicenses } from '#cli/types/settings/file.ts';

const allowedPackageSchema = z.strictObject({
    name: nonemptyString.describe(SETTING_FACTS['licenses.allowed_package.name'].description),
    version: z
        .string()
        .regex(ALLOWED_VERSION, 'Name an exact version, a semver range such as ^1.2.0, or * for every version.')
        .describe(SETTING_FACTS['licenses.allowed_package.version'].description),
    reason: z.string().describe(SETTING_FACTS['licenses.allowed_package.reason'].description),
} satisfies SchemaShape<TableSettings<'licenses'>['allowed_package'][number]>);

export const licensesSchema = z.strictObject({
    allowed: nonemptyStrings.default(SETTING_FACTS['licenses.allowed'].default).meta(SETTING_FACTS['licenses.allowed']),
    allowed_package: z
        .array(allowedPackageSchema)
        .default(SETTING_FACTS['licenses.allowed_package'].default)
        .meta(SETTING_FACTS['licenses.allowed_package']),
} satisfies SchemaShape<TableSettings<'licenses'>, WrittenLicenses>);
