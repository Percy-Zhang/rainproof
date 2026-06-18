type PerfMetadataValue = boolean | number | string | null | undefined;

export type PerfMetadata = Record<string, PerfMetadataValue>;

type PerfMetadataInput<T> = PerfMetadata | ((result: T) => PerfMetadata);

export function isDevPerfLoggingEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ && process.env.NODE_ENV !== 'test';
}

export function logDevPerfDuration(label: string, startedAt: number, metadata: PerfMetadata = {}): void {
  if (!isDevPerfLoggingEnabled()) {
    return;
  }

  const durationMs = Date.now() - startedAt;
  const details = formatPerfMetadata(metadata);
  console.info(`[perf] ${label} ${durationMs}ms${details}`);
}

export function timeDevPerf<T>(label: string, run: () => T, metadata?: PerfMetadataInput<T>): T {
  const startedAt = Date.now();

  try {
    const result = run();
    logDevPerfDuration(label, startedAt, resolvePerfMetadata(metadata, result));
    return result;
  } catch (error) {
    logDevPerfDuration(label, startedAt, { status: 'error' });
    throw error;
  }
}

export async function timeDevPerfAsync<T>(
  label: string,
  run: () => Promise<T>,
  metadata?: PerfMetadataInput<T>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await run();
    logDevPerfDuration(label, startedAt, resolvePerfMetadata(metadata, result));
    return result;
  } catch (error) {
    logDevPerfDuration(label, startedAt, { status: 'error' });
    throw error;
  }
}

function resolvePerfMetadata<T>(metadata: PerfMetadataInput<T> | undefined, result: T): PerfMetadata {
  if (!metadata) {
    return {};
  }

  return typeof metadata === 'function' ? metadata(result) : metadata;
}

function formatPerfMetadata(metadata: PerfMetadata): string {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return '';
  }

  return ` ${entries.map(([key, value]) => `${key}=${String(value)}`).join(' ')}`;
}
