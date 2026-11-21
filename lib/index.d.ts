import Schema from '@deepseek-ai/schemastery';
import { Context } from '@deepseek-ai/cordis';

export declare const name = '@goodandready/dsh-model-sync';
export declare const inject: readonly ['llm', 'webServer', 'credentials', 'settings'];

export interface NotificationItem {
  id: string;
  fingerprint: string;
  createdAt: number;
  updatedAt: number;
  occurrences?: number;
  readAt?: number | null;
  acknowledgedAt?: number | null;
  severity: string;
  title: string;
  message: string;
  providers?: Record<string, unknown>[];
}

export interface ModelLifecycleEntry {
  status: string;
  consecutiveMissing?: number;
  firstMissingAt?: number;
  lastSeenAt?: number;
  lastObservedRun?: number;
}

export interface HistoryEntry {
  id: string;
  version: number;
  startedAt: number;
  finishedAt: number;
  providers?: Record<string, unknown>[];
}

export interface ProviderScheduleConfig {
  provider: string;
  enabled?: boolean;
  intervalMinutes?: number;
  jitterMinutes?: number;
  ttlMinutes?: number;
  autoApply?: boolean;
}

export interface AliasTarget {
  provider: string;
  model: string;
}

export interface AliasConfig {
  provider?: string;
  model?: string;
  targets?: AliasTarget[];
  strategy?: string;
  updatedAt?: number;
}

export interface DeclarativeAdapterConfig {
  enabled?: boolean;
  endpoint?: string;
  auth?: string;
  parser?: string;
  modelsPath?: string;
  fields?: Record<string, unknown>;
  capabilityMap?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface ModelPolicyConfig {
  include?: string[];
  exclude?: string[];
  includeUtilityModels?: boolean;
  excludeUtilityModels?: boolean;
  requireCapabilities?: Record<string, boolean>;
  denyCapabilities?: Record<string, boolean>;
  enableCostFilter?: boolean;
  maxPricePerMillion?: number;
  enableContextFilter?: boolean;
  minContextTokens?: number;
}

export interface CachedCatalogModel {
  provider: string;
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ModelSyncConfig {
  enabled?: boolean;
  intervalMinutes?: number;
  scheduleEnabled?: boolean;
  jitterMinutes?: number;
  ttlMinutes?: number;
  autoApply?: boolean;
  requestTimeoutMs?: number;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  concurrency?: number;
  circuitBreakerFailures?: number;
  circuitBreakerCooldownMinutes?: number;
  historyLimit?: number;
  notificationLimit?: number;
  diffWebhookUrl?: string;
  diffWebhookSecretRef?: string;
  notifyOnModelAdded?: boolean;
  notifyOnModelDeprecated?: boolean;
  notifyOnPriceChanged?: boolean;
  notifications?: NotificationItem[];
  excludeUtilityModels?: boolean;
  collapseDateSnapshots?: boolean;
  displayNameBadges?: {
    enabled?: boolean;
    showContext?: boolean;
    showCapabilities?: boolean;
  };
  staleGraceRuns?: number;
  lifecycleRetentionRuns?: number;
  lifecycleRevision?: number;
  modelLifecycle?: Record<string, Record<string, ModelLifecycleEntry>>;
  history?: HistoryEntry[];
  providers?: ProviderScheduleConfig[];
  aliases?: Record<string, AliasConfig>;
  modelSelections?: Record<string, string[]>;
  adapterRegistry?: Record<string, DeclarativeAdapterConfig>;
  modelPolicies?: Record<string, ModelPolicyConfig>;
  modelCatalogs?: Record<string, CachedCatalogModel[]>;
}

export declare const Config: Schema<ModelSyncConfig>;

export declare function plainConfig<T>(value: T): T;

export interface RuntimeStateSnapshot {
  notifications: NotificationItem[];
  history: HistoryEntry[];
  modelLifecycle: Record<string, Record<string, ModelLifecycleEntry>>;
  lifecycleRevision: number;
  modelCatalogs: Record<string, CachedCatalogModel[]>;
}

export interface RuntimeStateStore {
  readonly storagePath: string;
  readonly persistToDisk: boolean;
  getState(): RuntimeStateSnapshot;
  get<K extends keyof RuntimeStateSnapshot>(key: K): RuntimeStateSnapshot[K];
  update(patch: Partial<RuntimeStateSnapshot>): RuntimeStateSnapshot;
  reset(nextState?: Partial<RuntimeStateSnapshot>): RuntimeStateSnapshot;
}

export interface ProviderService {
  listApiKeyProviders(): Record<string, unknown>[];
  getLimits(provider: string, modelId: string, modelMeta?: Record<string, unknown>): Record<string, unknown>;
  clampCompletionTokens(provider: string, modelId: string, requestedMaxTokens: number, modelMeta?: Record<string, unknown>): Record<string, unknown>;
  adaptReasoningPayload(provider: string, modelId: string, options?: Record<string, unknown>, modelMeta?: Record<string, unknown>): Record<string, unknown>;
}

export interface ModelSynchronizer {
  readonly services: {
    readonly stateStore: RuntimeStateStore;
    readonly pricing: Record<string, (...args: unknown[]) => unknown>;
    readonly ollama: Record<string, (...args: unknown[]) => unknown>;
    readonly probing: Record<string, (...args: unknown[]) => unknown>;
    readonly policy: Record<string, (...args: unknown[]) => unknown>;
  };
  readonly stateStore: RuntimeStateStore;
  listProviders(): Record<string, unknown>[];
  getProvider(provider: string): Record<string, unknown> | null;
  discover(options?: { provider?: string }): Promise<Record<string, unknown>>;
  run(options?: { provider?: string; dryRun?: boolean; force?: boolean; removeStale?: boolean }): Promise<Record<string, unknown>>;
  status(): Record<string, unknown>;
  [key: string]: unknown;
}

export declare function apply(ctx: Context, config: ModelSyncConfig): void;

declare module '@deepseek-ai/cordis' {
  interface Context {
    modelSync: ProviderService;
    modelSyncRunner: ModelSynchronizer;
  }
}
