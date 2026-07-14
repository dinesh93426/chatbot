document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatFeed = document.getElementById("chat-feed");
  const typingIndicator = document.getElementById("typing-indicator");
  const profileSelect = document.getElementById("profile-select");
  const customerCard = document.getElementById("customer-card");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsBtn = document.getElementById("close-settings-btn");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const btnUseMock = document.getElementById("btn-use-mock");
  const btnUseGemini = document.getElementById("btn-use-gemini");
  const geminiKeyGroup = document.getElementById("gemini-key-group");
  const apiKeyInput = document.getElementById("api-key-input");
  const clearChatBtn = document.getElementById("clear-chat-btn");
  const chatSuggestions = document.getElementById("chat-suggestions");
  const modeText = document.getElementById("mode-text");
  const agentName = document.getElementById("agent-name");
  const agentBadge = document.getElementById("agent-badge");
  const agentStatus = document.getElementById("agent-status");
  const escalationBanner = document.getElementById("escalation-banner");
  const headerAvatar = document.querySelector(".agent-avatar");

  // State
  let conversationHistory = [];
  let currentCustomer = null;
  let useMock = true; // Default to demo simulation
  let isHumanMode = false;
  let userApiKey = sessionStorage.getItem("OPENROUTER_API_KEY") || "";

  // Set default API key input if stored in session
  if (userApiKey) {
    apiKeyInput.value = userApiKey;
    useMock = false;
    toggleEngineButtons(false);
  }

  // Load Initial Customer Profiles
  updateCustomerCard(profileSelect.value);

  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Auto-resize textarea
  chatInput.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
    if (this.scrollHeight > 150) {
      this.style.overflowY = "scroll";
    } else {
      this.style.overflowY = "hidden";
    }
  });

  // Switch customer profile
  profileSelect.addEventListener("change", (e) => {
    updateCustomerCard(e.target.value);
    
    // Clear chat when switching customer to ensure correct verification flow testing
    clearChat();
    appendBotMessage(`Switched simulated profile. You are now testing as: <strong>${profileSelect.options[profileSelect.selectedIndex].text}</strong>.`);
  });

  // Settings Modal Toggle
  settingsBtn.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
  });

  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });

  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add("hidden");
    }
  });

  btnUseMock.addEventListener("click", () => toggleEngineButtons(true));
  btnUseGemini.addEventListener("click", () => toggleEngineButtons(false));

  saveSettingsBtn.addEventListener("click", () => {
    userApiKey = apiKeyInput.value.trim();
    if (userApiKey) {
      sessionStorage.setItem("OPENROUTER_API_KEY", userApiKey);
    } else {
      sessionStorage.removeItem("OPENROUTER_API_KEY");
      if (!useMock) {
        // Fallback to mock if live selected but no key given
        toggleEngineButtons(true);
      }
    }
    updateModeIndicator();
    settingsModal.classList.add("hidden");
    appendBotMessage("Settings updated. Chat engine initialized successfully.");
  });

  // Quick Prompt Chips
  document.querySelectorAll(".prompt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chatInput.value = chip.getAttribute("data-text");
      chatInput.focus();
      chatInput.dispatchEvent(new Event("input"));
    });
  });

  // Suggestions Chip Click
  chatSuggestions.addEventListener("click", (e) => {
    if (e.target.classList.contains("suggestion-chip")) {
      const text = e.target.textContent;
      let promptText = "";
      if (text === "Track Order") {
        promptText = currentCustomer && currentCustomer.orders.length > 0
          ? `Where is my order #${currentCustomer.orders[0].orderId}?`
          : "Can you track my order?";
      } else if (text === "Returns Info") {
        promptText = "What is Nexora's return and refund policy?";
      } else if (text === "Cancel Subscription") {
        promptText = "I need to cancel my subscription.";
      } else if (text === "Talk to Agent") {
        promptText = "I want to talk to a human agent.";
      }

      chatInput.value = promptText;
      chatInput.focus();
      chatInput.dispatchEvent(new Event("input"));
    }
  });

  // Clear chat logs
  clearChatBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear this conversation history?")) {
      clearChat();
      appendBotMessage("Conversation reset. How can I help you today?");
    }
  });

  // Handle Form Submission
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = chatInput.value.trim();
    if (!userText) return;

    // Reset textarea height
    chatInput.value = "";
    chatInput.style.height = "48px";

    // Append user bubble
    appendUserMessage(userText);

    // If human mode is active, simulate a human live agent answering directly instead of API
    if (isHumanMode) {
      showTypingIndicator(true);
      setTimeout(() => {
        showTypingIndicator(false);
        appendBotMessage(getSimulatedHumanAgentReply(userText), true);
      }, 1500);
      return;
    }

    // Call chatbot API endpoint
    showTypingIndicator(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userText,
          history: conversationHistory,
          currentCustomer: currentCustomer,
          useMock: useMock,
          apiKey: userApiKey
        })
      });

      const data = await response.json();
      showTypingIndicator(false);

      if (data.isError || !response.ok) {
        appendBotMessage(`<span style="color:var(--danger)"><strong>Error:</strong> ${data.error || 'Failed to connect to API'}</span>`);
        return;
      }

      // Add response to UI
      appendBotMessage(data.text);

      // Save message pair in history
      conversationHistory.push({ role: "user", parts: [{ text: userText }] });
      conversationHistory.push({ role: "assistant", parts: [{ text: data.text }] });

      // If simulated profile details changed in backend mock (e.g. verified email or cancelled sub)
      if (data.verifiedCustomer) {
        // Find profile and select it
        const option = Array.from(profileSelect.options).find(opt => opt.value === data.verifiedCustomer.email);
        if (option) {
          profileSelect.value = option.value;
          updateCustomerCard(option.value);
        }
      }

      // Trigger human agent transfer if API response flagged escalation
      if (data.shouldEscalate) {
        triggerHumanEscalation();
      }

    } catch (err) {
      showTypingIndicator(false);
      appendBotMessage(`<span style="color:var(--danger)"><strong>Network Error:</strong> Ensure the local server is running and try again.</span>`);
    }
  });

  // State / UI Toggles
  function toggleEngineButtons(selectMock) {
    useMock = selectMock;
    if (selectMock) {
      btnUseMock.classList.add("active");
      btnUseGemini.classList.remove("active");
      geminiKeyGroup.classList.add("hidden");
    } else {
      btnUseMock.classList.remove("active");
      btnUseGemini.classList.add("active");
      geminiKeyGroup.classList.remove("hidden");
    }
    updateModeIndicator();
  }

  function updateModeIndicator() {
    if (useMock) {
      modeText.textContent = "Demo Mode (Offline)";
      modeText.style.color = "var(--accent-amber)";
    } else {
      modeText.textContent = "Live OpenRouter Mode";
      modeText.style.color = "var(--success)";
    }
  }

  // Load and render simulated customer details
  async function updateCustomerCard(email) {
    if (email === "anonymous") {
      currentCustomer = null;
      customerCard.innerHTML = `<p class="empty-text">No verified customer profile selected.</p>`;
      customerCard.classList.add("empty");
      return;
    }

    try {
      const response = await fetch(`/api/customer/${email}`);
      const customer = await response.json();
      currentCustomer = customer;

      customerCard.classList.remove("empty");

      let ordersHtml = "";
      if (customer.orders && customer.orders.length > 0) {
        customer.orders.forEach(order => {
          ordersHtml += `
            <div class="profile-detail">
              <span class="detail-label">Order ID:</span>
              <span class="detail-value">#${order.orderId}</span>
            </div>
            <div class="profile-detail">
              <span class="detail-label">Status:</span>
              <span class="detail-value" style="color: ${order.status === 'Delivered' ? 'var(--success)' : 'var(--accent-cyan)'}">${order.status}</span>
            </div>
            <div class="profile-detail">
              <span class="detail-label">Tracking:</span>
              <span class="detail-value">${order.trackingNumber}</span>
            </div>
          `;
        });
      } else {
        ordersHtml = `<p class="detail-value">No orders found.</p>`;
      }

      let subHtml = "";
      if (customer.subscription) {
        const statusClass = customer.subscription.status === 'Active' ? 'status-active' : 'status-canceled';
        subHtml = `
          <div class="profile-detail">
            <span class="detail-label">Plan:</span>
            <span class="detail-value">${customer.subscription.plan}</span>
          </div>
          <div class="profile-detail">
            <span class="detail-label">Status:</span>
            <span class="detail-status ${statusClass}">${customer.subscription.status}</span>
          </div>
          <div class="profile-detail">
            <span class="detail-label">Next Bill:</span>
            <span class="detail-value">${customer.subscription.nextBillingDate}</span>
          </div>
        `;
      } else {
        subHtml = `<p class="detail-value" style="color: var(--text-muted)">No active subscription</p>`;
      }

      customerCard.innerHTML = `
        <h4>${customer.name}</h4>
        <div class="profile-detail">
          <span class="detail-label">Email:</span>
          <span class="detail-value">${customer.email}</span>
        </div>
        <div style="border-top:1px solid var(--panel-border); margin:4px 0"></div>
        <div style="font-weight:600; font-size:0.75rem; color:var(--text-secondary)">Orders</div>
        ${ordersHtml}
        <div style="border-top:1px solid var(--panel-border); margin:4px 0"></div>
        <div style="font-weight:600; font-size:0.75rem; color:var(--text-secondary)">Subscription</div>
        ${subHtml}
      `;
    } catch (err) {
      customerCard.innerHTML = `<p class="empty-text" style="color:var(--danger)">Error loading profile data</p>`;
    }
  }

  // Appending Bubbles
  function appendUserMessage(text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgElement = document.createElement("div");
    msgElement.className = "message message-user";
    msgElement.innerHTML = `
      <div class="message-bubble glass-panel">
        <p>${escapeHtml(text)}</p>
      </div>
      <span class="message-time">${time}</span>
    `;
    chatFeed.appendChild(msgElement);
    scrollToBottom();
  }

  function appendBotMessage(htmlContent, isHuman = false) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgElement = document.createElement("div");
    msgElement.className = "message message-bot";
    
    // We format linebreaks into paragraphs/breaks for HTML render
    const formattedText = htmlContent
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/- \*\*(.*?)\*\*/g, "- <strong>$1</strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    msgElement.innerHTML = `
      <div class="message-bubble glass-panel">
        <p>${formattedText}</p>
      </div>
      <span class="message-time">${time} ${isHuman ? '(Live Rep)' : '(AI Agent)'}</span>
    `;
    chatFeed.appendChild(msgElement);
    scrollToBottom();
  }

  function showTypingIndicator(show) {
    if (show) {
      typingIndicator.classList.remove("hidden");
      scrollToBottom();
    } else {
      typingIndicator.classList.add("hidden");
    }
  }

  function clearChat() {
    chatFeed.innerHTML = "";
    conversationHistory = [];
    isHumanMode = false;
    
    // Reset header design to AI
    document.body.classList.remove("human-mode");
    agentName.textContent = "Nexora Support Agent";
    agentBadge.textContent = "AI Bot";
    agentBadge.className = "badge badge-ai";
    agentStatus.innerHTML = `<span class="status-dot"></span> Ready to assist you`;
    escalationBanner.classList.add("hidden");
    headerAvatar.querySelector(".bot-icon").classList.remove("hidden");
    headerAvatar.querySelector(".human-icon").classList.add("hidden");
  }

  function scrollToBottom() {
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Handle human representative takeover animation
  function triggerHumanEscalation() {
    isHumanMode = true;
    showTypingIndicator(true);

    setTimeout(() => {
      showTypingIndicator(false);
      
      // Shift CSS styles
      document.body.classList.add("human-mode");
      
      // Shift avatar indicator
      headerAvatar.querySelector(".bot-icon").classList.add("hidden");
      headerAvatar.querySelector(".human-icon").classList.remove("hidden");
      
      // Update badge details
      agentName.textContent = "Alex (Nexora Support)";
      agentBadge.textContent = "Support Rep";
      agentBadge.className = "badge badge-human";
      agentStatus.innerHTML = `<span class="status-dot" style="background-color: var(--accent-amber); box-shadow: 0 0 8px var(--accent-amber)"></span> Connected - Live Session`;
      
      // Show Connection Banner
      escalationBanner.classList.remove("hidden");
      
      // Play brief ping sound or visual highlight
      if (window.lucide) {
        window.lucide.createIcons();
      }

      // Live Representative Greeting
      appendBotMessage(
        "Hi there, I'm Alex. I see that the automated system escalated our chat to me, and I've read your conversation history so you don't have to repeat anything. Let me help you resolve this right away. What specific resolution are you hoping for?",
        true
      );
    }, 1800);
  }

  // Simulated answers for the human rep (simulating live chatting)
  function getSimulatedHumanAgentReply(userText) {
    const text = userText.toLowerCase();
    
    if (text.includes("refund") || text.includes("return")) {
      return "I can absolutely authorize a full refund for you. Since this is an escalated case, I've bypassed the typical return shipping fee. I am sending a prepaid shipping label to your email address right now. Once FedEx scans the package, your refund will hit your account in 3 business days. Would you like me to email that label to you now?";
    }
    if (text.includes("cancel") || text.includes("subscription")) {
      return "I have completely canceled your Nexora Shield subscription, and to make things right for the hassle, I've credited a full refund for this month's charge back to your card. You'll see that credit in 2-3 business days. The subscription will deactivate immediately. Let me know if there's anything else I can do to help you.";
    }
    if (text.includes("thank") || text.includes("thanks") || text.includes("great")) {
      return "You're very welcome! I'm glad I could get this sorted out for you. Is there any other Nexora device or account issue I can help you with today?";
    }
    return "I want to make sure you're fully taken care of. I am processing this on my end right now to ensure the cancellation and refund details match your requests. Let me know if you have any questions about this process.";
  }
});
