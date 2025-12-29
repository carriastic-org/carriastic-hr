'use client';

import { useEffect, useMemo, useState } from "react";
import ReactPaginate from "react-paginate";

type PaginationProps<T> = {
  data: T[];
  postsPerPage: number;
  setCurrentPageData: (currentPageData: T[]) => void;
};

export default function Pagination<T>({
  data,
  postsPerPage,
  setCurrentPageData,
}: PaginationProps<T>) {
  const [pageNumber, setPageNumber] = useState(0);

  const pageCount = Math.max(1, Math.ceil(data.length / postsPerPage));

  const changePage = ({ selected }: { selected: number }) => {
    setPageNumber(selected);
  };

  useEffect(() => {
    const startIndex = pageNumber * postsPerPage;
    const currentPageData = data.slice(startIndex, startIndex + postsPerPage);
    setCurrentPageData(currentPageData);
  }, [pageNumber, data, postsPerPage, setCurrentPageData]);

  const rangeSummary = useMemo(() => {
    if (data.length === 0) {
      return { start: 0, end: 0 };
    }
    const start = pageNumber * postsPerPage + 1;
    const end = Math.min(data.length, (pageNumber + 1) * postsPerPage);
    return { start, end };
  }, [data.length, pageNumber, postsPerPage]);

  const pillClass =
    "inline-flex h-10 min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-[#0DBAD2] hover:text-[#0DBAD2] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0DBAD2] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-300 dark:focus-visible:outline-sky-400";

  return (
    <div className="mt-6 rounded-[28px] border border-white/60 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
      <div className="flex flex-col gap-4 text-sm text-slate-500 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
          Showing{" "}
          <span className="text-slate-900 dark:text-slate-100">
            {rangeSummary.start}-{rangeSummary.end}
          </span>{" "}
          of{" "}
          <span className="text-slate-900 dark:text-slate-100">
            {data.length}
          </span>{" "}
          records
        </p>
        <ReactPaginate
          breakLabel="..."
          nextLabel="Next"
          onPageChange={changePage}
          pageRangeDisplayed={3}
          pageCount={pageCount}
          previousLabel="Prev"
          containerClassName="flex flex-wrap items-center gap-2"
          pageLinkClassName={pillClass}
          previousLinkClassName={pillClass}
          nextLinkClassName={pillClass}
          breakLinkClassName={`${pillClass} cursor-default`}
          activeLinkClassName="!border-[#0DBAD2] !bg-[#0DBAD2] !text-white hover:!text-white"
          disabledLinkClassName="opacity-40 cursor-not-allowed pointer-events-none"
        />
      </div>
    </div>
  );
}
