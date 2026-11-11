<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import type { Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { ISSUES, PROBLEMS, localeDataOk, splitTicket } from '#lib/kb/problems';

  let { ticket }: { ticket: number } = $props();

  const exported = (reports as Report[]).length;
  const split = $derived(splitTicket(reports as Report[], ticket, tenantOf, notes.oneDayMove));
  const fmt = (n: Record<string, number>) =>
    Object.entries(n)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ×${v}`)
      .join(' · ');
  const shift = $derived(split.rows.find((g) => g.problem === 'shift'));
  const filedAs = $derived(
    shift ? [...new Set(split.rows.filter((g) => g.problem !== 'shift' && g.reports.some((r) => shift.reports.includes(r))).map((g) => g.problem))] : [],
  );
  const mistagged = $derived(
    split.rows.filter((g) => g.problem !== 'shift').reduce((n, g) => n + g.reports.filter((r) => r.meta.intakeTag !== g.problem).length, 0),
  );
</script>

{#if !localeDataOk()}
  <p class="warn">This build has no full locale data: day-first tenants are not recognised, so the numbers below are wrong. Build with full ICU.</p>
{/if}

<p class="sum">
  <strong>{split.merged.length}</strong> reports merged into #{ticket} ({exported} rows in the export, duplicates counted once) ·
  <strong>{split.rows.length}</strong> problems
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>tenants</th><th>came in by</th><th>intake tagged</th><th>seen</th><th>ticket</th><th>outcome</th></tr>
  </thead>
  <tbody>
    {#each split.rows as g (g.problem)}
      {@const p = PROBLEMS[g.problem]}
      <tr>
        <td><code>{g.problem}</code><br /><span class="t">{p.title}</span></td>
        <td><strong>{g.reports.length}</strong></td>
        <td>{g.tenants}</td>
        <td class="m">{fmt(g.channels)}</td>
        <td class="m">{fmt(g.taggedAs)}</td>
        <td class="m">{g.firstSeen} → {g.lastSeen}</td>
        <td>{#if p.issue}<a href="{ISSUES}/{p.issue}">#{p.issue}</a>{:else}none{/if}</td>
        <td class="m">{p.outcome}</td>
      </tr>
    {/each}
  </tbody>
</table>

{#if shift}
  <p class="m">The {shift.reports.length} <code>shift</code> reports stay counted where the desk files them by tenant ({filedAs.join(', ')}), so the rows add up to more than {split.merged.length}.</p>
{/if}
<p class="m">{mistagged} of {split.merged.length} reports carry an intake tag that is not their problem.</p>

<style>
  .sum { font-size: 1.1rem; }
  .t, .m { color: var(--muted); font-size: 0.85em; }
  .warn { background: var(--warn-bg); color: var(--warn); padding: 0.6rem 1rem; border-radius: 6px; }
</style>
