import { authorizedQboFetchDirect } from "@/lib/qbo";

export type QboInvoice = {
  Id?: string;
  DocNumber?: string;
  CustomerRef?: {
    name?: string;
    value?: string;
  };
};

function escapeQboString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function findQboInvoiceByNumber(invoiceNumber: string, userId?: string) {
  const byDocNumber = await authorizedQboFetchDirect<any>(
    `/query?query=${encodeURIComponent(
      `SELECT Id, DocNumber, CustomerRef FROM Invoice WHERE DocNumber = '${escapeQboString(invoiceNumber)}' MAXRESULTS 1`
    )}&minorversion=65`,
    {},
    userId
  );

  const firstMatch = (byDocNumber?.QueryResponse?.Invoice || [])[0] as QboInvoice | undefined;
  if (firstMatch) return firstMatch;

  const byId = await authorizedQboFetchDirect<any>(
    `/query?query=${encodeURIComponent(
      `SELECT Id, DocNumber, CustomerRef FROM Invoice WHERE Id = '${escapeQboString(invoiceNumber)}' MAXRESULTS 1`
    )}&minorversion=65`,
    {},
    userId
  );

  return (byId?.QueryResponse?.Invoice || [])[0] as QboInvoice | undefined;
}
