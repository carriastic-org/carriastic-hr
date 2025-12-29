import type { Gender, UserRole, WorkModel } from "@prisma/client";

export type SeedOrganization = {
  id: string;
  name: string;
  domain: string;
  timezone: string;
  locale: string;
  logoUrl: string;
};

export type SeedDepartment = {
  id: string;
  name: string;
  code: string;
  description: string;
  headId?: string | null;
};

export type SeedTeam = {
  id: string;
  name: string;
  description: string;
  departmentId: string;
};

export type SeedUserConfig = {
  id: string;
  organizationId: string;
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  preferredName: string;
  designation: string;
  employeeCode: string;
  teamId?: string | null;
  departmentId?: string | null;
  workModel?: WorkModel;
  workPhone?: string | null;
  personalPhone?: string | null;
  reportingManagerId?: string | null;
  gender?: Gender;
};

export const NDI_ORG_ID = "org-ndi";

export const organizations: SeedOrganization[] = [
  {
    id: NDI_ORG_ID,
    name: "Demo Company",
    domain: "example.com",
    timezone: "Asia/Dhaka",
    locale: "en-US",
    logoUrl: "/logo/demo.logo.png",
  },
];

export const organizationNameById = organizations.reduce<Record<string, string>>(
  (acc, org) => {
    acc[org.id] = org.name;
    return acc;
  },
  {},
);

export const orgDepartments: Record<string, SeedDepartment[]> = {
  [NDI_ORG_ID]: [
    {
      id: "dept-engineering",
      name: "Engineering",
      code: "ENG",
      description: "Product engineering and platform delivery.",
      headId: "eng-head-sakib",
    },
    {
      id: "dept-design",
      name: "Design",
      code: "DES",
      description: "Research, UX, and visual design.",
      headId: "design-manager-seibun",
    },
    {
      id: "dept-management",
      name: "Management",
      code: "MGT",
      description: "Strategy, HR, and operations.",
      headId: "org-admin-tabuchi",
    },
    {
      id: "dept-sns",
      name: "SNS",
      code: "SNS",
      description: "Comms and social media programs.",
      headId: "eng-head-sakib",
    },
    {
      id: "dept-research",
      name: "Research",
      code: "RSH",
      description: "Product discovery and research.",
      headId: "eng-head-sakib",
    },
  ],
};

export const orgTeams: Record<string, SeedTeam[]> = {
  [NDI_ORG_ID]: [
    {
      id: "team-hr",
      name: "HR Team",
      description: "Executive leadership, HR operations, and people programs.",
      departmentId: "dept-management",
    },
    {
      id: "team-frontend",
      name: "Frontend Team",
      description: "Client-facing applications and UI delivery.",
      departmentId: "dept-engineering",
    },
    {
      id: "team-backend",
      name: "Backend Team",
      description: "APIs, integrations, and data services.",
      departmentId: "dept-engineering",
    },
    {
      id: "team-uiux",
      name: "UI/UX Team",
      description: "Product design, UX research, and brand systems.",
      departmentId: "dept-design",
    },
  ],
};

export const teamDepartmentMap = Object.values(orgTeams)
  .flat()
  .reduce<Record<string, string>>((acc, team) => {
    acc[team.id] = team.departmentId;
    return acc;
  }, {});

const withPhones = (suffix: number) => ({
  workPhone: `+880130000${suffix.toString().padStart(4, "0")}`,
  personalPhone: null,
});

