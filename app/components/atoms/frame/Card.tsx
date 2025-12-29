import React from "react";
import Text from "../Text/Text";

type Props = {
  className?: string;
  background?: string;
  isSquareBox?: boolean;
  title?: string;
  isTransparentBackground?: boolean;
} & React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>;

export const Card = (props: Props) => {
  const {
    className = "",
    background,
    isSquareBox = false,
    isTransparentBackground = false,
    title,
    ...others
  } = props;

  const rounding = isSquareBox ? "rounded-2xl" : "rounded-[28px]";
  const borderClass = isTransparentBackground
    ? "border border-dashed border-slate-200/80 dark:border-slate-700/60"
    : "border border-white/60 shadow-xl shadow-indigo-100 backdrop-blur transition-colors duration-200 dark:border-slate-700/70 dark:shadow-slate-900/60";
  const backgroundClass = background
    ? background.startsWith("bg-")
      ? background
      : `bg-${background}`
    : isTransparentBackground
    ? "bg-white/70 dark:bg-slate-900/60"
    : "bg-white/90 dark:bg-slate-900/80";

  return (
    <div
      className={`${rounding} relative w-full overflow-hidden ${borderClass} ${backgroundClass} ${className}`}
    >
      {!isTransparentBackground && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/80 via-white/60 to-transparent dark:from-slate-900/60 dark:via-slate-900/40 dark:to-transparent" />
      )}
      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8">
        {title && (
          <div className="space-y-2">
            <Text
              text={title}
              className="text-2xl font-semibold text-slate-900 dark:text-slate-100"
            />
            <div className="section-divider" />
          </div>
        )}
        <div {...others} className="flex flex-col gap-6" />
      </div>
    </div>
  );
};
