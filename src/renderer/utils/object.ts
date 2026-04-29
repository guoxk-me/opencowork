export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function getRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value) || !isRecord(value[key])) {
    return undefined;
  }

  return value[key] as Record<string, unknown>;
}

export function getString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : undefined;
}

export function getNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const candidate = value[key];
  return typeof candidate === 'number' ? candidate : undefined;
}

export function getBoolean(value: unknown, key: string): boolean | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const candidate = value[key];
  return typeof candidate === 'boolean' ? candidate : undefined;
}

export function getStringArray(value: unknown, key: string): string[] | undefined {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    return undefined;
  }

  const items = (value[key] as unknown[]).filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : [];
}

export function getRecordArray(value: unknown, key: string): Array<Record<string, unknown>> | undefined {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    return undefined;
  }

  const items = (value[key] as unknown[]).filter(isRecord);
  return items.length > 0 ? items : [];
}
