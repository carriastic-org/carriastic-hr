/* eslint-disable @typescript-eslint/no-explicit-any */
import { UseFormRegister, type FieldError } from "react-hook-form"

type Props = {
  className?: string;
  isRequired?: boolean;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  value?: string;
  error?: FieldError | undefined;
  id?: string;
  height?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  name?: string;
  register?: UseFormRegister<any>;
  readOnly?: boolean;
  disabled?: boolean;
};

function TextArea(props: Props) {
  const {
    id,
    name = "name",
    register,
    className,
    isRequired = false,
    label,
    defaultValue,
    placeholder,
    value,
    error,
    height,
    onChange,
    readOnly = false,
    disabled = false,
  } = props;


  return (
    <div className={`flex flex-col ${className}`}>
      <div className="mb-2 flex flex-row gap-[5px]">
        <label className="text-[16px] font-bold text-text_bold dark:text-slate-200">
          {label}
        </label>
        {isRequired && (
          <span className="text-[16px] font-bold text-tertiary">*</span>
        )}
      </div>
      <textarea
        id={id}
        className="mb-2 w-full rounded-[5px] bg-white p-4 text-text_primary shadow-sm shadow-slate-200/70 transition-colors duration-200 focus:outline-none dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-slate-900/40"
        style={{ height: height || "100px" }}
        defaultValue={defaultValue}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        readOnly={readOnly}
        disabled={disabled}
        {...register?.(name)}
      />
      {error && <div className="text-[14px] text-tertiary">{error.message}</div>}
    </div>
  );
}

export default TextArea;