export const usersToCreate: SeedUserConfig[] = [
  {
    id: "super-admin-ndi",
    organizationId: NDI_ORG_ID,
    email: "super.admin@ninja-digital-innovations.com",
    password: "Ndi@1000",
    role: "SUPER_ADMIN",
    firstName: "Super",
    lastName: "Admin",
    preferredName: "Super Admin",
    designation: "Chief People Officer",
    employeeCode: "NDI-0000",
    teamId: "team-hr",
    workModel: "HYBRID",
    reportingManagerId: null,
    gender: "MALE",
    ...withPhones(1000),
  },
  {
    id: "org-owner-kohei",
    organizationId: NDI_ORG_ID,
    email: "kohei.yamamoto@ninja-digital-innovations.com",
    password: "Ndi@1001",
    role: "ORG_OWNER",
    firstName: "Kohei",
    lastName: "Yamamoto",
    preferredName: "Kohei",
    designation: "Chief Executive",
    employeeCode: "NDI-0001",
    teamId: "team-hr",
    workModel: "HYBRID",
    reportingManagerId: "super-admin-ndi",
    gender: "MALE",
    ...withPhones(1001),
  },
  {
    id: "org-admin-tabuchi",
    organizationId: NDI_ORG_ID,
    email: "satoru.tabuchi@ninja-digital-innovations.com",
    password: "Ndi@1002",
    role: "ORG_ADMIN",
    firstName: "Satoru",
    lastName: "Tabuchi",
    preferredName: "Tabuchi",
    designation: "General Manager",
    employeeCode: "NDI-0002",
    teamId: "team-hr",
    workModel: "HYBRID",
    reportingManagerId: "org-owner-kohei",
    gender: "MALE",
    ...withPhones(1002),
  },
  {
    id: "eng-head-sakib",
    organizationId: NDI_ORG_ID,
    email: "robiul.sakib@ninja-digital-innovations.com",
    password: "Ndi@1003",
    role: "MANAGER",
    firstName: "Md. Robiul",
    lastName: "Islam",
    preferredName: "Sakib",
    designation: "Head of Engineering",
    employeeCode: "NDI-0003",
    teamId: "team-backend",
    departmentId: "dept-engineering",
    workModel: "HYBRID",
    reportingManagerId: "org-admin-tabuchi",
    gender: "MALE",
    ...withPhones(1003),
  },
  {
    id: "design-manager-seibun",
    organizationId: NDI_ORG_ID,
    email: "seibun.to@ninja-digital-innovations.com",
    password: "Ndi@1004",
    role: "MANAGER",
    firstName: "Seibun",
    lastName: "To",
    preferredName: "Seibun",
    designation: "Design Manager",
    employeeCode: "NDI-0004",
    teamId: "team-uiux",
    departmentId: "dept-design",
    workModel: "HYBRID",
    reportingManagerId: "org-admin-tabuchi",
    gender: "MALE",
    ...withPhones(1004),
  },
  {
    id: "frontend-lead-hazrat",
    organizationId: NDI_ORG_ID,
    email: "hazrat.ali@ninja-digital-innovations.com",
    password: "Ndi@1005",
    role: "EMPLOYEE",
    firstName: "Md. Hazrat",
    lastName: "Ali",
    preferredName: "Hazrat",
    designation: "Frontend Lead",
    employeeCode: "NDI-0005",
    teamId: "team-frontend",
    workModel: "ONSITE",
    reportingManagerId: "eng-head-sakib",
    gender: "MALE",
    ...withPhones(1005),
  },
  {
    id: "backend-lead-sufi",
    organizationId: NDI_ORG_ID,
    email: "sufi.hossain@ninja-digital-innovations.com",
    password: "Ndi@1006",
    role: "EMPLOYEE",
    firstName: "Sufi Aurangzeb",
    lastName: "Hossain",
    preferredName: "Sufi",
    designation: "Backend Lead",
    employeeCode: "NDI-0006",
    teamId: "team-backend",
    workModel: "ONSITE",
    reportingManagerId: "eng-head-sakib",
    gender: "MALE",
    ...withPhones(1006),
  },
  {
    id: "designer-lead-tahmina",
    organizationId: NDI_ORG_ID,
    email: "tahmina.akter@ninja-digital-innovations.com",
    password: "Ndi@1007",
    role: "EMPLOYEE",
    firstName: "Tahmina",
    lastName: "Akter",
    preferredName: "Tahmina",
    designation: "Design Lead",
    employeeCode: "NDI-0007",
    teamId: "team-uiux",
    departmentId: "dept-design",
    workModel: "HYBRID",
    reportingManagerId: "design-manager-seibun",
    gender: "FEMALE",
    ...withPhones(1007),
  },
  {
    id: "emp-zahidul",
    organizationId: NDI_ORG_ID,
    email: "zahidul.islam@ninja-digital-innovations.com",
    password: "Ndi@1008",
    role: "EMPLOYEE",
    firstName: "Md. Zahidul",
    lastName: "Islam",
    preferredName: "Zahidul",
    designation: "Senior Frontend Engineer",
    employeeCode: "NDI-0008",
    teamId: "team-frontend",
    workModel: "ONSITE",
    reportingManagerId: "frontend-lead-hazrat",
    gender: "MALE",
    ...withPhones(1008),
  },
  {
    id: "emp-mustahid",
    organizationId: NDI_ORG_ID,
    email: "mustahid.hasan@ninja-digital-innovations.com",
    password: "Ndi@1009",
    role: "EMPLOYEE",
    firstName: "Mustahid",
    lastName: "Hasan",
    preferredName: "Mustahid",
    designation: "Backend Engineer",
    employeeCode: "NDI-0009",
    teamId: "team-backend",
    workModel: "ONSITE",
    reportingManagerId: "backend-lead-sufi",
    gender: "MALE",
    ...withPhones(1009),
  },
  {
    id: "emp-saiful",
    organizationId: NDI_ORG_ID,
    email: "saiful.islam@ninja-digital-innovations.com",
    password: "Ndi@1010",
    role: "EMPLOYEE",
    firstName: "Saiful Islam",
    lastName: "Rifat",
    preferredName: "Rifat",
    designation: "Frontend Engineer",
    employeeCode: "NDI-0010",
    teamId: "team-frontend",
    workModel: "ONSITE",
    reportingManagerId: "frontend-lead-hazrat",
    gender: "MALE",
    ...withPhones(1010),
  },
  {
    id: "emp-omar",
    organizationId: NDI_ORG_ID,
    email: "omar.shahariar@ninja-digital-innovations.com",
    password: "Ndi@1011",
    role: "EMPLOYEE",
    firstName: "Md. Omar",
    lastName: "Shahariar",
    preferredName: "Omar",
    designation: "Frontend Engineer",
    employeeCode: "NDI-0011",
    teamId: "team-frontend",
    workModel: "HYBRID",
    reportingManagerId: "frontend-lead-hazrat",
    gender: "MALE",
    ...withPhones(1011),
  },
  {
    id: "emp-sohel",
    organizationId: NDI_ORG_ID,
    email: "sohel.rana@ninja-digital-innovations.com",
    password: "Ndi@1012",
    role: "EMPLOYEE",
    firstName: "Md. Sohel",
    lastName: "Rana",
    preferredName: "Sohel",
    designation: "Backend Engineer",
    employeeCode: "NDI-0012",
    teamId: "team-backend",
    workModel: "ONSITE",
    reportingManagerId: "backend-lead-sufi",
    gender: "MALE",
    ...withPhones(1012),
  },
  {
    id: "emp-sourov",
    organizationId: NDI_ORG_ID,
    email: "sourov.mia@ninja-digital-innovations.com",
    password: "Ndi@1013",
    role: "EMPLOYEE",
    firstName: "Md. Sourov",
    lastName: "Mia",
    preferredName: "Sourov",
    designation: "Backend Engineer",
    employeeCode: "NDI-0013",
    teamId: "team-backend",
    workModel: "REMOTE",
    reportingManagerId: "backend-lead-sufi",
    gender: "MALE",
    ...withPhones(1013),
  },
  {
    id: "emp-sunny",
    organizationId: NDI_ORG_ID,
    email: "sunny.sutradhar@ninja-digital-innovations.com",
    password: "Ndi@1014",
    role: "EMPLOYEE",
    firstName: "Sunny",
    lastName: "Sutradhar",
    preferredName: "Sunny",
    designation: "Backend Engineer",
    employeeCode: "NDI-0014",
    teamId: "team-backend",
    workModel: "ONSITE",
    reportingManagerId: "backend-lead-sufi",
    gender: "MALE",
    ...withPhones(1014),
  },
  {
    id: "emp-mueem",
    organizationId: NDI_ORG_ID,
    email: "mueem.nahid@ninja-digital-innovations.com",
    password: "Ndi@1015",
    role: "EMPLOYEE",
    firstName: "Mueem Nahid",
    lastName: "Ibn Mahbub",
    preferredName: "Mueem",
    designation: "Frontend Engineer",
    employeeCode: "NDI-0015",
    teamId: "team-frontend",
    workModel: "REMOTE",
    reportingManagerId: "frontend-lead-hazrat",
    gender: "MALE",
    ...withPhones(1015),
  },
  {
    id: "emp-rafidul",
    organizationId: NDI_ORG_ID,
    email: "rafidul.islam@ninja-digital-innovations.com",
    password: "Ndi@1016",
    role: "EMPLOYEE",
    firstName: "Md. Rafidul",
    lastName: "Islam",
    preferredName: "Rafid",
    designation: "Frontend Engineer",
    employeeCode: "NDI-0016",
    teamId: "team-frontend",
    workModel: "ONSITE",
    reportingManagerId: "frontend-lead-hazrat",
    gender: "MALE",
    ...withPhones(1016),
  },
  {
    id: "emp-masud",
    organizationId: NDI_ORG_ID,
    email: "masud.rana@ninja-digital-innovations.com",
    password: "Ndi@1017",
    role: "EMPLOYEE",
    firstName: "Masud",
    lastName: "Rana",
    preferredName: "Masud",
    designation: "Product Designer",
    employeeCode: "NDI-0017",
    teamId: "team-uiux",
    workModel: "HYBRID",
    reportingManagerId: "design-manager-seibun",
    gender: "MALE",
    ...withPhones(1017),
  },
  {
    id: "hr-yeasir",
    organizationId: NDI_ORG_ID,
    email: "yeasir.arafat@ninja-digital-innovations.com",
    password: "Ndi@1018",
    role: "HR_ADMIN",
    firstName: "Md. Yeasir",
    lastName: "Arafat",
    preferredName: "Yeasir",
    designation: "HR Executive",
    employeeCode: "NDI-0018",
    teamId: "team-hr",
    workModel: "ONSITE",
    reportingManagerId: "org-admin-tabuchi",
    gender: "MALE",
    ...withPhones(1018),
  },
  {
    id: "hr-arpon",
    organizationId: NDI_ORG_ID,
    email: "arpon.hasan@ninja-digital-innovations.com",
    password: "Ndi@1019",
    role: "HR_ADMIN",
    firstName: "Mohammad Arpon",
    lastName: "Hasan",
    preferredName: "Arpon",
    designation: "HR Officer",
    employeeCode: "NDI-0019",
    teamId: "team-hr",
    workModel: "HYBRID",
    reportingManagerId: "hr-yeasir",
    gender: "MALE",
    ...withPhones(1019),
  },
];

export const teamLeadAssignments: Array<{ teamId: string; leadUserIds: string[] }> = [
  { teamId: "team-hr", leadUserIds: ["org-owner-kohei", "org-admin-tabuchi"] },
  { teamId: "team-frontend", leadUserIds: ["frontend-lead-hazrat"] },
  { teamId: "team-backend", leadUserIds: ["backend-lead-sufi", "eng-head-sakib"] },
  { teamId: "team-uiux", leadUserIds: ["designer-lead-tahmina"] },
];

export const teamManagerAssignments: Array<{ managerId: string; teamIds: string[] }> = [
  {
    managerId: "eng-head-sakib",
    teamIds: ["team-frontend", "team-backend"],
  },
  {
    managerId: "org-admin-tabuchi",
    teamIds: ["team-hr"],
  },
  {
    managerId: "design-manager-seibun",
    teamIds: ["team-uiux"],
  },
];
