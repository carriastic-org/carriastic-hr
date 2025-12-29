'use client';

/* eslint-disable @next/next/no-img-element */
import { ChangeEvent } from "react";

type ImageInputProps = {
  className?: string;
  label?: string;
  id?: string;
  isRequired?: boolean;
  initialImage?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  isUploading?: boolean;
  error?: string | null;
};

const ImageInput = (props: ImageInputProps) => {
  const {
    className,
    label,
    id,
    isRequired = false,
    initialImage = "/default_profile.png",
    onChange,
    isUploading = false,
    error = null,
  } = props;

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <div className="mb-2 flex gap-1">
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
      )}

      <div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/80 shadow shadow-slate-200/50 transition-colors duration-200 dark:border-slate-700 dark:shadow-slate-900/50">
        <img
          src={initialImage}
          alt="Profile preview"
          className="h-full w-full object-cover"
        />

        <label
          htmlFor={id}
          className={`absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-white opacity-0 transition-opacity ${
            isUploading ? "cursor-not-allowed opacity-100" : "hover:opacity-100"
          }`}
        >
          <span className="text-sm font-semibold">
            {isUploading ? "Uploading..." : "Change"}
          </span>
        </label>

        <input
          id={id}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onChange}
          disabled={isUploading}
        />
      </div>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>
      ) : null}
    </div>
  );
};

export default ImageInput;
