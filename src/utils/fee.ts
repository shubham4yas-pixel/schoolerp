import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const calculateFee = (total: number, paid: number) => {
  const pending = total - paid;

  let status = "Unpaid";

  if (paid === 0) status = "Unpaid";
  else if (paid < total) status = "Partial";
  else if (paid === total) status = "Paid";
  else status = "Overpaid";

  return {
    total,
    paid,
    pending,
    status,
  };
};

export const recordPayment = async (studentId: string, amount: number, schoolId: string = "school_001") => {
  const feesRef = collection(db, "schools", schoolId, "fees");
  await addDoc(feesRef, {
    studentId,
    amount,
    createdAt: serverTimestamp(),
  });
};
