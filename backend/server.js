
const express = require("express");
const fs = require("fs");
const path = require("path");

const multer = require("multer");
const Tesseract = require("tesseract.js");

const app = express();
const PORT = 3000;

app.use(express.json());


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
    } else {
      callback(new Error("Only image files are allowed."));
    }
  },
});


// Location of our permanent order file
const ordersFile = path.join(
  __dirname,
  "data",
  "orders.json"
);

// Read orders from the JSON file
function readOrders() {
  const fileContent = fs.readFileSync(ordersFile, "utf8");
  return JSON.parse(fileContent);
}

// Write orders to the JSON file
function writeOrders(orders) {
  fs.writeFileSync(
    ordersFile,
    JSON.stringify(orders, null, 2),
    "utf8"
  );
}


async function extractOrder(message) {
  const response = await fetch(
    "http://localhost:11434/api/chat",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5:1.5b",
        stream: false,
        format: "json",
        messages: [
          {
            role: "system",
            content: `
You extract food orders for a food delivery business.

Return only valid JSON with this structure:
{
  "customerName": "string or null",
  "items": [
    {
      "name": "string",
      "quantity": 1,
      "instructions": "string or null"
    }
  ],
  "deliveryDate": "YYYY-MM-DD or null",
  "deliveryTime": "HH:mm or null",
  "deliveryType": "Delivery or Pickup",
  "deliveryAddress": "string or null",
  "missingInformation": []
}

Rules:
- Extract every food or drink item separately.
- Quantity must be a number.
- Attach instructions only to the item they describe.
- Do not invent customer names, dates, times, or delivery types.
- Use null for information that is not provided.
- Put essential missing information in missingInformation.
- Do not treat a preparation instruction for one item as applying to other items.
- Preserve the customer's meaning.
- Return deliveryDate as YYYY-MM-DD when an exact date is stated.
- Return deliveryTime in 24-hour HH:mm format when the time is stated.
- Do not invent missing dates or times.
- If a relative date cannot be determined, preserve the phrase or use null rather than guessing.
- Detect deliveryType from the customer's message.
- Use "Pickup" when the customer explicitly says they will collect,
  pick up, or come to collect the order.
- Use "Delivery" when the customer explicitly asks for delivery,
  drop-off, or home delivery.
- If neither is stated, return "Delivery" as the default.
- deliveryType must be exactly "Delivery" or "Pickup".
- Extract the complete delivery address when the customer provides one.
- Store the address in deliveryAddress.
- Do not invent or guess missing address details.
- If no address is provided, return null.
- For pickup orders, deliveryAddress should be null unless the customer explicitly provides an address relevant to the order.
            `.trim(),
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error("The AI model request failed.");
  }

  
  const result = await response.json();
  const draft = JSON.parse(result.message.content);

  // Resolve common relative dates using the computer's local date.
  
  const today = new Date();

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function resolveRelativeDate(message, baseDate) {
    const text = message.toLowerCase();

    let daysToAdd = null;

    if (/\bday after tomorrow\b/.test(text)) {
      daysToAdd = 2;
    } else if (/\btomorrow\b/.test(text)) {
      daysToAdd = 1;
    } else if (/\btoday\b/.test(text)) {
      daysToAdd = 0;
    } else if (
      /\bin (?:a|one) week\b/.test(text) ||
      /\bin 7 days\b/.test(text)
    ) {
      daysToAdd = 7;
    } else {
      const match = text.match(/\bin (\d+) days?\b/);

      if (match) {
        daysToAdd = Number(match[1]);
      }
    }

    if (daysToAdd === null) {
      return null;
    }

    const date = new Date(baseDate);
    date.setDate(date.getDate() + daysToAdd);

    return formatDate(date);
  }

  function normalizeTime(value) {
    if (!value) return null;

    const text = String(value).trim().toUpperCase();

    if (text === "NOON") return "12:00";
    if (text === "MIDNIGHT") return "00:00";

    const match = text.match(
      /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/
    );

    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2] ?? 0);
    const period = match[3];

    if (hours > 23 || minutes > 59) return null;

    if (period) {
      if (hours < 1 || hours > 12) return null;

      if (period === "AM") {
        hours = hours === 12 ? 0 : hours;
      } else {
        hours = hours === 12 ? 12 : hours + 12;
      }
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const resolvedDate = resolveRelativeDate(message, today);

  const text = message.toLowerCase();

  if (
    /\bpick[\s-]?up\b|\bcollect\b|\bcome and collect\b|\bi(?:'ll| will) come\b/.test(text)
  ) {
    draft.deliveryType = "Pickup";
  } else if (
    /\bdeliver(?:y|ed)?\b|\bdrop[\s-]?off\b|\bhome delivery\b/.test(text)
  ) {
    draft.deliveryType = "Delivery";
  } else {
    draft.deliveryType = "Delivery";
  }

  if (resolvedDate) {
    draft.deliveryDate = resolvedDate;
  }

  draft.deliveryTime = normalizeTime(draft.deliveryTime);

  return draft;

}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "OrderSathi backend is running!",
  });
});

