import process from "node:process";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// The Replit work order API's exact field names for tax tracking aren't
// confirmed, so check the common ones it's likely to use. Mirrors the
// same lookup in app/routes/api.work-orders.jsx so the report matches
// what the POS ticket shows.
function firstDefined(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function readItemTaxable(item: Record<string, unknown>) {
  const value = firstDefined(
    item.taxable,
    item.isTaxable,
    item.taxExempt === undefined ? undefined : !item.taxExempt,
    item.tax_exempt === undefined ? undefined : !item.tax_exempt,
  );
  return value === undefined ? true : Boolean(value);
}

function readOrderTax(order: Record<string, unknown>) {
  const value = firstDefined(
    order.tax,
    order.taxTotal,
    order.salesTax,
    order.taxAmount,
    order.totalTax,
  );
  return value === undefined ? undefined : Number(value);
}

function lineAmount(item: Record<string, unknown>) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  return Number(item.unitPrice || 0) * quantity;
}

function computeBreakdown(order: Record<string, unknown>) {
  const items = (order.lineItems as Record<string, unknown>[]) || [];

  const taxableSubtotal = items
    .filter((item) => readItemTaxable(item))
    .reduce((sum, item) => sum + lineAmount(item), 0);

  const nontaxableSubtotal = items
    .filter((item) => !readItemTaxable(item))
    .reduce((sum, item) => sum + lineAmount(item), 0);

  const total = Number(order.total || 0);
  const providedTax = readOrderTax(order);
  const tax =
    providedTax !== undefined
      ? providedTax
      : Math.max(0, total - taxableSubtotal - nontaxableSubtotal);

  return { taxableSubtotal, nontaxableSubtotal, tax, total };
}

function csvEscape(value: unknown) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function fetchAllCompletedWorkOrders() {
  const pageSize = 100;
  const maxPages = 200;
  let page = 1;
  const all: Record<string, unknown>[] = [];

  while (page <= maxPages) {
    const replitUrl = new URL("https://work-order-pro.replit.app/api/work-orders");
    replitUrl.searchParams.set("page", String(page));
    replitUrl.searchParams.set("pageSize", String(pageSize));
    replitUrl.searchParams.set("status", "done");

    const response = await fetch(replitUrl.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.WORK_ORDER_PRO_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Replit API failed: ${response.status}`);
    }

    const data = await response.json();
    const items = (data.items as Record<string, unknown>[]) || [];
    all.push(...items);

    const total = Number(data.total || items.length);
    if (items.length === 0 || all.length >= total) break;
    page += 1;
  }

  return all;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const orders = await fetchAllCompletedWorkOrders();

  const header = [
    "Work Order",
    "Customer",
    "Taxable Subtotal",
    "Nontaxable Subtotal",
    "Sales Tax",
    "Total",
  ];

  const rows = orders.map((order) => {
    const customerRecord = order.customer as
      | { firstName?: string; lastName?: string }
      | undefined;
    const customer = customerRecord
      ? `${customerRecord.firstName || ""} ${customerRecord.lastName || ""}`.trim()
      : "No customer";

    const { taxableSubtotal, nontaxableSubtotal, tax, total } =
      computeBreakdown(order);

    return [
      order.orderNumber ?? order.id,
      customer || "No customer",
      taxableSubtotal.toFixed(2),
      nontaxableSubtotal.toFixed(2),
      tax.toFixed(2),
      total.toFixed(2),
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="work-order-tax-report.csv"',
    },
  });
}
