import { readFileSync } from 'node:fs';
import { ErrorCodeSchema } from '@note-app/shared';
import { describe, expect, it } from 'vitest';
import { ERROR_STATUS } from './error-status.js';

const sds = readFileSync(new URL('../../../../docs/SDS.md', import.meta.url), 'utf8');
const section = sds.slice(
  sds.indexOf('### 4.3 Error codes'),
  sds.indexOf("**Rule.** A ticket's spec"),
);
const sdsStatuses: Record<string, number> = Object.fromEntries(
  [...section.matchAll(/^\| `([A-Z_]+)` \| (\d{3}) \|/gm)].map((match): [string, number] => [
    match[1] ?? '',
    Number(match[2]),
  ]),
);

describe('ERROR_STATUS', () => {
  it('S-AB1001-07: matches the binding table in docs/SDS.md section 4.3', () => {
    expect(Object.keys(sdsStatuses)).toHaveLength(17);
    expect(ERROR_STATUS).toEqual(sdsStatuses);
  });

  it('has a status for every shared ErrorCode', () => {
    expect(Object.keys(ERROR_STATUS).sort()).toEqual([...ErrorCodeSchema.options].sort());
  });

  it('never uses 403 for anything but the origin check, nor 422, 429 or 410', () => {
    const entries = Object.entries(ERROR_STATUS);
    expect(entries.filter(([, status]) => status === 403).map(([code]) => code)).toEqual([
      'FORBIDDEN_ORIGIN',
    ]);
    expect(entries.some(([, status]) => [410, 422, 429].includes(status))).toBe(false);
  });
});