// Get all orders
app.get("/api/orders", (req, res) => {
  const orders = readOrders();
  res.json(orders);
});

// Create a new order

app.post("/api/orders", (req, res) => {
  const {
    customerName,
    items,
    deliveryDate,
    deliveryTime,
    deliveryType,
    deliveryAddress,
  } = req.body;

  // Validate the order items
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.some(
      (item) =>
        typeof item.name !== "string" ||
        !item.name.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
    )
  ) {
    return res.status(400).json({
      error: "Please provide valid order items and quantities.",
    });
  }

  const orders = readOrders();

  const newOrder = {
    id: Date.now(),
    customerName:
      typeof customerName === "string" && customerName.trim()
        ? customerName.trim()
        : "New customer",
    items: items.map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      instructions:
        typeof item.instructions === "string" &&
        item.instructions.trim()
          ? item.instructions.trim()
          : null,
    })),
    deliveryDate:
      typeof deliveryDate === "string" ? deliveryDate : null,
    deliveryTime:
      typeof deliveryTime === "string" ? deliveryTime : null,
    deliveryType:
      deliveryType === "Pickup" ? "Pickup" : "Delivery",
    deliveryAddress:
      typeof deliveryAddress === "string"
        ? deliveryAddress.trim()
        : "",
    status: "Pending",
  };

  orders.unshift(newOrder);
  writeOrders(orders);

  res.status(201).json(newOrder);
});

app.patch("/api/orders/:id/status", (req, res) => {
  const { status } = req.body;
  const allowedStatuses = ["Pending", "Confirmed", "Completed"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid order status.",
    });
  }

  const orders = readOrders();
  const orderIndex = orders.findIndex(
    (order) => order.id === Number(req.params.id)
  );

  if (orderIndex === -1) {
    return res.status(404).json({
      error: "Order not found.",
    });
  }

  orders[orderIndex].status = status;
  writeOrders(orders);

  res.json(orders[orderIndex]);
});

app.delete("/api/orders/:id", (req, res) => {
  const orders = readOrders();
  const orderIndex = orders.findIndex(
    (order) => order.id === Number(req.params.id)
  );

  if (orderIndex === -1) {
    return res.status(404).json({
      error: "Order not found.",
    });
  }

  const [deletedOrder] = orders.splice(orderIndex, 1);
  writeOrders(orders);

  res.json({
    message: "Order deleted successfully.",
    order: deletedOrder,
  });
});

app.post("/api/extract-order", async (req, res) => {
  const { message } = req.body;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Please provide a customer message.",
    });
  }

  try {
    const draft = await extractOrder(message.trim());
    res.json(draft);
  } catch (error) {
    console.error("Order extraction failed:", error);

    res.status(502).json({
      error: "Could not extract the order. Please try again.",
    });
  }
});


app.post("/api/ocr", upload.single("screenshot"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Please upload a screenshot.",
    });
  }

  try {
    const result = await Tesseract.recognize(
      req.file.buffer,
      "eng"
    );

    res.json({
      text: result.data.text.trim(),
    });
  } catch (error) {
    console.error("OCR failed:", error);

    res.status(500).json({
      error: "Could not read text from this screenshot.",
    });
  }
});


app.listen(PORT, () => {
  console.log(
    `OrderSathi API running at http://localhost:${PORT}`
  );
});
