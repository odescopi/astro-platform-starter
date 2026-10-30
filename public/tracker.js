(function() {
    // 1. Get the API Key from the script tag
    const scriptTag = document.currentScript;
    const apiKey = scriptTag.getAttribute('data-api-key');
    if (!apiKey) {
        console.error("GetInsightStream: Missing data-api-key attribute");
        return;
    }

    const API_ENDPOINT = "https://9q2w68wtrl.execute-api.us-east-1.amazonaws.com/v1/events";

    // 2. Generate a unique anonymous user ID (stored in browser)
    let userId = localStorage.getItem('gis_user_id');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('gis_user_id', userId);
    }

    // 3. Generate a session ID (resets every 30 mins of inactivity)
    let sessionId = sessionStorage.getItem('gis_session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('gis_session_id', sessionId);
    }

    // 4. Function to send the event to AWS
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

    // 5. Automatically track Page Views
    sendEvent('page_view');

    // 6. Listen for Shopify "Add to Cart" buttons (Optional)
    // We look for elements with a specific class or button name
    document.addEventListener('click', function(e) {
        const target = e.target.closest('button, a');
        if (!target) return;

        const text = (target.innerText || "").toLowerCase();
        if (text.includes('add to cart') || text.includes('buy now')) {
            sendEvent('add_to_cart', {
                page: { url: window.location.href }
            });
        }
    });

    console.log("✅ GetInsightStream Tracker Active");
})();
