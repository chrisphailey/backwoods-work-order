import process from "node:process";

export async function loader() {
  try {
    const response = await fetch(
      "https://work-order-pro.replit.app/api/work-orders",
      {
        headers: {
          Authorization: `Bearer ${process.env.WORK_ORDER_PRO_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Replit API failed: ${response.status}`);
    }

    const data = await response.json();

    const workOrders = (data.items || []).map((order) => ({
    replitId: order.id,
      id: order.orderNumber,
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

   return Response.json(
  { workOrders },
  {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  }
);
  } catch (error) {
   return Response.json(
  { workOrders: [], error: error.message },
  {
    status: 500,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  }
);
  }
}