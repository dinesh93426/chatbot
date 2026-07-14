import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { MockCustomers, getCustomerInfoByEmail, getOrderById, cancelCustomerSubscription } from "./knowledge.js";
import { getGeminiResponse, getMockResponse } from "./gemini.js";

// Initialize environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, "public")));

// Endpoint to fetch mock customer accounts
app.get("/api/customers", (req, res) => {
  try {
    const list = MockCustomers.map(c => ({
      name: c.name,
      email: c.email,
      hasSubscription: !!c.subscription,
      orders: c.orders.map(o => o.orderId)
    }));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch detailed profile for a customer
app.get("/api/customer/:email", (req, res) => {
  try {
    const customer = getCustomerInfoByEmail(req.params.email);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to query order details
app.get("/api/orders/:id", (req, res) => {
  try {
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoint integrating Gemini API and local mock fallback
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, currentCustomer, useMock } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const forceMock = useMock || !apiKey;

    console.log(`Processing chat message. Mode: ${forceMock ? "Mock/Demo" : "Live Gemini"}`);

    if (forceMock) {
      // Use local simulation engine
      const response = getMockResponse(message, history, currentCustomer);
      
      // Simulate minor typing delay (500ms - 1000ms) for high quality UX
      await new Promise(resolve => setTimeout(resolve, 800));

      return res.json({
        text: response.text,
        shouldEscalate: response.shouldEscalate || false,
        verifiedCustomer: response.verifiedCustomer || null,
        mode: "mock"
      });
    } else {
      // Call Gemini Generative AI SDK
      const response = await getGeminiResponse(message, history, currentCustomer, apiKey);
      return res.json({
        text: response.text,
        shouldEscalate: response.shouldEscalate || false,
        mode: "gemini"
      });
    }
  } catch (error) {
    console.error("Error in /api/chat endpoint:", error);
    res.status(500).json({ error: error.message, isError: true });
  }
});

// API endpoint to cancel customer subscription
app.post("/api/cancel-subscription", (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const result = cancelCustomerSubscription(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback to serve index.html for undefined routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Nexora Support Backend is running at http://localhost:${PORT}`);
});
