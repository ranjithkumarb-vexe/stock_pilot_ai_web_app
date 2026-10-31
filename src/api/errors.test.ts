import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ApiError,
  ERROR_COPY,
  codeForStatus,
  describeError,
  fieldErrorsFrom,
  violationsFrom,
} from './errors';
import { SERVER_ERROR_CODES } from './types';

describe('error code → UX copy', () => {
  it('covers every code listed in CONTRACT.md', () => {
    const contract = readFileSync(resolve(__dirname, '../../docs/workflow/CONTRACT.md'), 'utf8');
    const line = contract.split('\n').find(l => l.startsWith('- Errors:')) ?? '';
    const codes = [...line.matchAll(/`([a-z_]+)`\(\d{3}/g)].map(m => m[1] as string);
    expect(codes.length).toBeGreaterThanOrEqual(15);
    for (const c of codes) expect(ERROR_COPY, `missing copy for ${c}`).toHaveProperty(c);
    for (const c of SERVER_ERROR_CODES) expect(codes, `${c} not in CONTRACT.md`).toContain(c);
  });

  it('every entry has non-empty title and message', () => {
    for (const [code, c] of Object.entries(ERROR_COPY)) {
      expect(c.title.length, code).toBeGreaterThan(3);
      expect(c.message.length, code).toBeGreaterThan(10);
    }
  });

  it('never uses forbidden advice/urgency wording (SPEC §11.4)', () => {
    const text = Object.values(ERROR_COPY)
      .map(c => `${c.title} ${c.message}`)
      .join(' ')
      .toLowerCase();
    for (const bad of ['you should buy', 'you should sell', 'guaranteed', "can't lose", 'act now', 'hurry'])
      expect(text).not.toContain(bad);
  });

  it('describes an ApiError with trace id, server message and tone', () => {
    const d = describeError(
      new ApiError({
        code: 'stale_quote',
        message: 'Quote older than 15m for NVDA',
        status: 409,
        trace_id: 't-1',
      }),
    );
    expect(d.title).toBe('Quote is stale');
    expect(d.traceId).toBe('t-1');
    expect(d.serverMessage).toBe('Quote older than 15m for NVDA');
    expect(d.retryable).toBe(true);
  });

  it('rate_limited copy includes the Retry-After seconds', () => {
    const d = describeError(
      new ApiError({ code: 'rate_limited', message: 'slow', status: 429, retryAfterMs: 7000 }),
    );
    expect(d.retryAfterSec).toBe(7);
    expect(d.message).toContain('7 seconds');
  });

  it('unknown codes fall back to the generic message and keep the server text', () => {
    const d = describeError(
      new ApiError({ code: 'brand_new_code', message: 'Something specific', status: 418 }),
    );
    expect(d.title).toBe(ERROR_COPY.internal.title);
    expect(d.serverMessage).toBe('Something specific');
  });

  it('non-ApiError values are described as internal', () => {
    expect(describeError(new Error('boom')).serverMessage).toBe('boom');
    expect(describeError('x').code).toBe('internal');
  });

  it('extracts validation field errors (pydantic list and {fields})', () => {
    expect(fieldErrorsFrom({ errors: [{ loc: ['body', 'qty'], msg: 'must be >= 1' }] })).toEqual({
      qty: 'must be >= 1',
    });
    expect(fieldErrorsFrom({ fields: { symbol: ['unknown'] } })).toEqual({ symbol: 'unknown' });
    expect(fieldErrorsFrom(null)).toEqual({});
  });

  it('extracts rule violations', () => {
    expect(violationsFrom({ violations: [{ rule: 'pos', message: 'NVDA 27% > 25%' }] })).toHaveLength(1);
    expect(violationsFrom({})).toEqual([]);
  });

  it('maps HTTP status to a code when the body is not an error envelope', () => {
    expect(codeForStatus(401)).toBe('unauthenticated');
    expect(codeForStatus(404)).toBe('not_found');
    expect(codeForStatus(429)).toBe('rate_limited');
    expect(codeForStatus(503)).toBe('upstream_unavailable');
    expect(codeForStatus(500)).toBe('internal');
  });
});
