import { useEffect, useState } from "react";
import "./App.css";

type Order = {
  id: number;
  customer: string;
  item: string;
  dueDate: string;
  deliveryAddress: string;
  status: "Pending" | "Confirmed" | "Completed";
};


function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [draft, setDraft] = useState<any>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");

useEffect(() => {
  async function loadOrders() {
    try {
      const response = await fetch("/api/orders");

      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }

      const data: {
        id: number;
        customerName: string;
        items:
          | string
          | {
              name: string;
              quantity: number;
              instructions?: string | null;
            }[];
        deliveryDate?: string | null;
        deliveryTime?: string | null;
        deliveryType: string;
        deliveryAddress: string;
        status: string;
      }[] = await response.json();

      const formattedOrders: Order[] = data.map((order) => {
        const itemSummary =
          typeof order.items === "string"
            ? order.items
            : order.items
                .map(
                  (item) =>
                    `${item.quantity} × ${item.name}${
                      item.instructions
                        ? ` (${item.instructions})`
                        : ""
                    }`
                )
                .join(", ");

        return {
          id: order.id,
          customer: order.customerName || "New customer",
          item: `${itemSummary} · ${order.deliveryType || "Delivery"}`,
          dueDate:
            [order.deliveryDate, order.deliveryTime]
              .filter(Boolean)
              .join(" · ") || "Not specified",
          deliveryAddress: order.deliveryAddress || "",
          status:
            order.status === "Confirmed"
              ? "Confirmed"
              : order.status === "Completed"
                ? "Completed"
                : "Pending",
        };
      });

      setOrders(formattedOrders);
    } catch (error) {
      console.error("Failed to load orders:", error);
      setError("Could not load orders. Check that your backend is running.");
    } finally {
      setLoading(false);
    }
  }

  loadOrders();
}, []);



async function extractOrderWithAI() {
  if (!message.trim()) return;

  setExtracting(true);
  setExtractError("");
  setDraft(null);

  try {
    const response = await fetch("/api/extract-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message.trim(),
      }),
    });

    if (!response.ok) {
      throw new Error("Order extraction failed.");
    }

    const data = await response.json();
    setDraft(data);
  } catch (error) {
    console.error("AI extraction error:", error);
    setExtractError(
      "Could not extract the order. Check that your backend and Ollama are running."
    );
  } finally {
    setExtracting(false);
  }
}


async function extractTextFromScreenshot() {
  if (!screenshot) {
    setOcrError("Please select a screenshot first.");
    return;
  }

  setOcrLoading(true);
  setOcrError("");
  setOcrText("");

  try {
    const formData = new FormData();
    formData.append("screenshot", screenshot);

    const response = await fetch("/api/ocr", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "OCR extraction failed.");
    }

    if (!data.text?.trim()) {
      throw new Error("No readable text found. Try a clearer screenshot.");
    }

    setOcrText(data.text);
  } catch (error) {
    setOcrError(
      error instanceof Error
        ? error.message
        : "Could not read the screenshot."
    );
  } finally {
    setOcrLoading(false);
  }
}


async function saveReviewedOrder() {
  if (!draft || !Array.isArray(draft.items) || draft.items.length === 0) {
    setExtractError("Please extract an order with at least one item.");
    return;
  }

  if (
    draft.items.some(
      (item: { name: string; quantity: number }) =>
        !item.name.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
    )
  ) {
    setExtractError("Please check every item name and quantity.");
    return;
  }

  setExtractError("");

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerName: draft.customerName,
        items: draft.items,
        deliveryDate: draft.deliveryDate,
        deliveryTime: draft.deliveryTime,
        deliveryType: draft.deliveryType || "Delivery",
        deliveryAddress: draft.deliveryAddress ?? "",
      }),
    });

    const savedOrder = await response.json();

    if (!response.ok) {
      throw new Error(savedOrder.error || "Could not save order.");
    }

    const formattedOrder: Order = {
      id: savedOrder.id,
      customer: savedOrder.customerName,
      item: savedOrder.items
        .map(
          (item: { name: string; quantity: number; instructions?: string | null }) =>
            `${item.quantity} × ${item.name}${
              item.instructions ? ` (${item.instructions})` : ""
            }`
        )
        .join(", "),
      dueDate: [
        savedOrder.deliveryDate,
        savedOrder.deliveryTime,
      ].filter(Boolean).join(" · ") || "Not specified",
      deliveryAddress: savedOrder.deliveryAddress || "",
      status: savedOrder.status,
    };

    setOrders((currentOrders) => [formattedOrder, ...currentOrders]);
    setDraft(null);
    setMessage("");
    setExtractError("");
  } catch (error) {
    console.error("Save order error:", error);
    setExtractError(
      error instanceof Error ? error.message : "Could not save the order."
    );
  }
}

