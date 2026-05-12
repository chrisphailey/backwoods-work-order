import "@shopify/ui-extensions/preact";
import {render} from "preact";
import {useEffect, useState} from "preact/hooks";
const LOADED_WORK_ORDERS_KEY = "loadedWorkOrderIds";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const [workOrders, setWorkOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [loadedWorkOrderIds, setLoadedWorkOrderIds] = useState([]);
  
useEffect(() => {
  async function loadRememberedOrders() {
    try {
      const saved = await shopify.storage.get(LOADED_WORK_ORDERS_KEY);

      if (!saved) {
        setLoadedWorkOrderIds([]);
        return;
      }

      const parsed = JSON.parse(String(saved));
      setLoadedWorkOrderIds(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error("Failed to read loaded work orders", error);
      setLoadedWorkOrderIds([]);
    }
  }

  loadRememberedOrders();
}, []);

  async function loadWorkOrders() {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch(
  "https://backwoods-work-order.onrender.com/api/work-orders",
  {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  }
);

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    setWorkOrders(data.workOrders || []);
  } catch (error) {
    console.error("Failed to load work orders", error);
    setError(error.message);
  } finally {
    setLoading(false);
  }
}
useEffect(() => {
  loadWorkOrders();
}, []);
async function attachCustomerToCart(order) {
  if (!order.shopifyCustomerId) {
    console.log("No Shopify customer ID on work order", order);
    return;
  }

  const customerId = Number(order.shopifyCustomerId);

  try {
    console.log("Trying to attach customer", {
      customerId,
      customerName: order.customer,
      email: order.email,
    });

    await shopify.cart.setCustomer({
      id: customerId,
    });

    shopify.toast.show("Customer attached");
  } catch (error) {
    console.error("Customer attach failed", {
      error,
      customerId,
      customerName: order.customer,
      email: order.email,
    });

    shopify.toast.show(`Customer attach failed: ${error.message || "unknown"}`);
  }
}

async function rememberLoadedWorkOrder(workOrderId) {
  const nextIds = Array.from(new Set([...loadedWorkOrderIds, workOrderId]));

  setLoadedWorkOrderIds(nextIds);

  try {
    await shopify.storage.set(
      LOADED_WORK_ORDERS_KEY,
      JSON.stringify(nextIds)
    );
  } catch (error) {
    console.error("Failed to save loaded work order", error);
  }
}

async function loadIntoCart() {
  if (loadedWorkOrderIds.includes(selected.id)) {
  shopify.toast.show("This work order is already loaded");
  return;
}
  if (!selected) return;

  try {
    await attachCustomerToCart(selected);
    for (const item of selected.items) {
      if (item.variantId) {
        await shopify.cart.addLineItem(
  Number(item.variantId),
  item.quantity
);
} else {
  await shopify.cart.addCustomSale({
    title: item.name,
    quantity: item.quantity,
    price: item.price.replace("$", ""),
    taxable: true,
  });
}
    }

    await shopify.cart.addCartProperties({
      workOrderId: selected.id,
      replitWorkOrderId: String(selected.replitId),
      customer: selected.customer,
      customerEmail: selected.email || "",
      shopifyCustomerId: selected.shopifyCustomerId || "",
      vehicle: selected.vehicle,
    });
    await rememberLoadedWorkOrder(selected.id);

    
//     await fetch(
//   `https://backwoods-work-order.onrender.com/api/work-orders${selected.replitId}/pos-loaded`,
//   {
//     method: "POST",
//   }
// );
    shopify.toast.show("Work order loaded into cart");
  } catch (error) {
    console.error("Mark loaded failed", error);
  shopify.toast.show("Cart loaded, but sync failed");
  }
}

const visibleWorkOrders = workOrders.filter((order) => {
  const text = `${order.id} ${order.customer} ${order.vehicle} ${order.email}`.toLowerCase();
  return text.includes(search.toLowerCase());
});
  return (
    <s-page heading="Completed Work Orders">
      <s-section>
        <s-text-field
  label="Search work orders"
  value={search}
  onInput={(event) => setSearch(event.target.value)}
/>
        <s-button onClick={loadWorkOrders}>
  Refresh Work Orders
</s-button>
  {loading && <s-text>Loading work orders...</s-text>}

  {error && <s-text>Error: {error}</s-text>}

  {!loading && !selected &&
    visibleWorkOrders.map((order) => (
            <s-box key={order.id} padding="base">
              <s-stack gap="small">
                <s-text>{order.id}</s-text>
                <s-text>{order.customer}</s-text>
                <s-text>{order.vehicle}</s-text>
                <s-text>{order.total}</s-text>

                <s-button onClick={() => setSelected(order)}>
                  View Work Order
                </s-button>
              </s-stack>
            </s-box>
          ))}

        {selected && (
  <s-stack gap="base">
    <s-text>Selected: {selected.id}</s-text>
    <s-text>{selected.customer}</s-text>
    <s-text>{selected.vehicle}</s-text>
    <s-text>{selected.total}</s-text>

    <s-section heading="Items">
      
      {selected.items.map((item) => (
        <s-box key={item.id} padding="base">
          <s-stack gap="small">
            <s-text>{item.name}</s-text>
<s-text>Qty: {item.quantity}</s-text>
<s-text>{item.price}</s-text>
          </s-stack>
        </s-box>
      ))}
    </s-section>

    <s-button
  onClick={async () => {
    if (loadedWorkOrderIds.includes(selected.id)) {
      shopify.toast.show("This work order is already loaded in the cart");
      return;
    }

    await loadIntoCart();
  }}
  disabled={loadedWorkOrderIds.includes(selected.id)}
>
  {loadedWorkOrderIds.includes(selected.id)
    ? "Loaded in Cart"
    : "Load into Cart"}
</s-button>

   <s-button
  onClick={() => {
    setSelected(null);
  }}>Back</s-button>
  </s-stack>
)}

      </s-section>
    </s-page>
  );
}