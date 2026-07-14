// Nexora Official Knowledge Base and Customer Database

export const NexoraKnowledge = {
  brand: "Nexora",
  niche: "Smart Home Technology & Security Systems",
  products: [
    { id: "nexora-link", name: "Nexora Link (Smart Home Hub)", price: 149.00, description: "Central control hub for all connected Nexora devices." },
    { id: "nexora-cam", name: "Nexora Cam (Indoor Security Camera)", price: 79.00, description: "1080p indoor camera with night vision and two-way audio." },
    { id: "nexora-cam-pro", name: "Nexora Cam Pro (Outdoor Security Camera)", price: 129.00, description: "2K weather-resistant (IP65) outdoor camera with integrated spotlight." },
    { id: "nexora-climate", name: "Nexora Climate (Smart Thermostat)", price: 99.00, description: "Energy-saving smart thermostat with automated scheduling." },
    { id: "nexora-guard", name: "Nexora Guard (Door/Window Sensors)", price: 29.00, description: "Two-pack of contact sensors for doors or windows." }
  ],
  policies: {
    returns_refunds: "30-day money-back guarantee for all Nexora devices. Items must be in original packaging and undamaged. Customers pay return shipping unless the item arrived defective. Refunds take 5-7 business days to process once the warehouse receives the item.",
    warranty: "1-year limited warranty on all hardware components. Covers manufacturing defects. Does not cover physical abuse, water damage (except Nexora Cam Pro which is IP65 rated), or unauthorized disassembly.",
    shipping: "Standard shipping (3-5 business days) is free on orders over $50. Otherwise, flat rate is $5.99. Express shipping (1-2 business days) is $14.99.",
    subscriptions: "Nexora Shield (Cloud storage & smart alerts for Nexora Cam models):\n- Basic: $4.99/month per camera.\n- Plus: $9.99/month or $99.00/year for unlimited cameras.",
    cancellations: "Subscriptions can be canceled at any time. The cancellation takes effect at the end of the current billing cycle. No partial or prorated refunds are issued for mid-month cancellations."
  }
};

// Mock Customer Accounts & Orders
export const MockCustomers = [
  {
    name: "Sarah Jenkins",
    email: "sarah@example.com",
    orders: [
      {
        orderId: "1002",
        date: "2026-07-10",
        items: ["Nexora Link (Smart Home Hub)", "Nexora Guard (Door/Window Sensors)"],
        total: 178.00,
        status: "Delivered",
        deliveryDate: "2026-07-13",
        trackingNumber: "NX-88273-US",
        carrier: "FedEx"
      }
    ],
    subscription: {
      plan: "Nexora Shield Plus (Monthly)",
      status: "Active",
      price: 9.99,
      nextBillingDate: "2026-08-01"
    }
  },
  {
    name: "Marcus Vance",
    email: "marcus@example.com",
    orders: [
      {
        orderId: "1005",
        date: "2026-07-12",
        items: ["Nexora Cam (Indoor Security Camera)"],
        total: 84.99, // flat rate shipping included ($79 + $5.99)
        status: "In Transit",
        estimatedDelivery: "2026-07-16",
        trackingNumber: "NX-99281-US",
        carrier: "USPS"
      }
    ],
    subscription: null
  },
  {
    name: "Elena Rostova",
    email: "elena@example.com",
    orders: [
      {
        orderId: "1001",
        date: "2026-06-28",
        items: ["Nexora Climate (Smart Thermostat)"],
        total: 99.00,
        status: "Delivered",
        deliveryDate: "2026-07-05",
        trackingNumber: "NX-11029-US",
        carrier: "UPS"
      }
    ],
    subscription: null,
    tickets: [
      {
        ticketId: "TK-402",
        subject: "Return Request for Order #1001",
        status: "Pending Return Shipment",
        createdDate: "2026-07-06"
      }
    ]
  }
];

// Helper Functions
export function getCustomerInfoByEmail(email) {
  if (!email) return null;
  return MockCustomers.find(c => c.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

export function getOrderById(orderId) {
  if (!orderId) return null;
  const cleanId = orderId.toString().replace("#", "").trim();
  for (const customer of MockCustomers) {
    const order = customer.orders.find(o => o.orderId === cleanId);
    if (order) {
      return { customerName: customer.name, customerEmail: customer.email, ...order };
    }
  }
  return null;
}

export function cancelCustomerSubscription(email) {
  const customer = getCustomerInfoByEmail(email);
  if (!customer) return { success: false, message: "Customer account not found." };
  if (!customer.subscription || customer.subscription.status === "Canceled") {
    return { success: false, message: "No active subscription found to cancel." };
  }
  customer.subscription.status = "Canceled";
  return {
    success: true,
    message: `Your ${customer.subscription.plan} subscription has been canceled. You will continue to have access until the end of your billing cycle on ${customer.subscription.nextBillingDate}.`
  };
}
