"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IoIosCloseCircle } from "react-icons/io";
import Button from "../buttons/Button";

type Props = {
  titleTextSize?: string;
  buttonHeight?: string;
  buttonWidth?: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onDoneClick?: () => void;
  className?: string;
  title: string;
  children?: ReactNode;
  closeOnClick?: () => void;
  isDoneButton?: boolean;
  doneButtonText: string;
  isCancelButton?: boolean;
  cancelButtonText?: string;
  minWidthModal?: string;
  crossOnClick?: () => void;
};

export const Modal = (props: Props) => {
  const {
    open,
    setOpen,
    className = "",
    buttonHeight,
    buttonWidth,
    children,
    title,
    isDoneButton = true,
    doneButtonText,
    onDoneClick,
    closeOnClick,
    isCancelButton = false,
    cancelButtonText,
    titleTextSize,
    crossOnClick,
    minWidthModal,
  } = props;

  const headingId = useId();

  const handleClose = useCallback(() => {
    if (closeOnClick) {
      closeOnClick();
    } else if (setOpen) {
      setOpen(false);
    }
  }, [closeOnClick, setOpen]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  if (!open || typeof document === "undefined") return null;

  const handleBackdropClick = () => {
    handleClose();
  };

  const widthClass =
    minWidthModal ??
    "w-[min(90vw,520px)] max-h-[90vh] overflow-hidden sm:w-[min(85vw,560px)]";

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center text-slate-800 dark:text-slate-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? headingId : undefined}
    >
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm dark:bg-slate-950/60"
        onClick={handleBackdropClick}
      />
      <div
        className={`relative z-10 flex flex-col gap-6 rounded-[28px] border border-white/60 bg-white/95 p-6 text-slate-700 shadow-2xl shadow-black/10 backdrop-blur transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/85 dark:text-slate-200 dark:shadow-slate-900/70 ${widthClass} ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              id={title ? headingId : undefined}
              className={`font-semibold text-slate-900 dark:text-slate-100 ${
                titleTextSize ?? "text-xl"
              }`}
            >
              {title}
            </p>
            <div className="section-divider mt-4" />
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            className="text-3xl text-slate-400 transition-colors hover:text-indigo-500 dark:text-slate-500 dark:hover:text-sky-400"
            onClick={crossOnClick || handleClose}
          >
            <IoIosCloseCircle />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto pr-1 text-sm text-slate-600 dark:text-slate-300">
          {children}
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          {isDoneButton && (
            <div
              style={{
                width: buttonWidth,
                height: buttonHeight,
              }}
            >
              <Button isWidthFull onClick={onDoneClick}>
                {doneButtonText}
              </Button>
            </div>
          )}
          {isCancelButton && (
            <div
              style={{
                width: buttonWidth,
                height: buttonHeight,
              }}
            >
              <Button theme="secondary" isWidthFull onClick={handleClose}>
                {cancelButtonText}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
