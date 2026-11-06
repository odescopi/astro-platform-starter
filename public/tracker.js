(function() {
    // 1. Get the API Key
    const scriptTag = document.currentScript;
    const apiKey = scriptTag.getAttribute('data-api-key');
    if (!apiKey) {
        console.error("GetInsightStream: Missing data-api-key attribute");
        return;
    }

    // 2. Your Live API Endpoint
    const API_ENDPOINT = "https://m01abirupj.execute-api.us-east-1.amazonaws.com/v1/events";

    // 3. Generate Persistent User ID & Session ID
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

    // 4. Universal Event Sender
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

    // 5. Auto-track Page Views
    sendEvent('page_view');

    // 6. Auto-Detect Product Views (Shopify/WooCommerce)
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType && ogType.content === 'product') {
        const productTitle = document.querySelector('meta[property="og:title"]')?.content || document.title;
        const priceMeta = document.querySelector('meta[property="og:price:amount"]') || 
                          document.querySelector('meta[property="product:price:amount"]');
        const price = priceMeta ? parseFloat(priceMeta.content) : 0;

        sendEvent('product_view', {
            product_name: productTitle,
            price: price
        });
    }

    // 7. SMART CLICK TRACKER (Buttons + Links)
    document.addEventListener('click', function(e) {
        const target = e.target.closest('button, a');
        if (!target) return;

        const text = (target.innerText || "").trim();
        if (text.length === 0 || text.length > 50) return;

        const lowerText = text.toLowerCase();
        
        // Route standard e-commerce clicks
        if (lowerText.includes('add to cart') || lowerText.includes('buy now')) {
            sendEvent('add_to_cart');
            return;
        }

        // Filter out standard navigation links to prevent database noise
        const href = target.getAttribute('href');
        if (target.tagName.toLowerCase() === 'a' && href) {
            // Ignore internal links (Home, About, Pricing)
            if (href.startsWith('/') && !href.includes('#') && !href.includes('checkout') && !href.includes('cart')) {
                return; 
            }
            // Ignore social media links
            if (href.includes('facebook.com') || href.includes('twitter.com') || href.includes('instagram.com')) {
                return;
            }
        }

        // Capture ALL other buttons and important CTA links
        sendEvent('button_click', {
            button_text: text,
            button_url: href || "",
            element_type: target.tagName.toLowerCase()
        });
    });

    // 8. Auto-Detect Purchase (Shopify/WooCommerce Checkout)
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

    // 9. Expose Global API for Custom Apps (React, Vue, Node)
    window.getinsightstream = function(action, eventType, data = {}) {
        if (action === 'track') {
            sendEvent(eventType, data);
        }
    };

    console.log("✅ GetInsightStream Tracker Active");
})();
