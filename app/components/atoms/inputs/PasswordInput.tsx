'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { UseFormRegister, type FieldError } from "react-hook-form";
import { TbEyeFilled } from "react-icons/tb";
import { IoMdEyeOff } from "react-icons/io";
import { useState } from "react";

type Props = {
  className?: string;
  isRequired?: boolean;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  value?: string;
  error?: FieldError | undefined;
  id?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  register?: UseFormRegister<any>;
};

function PasswordInput(props: Props) {
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
    onChange,
  } = props;

  const [viewPassword, setViewPassword] = useState<boolean>(false);

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
      <div className="relative h-[56px] w-full">
        <input
          id={id}
          className="mb-2 h-[40px] w-full rounded-[5px] bg-white px-4 text-text_primary shadow-sm shadow-slate-200/70 transition-colors duration-200 focus:outline-none dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-slate-900/40"
          type={viewPassword ? "text" : "password"}
          defaultValue={defaultValue}
          value={value}
          placeholder={placeholder ? placeholder : "********"}
          onChange={onChange}
          {...register?.(name)}
        />
        {viewPassword ? (
          <TbEyeFilled
            size={22}
            className="absolute -top-6 bottom-0 right-[6px] m-auto cursor-pointer text-text_bold md:-top-5 md:right-[8px] dark:text-slate-300"
            onClick={() => setViewPassword((prev) => !prev)}
          />
        ) : (
          <IoMdEyeOff
            size={22}
            className="absolute -top-6 bottom-0 right-[6px] m-auto cursor-pointer text-text_bold md:-top-5 md:right-[8px] dark:text-slate-300"
            onClick={() => setViewPassword((prev) => !prev)}
          />
        )}
        {error && (
          <div className="text-[14px] text-tertiary">{error.message}</div>
        )}
      </div>
    </div>
  );
}

export default PasswordInput;
