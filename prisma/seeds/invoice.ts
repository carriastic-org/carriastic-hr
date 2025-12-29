import { InvoiceStatus, PrismaClient } from "@prisma/client";

import { NDI_ORG_ID, usersToCreate } from "./data";

const formatAmount = (value: number) => value.toFixed(2);

const defaultLineItems = [
  { description: "Base compensation", quantity: 1, unitPrice: 3200 },
  { description: "Transport allowance", quantity: 1, unitPrice: 150 },
  { description: "Performance bonus", quantity: 1, unitPrice: 450 },
];

export const seedInvoices = async (prisma: PrismaClient) => {
  const existing = await prisma.invoice.count();
  if (existing > 0) {
    return;
  }

  const hrAuthor = await prisma.user.findFirst({
    where: {
      organizationId: NDI_ORG_ID,
      role: {
        in: ["HR_ADMIN", "ORG_ADMIN", "ORG_OWNER", "SUPER_ADMIN"],
      },
    },
    select: { id: true, organizationId: true },
  });

  if (!hrAuthor) {
    console.warn("Skipping invoice seeds because no HR/Org admin exists.");
    return;
  }

  const employeeIds = usersToCreate
    .filter((user) => user.role === "EMPLOYEE")
    .slice(0, 3)
    .map((user) => user.id);

  if (!employeeIds.length) {
    console.warn("Skipping invoice seeds because no employees found.");
    return;
  }

  const employees = await prisma.user.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true },
  });

  const today = new Date();
  const baseYear = today.getFullYear();
  const baseMonth = today.getMonth() + 1;

  for (const [index, employee] of employees.entries()) {
    const monthOffset = employees.length - index;
    const periodMonth = ((baseMonth - monthOffset + 12 - 1) % 12) + 1;
    const yearAdjustment = baseMonth - monthOffset <= 0 ? 1 : 0;
    const periodYear = baseYear - yearAdjustment;

    const lineItems = defaultLineItems.map((item, itemIndex) => ({
      ...item,
      unitPrice: item.unitPrice + index * 100 + itemIndex * 25,
    }));

    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const taxRate = index === 0 ? 0.05 : index === 1 ? 0.08 : 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const status: InvoiceStatus =
      index === 0
        ? InvoiceStatus.READY_TO_DELIVER
        : index === 1
          ? InvoiceStatus.PENDING_REVIEW
          : InvoiceStatus.DRAFT;

    const sentAt = status !== InvoiceStatus.DRAFT ? new Date() : null;
    const confirmedAt = status === InvoiceStatus.READY_TO_DELIVER ? new Date() : null;
    const readyAt = status === InvoiceStatus.READY_TO_DELIVER ? new Date() : null;

    await prisma.invoice.create({
      data: {
        organizationId: hrAuthor.organizationId,
        employeeId: employee.id,
        createdById: hrAuthor.id,
        title: `Monthly Invoice ${periodMonth.toString().padStart(2, "0")}/${periodYear}`,
        periodMonth,
        periodYear,
        dueDate: new Date(periodYear, periodMonth - 1, 25),
        currency: "USD",
        subtotal: formatAmount(subtotal),
        tax: formatAmount(tax),
        total: formatAmount(total),
        notes: "Seeded sample invoice to illustrate the workflow.",
        status,
        sentAt,
        confirmedAt,
        readyAt,
        items: {
          create: lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: formatAmount(item.unitPrice),
            amount: formatAmount(item.quantity * item.unitPrice),
          })),
        },
      },
    });
  }
};
