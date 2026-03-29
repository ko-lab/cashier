import { oc } from "@orpc/contract";
import * as z from "zod";
import {
  AdminCreateMemberInputSchema,
  AdminCreditLedgerInputSchema,
  AdminCreditLedgerOutputSchema,
  AdminExportTransactionsInputSchema,
  AdminExportTransactionsOutputSchema,
  AdminGetStockOutputSchema,
  AdminMembersOutputSchema,
  AdminSetMemberActiveInputSchema,
  AdminSetMemberPinInputSchema,
  AdminSetStockInputSchema,
  AdminTopupCreditInputSchema,
  FinalizeTransactionInputSchema,
  MemberAuthInputSchema,
  MemberAuthOutputSchema,
  MemberListOutputSchema,
  ProductCatalogSchema,
  StartTransactionInputSchema,
  TransactionSchema
} from "./models.ts";

export const listProductsContract = oc
  .input(z.void())
  .output(ProductCatalogSchema);

export const startTransactionContract = oc
  .input(StartTransactionInputSchema)
  .output(TransactionSchema);

export const finalizeTransactionContract = oc
  .input(FinalizeTransactionInputSchema)
  .output(TransactionSchema);

export const adminExportTransactionsContract = oc
  .input(AdminExportTransactionsInputSchema)
  .output(AdminExportTransactionsOutputSchema);

export const adminGetStockContract = oc
  .input(AdminExportTransactionsInputSchema)
  .output(AdminGetStockOutputSchema);

export const adminSetStockContract = oc
  .input(AdminSetStockInputSchema)
  .output(AdminGetStockOutputSchema);

export const memberAuthContract = oc
  .input(MemberAuthInputSchema)
  .output(MemberAuthOutputSchema);

export const memberListContract = oc
  .input(z.void())
  .output(MemberListOutputSchema);

export const adminMembersListContract = oc
  .input(AdminExportTransactionsInputSchema)
  .output(AdminMembersOutputSchema);

export const adminMembersCreateContract = oc
  .input(AdminCreateMemberInputSchema)
  .output(AdminMembersOutputSchema);

export const adminMembersSetPinContract = oc
  .input(AdminSetMemberPinInputSchema)
  .output(AdminMembersOutputSchema);

export const adminMembersSetActiveContract = oc
  .input(AdminSetMemberActiveInputSchema)
  .output(AdminMembersOutputSchema);

export const adminCreditTopupContract = oc
  .input(AdminTopupCreditInputSchema)
  .output(AdminMembersOutputSchema);

export const adminCreditLedgerContract = oc
  .input(AdminCreditLedgerInputSchema)
  .output(AdminCreditLedgerOutputSchema);

export const contract = {
  product: {
    list: listProductsContract
  },
  member: {
    authPin: memberAuthContract,
    list: memberListContract
  },
  transaction: {
    start: startTransactionContract,
    finalize: finalizeTransactionContract
  },
  admin: {
    exportTransactions: adminExportTransactionsContract,
    getStock: adminGetStockContract,
    setStock: adminSetStockContract,
    listMembers: adminMembersListContract,
    createMember: adminMembersCreateContract,
    setMemberPin: adminMembersSetPinContract,
    setMemberActive: adminMembersSetActiveContract,
    topupCredit: adminCreditTopupContract,
    creditLedger: adminCreditLedgerContract
  }
};
