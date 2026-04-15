import { describe, expect, it } from "vitest";
import { getStudentPendingStatus } from "@/lib/data-utils";
import type { Payment, Student } from "@/lib/types";

const buildStudent = (): Student => ({
  id: "student_1",
  rollNumber: "R001",
  name: "Aarav",
  class: "Class 6",
  classId: "class_6",
  className: "Class 6",
  section: "A",
  schoolId: "school_001",
  totalFees: 1000,
  paidAmount: 0,
  parentName: "Parent",
  parentContact: "9999999999",
  enrollmentDate: "2026-04-01",
  avatarColor: "#123456",
});

const buildPayment = (overrides: Partial<Payment>): Payment => ({
  id: overrides.id || "pay_1",
  studentId: "student_1",
  studentName: "Aarav",
  classId: "class_6",
  section: "A",
  month: "April",
  monthIndex: 0,
  monthKey: "2026-27_0",
  year: "2026",
  academicYear: "2026-27",
  amount: 1000,
  status: "paid",
  date: "2026-04-10",
  timestamp: "2026-04-10T10:00:00.000Z",
  paidAt: "2026-04-10T10:00:00.000Z",
  ...overrides,
});

describe("getStudentPendingStatus", () => {
  const feeSettings = {
    class_6: {
      monthlyFee: 1000,
      transportFee: 0,
    },
  };

  it("keeps a student pending when previous months were skipped", () => {
    const student = buildStudent();
    const transactions = [
      buildPayment({
        id: "pay_june",
        month: "June",
        monthIndex: 2,
        monthKey: "2026-27_2",
      }),
    ];

    const status = getStudentPendingStatus(student, transactions, feeSettings, 2, "2026-27");

    expect(status.expectedFee).toBe(3000);
    expect(status.paid).toBe(1000);
    expect(status.due).toBe(2000);
    expect(status.isPending).toBe(true);
    expect(status.status).toBe("partial");
  });

  it("becomes non-pending as soon as dues till the current month are fully cleared", () => {
    const student = buildStudent();
    const transactions = [
      buildPayment({
        id: "pay_april",
        month: "April",
        monthIndex: 0,
        monthKey: "2026-27_0",
      }),
      buildPayment({
        id: "pay_may",
        month: "May",
        monthIndex: 1,
        monthKey: "2026-27_1",
      }),
      buildPayment({
        id: "pay_june",
        month: "June",
        monthIndex: 2,
        monthKey: "2026-27_2",
      }),
    ];

    const status = getStudentPendingStatus(student, transactions, feeSettings, 2, "2026-27");

    expect(status.expectedFee).toBe(3000);
    expect(status.paid).toBe(3000);
    expect(status.due).toBe(0);
    expect(status.isPending).toBe(false);
    expect(status.status).toBe("paid");
  });

  it("filters transactions by academic year before computing pending dues", () => {
    const student = buildStudent();
    const transactions = [
      buildPayment({
        id: "old_year",
        academicYear: "2025-26",
        month: "April",
        monthIndex: 0,
        monthKey: "2025-26_0",
      }),
      buildPayment({
        id: "current_year",
        academicYear: "2026-27",
        month: "April",
        monthIndex: 0,
        monthKey: "2026-27_0",
      }),
    ];

    const status = getStudentPendingStatus(student, transactions, feeSettings, 1, "2026-27");

    expect(status.expectedFee).toBe(2000);
    expect(status.paid).toBe(1000);
    expect(status.due).toBe(1000);
    expect(status.isPending).toBe(true);
    expect(status.status).toBe("partial");
  });
});
