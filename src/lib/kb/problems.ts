// #4471 split into the problems its reports describe. causes.ts decides parser vs hint by tenant;
// this adds what the bodies show and causes.ts cannot: a date moved by one day is not a swap.
import { causeOf, dayFirst, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'shift' | 'unplaced';

// outcome: engineering's update on #4471 (closed 2026-10-05).
export const PROBLEMS: Record<Problem, { title: string; issue: number | null; outcome: string }> = {
  parser: { title: 'Shared parser reads day-first dates month first', issue: 1, outcome: 'fixed: fix(dates): parse dd/mm for eu locales' },
  hint: { title: 'booking-v3 form hint says MM/DD/YYYY for day-first tenants', issue: 2, outcome: "won't fix: booking-v3 form retired" },
  shift: { title: 'Dates move by one day (time zone)', issue: 3, outcome: 'not in the engineering update; not covered by the parser fix' },
  unplaced: { title: 'No tenant on file, or tenant not day-first', issue: null, outcome: '' },
};

export const ISSUES = 'https://github.com/mjanusz-ij/s01e03-what-it-shows/issues';

// Counted the desk's way: every report under the cause its tenant gives it (causes.ts), once.
// oneDayMove (desk-notes.json) are reports read as a one-day move, not a swap: their own problem,
// counted again under `shift` while they stay filed under their tenant's cause.
export function problemsOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem[] {
  const filed: Problem = causeOf(r, t) ?? 'unplaced';
  return oneDayMove.includes(r.id) ? [filed, 'shift'] : [filed];
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
    for (const p of problemsOf(r, tenantOf(r), oneDayMove)) by.set(p, [...(by.get(p) ?? []), r]);
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
