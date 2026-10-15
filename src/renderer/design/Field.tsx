import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '../lib/cx';

const controlBase =
  'rounded-lg border border-control bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 focus-visible:border-focus focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus/25 disabled:opacity-50 aria-[invalid=true]:border-critical';

/** Controls fill their container unless the caller sets an explicit width. */
const width = (className?: string) => (className && /(^|\s)w-/.test(className) ? '' : 'w-full');

// A neutral grey chevron that reads on both light and dark surfaces.
const CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="#8e8679" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 8 4 4 4-4"/></svg>',
)}")`;

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[12px] text-critical">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return (
      <input ref={ref} className={cx(controlBase, width(className), 'h-9', className)} {...rest} />
    );
  },
);

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(
        controlBase,
        width(className),
        'min-h-[84px] resize-y py-2 leading-relaxed',
        className,
      )}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cx(
          controlBase,
          width(className),
          'h-9 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9',
          className,
        )}
        style={{ backgroundImage: CHEVRON }}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

/** A labelled field whose control is wired up automatically by id. */
export function LabeledInput({
  label,
  hint,
  error,
  suffix,
  className,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  suffix?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <div className="relative">
        <TextInput
          id={id}
          aria-invalid={error ? true : undefined}
          className={suffix ? 'pr-12' : undefined}
          {...input}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12.5px] text-ink-faint">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** A radio group styled as a segmented control (arrow keys move between options). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  className,
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('inline-flex w-fit self-start rounded-lg bg-sunken p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cx(
              'relative inline-flex cursor-default items-center justify-center rounded-md font-medium transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus',
              size === 'sm' ? 'h-6 px-2.5 text-[12px]' : 'h-7 px-3 text-[12.5px]',
              selected
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => {
                onChange(option.value);
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="text-[13.5px] font-medium text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => {
          onChange(!checked);
        }}
        className={cx(
          'relative mt-0.5 inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors duration-150',
          checked ? 'bg-ink' : 'bg-rule-strong',
        )}
      >
        <span
          className={cx(
            'inline-block h-[18px] w-[18px] rounded-full bg-paper shadow transition-transform duration-150',
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  );
}
