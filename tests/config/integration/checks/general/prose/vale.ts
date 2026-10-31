import { dirname } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const EXAMPLE_STYLE_FOLDER = `${dirname(GSPOT_PATHS.valeConfig)}/styles/Example`;

export const VALE_INI = `StylesPath = styles
MinAlertLevel = suggestion
[*]
BasedOnStyles = Example
`;
