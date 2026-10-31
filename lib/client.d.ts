import { Context } from '@deepseek-ai/cordis';

export declare const name = '@goodandready/dsh-model-sync';
export declare const inject: readonly [
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-settings'
];

export declare function apply(ctx: Context): void;
