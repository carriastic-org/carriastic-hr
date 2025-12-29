import RadioButton from "./RadioButton";
import Text from "../Text/Text";
import { FieldError } from "react-hook-form";

type RadioGroupProps = {
  options: { label: string; value: string }[];
  name: string;
  selectedValue?: string;
  onChange: (value: string) => void;
  title?: string;
  isRequired?: boolean;
  error?: FieldError | undefined;
  className?: string;
};

function RadioGroup({
  options,
  title = "Select an option:",
  name,
  selectedValue,
  onChange,
  isRequired = false,
  error,
  className = "",
}: RadioGroupProps) {
  return (
    <div className={`radio-group flex flex-col gap-2 ${className}`}>
      <div className="mb-2 flex flex-row gap-[5px]">
        <Text
          text={title}
          className="text-[16px] font-bold text-text_bold dark:text-slate-200"
          isBold
        />
        {isRequired && (
          <span className="text-[16px] font-bold text-tertiary">*</span>
        )}
      </div>

      {options.map((option) => (
        <RadioButton
          key={option.value}
          label={option.label}
          value={option.value}
          name={name}
          selectedValue={selectedValue || ""}
          onChange={onChange}
        />
      ))}
      {error && (
        <div className="text-[14px] text-tertiary">{error.message}</div>
      )}
    </div>
  );
}

export default RadioGroup;
