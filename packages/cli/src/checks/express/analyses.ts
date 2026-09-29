// The express analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { routesTested } from '#cli/checks/express/routes.ts';

export const EXPRESS_ANALYSES: Record<string, Engine> = {
    'routes-tested': routesTested,
};