async function updateOrderStatus(
  orderId: number,
  newStatus: Order["status"]
) {
  try {
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to update order status.");
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId
          ? { ...order, status: data.status }
          : order
      )
    );
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : "Could not update order status."
    );
  }
}

async function deleteOrder(orderId: number) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this order? This action cannot be undone."
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to delete order.");
    }

    setOrders((currentOrders) =>
      currentOrders.filter((order) => order.id !== orderId)
    );
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : "Could not delete order."
    );
  }
}
  
async function addSampleOrder() {
  if (!message.trim()) return;

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerName: "New customer",
        items: message.trim(),
        deliveryType: "Delivery",
      }),
    });

    if (!response.ok) {
      throw new Error("Could not save the order.");
    }

    const savedOrder = await response.json();

    const formattedOrder: Order = {
      id: savedOrder.id,
      customer: savedOrder.customerName,
      item: savedOrder.items,
      dueDate: "Not specified",
      status: savedOrder.status,
    };

    setOrders((currentOrders) => [
      formattedOrder,
      ...currentOrders,
    ]);

    setMessage("");
  } catch (error) {
    console.error("Error saving order:", error);
    alert("Could not save the order. Please check your backend.");
  }
}


  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">O</span>
          <span>OrderSathi</span>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <button className="nav-item active">Dashboard</button>
        <button className="nav-item">All orders</button>
        <button className="nav-item">Settings</button>

        <div className="sidebar-note">
          <p>Made for small businesses</p>
          <span>Less admin. More making.</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
            <h1>Good morning!</h1>
            <p className="subtitle">
              Let's get your orders organized.
            </p>
          </div>
          <span className="demo-badge">DEMO DATA</span>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <span>Total orders</span>
            <strong>{orders.length}</strong>
            <small>Orders in this workspace</small>
          </article>
          <article className="stat-card">
            <span>Pending</span>
            <strong>
              {orders.filter((order) => order.status === "Pending").length}
            </strong>
            <small>Awaiting confirmation</small>
          </article>
          <article className="stat-card">
            <span>Confirmed</span>
            <strong>
              {orders.filter((order) => order.status === "Confirmed").length}
            </strong>
            <small>Ready to prepare</small>
          </article>
        </section>

        <section className="workspace-grid">
          <div className="capture-column">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">QUICK CAPTURE</p>
                <h2>Capture a customer order</h2>
              </div>
              <span className="sparkle">✳</span>
            </div>

            <p className="helper-text">
              Paste a customer message below. AI extraction is coming next.
            </p>

            <label htmlFor="customer-message">Customer message</label>
            <textarea
              id="customer-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Example: Hi! I need a 1 kg chocolate cake for Saturday at 4 PM. Please write Happy Birthday on it."
              rows={6}
            />

            
            <div className="screenshot-upload">
              <h3>Or upload a WhatsApp screenshot</h3>

              <label htmlFor="order-screenshot">
                Choose screenshot
              </label>

              <input
                id="order-screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  setScreenshot(event.target.files?.[0] ?? null);
                  setOcrText("");
                  setOcrError("");
                }}
              />

              {screenshot && (
                <p className="helper-text">
                  Selected: {screenshot.name}
                </p>
              )}

              <button
                className="secondary-button"
                onClick={extractTextFromScreenshot}
                disabled={!screenshot || ocrLoading}
              >
                {ocrLoading ? "Reading screenshot..." : "Extract text from screenshot"}
              </button>

              {ocrError && (
                <p role="alert" className="ocr-error">
                  {ocrError}
                </p>
              )}

              {ocrText && (
                <div className="ocr-result">
                  <label htmlFor="ocr-result-text">
                    Extracted text — correct any mistakes
                  </label>

                  <textarea
                    id="ocr-result-text"
                    rows={5}
                    value={ocrText}
                    onChange={(event) => setOcrText(event.target.value)}
                  />

                  <button
                    className="primary-button"
                    disabled={!ocrText.trim()}
                    onClick={() => {
                      setMessage(ocrText);
                      setDraft(null);
                      setExtractError("");
                    }}
                  >
                    Use text for AI extraction
                  </button>
                </div>
              )}
            </div>
            
            <button
              className="primary-button"
              onClick={extractOrderWithAI}
              disabled={!message.trim() || extracting}
            >
              {extracting ? "Extracting order..." : "Extract order with AI"}
            </button>

            {extractError && (
              <p role="alert">{extractError}</p>
            )}


            <button
              className="primary-button"
              onClick={addSampleOrder}
              disabled={!message.trim()}
            >
              + Add draft order
            </button>

            <p className="privacy-note">
              Your message stays in this page for now. Saving is not connected yet.
            </p>
          </article>

          
          {draft && (
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">AI EXTRACTION</p>
                  <h2>Review your order</h2>
                </div>
                <span className="sparkle">✳</span>
              </div>

              <p className="helper-text">
                Check the extracted details and correct anything
                that doesn't look right before saving.
              </p>

              <label>Customer name</label>
              <input
                value={draft.customerName ?? ""}
                placeholder="Customer name not provided"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    customerName: event.target.value || null,
                  })
                }
              />

              <h3>Order items</h3>

              {draft.items.map((item: {
                name: string;
                quantity: number;
                instructions: string | null;
              }, index: number) => (
                <div key={index} className="order-item-editor">
                  <label>Item name</label>
                  <input
                    value={item.name}
                    onChange={(event) => {
                      const updatedItems = [...draft.items];
                      updatedItems[index] = {
                        ...item,
                        name: event.target.value,
                      };
                      setDraft({ ...draft, items: updatedItems });
                    }}
                  />

                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => {
                      const updatedItems = [...draft.items];
                      updatedItems[index] = {
                        ...item,
                        quantity: Number(event.target.value),
                      };
                      setDraft({ ...draft, items: updatedItems });
                    }}
                  />

                  <label>Preparation instructions</label>
                  <input
                    value={item.instructions ?? ""}
                    placeholder="No special instructions"
                    onChange={(event) => {
                      const updatedItems = [...draft.items];
                      updatedItems[index] = {
                        ...item,
                        instructions: event.target.value || null,
                      };
                      setDraft({ ...draft, items: updatedItems });
                    }}
                  />
                </div>
              ))}

              <label>Delivery date</label>
              <input
                value={draft.deliveryDate ?? ""}
                placeholder="Date not provided"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    deliveryDate: event.target.value || null,
                  })
                }
              />

              <label>Delivery time</label>
              <input
                value={draft.deliveryTime ?? ""}
                placeholder="Time not provided"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    deliveryTime: event.target.value || null,
                  })
                }
              />

              <label>Delivery or pickup</label>
              <select
                value={draft.deliveryType ?? "Delivery"}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    deliveryType: event.target.value || "Delivery",
                  })
                }
              >
                <option value="Delivery">Delivery</option>
                <option value="Pickup">Pickup</option>
              </select>

              <label>Delivery Address</label>
              <textarea
                value={draft.deliveryAddress ?? ""}
                placeholder="Enter the complete delivery address"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    deliveryAddress: event.target.value || null,
                  })
                }
                rows={2}
              />

              {draft.missingInformation?.length > 0 && (
                <div className="missing-info">
                  <strong>Information to confirm</strong>
                  <ul>
                    {draft.missingInformation.map(
                      (item: string, index: number) => (
                        <li key={index}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              )}
              
              <button
                className="primary-button"
                onClick={saveReviewedOrder}
              >
                Save reviewed order
              </button>

              <button
                className="secondary-button"
                onClick={() => setDraft(null)}
              >
                Discard draft
              </button>
            </article>
          )}
          </div>


          <article className="panel orders-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ORDER MANAGEMENT</p>
                <h2>Recent orders</h2>
              </div>
              <span className="order-count">{orders.length} orders</span>
            </div>

            
            <div className="orders-list">
              {loading && <p>Loading orders...</p>}

              {error && <p role="alert">{error}</p>}

              {!loading && !error && orders.length === 0 && (
                <p>No orders yet. Add your first order!</p>
              )}

              
              {!loading &&
                !error &&
                orders.map((order) => (
                  <div className="order-row" key={order.id}>
                    <div className="order-avatar">
                      {order.customer.charAt(0)}
                    </div>

                    <div className="order-details">
                      <strong>{order.customer}</strong>
                      <span>{order.item}</span>
                      <small>{order.dueDate}</small>

                      {order.deliveryAddress && (
                        <small className="order-address">
                          Address: {order.deliveryAddress}
                        </small>
                      )}
                    </div>

                    <div className="order-actions">
                      <select
                        className={`status-select status-${order.status.toLowerCase()}`}
                        value={order.status}
                        onChange={(event) =>
                          updateOrderStatus(
                            order.id,
                            event.target.value as Order["status"]
                          )
                        }
                        aria-label={`Update status for ${order.customer}'s order`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                      </select>

                      <button
                        type="button"
                        className="delete-order-button"
                        onClick={() => deleteOrder(order.id)}
                        aria-label={`Delete order for ${order.customer}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

            </div>

          </article>
        </section>

        <footer>
          OrderSathi · Your orders, organized.
        </footer>
      </main>
    </div>
  );
}

export default App;
