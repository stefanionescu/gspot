// The express analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { routesTested } from '#cli/checks/express/routes.ts';
import { openapiLint, openapiFresh } from '#cli/checks/express/openapi.ts';

export const EXPRESS_ANALYSES: Record<string, Engine> = {
    'openapi-lint': openapiLint,
    'openapi-fresh': openapiFresh,
    'routes-tested': routesTested,
};
