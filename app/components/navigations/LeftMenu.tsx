'use client';

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { BiChevronDown, BiChevronUp, BiLogOut } from "react-icons/bi";
import {
  FaBell,
  FaCalendarCheck,
  FaClipboardList,
  FaEdit,
  FaEnvelopeOpenText,
  FaEye,
  FaFileInvoice,
  FaUser,
  FaUsers,
} from "react-icons/fa";
import { MdOutlineAdminPanelSettings, MdOutlineDashboard } from "react-icons/md";
import { TbReport, TbReportAnalytics } from "react-icons/tb";
import { HiOutlineDocumentText } from "react-icons/hi";
import { IoIosPaper } from "react-icons/io";
import { FiSettings } from "react-icons/fi";
import { Modal } from "../atoms/frame/Modal";
import { trpc } from "@/trpc/client";
import { DEFAULT_ORGANIZATION_LOGO } from "@/lib/organization-branding";

type Props = {
  isLeader?: boolean;
  canAccessHrAdmin?: boolean;
  className?: string;
  organizationName?: string;
  userFullName?: string;
  organizationLogoUrl?: string;
};

const menuItems = [
  { label: "Dashboard", icon: <MdOutlineDashboard />, href: "/" },
  { label: "Profile", icon: <FaUser />, href: "/profile" },
  { label: "Attendance", icon: <FaCalendarCheck />, href: "/attendance" },
  { label: "Calender", icon: <FaCalendarCheck />, href: "/calender" },
  {
    label: "Leave",
    icon: <FaClipboardList />,
    href: "/leave",
    subItems: [
      {
        label: "Leave History",
        icon: <HiOutlineDocumentText />,
        href: "/leave",
      },
      {
        label: "Leave Application",
        icon: <IoIosPaper />,
        href: "/leave/application",
      },
    ],
  },

  {
    label: "Daily Report",
    icon: <TbReport />,
    href: "/report/daily",
    subItems: [
      {
        label: "Daily Report",
        icon: <HiOutlineDocumentText />,
        href: "/report/daily",
      },
      {
        label: "Daily Report History",
        icon: <IoIosPaper />,
        href: "/report/daily/history",
      },
    ],
  },

  {
    label: "Monthly Report",
    icon: <TbReportAnalytics />,
    href: "/report/monthly",
    subItems: [
      {
        label: "Monthly Report",
        icon: <HiOutlineDocumentText />,
        href: "/report/monthly",
      },
      {
        label: "Monthly Report History",
        icon: <IoIosPaper />,
        href: "/report/monthly/history",
      },
    ],
  },
  { label: "Messages", icon: <FaEnvelopeOpenText />, href: "/messages" },
  { label: "Notification", icon: <FaBell />, href: "/notification" },
  { label: "Invoice", icon: <FaFileInvoice />, href: "/invoice" },
  { label: "Settings", icon: <FiSettings />, href: "/settings" },
];

type DropdownKey = "profile" | "leave" | "daily" | "monthly" | null;

