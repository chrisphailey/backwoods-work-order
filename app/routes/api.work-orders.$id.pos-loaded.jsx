import process from "node:process";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
};

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  return Response.json(
    { error: "Method not allowed" },
    { status: 405, headers: corsHeaders }
  );
}

export async function action({ params }) {
  try {
    const response = await fetch(
      `https://work-order-pro.replit.app/api/work-orders/${params.id}/pos-loaded`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.WORK_ORDER_PRO_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Replit mark-loaded failed: ${response.status}`);
    }

    const data = await response.json();

    return Response.json(data, {
      headers: corsHeaders,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}