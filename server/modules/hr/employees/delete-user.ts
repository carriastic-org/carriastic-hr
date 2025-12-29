import type { Prisma } from "@prisma/client";

export type PrismaTransaction = Prisma.TransactionClient;

export const deleteUserCascade = async (tx: PrismaTransaction, userId: string) => {
  await tx.department.updateMany({
    where: { headId: userId },
    data: { headId: null },
  });

  await tx.notification.updateMany({
    where: { senderId: userId },
    data: { senderId: null },
  });

  await tx.emergencyContact.deleteMany({ where: { userId } });
  await tx.employeeBankAccount.deleteMany({ where: { userId } });
  await tx.attendanceRecord.deleteMany({ where: { employeeId: userId } });
  await tx.leaveRequest.deleteMany({
    where: {
      OR: [{ employeeId: userId }, { reviewerId: userId }],
    },
  });
  await tx.employeeProfile.deleteMany({ where: { userId } });
  await tx.employmentDetail.deleteMany({ where: { userId } });
  await tx.session.deleteMany({ where: { userId } });
  await tx.passwordResetToken.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
};
