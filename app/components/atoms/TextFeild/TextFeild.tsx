type Props = {
  label: string;
  text: string;
  labelColor?: string;
  textColor?: string;
  labelFontFamily?: string;
  textFontFamily?: string;
  labelFontWeight?: number;
  labelFontSize?: string;
  textFontWeight?: number;
  textFontSize?: string;
  className?: string;
};
const TextFeild = (props: Props) => {
  const {
    label,
    text,
    labelColor,
    textColor,
    labelFontFamily = "Inter, sans-serif",
    textFontFamily = "Inter, sans-serif",
    labelFontWeight = 600,
    labelFontSize = "16px",
    textFontWeight = 600,
    textFontSize = "14px",
    className,
  } = props;
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <p
        className={
          labelColor ?? "text-slate-900 dark:text-slate-100"
        }
        style={{
          fontWeight: labelFontWeight,
          fontSize: labelFontSize,
          fontFamily: labelFontFamily,
        }}
      >
        {label}
      </p>
      <p
        className={
          textColor ?? "text-slate-600 dark:text-slate-300"
        }
        style={{
          fontWeight: textFontWeight,
          fontSize: textFontSize,
          fontFamily: textFontFamily,
        }}
      >
        {text}
      </p>
    </div>
  );
};

export default TextFeild;
