// The shared instances of the generation module.
import { Eta } from 'eta';

/** The template engine every configuration template renders through. */
export const eta = new Eta({ autoEscape: false, autoTrim: false, useWith: true, rmWhitespace: false, varName: 'it' });
