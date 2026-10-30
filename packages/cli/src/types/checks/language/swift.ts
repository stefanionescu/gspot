import type { z } from 'zod';
import type { Files } from '#cli/types/system/files.ts';
import type { xccovSchema } from '#cli/schemas/checks/language/swift.ts';

export type SwiftBuildPlan =
    | {
          kind: 'package';
          purpose: Exclude<SwiftBuildPurpose, 'periphery'>;
          folder: string;
          log: string;
          scratch: string;
          commandArguments: string[];
      }
    | {
          kind: 'xcode';
          purpose: Exclude<SwiftBuildPurpose, 'periphery'>;
          folder: string;
          log: string;
          commandArguments: string[];
      };

export type SwiftBuildOutput = { code: number; output: string; source: string };

export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

export type SwiftBuildSetup = { files: Files; source: string };

export type CoverageOutput = z.infer<typeof xccovSchema>;
