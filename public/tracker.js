(function() {
    const scriptTag = document.currentScript;
    const apiKey = scriptTag.getAttribute('data-api-key');
    if (!apiKey) return;

    const API_ENDPOINT = "https://m01abirupj.execute-api.us-east-1.amazonaws.com/v1/events";

    let userId = localStorage.getItem('gis_user_id') || 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('gis_user_id', userId);
    let sessionId = sessionStorage.getItem('gis_session_id') || 'sess_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('gis_session_id', sessionId);

    function sendEvent(eventType, additionalData = {}) {
        const payload = {
            version: "1.0",
            event_id: "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            event_type: eventType,
            event_time: new Date().toISOString(),
            source: "tracker.js",
            user: { anonymous_id: userId },
            session: { session_id: sessionId },
            page: { url: window.location.href, referrer: document.referrer },
            ...additionalData
        };

        fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
            body: JSON.stringify(payload)
        }).catch(err => console.error("GetInsightStream Error:", err));
    }

    // 1. Auto-track Page Views
    sendEvent('page_view');

    // 2. Auto-track Add to Cart
    document.addEventListener('click', function(e) {
        const target = e.target.closest('button, a');
        if (!target) return;
        const text = (target.innerText || "").toLowerCase();
        if (text.includes('add to cart') || text.includes('buy now')) {
            sendEvent('add_to_cart');
        }
    });

    // 🛠️ ENTERPRISE FIX: Auto-detect Purchase Pages (Shopify/WooCommerce)
    const currentUrl = window.location.href;
    if (currentUrl.includes('/thank_you') || currentUrl.includes('/order-received')) {
        // Note: In a real enterprise setup, you would parse the DOM to get the exact order total.
        // For now, we fire a purchase event.
        sendEvent('purchase', {
            order_id: 'auto_detected_' + Date.now(),
            revenue: 0 // Client's backend should update this via API for exact revenue
        });
    }

    // 3. Expose the Global API for Custom Backends
    window.getinsightstream = function(action, eventType, data = {}) {
        if (action === 'track') sendEvent(eventType, data);
    };

    console.log("✅ GetInsightStream Tracker Active");
})();
