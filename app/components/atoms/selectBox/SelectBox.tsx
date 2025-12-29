/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FieldError, UseFormRegister } from "react-hook-form";
import type { ChangeEvent } from "react";
type Option = {
  label: string;
  value: string;
};

type SelectBoxProps = {
  label?: string;
  options: Option[];
  name?: string;
  className?: string;
  isRequired?: boolean;
  register?: UseFormRegister<any>;
  error?: FieldError | undefined;
  includePlaceholder?: boolean;
  placeholderLabel?: string;
  isDisabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
};

export default function SelectBox({
  label = "Select Option",
  options = [],
  className = "",
  name = "name",
  isRequired = false,
  error,
  register,
  includePlaceholder = true,
  placeholderLabel = "Select Any",
  isDisabled = false,
  value,
  defaultValue,
  onChange,
}: SelectBoxProps) {
  const placeholderOptions = includePlaceholder ? [{ label: placeholderLabel, value: "" }] : [];
  const allOptions = [...placeholderOptions, ...options];
  const registerProps =
    register && value === undefined && onChange === undefined ? register(name) : undefined;
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex flex-row gap-1">
        <label
          className="text-[16px] font-bold text-text_bold dark:text-slate-200"
          htmlFor={label}
        >
          {label}
        </label>
        {isRequired && (
          <span className="text-[16px] font-bold text-tertiary">*</span>
        )}
      </div>

      <select
        id={label}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        {...registerProps}
        className={`h-[40px] rounded-lg border border-white/60 bg-white px-4 text-[16px] text-text_primary shadow-sm shadow-slate-200/70 transition-colors duration-200 focus:outline-none hover:cursor-pointer dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-900/40 ${className}`}
        disabled={isDisabled}
      >
        {options.length > 0 ? (
          allOptions.map((option, index) => (
            <option
              key={index}
              value={option.value}
              className="hover:bg-primary"
            >
              {option.label}
            </option>
          ))
        ) : (
          <option disabled>No options available</option>
        )}
      </select>
      {error && (
        <div className="text-[14px] text-tertiary mt-2">{error.message}</div>
      )}
    </div>
  );
}
