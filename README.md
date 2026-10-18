# OrderSathi 🍱

**An AI-powered order management assistant for small food businesses.**

OrderSathi helps home chefs, cloud kitchens, bakers, and small food businesses organize customer orders received through messages and screenshots. Instead of manually copying every order into a list, users can extract order details with AI, review the results, and manage orders in one place.

Built for the Hacktoberfest DEV Challenge, OrderSathi explores how open-weight AI can help simplify everyday work for small businesses.

## 💡 The Problem

Small food businesses often receive customer orders through informal messages and screenshots. As the number of orders grows, keeping track of items, delivery dates, timings, addresses, and order status becomes difficult.

Missing details or forgotten orders can lead to late deliveries, unhappy customers, and lost trust.

OrderSathi aims to make this process simpler by turning unstructured customer requests into organized, editable order records.

## ✨ Features

- **AI-powered order extraction:** Convert natural-language customer messages into structured order details using a locally running open-weight language model.
- **Screenshot OCR:** Extract text from screenshots of customer orders using Tesseract.js.
- **Review before saving:** Inspect and edit extracted information before saving an order.
- **Order management:** Save orders, view recent orders, update their status, and delete orders.
- **Delivery and pickup detection:** Identify whether an order is intended for delivery or pickup.
- **Date and time handling:** Interpret common relative dates and normalize delivery times.
- **Missing-information awareness:** Identify details that may need clarification before an order is finalized.
- **Local AI inference:** Use Ollama with Qwen2.5:1.5b rather than requiring a paid hosted language-model API for the current local workflow.

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express.js |
| AI model | Qwen2.5:1.5b |
| Local model runtime | Ollama |
| OCR | Tesseract.js |
| File uploads | Multer |
| Data storage | Local JSON file |

## 🔄 How It Works

1. **Provide an order:** Enter a customer's message or upload a screenshot.
2. **Extract the information:** Text messages are processed by the local language model. Screenshots are processed using OCR.
3. **Review the result:** Check and edit the extracted customer details, items, delivery information, and other fields.
4. **Save the order:** Submit the reviewed order to the backend.
5. **Manage orders:** View saved orders, update their status, or delete them.

The review step is important because AI and OCR can make mistakes. Extracted information should be checked before an order is confirmed.

## 🏗️ Project Structure

```text
ordersathi/
├── backend/
│   ├── data/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── public/
├── src/
│   ├── assets/
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── README.md
└── vite.config.ts
```

The `backend/data/` directory contains local order data generated during development and is not intended to be published with the source code.

## ⚙️ Getting Started

### Prerequisites

Install the following before running OrderSathi:

- [Node.js](https://nodejs.org/) and npm
- [Git](https://git-scm.com/)
- [Ollama](https://ollama.com/)

### 1. Clone the repository

```bash
git clone https://github.com/JayitaL/OrderSathi.git
cd OrderSathi
```

### 2. Set up the AI model

Install and start Ollama, then download the model:

```bash
ollama pull qwen2.5:1.5b
```

Make sure Ollama is running locally and the model is available before testing AI extraction.

### 3. Install frontend dependencies

From the project root, run:

```bash
npm install
```

### 4. Install backend dependencies

```bash
cd backend
npm install
```

### 5. Start the backend

From the `backend` directory, run the backend start command:

```bash
npm run dev
```

### 6. Start the frontend

Open a second terminal in the project root and run:

```bash
npm run dev
```

Open the local URL printed by Vite in your browser.

**Note:** The frontend must be configured to communicate with the backend, and the backend must be configured to reach Ollama. Check the project's Vite configuration and backend settings if the services do not connect.

## 🔐 Data and Privacy

The current prototype uses local AI inference and local JSON-based order storage.

- Customer messages are processed by the locally running model in the intended local setup.
- Orders are stored in a local JSON file during development.
- This is a prototype, not a production-ready multi-user service.
- Data security, authentication, access control, and persistent production storage would need further work before deployment.

Local inference can reduce reliance on external AI services, but privacy also depends on how the application and its surrounding services are configured.

## 🚧 Current Limitations

OrderSathi is an early-stage prototype, and there is more work to do.

- AI-extracted details may be incorrect or incomplete and should be reviewed.
- OCR accuracy depends on screenshot quality and formatting.
- Order storage currently uses a local JSON file.
- The application has not yet been deployed as a public live service.
- Voice-note parsing is a planned improvement, not a currently supported feature.

## 🗺️ What's Next?

- Add voice-note processing to extract orders from audio messages.
- Improve handling of ambiguous requests and missing details.
- Test with more small food businesses and incorporate their feedback.
- Introduce a more robust database for persistent order storage.
- Improve validation, error handling, and production readiness.

## 🌱 Why Open Innovation?

OrderSathi uses an open-weight language model through Ollama, making it possible to experiment with AI-powered order extraction locally without requiring a paid hosted language-model API for inference.

This approach makes the project easier to experiment with, gives developers more control over their model setup, and offers a starting point for adapting AI tools to practical small-business workflows.

---

Built as a Hacktoberfest DEV Challenge project with the goal of making everyday order management a little easier for small food businesses.
