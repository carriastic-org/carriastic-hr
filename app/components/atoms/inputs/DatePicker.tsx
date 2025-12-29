/* eslint-disable @typescript-eslint/no-explicit-any */
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

type Props = {
  id?: string;
  name?: string;
  label?: string;
  isRequired?: boolean;
  placeholder?: string;
  className?: string;
  error?: any;
  value?: Date | null;
  onChange: (date: Date | null) => void;
};

function CustomDatePicker(props: Props) {
  const {
    id,
    name = "name",
    className,
    isRequired = false,
    label,
    placeholder,
    error,
    value,
    onChange,
  } = props;

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      <div className="mb-2 flex flex-row gap-[5px]">
        <label
          htmlFor={id}
          className="text-[16px] font-bold text-text_bold dark:text-slate-200"
        >
          {label}
        </label>
        {isRequired && (
          <span className="text-[16px] font-bold text-tertiary">*</span>
        )}
      </div>
      <DatePicker
        className="mb-2 h-[40px] w-full cursor-pointer rounded-[5px] bg-white px-4 text-text_primary shadow-sm shadow-slate-200/70 transition-colors duration-200 focus:outline-none dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-slate-900/40"
        selected={value}
        onChange={onChange}
        placeholderText={placeholder}
        autoComplete="off"
        id={id}
        name={name}
      />
      {error && (
        <div className="text-[14px] text-tertiary">{error.message}</div>
      )}
    </div>
  );
}

export default CustomDatePicker;
