import { ReactElement } from "react";

type DynamicColor = {
  columnName: string;
  textColors: {
    text: string;
    color: string;
  }[];
};

type TableProps = {
  headers: string[];
  rows: Array<Record<string, string | number | ReactElement>>;
  className?: string;
  dynamicColorValues?: DynamicColor[];
  isTextCenter?: boolean;
  onRowClick?: (row: Record<string, string | number | ReactElement>) => void;
};

export function Table(props: TableProps) {
  const {
    headers,
    rows,
    className,
    dynamicColorValues,
    isTextCenter = false,
    onRowClick,
  } = props;
  return (
    <div
      className={`overflow-x-auto rounded-[24px] border border-white/60 bg-white/90 shadow-sm shadow-slate-200/50 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/50 ${className}`}
    >
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700/70">
            {headers.map((header, index) => (
              <th
                key={index}
                className={`${
                  isTextCenter ? "text-center" : "text-left"
                } py-3 px-4 font-semibold text-slate-700 transition-colors duration-200 dark:text-slate-200`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-b border-slate-100 text-slate-600 transition-colors duration-200 last:border-b-0 dark:border-slate-800/70 dark:text-slate-300 ${
                onRowClick
                  ? "cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                  : ""
              }`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {headers.map((header, headerIndex) => {
                const dynamicColorConfig = dynamicColorValues?.find(
                  (colorConfig) => colorConfig.columnName === header
                );

                const textColors = dynamicColorConfig?.textColors?.find(
                  (textColor) => {
                    if (row[header] === textColor?.text) {
                      return textColor?.color;
                    }
                    return null;
                  }
                )?.color;

                return (
                  <td
                    key={headerIndex}
                    className={`${
                      isTextCenter ? "text-center" : "text-left"
                    } py-3 px-4`}
                    style={{ color: textColors || "var(--text-muted)" }}
                  >
                    {row[header] || "N/A"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
