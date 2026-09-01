import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('../supabase-server', () => ({
  supabaseServiceRole: () => ({
    from: mockFrom,
  }),
}));

import { checkRateLimit } from '../rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn(),
    });
  });

  it('resets the counter exactly when the window expires', async () => {
    const now = new Date('2026-09-02T12:00:00.000Z');
    const windowStart = new Date('2026-09-02T11:59:00.000Z');

    vi.setSystemTime(now);
    mockMaybeSingle.mockResolvedValue({
      data: { key: 'demo', count: 10, window_start: windowStart.toISOString() },
    });

    const result = await checkRateLimit('demo', 10, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.retryAfterSeconds).toBe(0);
    expect(mockUpdate).toHaveBeenCalledWith({ count: 1, window_start: now.toISOString() });
  });
});
