// #4471 split into the problems its reports describe. causes.ts decides parser vs hint by tenant;
// this adds what the bodies show and causes.ts cannot: a date moved by one day is not a swap.
import { causeOf, dayFirst, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'shift' | 'unplaced';

export const PROBLEMS: Record<Problem, { title: string; issue: number | null }> = {
  parser: { title: 'Shared parser reads day-first dates month first', issue: 1 },
  hint: { title: 'booking-v3 form hint says MM/DD/YYYY for day-first tenants', issue: 2 },
  shift: { title: 'Dates move by one day (time zone)', issue: 3 },
  unplaced: { title: 'No tenant on file, or tenant not day-first', issue: null },
};

export const ISSUES = 'https://github.com/mjanusz-ij/s01e03-what-it-shows/issues';

// oneDayMove: report ids the desk read as a one-day move (desk-notes.json). A move, not a swap.
export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  if (oneDayMove.includes(r.id)) return 'shift';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemRow = {
  problem: Problem;
  reports: Report[];
  tenants: number;
  channels: Record<string, number>;
  taggedAs: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
};

export function splitTicket(
  all: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): { merged: Report[]; rows: ProblemRow[] } {
  const merged = uniqueById(all).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of merged) {
    const p = problemOf(r, tenantOf(r), oneDayMove);
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const count = (rs: Report[], key: (r: Report) => string) =>
    rs.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});
  const rows = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: new Set(rs.map((r) => r.tenant)).size,
        channels: count(rs, (r) => r.channel),
        taggedAs: count(rs, (r) => r.meta.intakeTag),
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
  return { merged, rows };
}

// A runtime without full locale data (e.g. Node built with small-icu) says no locale is day-first,
// and every report lands in `unplaced`. The page warns instead of printing wrong numbers quietly.
export const localeDataOk = (): boolean => dayFirst('de-DE') && dayFirst('en-GB');
