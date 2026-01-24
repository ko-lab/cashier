import { oc } from "@orpc/contract";
import * as z from "zod";
import {
  FinalizeTransactionInputSchema,
  ProductCatalogSchema,
  StartTransactionInputSchema,
  TransactionSchema
} from "./models";

export const listProductsContract = oc
  .input(z.void())
  .output(ProductCatalogSchema);

export const startTransactionContract = oc
  .input(StartTransactionInputSchema)
  .output(TransactionSchema);

export const finalizeTransactionContract = oc
  .input(FinalizeTransactionInputSchema)
  .output(TransactionSchema);

export const contract = {
  product: {
    list: listProductsContract
  },
  transaction: {
    start: startTransactionContract,
    finalize: finalizeTransactionContract
  }
};
