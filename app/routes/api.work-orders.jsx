import process from "node:process";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function loader({ request }) {
  try {
    const url = new URL(request.url);

    const page = url.searchParams.get("page") || "1";
    const pageSize = url.searchParams.get("pageSize") || "5";
    const search = url.searchParams.get("search") || "";

    const replitUrl = new URL("https://work-order-pro.replit.app/api/work-orders");

    replitUrl.searchParams.set("page", page);
    replitUrl.searchParams.set("pageSize", pageSize);

    if (search) {
      replitUrl.searchParams.set("search", search);
    }

    const response = await fetch(replitUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.WORK_ORDER_PRO_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Replit API failed: ${response.status}`);
    }

    const data = await response.json();

    const workOrders = (data.items || []).map((order) => ({
      id: order.orderNumber,
      replitId: order.id,
      customer: order.customer
        ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim()
        : "No customer",
      email: order.customer?.email || "",
      shopifyCustomerId: order.customer?.shopifyCustomerId || null,
      vehicle:
        order.customFields?.bikeMake || order.customFields?.model
          ? `${order.customFields?.bikeMake || ""} ${order.customFields?.model || ""}`.trim()
          : order.title,
      total: `$${Number(order.total || 0).toFixed(2)}`,
      status: order.status,
      items: (order.lineItems || []).map((item, index) => ({
        id: `${order.id}-${index}`,
        name: item.description || "Untitled item",
        quantity: item.quantity || 1,
        price: `$${Number(item.unitPrice || 0).toFixed(2)}`,
        variantId: item.shopifyVariantId || null,
      })),
    }));

    const currentPage = Number(data.page || page);
    const currentPageSize = Number(data.pageSize || pageSize);
    const total = Number(data.total || workOrders.length);

    return Response.json(
      {
        workOrders,
        page: currentPage,
        pageSize: currentPageSize,
        total,
        hasNextPage: currentPage * currentPageSize < total,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    return Response.json(
      {
        workOrders: [],
        error: error.message,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}