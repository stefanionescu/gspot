import { schemaLocation } from './src/rules/schema-location.ts';
import { noPromiseMatchers } from './src/rules/no-promise-matchers.ts';

export default { rules: { 'schema-location': schemaLocation, 'no-promise-matchers': noPromiseMatchers } };
