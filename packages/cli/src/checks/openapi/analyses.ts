// The OpenAPI analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { openapiLint, openapiFresh } from '#cli/checks/openapi/openapi.ts';

export const OPENAPI_ANALYSES: Record<string, Engine> = {
    'openapi-lint': openapiLint,
    'openapi-fresh': openapiFresh,
};
