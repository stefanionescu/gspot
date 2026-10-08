/** The explicit producer for compiler-derived policy validators. */
export const SETTING_VALUES_COMMAND = 'bun scripts/setting-values.ts';

/** The compiler-owned runtime schema beside the policy's other validation owners. */
export const SETTING_VALUES_FILE = 'src/policy/schema/native/public.ts';

/** Root policy tables have their own public schema owners. */
export const POLICY_TABLE_NAMES = ['tools', 'limits', 'naming', 'format', 'structure', 'architecture'];

/** Nested concern validators compiled from the same setting declarations. */
export const SETTING_NAMESPACES_FILE = 'src/policy/schema/native/contracts.ts';

/** Literal setting-key and active-value artifacts share their native namespace import. */
export const SETTING_SCHEMA_IMPORTS = [
    "import { settingNamespaceSchemas } from '#cli/policy/schema/native/contracts.ts';",
    '',
];

/** Namespace validators use the same parser-owned native schemas as runtime policy. */
export const SETTING_NAMESPACE_IMPORTS = [
    "import { z } from 'zod';",
    "import { toolsSchema } from '#cli/policy/schema/tools.ts';",
    "import { namingLists } from '#cli/parsers/schema/naming.ts';",
    "import { FULL_PERCENTAGE } from '#cli/config/platform/runtime.ts';",
    "import { allowlistSchema } from '#cli/parsers/schema/licenses.ts';",
    '',
    "import { formatSchema, relativePath, architectureRolesSchema, environmentReadersSchema } from '#cli/policy/schema/contracts.ts';",
    '',
];
