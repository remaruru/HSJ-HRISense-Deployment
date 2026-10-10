import { useEffect, useState } from "react";
import { RELIGION_OPTIONS, RELIGION_OTHER, splitReligion } from "@/lib/religion";

/**
 * Religion: a picker with an "Others" escape hatch.
 *
 * The parent only ever holds the final string — what is stored is what the
 * person chose, or exactly what they typed under "Others". Which of the two
 * controls is showing is this component's own business: picking "Others" empties
 * the value until they type, so the choice cannot be derived from the value
 * alone and is kept in state here. An external change (a draft loading, a record
 * opening) is adopted, but an empty value never closes the box the person is
 * currently typing in.
 */
export function ReligionPicker({
  value,
  onChange,
  id = "religion",
  required,
  disabled,
  controlClass,
  otherPlaceholder = "Please specify your religion",
  optional = false,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  /** The page's own control styling, so the picker matches its neighbours. */
  controlClass: string;
  otherPlaceholder?: string;
  /** The field may be left blank: the empty choice stays selectable. */
  optional?: boolean;
}) {
  const [choice, setChoice] = useState(() => splitReligion(value).choice);

  useEffect(() => {
    const incoming = splitReligion(value).choice;
    if (incoming && incoming !== choice) setChoice(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const showOther = choice === RELIGION_OTHER;
  const otherValue = showOther ? value : "";

  return (
    <div className="space-y-2">
      <select
        id={id}
        name={id}
        required={required}
        disabled={disabled}
        className={controlClass}
        value={choice}
        onChange={(e) => {
          const next = e.target.value;
          setChoice(next);
          // "Others" starts empty so the typed answer is the stored answer.
          onChange(next === RELIGION_OTHER ? "" : next);
        }}
      >
        <option value="" disabled={!optional}>{optional ? "Select religion (optional)…" : "Select religion…"}</option>
        {RELIGION_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
        <option value={RELIGION_OTHER}>{RELIGION_OTHER} (not listed)</option>
      </select>

      {showOther && (
        <input
          id={`${id}-other`}
          name={`${id}-other`}
          type="text"
          required={required}
          disabled={disabled}
          className={controlClass}
          placeholder={otherPlaceholder}
          value={otherValue}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Your religion"
        />
      )}
    </div>
  );
}
