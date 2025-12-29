import { trpc } from "@/trpc/client";
import Text from "../atoms/Text/Text";
import Button from "../atoms/buttons/Button";
import { formatDate } from "@/app/(main)/profile/page";

interface LayoutProps {
  hasRightButton?: boolean;
  buttonText?: string;
  onButtonClick?: () => void;
}

export function EmployeeHeader(props: LayoutProps) {
  const {
    hasRightButton = false,
    buttonText = "Click here",
    onButtonClick,
  } = props;
  const { data, isLoading, error } = trpc.user.profile.useQuery();
  const profile = data?.profile;
  const employment = data?.employment;
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    data?.email;
  const employee_designation = employment?.designation ?? "Team Member";
  const joiningDate = formatDate(employment?.startDate);
  return (
    <div className="glass-panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <Text
          text={fullName || "Unnamed Employee"}
          className="text-3xl font-semibold text-slate-900 dark:text-white"
          isBold
        />
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {employee_designation} · Joined on {joiningDate}
        </p>
      </div>
      {hasRightButton && (
        <Button theme="primary" onClick={onButtonClick}>
          <Text text={buttonText} className="font-semibold px-6" />
        </Button>
      )}
    </div>
  );
}
