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
}: {
  caption: string;
  items: ReadonlyArray<{ label: string; value: string }>;
  onPick: (value: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[12px] text-ink-muted">{caption}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            // type="button" matters: without it a click inside a form submits.
            type="button"
            key={item.label}
            onClick={() => onPick(item.value)}
            className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-body hover:border-graphite hover:text-ink"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
