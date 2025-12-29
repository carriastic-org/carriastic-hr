type RadioButtonProps = {
  label: string;
  value: string;
  name: string;
  selectedValue: string;
  onChange: (value: string) => void;
};

function RadioButton({ label, value, name, selectedValue, onChange }: RadioButtonProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selectedValue === value}
        onChange={() => onChange(value)}
        className={`h-4 w-4 appearance-none rounded-full border transition-colors duration-150 ${
          selectedValue === value
            ? "border-[#0DBAD2] bg-[#0DBAD2] shadow-[0_0_0_3px_rgba(13,186,210,0.25)]"
            : "border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-900"
        }`}
      />
      <span className="text-text_primary dark:text-slate-300">{label}</span>
    </label>
  );
}

export default RadioButton;
