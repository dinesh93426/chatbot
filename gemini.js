import { GoogleGenerativeAI } from "@google/generative-ai";
import { NexoraKnowledge, getCustomerInfoByEmail, getOrderById } from "./knowledge.js";

// System Prompt for Nexora Support Agent
const SYSTEM_PROMPT = `
# Customer Support Agent — System Prompt

## ROLE & IDENTITY
You are Customer Support Agent, the customer care assistant for Nexora. You help customers resolve issues quickly, answer questions accurately, and leave every interaction feeling heard and taken care of.

You are not a generic assistant — you represent the brand. Every response should feel like it came from someone who genuinely works there and knows the product.

## PRIMARY OBJECTIVES (in priority order)
1. **Resolve the customer's actual problem** — not just answer the literal question.
2. **Retain the customer** — de-escalate frustration, prevent cancellations where possible.
3. **Build trust** — be honest, transparent, and consistent, even when the answer isn't what the customer wants to hear.
4. **Escalate appropriately** — know when a human needs to take over.

Never sacrifice #3 to achieve #1 or #2. A customer who feels manipulated into staying is a customer who churns loudly later.

## TONE & STYLE
- Warm, direct, and human. No corporate jargon, no robotic phrasing ("We apologize for any inconvenience this may have caused").
- Use the customer's name once you know it. Don't overuse it.
- Match their energy: if they're calm, be efficient; if they're frustrated, slow down and acknowledge before problem-solving.
- Keep responses concise. Long paragraphs feel like stonewalling. Use short sentences and, when helpful, numbered steps.
- Never sound scripted. Vary your phrasing — don't reuse the same opening line ("I understand your frustration") in every response.

## KNOWLEDGE BOUNDARIES
- Only state facts you have from the official Nexora knowledge base, help center articles, and order/account data provided to you. Never rely on general assumptions about the product.
- If you don't know something, say so plainly: "I don't have that info in front of me — let me get you to someone who does" rather than guessing or inventing a policy.
- Never promise a refund, discount, replacement, or timeline you're not authorized to guarantee. Check the current refund/return/cancellation policy before committing to anything financial.
- Never fabricate order numbers, tracking info, timelines, or account details. If system data is missing or looks wrong, say so instead of filling the gap.

## CONVERSATION FLOW
1. **Acknowledge before solving**: Before jumping to a fix, briefly acknowledge what happened, especially if the customer is upset. One sentence is enough — don't over-apologize.
2. **Diagnose before answering**: If the request is ambiguous or you're missing key info (order number, account email, issue specifics), ask one focused question at a time. Don't interrogate the customer with a checklist.
3. **Resolve**: Give the customer the most direct path to resolution. If there are multiple options, briefly explain the tradeoff and let them choose. Confirm resolution clearly.
4. **Retention moment (only when relevant)**: If the customer is expressing intent to cancel/leave: First, understand *why* (ask what's driving the decision). If the issue is fixable, fix it first. If it's a value/price objection, offer authorized retention incentive once, clearly. If they still want to leave, let them go gracefully.
5. **Close with clarity**: End by confirming the resolution and asking if there's anything else.

## ESCALATION TRIGGERS
Immediately hand off to a human agent (and tell the customer you're doing so) when:
- The customer explicitly asks for a human/agent.
- The issue involves legal threats, safety concerns, or potential fraud.
- The request exceeds your authorization (e.g., large refunds, account deletion, complex billing disputes).
- The customer has repeated the same complaint 2+ times without resolution — don't loop them.
- You detect signs of significant distress unrelated to the product itself.

When escalating: explain *why* briefly, tell them what happens next, and don't make them repeat their whole story if you can pass along context.

## GUARDRAILS
- Never argue with or contradict the customer's account of what happened to them.
- Never blame the customer ("you should have...").
- Never use pressure tactics, false urgency, or guilt to prevent cancellation.
- Don't over-apologize.
- If a customer is abusive, warn them calmly; end if it continues.
- Protect customer data: verify identity (e.g., matching account email or order number) before discussing sensitive details.

## OUTPUT FORMAT
- Default to plain conversational text, not bullet-heavy.
- Use bullets/numbers only for instructions, multiple options, or summaries.
- Keep responses under ~150 words unless the issue genuinely requires more detail.
`;

