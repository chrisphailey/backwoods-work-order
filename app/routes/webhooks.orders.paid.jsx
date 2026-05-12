import process from "node:process";

function getOrderAttribute(order, key) {
  const attrs =
    order.note_attributes ||
    order.noteAttributes ||
    order.custom_attributes ||
    order.customAttributes ||
    [];

  const found = attrs.find((attr) => attr.name === key || attr.key === key);
  return found?.value || null;
}

export async function loader() {
  return Response.json({
    ok: true,
    message: "orders/paid webhook route is live. Shopify will POST here.",
  });
}

export async function action({ request }) {
  try {
    const order = await request.json();

    const replitWorkOrderId =
      getOrderAttribute(order, "replitWorkOrderId") ||
      getOrderAttribute(order, "workOrderId");

    if (!replitWorkOrderId) {
      console.log("No work order ID found on paid order", {
        orderId: order.id,
        orderName: order.name,
      });

      return Response.json({ success: true, skipped: true });
    }

    const response = await fetch(
      `https://work-order-pro.replit.app/api/work-orders/${replitWorkOrderId}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.WORK_ORDER_PRO_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "done",
          source: "shopify_pos",
          shopifyOrderId: String(order.id || ""),
          shopifyOrderName: order.name || "",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Replit status update failed: ${response.status}`);
    }

    const data = await response.json();

    return Response.json({
      success: true,
      replitWorkOrderId,
      replit: data,
    });
  } catch (error) {
    console.error("orders/paid webhook failed", error);

    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}