const LeftMenu = ({
  isLeader = false,
  canAccessHrAdmin = false,
  className = "",
  organizationName = "Demo Company",
  userFullName,
  organizationLogoUrl = DEFAULT_ORGANIZATION_LOGO,
}: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "/";
  const unseenNotificationQuery = trpc.notification.unseenCount.useQuery(undefined, {
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });
  const unseenNotifications = unseenNotificationQuery.data?.unseen ?? 0;

  const deriveSectionFromPath = (path: string): DropdownKey => {
    if (path.startsWith("/profile")) return "profile";
    if (path.startsWith("/leave")) return "leave";
    if (path.startsWith("/report/daily")) return "daily";
    if (path.startsWith("/report/monthly")) return "monthly";
    return null;
  };

  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(
    deriveSectionFromPath(currentPath)
  );
  const [isOpenModal, setIsOpenModal] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoSrc =
    organizationLogoUrl && organizationLogoUrl.trim().length
      ? organizationLogoUrl
      : DEFAULT_ORGANIZATION_LOGO;

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      await signOut({ redirect: false });
      router.push("/auth/login");
    } catch (error) {
      void error;
      setLogoutError("Failed to log out. Please try again.");
    } finally {
      setIsLoggingOut(false);
      setIsOpenModal(false);
    }
  };

  const nameFallback = useMemo(() => {
    if (userFullName && userFullName.trim().length > 0) {
      return userFullName;
    }
    return "Team Member";
  }, [userFullName]);

  useEffect(() => {
    // Keep dropdown state aligned with the current route selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenDropdown(deriveSectionFromPath(currentPath));
  }, [currentPath]);

  const profileDropdownOpen = openDropdown === "profile";
  const leaveDropdownOpen = openDropdown === "leave";
  const dailyReportDropdownOpen = openDropdown === "daily";
  const monthlyReportDropdownOpen = openDropdown === "monthly";

  const toggleDropdown = (key: Exclude<DropdownKey, null>) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const getNavClasses = (isActive: boolean) =>
    [
      "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200",
      isActive
        ? "bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow-lg shadow-indigo-500/30 dark:shadow-sky-900/40 rounded"
        : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100 rounded",
    ].join(" ");

  const getSubNavClasses = (isActive: boolean) =>
    [
      "flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition-all duration-200",
      isActive
        ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-800/80 dark:text-sky-300 dark:shadow-slate-900/40"
        : "text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100",
    ].join(" ");

  const isRouteActive = (href: string) => {
    if (href === "/") {
      return currentPath === "/";
    }
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const containerClasses = [
    "flex min-h-full w-full flex-col gap-4 rounded-[32px] border border-white/60 bg-white/90 p-6 text-slate-700 shadow-2xl shadow-indigo-100 backdrop-blur transition-colors duration-200 md:min-w-[18rem]",
    "dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 dark:shadow-slate-900/60",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div className="sticky top-0 z-20 flex flex-col items-center gap-3 rounded-[24px] bg-white/95 pb-2 text-center backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:text-left dark:bg-slate-900/85">
        <div className="flex flex-row items-center justify-center gap-2 sm:justify-start">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
            <Image
              src={logoSrc}
              alt="Organization logo"
              width={64}
              height={64}
              className="h-10 w-10 object-contain"
              priority
            />
          </div>
          <div>
            <p className="text-base font-semibold text-[#364a6e] dark:text-slate-100">
              {organizationName}
            </p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {nameFallback}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.label}>
              {item.label === "Profile" ? (
                <div>
                  <button
                    onClick={() => toggleDropdown("profile")}
                    className={getNavClasses(currentPath.startsWith("/profile"))}
                  >
                    {item.icon}
                    <span className="text-[16px] font-semibold">
                      {item.label}
                    </span>
                    {profileDropdownOpen ? (
                      <BiChevronUp className="ml-auto" />
                    ) : (
                      <BiChevronDown className="ml-auto" />
                    )}
                  </button>

                  {profileDropdownOpen && (
                    <ul className="mt-2 space-y-2 pl-4">
                      <li>
                        <Link
                          href="/profile"
                          className={getSubNavClasses(currentPath === "/profile")}
                        >
                          <FaEye />
                          <span className="text-[14px] font-medium">
                            View Profile
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/profile/edit"
                          className={getSubNavClasses(
                            currentPath === "/profile/edit"
                          )}
                        >
                          <FaEdit />
                          <span className="text-[14px] font-medium">
                            Edit Profile
                          </span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              ) : item.label === "Leave" ? (
                <div>
                  <button
                    onClick={() => toggleDropdown("leave")}
                    className={getNavClasses(currentPath.startsWith("/leave"))}
                  >
                    {item.icon}
                    <span className="text-[16px] font-semibold">
                      {item.label}
                    </span>
                    {leaveDropdownOpen ? (
                      <BiChevronUp className="ml-auto" />
                    ) : (
                      <BiChevronDown className="ml-auto" />
                    )}
                  </button>

                  {leaveDropdownOpen && (
                    <ul className="mt-2 space-y-2 pl-4">
                      <li>
                        <Link
                          href="/leave"
                          className={getSubNavClasses(currentPath === "/leave")}
                        >
                          <HiOutlineDocumentText />
                          <span className="text-[14px] font-medium">
                            History
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/leave/application"
                          className={getSubNavClasses(
                            currentPath === "/leave/application"
                          )}
                        >
                          <IoIosPaper />
                          <span className="text-[14px] font-medium">
                            Application
                          </span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              ) : item.label === "Notification" ? (
                <Link
                  href={item.href}
                  className={getNavClasses(isRouteActive("/notification"))}
                >
                  {item.icon}
                  <span className="text-[16px] font-semibold">
                    {item.label}
                  </span>
                  {unseenNotifications > 0 ? (
                    <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-100">
                      {unseenNotifications}
                    </span>
                  ) : null}
                </Link>
              ) : item.label === "Invoice" ? (
                <Link
                  href={item.href}
                  className={getNavClasses(isRouteActive("/invoice"))}
                >
                  {item.icon}
                  <span className="text-[16px] font-semibold">
                    {item.label}
                  </span>
                </Link>
              ) : item.label === "Daily Report" ? (
                <div>
                  <button
                    onClick={() => toggleDropdown("daily")}
                    className={getNavClasses(
                      currentPath.startsWith("/report/daily")
                    )}
                  >
                    {item.icon}
                    <span className="text-[16px] font-semibold">
                      {item.label}
                    </span>
                    {dailyReportDropdownOpen ? (
                      <BiChevronUp className="ml-auto" />
                    ) : (
                      <BiChevronDown className="ml-auto" />
                    )}
                  </button>

                  {dailyReportDropdownOpen && (
                    <ul className="mt-2 space-y-2 pl-4">
                      <li>
                        <Link
                          href="/report/daily/history"
                          className={getSubNavClasses(
                            currentPath === "/report/daily/history"
                          )}
                        >
                          <HiOutlineDocumentText />
                          <span className="text-[14px] font-medium">
                            History
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/report/daily"
                          className={getSubNavClasses(
                            currentPath === "/report/daily"
                          )}
                        >
                          <IoIosPaper />
                          <span className="text-[14px] font-medium">
                            Report
                          </span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              ) : item.label === "Monthly Report" ? (
                <div>
                  <button
                    onClick={() => toggleDropdown("monthly")}
                    className={getNavClasses(
                      currentPath.startsWith("/report/monthly")
                    )}
                  >
                    {item.icon}
                    <span className="text-[16px] font-semibold">
                      {item.label}
                    </span>
                    {monthlyReportDropdownOpen ? (
                      <BiChevronUp className="ml-auto" />
                    ) : (
                      <BiChevronDown className="ml-auto" />
                    )}
                  </button>

                  {monthlyReportDropdownOpen && (
                    <ul className="mt-2 space-y-2 pl-4">
                      <li>
                        <Link
                          href="/report/monthly/history"
                          className={getSubNavClasses(
                            currentPath === "/report/monthly/history"
                          )}
                        >
                          <HiOutlineDocumentText />
                          <span className="text-[14px] font-medium">
                            History
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/report/monthly"
                          className={getSubNavClasses(
                            currentPath === "/report/monthly"
                          )}
                        >
                          <IoIosPaper />
                          <span className="text-[14px] font-medium">
                            Report
                          </span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={getNavClasses(isRouteActive(item.href))}
                >
                  {item.icon}
                  <span className="text-[16px] font-semibold">
                    {item.label}
                  </span>
                </Link>
              )}
            </li>
          ))}
            <li>
              <Link
                href="/my-team"
                className={getNavClasses(currentPath === "/my-team")}
              >
                <FaUsers />
                <span className="text-[16px] font-semibold">My Team</span>
              </Link>
            </li>
        </ul>
        {canAccessHrAdmin && (
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 rounded dark:border-slate-700/80 dark:bg-slate-800/60">
            <Link
              href="/hr-admin"
              target="_blank"
              className={`${getNavClasses(isRouteActive("/hr-admin"))}`}
            >
              <MdOutlineAdminPanelSettings className="text-lg" />
              <span className="text-[16px] font-semibold">
                HR Admin Dashboard
              </span>
            </Link>
          </div>
        )}
      </nav>

      <div className="mt-auto w-full">
        <div className="section-divider" />
        <button
          type="button"
          onClick={() => setIsOpenModal(true)}
          disabled={isLoggingOut}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 dark:from-rose-500 dark:via-amber-500 dark:to-orange-400 dark:shadow-rose-900/50 rounded"
        >
          <BiLogOut className="text-lg" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
        {logoutError ? (
          <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {logoutError}
          </p>
        ) : null}
      </div>

      <Modal
        doneButtonText="Log Out"
        cancelButtonText="Cancel"
        isCancelButton
        className="h-auto w-[496px]"
        open={isOpenModal}
        setOpen={setIsOpenModal}
        title="Log Out ?"
        buttonWidth="120px"
        buttonHeight="40px"
        onDoneClick={handleLogout}
        closeOnClick={() => setIsOpenModal(false)}
      >
        <div>Are you sure you would like to log out?</div>
      </Modal>
    </div>
  );
};

export default LeftMenu;