// Simple mock responses for Demo Mode (if no API Key is available or Demo Mode is toggled)
export function getMockResponse(message, history, currentCustomer) {
  const msg = message.toLowerCase();
  const historyText = history.map(h => h.parts[0].text.toLowerCase()).join(" ");

  // 1. Check for explicit escalation triggers
  if (msg.includes("human") || msg.includes("representative") || msg.includes("agent") || msg.includes("person") || msg.includes("manager") || msg.includes("supervisor")) {
    return {
      text: "I understand you'd like to speak with a person. Let me transfer you to a human agent right now. They'll have access to our chat history so you don't have to repeat yourself.",
      shouldEscalate: true
    };
  }

  if (msg.includes("sue") || msg.includes("legal") || msg.includes("lawyer") || msg.includes("attorney") || msg.includes("court")) {
    return {
      text: "I understand this is a serious situation. Since this involves a legal matter, I'm transferring you to our specialized resolution team immediately.",
      shouldEscalate: true
    };
  }

  // 2. Identify customer
  let customerInfo = null;
  if (currentCustomer && currentCustomer.email) {
    customerInfo = getCustomerInfoByEmail(currentCustomer.email);
  }

  // Detect email in message to verify identity
  const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+/);
  if (emailMatch) {
    const email = emailMatch[0];
    const found = getCustomerInfoByEmail(email);
    if (found) {
      customerInfo = found;
      return {
        text: `Thanks for verifying, ${found.name}. I see your account under ${found.email}. How can I help you with Nexora today?`,
        verifiedCustomer: found
      };
    } else {
      return {
        text: `I looked for an account with "${email}" but couldn't find one in our system. Could you double-check the email address?`
      };
    }
  }

  // 3. Order status requests
  if (msg.includes("order") || msg.includes("track") || msg.includes("shipping")) {
    // Check if we have an order number in message
    const orderMatch = msg.match(/#?(\d{4})/);
    if (orderMatch) {
      const orderId = orderMatch[1];
      const order = getOrderById(orderId);
      if (order) {
        if (!customerInfo || customerInfo.email !== order.customerEmail) {
          return {
            text: `I found order #${orderId}, but to protect your privacy, could you please confirm the email address associated with this order?`
          };
        }
        if (order.status === "Delivered") {
          return {
            text: `I checked order #${orderId} for you. It was delivered via ${order.carrier} on ${order.deliveryDate}. Tracking number is ${order.trackingNumber}. Is everything working well with your new hardware?`
          };
        } else if (order.status === "In Transit") {
          return {
            text: `Order #${orderId} is currently in transit with ${order.carrier}. It's estimated to arrive on ${order.estimatedDelivery}. You can track it using ${order.trackingNumber}.`
          };
        }
      } else {
        return {
          text: `I tried looking up order #${orderId} but didn't find anything. Could you please double-check the order number?`
        };
      }
    }

    // No order number provided, but we know who the customer is
    if (customerInfo && customerInfo.orders && customerInfo.orders.length > 0) {
      const primaryOrder = customerInfo.orders[0];
      return {
        text: `I see your recent order #${primaryOrder.orderId} for ${primaryOrder.items.join(" & ")}. It is currently ${primaryOrder.status.toLowerCase()}${primaryOrder.status === 'Delivered' ? ' (delivered ' + primaryOrder.deliveryDate + ')' : ' (estimated delivery ' + primaryOrder.estimatedDelivery + ')'}. Is this the order you're asking about?`
      };
    }

    // If we don't know the customer, ask for email/order number
    return {
      text: "I can absolutely check your order status. Could you share the email address on your Nexora account or the order number?"
    };
  }

  // 4. Return / Refund Policy questions
  if (msg.includes("return") || msg.includes("refund") || msg.includes("send back") || msg.includes("money back")) {
    return {
      text: `For all Nexora devices, we offer a 30-day money-back guarantee. The item needs to be undamaged and in its original packaging. Customers are responsible for return shipping, and refunds take about 5 to 7 business days to process once we get the item. Are you looking to return a specific purchase?`
    };
  }

  // 5. Subscription Cancellation requests
  if (msg.includes("cancel") || msg.includes("subscription") || msg.includes("stop billing") || msg.includes("shield")) {
    if (!customerInfo) {
      return {
        text: "I can help with subscription changes. To locate your subscription, could you tell me the email address associated with your Nexora account?"
      };
    }
    if (!customerInfo.subscription || customerInfo.subscription.status === "Canceled") {
      return {
        text: `I checked your account, ${customerInfo.name}, but I don't see an active subscription under your email (${customerInfo.email}). Let me know if there's another account or if you have any questions.`
      };
    }

    // Retention Step: check if customer has answered *why* yet
    const hasExplainReason = historyText.includes("why") || historyText.includes("reason") || msg.includes("expensive") || msg.includes("too much") || msg.includes("need") || msg.includes("don't use");
    if (!hasExplainReason) {
      return {
        text: `I can certainly help you cancel your subscription. Before I do that, could you tell me what's driving this decision? I want to make sure we're doing everything we can to improve your experience.`
      };
    }

    // Process cancellation
    customerInfo.subscription.status = "Canceled";
    return {
      text: `I've canceled your ${customerInfo.subscription.plan}. You will continue to have access to your video history and alerts until the end of your billing cycle on ${customerInfo.subscription.nextBillingDate}. No more charges will occur. Is there anything else I can assist with?`,
      verifiedCustomer: customerInfo
    };
  }

  // 6. Generic/default answers showing Nexora product context
  if (msg.includes("hello") || msg.includes("hi ") || msg.includes("hey")) {
    const greeting = customerInfo ? `Hello ${customerInfo.name}! ` : "Hello! ";
    return {
      text: `${greeting}Welcome to Nexora Support. How can I help you with your smart home setup or order today?`
    };
  }

  if (msg.includes("warranty") || msg.includes("broken") || msg.includes("defective")) {
    return {
      text: "All Nexora hardware comes with a 1-year limited warranty covering manufacturing defects. It doesn't cover physical damage. If you're experiencing a hardware issue, let me know which device you have so we can troubleshoot it."
    };
  }

  // General catch-all
  return {
    text: "I want to make sure I give you the correct info. Nexora offers smart home security hubs, cameras (indoor and outdoor), thermostats, and sensors. If you have an account or order inquiry, could you share your email or order number so I can check our system?"
  };
}

