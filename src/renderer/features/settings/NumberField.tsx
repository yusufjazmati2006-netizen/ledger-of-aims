import { useState } from 'react';
import { parseDecimal } from '../../lib/units';
import { Field, TextInput } from '../../design/Field';

/** A numeric setting validated and saved when the field loses focus. */
export function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  integer = true,
  suffix,
  onSave,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  suffix?: string;
  onSave: (value: number) => void | Promise<void>;
}) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="flex items-center gap-2">
        <TextInput
          id={id}
          inputMode="decimal"
          className="w-[100px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = parseDecimal(text);
            if (n === null || n < min || n > max || (integer && !Number.isInteger(n))) {
              setError(`Enter ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
              return;
            }
            setError(null);
            if (n !== value) void onSave(n);
          }}
        />
        {suffix ? <span className="text-[12.5px] text-ink-faint">{suffix}</span> : null}
      </div>
    </Field>
  );
}
