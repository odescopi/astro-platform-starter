(function() {
    // 1. Get the API Key
    const scriptTag = document.currentScript;
    const apiKey = scriptTag.getAttribute('data-api-key');
    if (!apiKey) {
        console.error("GetInsightStream: Missing data-api-key attribute");
        return;
    }

    const API_ENDPOINT = "https://m01abirupj.execute-api.us-east-1.amazonaws.com/v1/events";

    // 2. Generate IDs
    let userId = localStorage.getItem('gis_user_id');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('gis_user_id', userId);
    }

    let sessionId = sessionStorage.getItem('gis_session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('gis_session_id', sessionId);
    }

    // 3. Universal Event Sender
    function sendEvent(eventType, additionalData = {}) {
        const payload = {
            version: "1.0",
            event_id: "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            event_type: eventType,
            event_time: new Date().toISOString(),
            source: "tracker.js",
            user: { anonymous_id: userId },
            session: { session_id: sessionId },
            page: {
                url: window.location.href,
                referrer: document.referrer,
                title: document.title
            },
            ...additionalData
        };

        fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify(payload)
        }).catch(err => console.error("GetInsightStream Error:", err));
    }

    // 4. Automatically track Page Views
    sendEvent('page_view');

    // 🛠️ 5. ENTERPRISE FIX: Auto-Detect Product Views (Shopify/WooCommerce)
    // We look for standard OpenGraph meta tags that e-commerce sites use.
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType && ogType.content === 'product') {
        const productTitle = document.querySelector('meta[property="og:title"]')?.content || document.title;
        
        // Try to find the price (Shopify uses meta tags for price too)
        const priceMeta = document.querySelector('meta[property="og:price:amount"]') || 
                          document.querySelector('meta[property="product:price:amount"]');
        const price = priceMeta ? parseFloat(priceMeta.content) : 0;

        sendEvent('product_view', {
            product_name: productTitle,
            price: price
        });
    }

    // 6. Auto-track Add to Cart (Universal Listener)
    document.addEventListener('click', function(e) {
        const target = e.target.closest('button, a');
        if (!target) return;
        
        const text = (target.innerText || "").toLowerCase();
        if (text.includes('add to cart') || text.includes('buy now')) {
            sendEvent('add_to_cart', {
                page_url: window.location.href
            });
        }
    });

    // 7. Auto-Detect Purchase & Extract Revenue (Shopify/WooCommerce Checkout)
    const currentUrl = window.location.href;
    if (currentUrl.includes('/thank_you') || currentUrl.includes('/order-received') || currentUrl.includes('/checkout/success')) {
        let revenue = 0;
        
        // Try to find the total price in the page HTML
        const priceElements = document.querySelectorAll('.total-line__price, .order-total .amount, .woocommerce-Price-amount');
        if (priceElements.length > 0) {
            const rawText = priceElements[0].innerText.replace(/[^0-9.]/g, '');
            revenue = parseFloat(rawText) || 0;
        }

        sendEvent('purchase', {
            order_id: 'auto_' + Date.now(),
            revenue: revenue
        });
    }

    // 8. Expose Global API for Custom Apps (React, Vue, Node)
    window.getinsightstream = function(action, eventType, data = {}) {
        if (action === 'track') {
            sendEvent(eventType, data);
        }
    };

    console.log("✅ GetInsightStream Tracker Active");
})();