// Call Gemini API
export async function getGeminiResponse(message, history, currentCustomer, apiKey) {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  // Prepare system context injection
  let sessionContext = "\n## CURRENT SESSION CONTEXT\n";
  sessionContext += `- Current Time: ${new Date().toISOString()}\n`;

  if (currentCustomer) {
    const customerDbInfo = getCustomerInfoByEmail(currentCustomer.email);
    if (customerDbInfo) {
      sessionContext += `- Verified Customer Name: ${customerDbInfo.name}\n`;
      sessionContext += `- Verified Customer Email: ${customerDbInfo.email}\n`;
      if (customerDbInfo.subscription) {
        sessionContext += `- Active Subscription: ${JSON.stringify(customerDbInfo.subscription)}\n`;
      } else {
        sessionContext += `- Active Subscription: None\n`;
      }
      sessionContext += `- Order History: ${JSON.stringify(customerDbInfo.orders)}\n`;
      if (customerDbInfo.tickets) {
        sessionContext += `- Open Support Tickets: ${JSON.stringify(customerDbInfo.tickets)}\n`;
      }
    } else {
      sessionContext += `- Requested Email: ${currentCustomer.email} (Not found in account database)\n`;
    }
  } else {
    sessionContext += `- Customer: Anonymous / Unauthenticated\n`;
  }

  sessionContext += `\n## OFFICIAL NEXORA KNOWLEDGE BASE:\n${JSON.stringify(NexoraKnowledge, null, 2)}\n`;

  // Merge the standard system prompt and dynamic context
  const fullSystemInstruction = SYSTEM_PROMPT + sessionContext;

  // Format history for Gemini SDK:
  // [{ role: 'user', parts: [{ text: '...' }] }, { role: 'model', parts: [{ text: '...' }] }]
  const formattedHistory = history.map(item => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.parts[0].text }]
  }));

  // Initial chat setup
  const chat = model.startChat({
    history: formattedHistory,
    systemInstruction: fullSystemInstruction,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 500,
    }
  });

  const result = await chat.sendMessage(message);
  const responseText = result.response.text();

  // Programmatic Escalation Check
  const lowerResponse = responseText.toLowerCase();
  const lowerMessage = message.toLowerCase();
  const needsEscalation = 
    lowerMessage.includes("human") || 
    lowerMessage.includes("agent") || 
    lowerMessage.includes("representative") ||
    lowerMessage.includes("manager") ||
    lowerResponse.includes("transfer you") ||
    lowerResponse.includes("hand you off") ||
    lowerResponse.includes("human agent") ||
    lowerResponse.includes("specialized team");

  return {
    text: responseText,
    shouldEscalate: needsEscalation
  };
}
