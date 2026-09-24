"use client";

/**
 * A row of one-tap shortcuts that fill in a field below it.
 *
 * Deliberately not inside a <Field>: that renders a <label> wrapping its
 * control, and a button inside a label activates the label's control as well as
 * itself, so a chip would also focus the textarea and fight the click. Sitting
 * under the field it feeds is also the better place on a phone, where the
 * shortcuts land in thumb reach instead of above the keyboard.
 */
export function QuickPicks({
  caption,
  items,
  onPick,
  dense = false,
}: {
  caption: string;
  items: ReadonlyArray<{ label: string; value: string }>;
  onPick: (value: string) => void;
  /**
   * Eight to a row on a wide screen, in even columns rather than wrapped.
   *
   * It steps down to four and then two as the screen narrows, because eight
   * across a 375px phone leaves 40px a chip — not enough for "Opening /
   * closing", and a row of chopped-off labels is slower to read than two tidy
   * rows. A long label truncates with the full text on hover.
   */
  dense?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[12px] text-ink-muted">{caption}</p>
      <div
        className={
          dense
            ? "grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-8"
            : "flex flex-wrap gap-1.5"
        }
      >
        {items.map((item) => (
          <button
            // type="button" matters: without it a click inside a form submits.
            type="button"
            key={item.label}
            onClick={() => onPick(item.value)}
            title={item.label}
            className={
              dense
                ? "truncate rounded-md border border-line px-1.5 py-1 text-[11px] text-ink-body hover:border-graphite hover:text-ink"
                : "rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-body hover:border-graphite hover:text-ink"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The same shortcuts, under a heading per team.
 *
 * Wrapped pills rather than the dense grid: truncating a person's name on a
 * control that assigns work is how someone taps "Danielle D..." meaning Danica.
 * The team heading is what makes a long list quick to scan, not smaller chips.
 */
export function GroupedQuickPicks({
  caption,
  groups,
  onPick,
}: {
  caption: string;
  groups: ReadonlyArray<{
    team: string;
    picks: ReadonlyArray<{ label: string; id: string }>;
  }>;
  onPick: (id: string) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[12px] text-ink-muted">{caption}</p>
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.team}>
            <p className="mb-1 text-[11px] font-bold tracking-wide text-ink-muted uppercase">
              {group.team}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.picks.map((pick) => (
                <button
                  type="button"
                  key={pick.id}
                  onClick={() => onPick(pick.id)}
                  className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-body hover:border-graphite hover:text-ink"
                >
                  {pick.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
