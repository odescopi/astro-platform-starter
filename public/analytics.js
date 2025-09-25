// AWS Configuration - Use your exact Identity Pool ID
const AWS_CONFIG = {
  region: 'us-east-1',
  IdentityPoolId: 'us-east-1:f73b9c93-1212-4ee6-b6ed-ad3ad4fae856'
};

// Generate unique ID
const generateUniqueId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// NEW: Shop domain detection function
function getShopDomain() {
    // Try multiple sources for shop domain
    return window.shopDomain || 
           document.querySelector('[data-shop-domain]')?.dataset.shopDomain ||
           new URLSearchParams(window.location.search).get('shop') ||
           window.location.hostname.replace('www.', '');
}

// Initialize AWS
let kinesis = null;
let isInitialized = false;

// E-commerce specific functions
function getCurrentDiscountCode() {
  // Extract from URL parameters or cookies
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('discount') || urlParams.get('promo') || '';
}

function getOrderIdFromPage() {
  // Try to extract order ID from common thank-you page patterns
  const urlMatch = window.location.pathname.match(/order[_-]?(\w+)/i);
  if (urlMatch) return urlMatch[1];
  
  // Check for order ID in page content
  const orderElement = document.querySelector('[data-order-id], .order-id, #order-number');
  if (orderElement) return orderElement.textContent.trim();
  
  return 'unknown';
}

function getOrderTotal() {
  // Extract order total from common patterns
  const totalElement = document.querySelector('[data-total], .order-total, .total-amount');
  if (totalElement) {
    const totalText = totalElement.textContent.replace(/[^\d.]/g, '');
    return parseFloat(totalText) || 0;
  }
  return 0;
}

function getItemCount() {
  // Count items in order summary
  const itemElements = document.querySelectorAll('.order-item, [data-item], .cart-item');
  return itemElements.length || 1;
}

function getPaymentMethod() {
  // Detect payment method from common indicators
  if (document.querySelector('[data-payment="credit"], .credit-card, #card-payment')) {
    return 'credit_card';
  }
  if (document.querySelector('[data-payment="paypal"], .paypal-button, #paypal-payment')) {
    return 'paypal';
  }
  if (document.querySelector('[data-payment="stripe"], .stripe-button')) {
    return 'stripe';
  }
  return 'unknown';
}

// E-COMMERCE EVENT TRACKING
function trackEcommerceEvents() {
  // 1. Product View Tracking
  function trackProductViews() {
    // Track clicks on product links or cards
    document.querySelectorAll('a[href*="/product/"], [data-product-id], .product-card').forEach(element => {
      element.addEventListener('click', () => {
        const productId = element.dataset.productId || 
                         element.getAttribute('href')?.split('/product/')[1] ||
                         'unknown';
        
        trackEvent('product_view', {
          product_id: productId,
          category: element.dataset.category || 'general',
          price: parseFloat(element.dataset.price) || 0,
          stock_status: element.dataset.stockStatus || 'in_stock',
          shop_domain: getShopDomain() // Added shop domain
        });
      });
    });
  }

  // 2. Add to Cart Tracking
  function trackAddToCart() {
    document.querySelectorAll('[data-add-to-cart], .add-to-cart, .cart-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        const productId = button.dataset.productId || 
                         button.closest('[data-product-id]')?.dataset.productId ||
                         'unknown';
        
        trackEvent('cart_add', {
          product_id: productId,
          quantity: parseInt(button.dataset.quantity) || 1,
          price: parseFloat(button.dataset.price) || 0,
          discount_code: getCurrentDiscountCode(),
          shop_domain: getShopDomain() // Added shop domain
        });
        
        // Allow original cart functionality after tracking
        setTimeout(() => {
          if (button.type === 'submit') {
            button.closest('form')?.submit();
          } else {
            button.click();
          }
        }, 100);
      });
    });
  }

  // 3. Checkout Process Tracking
  function trackCheckoutSteps() {
    // Track checkout form submissions
    document.querySelectorAll('form[action*="checkout"], #checkout-form').forEach(form => {
      form.addEventListener('submit', () => {
        trackEvent('checkout_start', {
          step_number: 1,
          payment_method: getPaymentMethod(),
          shipping_method: document.querySelector('[name="shipping"]')?.value || 'standard',
          shop_domain: getShopDomain() // Added shop domain
        });
      });
    });
  }

  // 4. Purchase Confirmation Tracking
  function trackPurchases() {
    // Detect thank-you/purchase confirmation pages
    if (window.location.pathname.match(/(thank-you|order-confirmation|purchase-complete)/i)) {
      trackEvent('purchase', {
        order_id: getOrderIdFromPage(),
        revenue: getOrderTotal(),
        item_count: getItemCount(),
        payment_method: getPaymentMethod(),
        shipping_method: 'standard',
        shop_domain: getShopDomain() // Added shop domain
      });
    }
  }

  // 5. Enhanced User Engagement Tracking
  function trackEnhancedEngagement() {
    // Video engagement
    document.querySelectorAll('video').forEach(video => {
      video.addEventListener('play', () => {
        trackEvent('user_engagement', {
          engagement_type: 'video_play',
          media_id: video.id || 'product_video',
          duration: video.duration || 0,
          shop_domain: getShopDomain() // Added shop domain
        });
      });
    });

    // File downloads (price lists, catalogs, etc.)
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.href) {
        const extension = link.href.split('.').pop().toLowerCase();
        const downloadExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'csv'];
        
        if (downloadExtensions.includes(extension)) {
          trackEvent('user_engagement', {
            engagement_type: 'file_download',
            file_type: extension,
            file_name: link.download || link.href.split('/').pop(),
            shop_domain: getShopDomain() // Added shop domain
          });
        }
      }
    });
  }

  // Initialize all e-commerce tracking
  trackProductViews();
  trackAddToCart();
  trackCheckoutSteps();
  trackPurchases();
  trackEnhancedEngagement();
}

// SHOPIFY DETECTION AND AUTO-CONFIG
function initShopifyIntegration() {
  // Detect if this is a Shopify store
  if (window.Shopify || document.querySelector('[data-shopify]')) {
    const shopDomain = window.Shopify?.shop || 
                      document.querySelector('[data-shop-domain]')?.dataset.shopDomain ||
                      window.location.hostname;
    
    // Auto-configure for Shopify
    console.log('🛍️ Shopify store detected:', shopDomain);
    
    // Enhanced product tracking for Shopify themes
    function enhanceShopifyTracking() {
      // Shopify specific product selectors
      const shopifyProductSelectors = [
        '.product-item', 
        '[data-product-handle]',
        '.grid-product',
        '.product-card'
      ];
      
      shopifyProductSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          element.addEventListener('click', () => {
            const productHandle = element.dataset.productHandle;
            if (productHandle) {
              trackEvent('product_view', {
                product_id: productHandle,
                category: 'shopify_product',
                shop_domain: shopDomain
              });
            }
          });
        });
      });
    }
    
    enhanceShopifyTracking();
  }
}

// MAIN ANALYTICS FUNCTION
function trackEvent(eventType, eventData = {}) {
  if (!isInitialized) {
    console.warn('Analytics not initialized yet');
    return;
  }

  const event = {
    event_id: generateUniqueId(),
    event_type: eventType,
    timestamp: new Date().toISOString(),
    page_url: window.location.href,
    page_title: document.title,
    page_path: window.location.pathname,
    referrer: document.referrer,
    user_agent: navigator.userAgent,
    screen_resolution: `${screen.width}x${screen.height}`,
    shop_domain: getShopDomain(), // UPDATED: Use the new function
    ...eventData
  };

  const params = {
    Data: JSON.stringify(event),
    PartitionKey: event.event_id,
    StreamName: 'CdkIacProjectStack-WebsiteClickStream66FE1323-blFyTYg1yVJv' // UPDATED: Fixed stream name
  };

  kinesis.putRecord(params, (err, data) => {
    if (err) {
      console.error('Error sending event:', err);
    } else {
      console.log('📊 Event sent successfully:', eventType, eventData);
    }
  });
}

// INITIALIZATION FUNCTION
function initAnalytics() {
  if (isInitialized) return;
  
  // Load AWS SDK dynamically
  const script = document.createElement('script');
  script.src = 'https://sdk.amazonaws.com/js/aws-sdk-2.1326.0.min.js';
  script.onload = () => {
    window.AWS.config.region = AWS_CONFIG.region;
    window.AWS.config.credentials = new window.AWS.CognitoIdentityCredentials({
      IdentityPoolId: AWS_CONFIG.IdentityPoolId
    });

    kinesis = new window.AWS.Kinesis();
    isInitialized = true;
    
    // Track initial page view
    trackEvent('page_view');
    
    // Initialize e-commerce tracking
    trackEcommerceEvents();
    
    // Initialize Shopify integration
    initShopifyIntegration();
    
    console.log('✅ GetInsightStream Analytics initialized with e-commerce tracking');
  };
  document.head.appendChild(script);
}

// EXISTING TRACKING FUNCTIONS (keep all your current ones)
// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
  initAnalytics();
}

// Make trackEvent available globally
window.trackEvent = trackEvent;

// Track navigation clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href) {
    setTimeout(() => {
      trackEvent('navigation_click', {
        link_text: link.textContent.trim().substring(0, 100),
        link_url: link.href,
        link_location: 'navigation',
        shop_domain: getShopDomain() // Added shop domain
      });
    }, 100);
  }
});

// Track scroll depth
let maxScrollDepth = 0;
window.addEventListener('scroll', () => {
  const scrollHeight = document.documentElement.scrollHeight;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const clientHeight = document.documentElement.clientHeight;
  const currentDepth = Math.round((scrollTop + clientHeight) / scrollHeight * 100);
  
  if (currentDepth > maxScrollDepth && currentDepth % 25 === 0) {
    maxScrollDepth = currentDepth;
    trackEvent('scroll_depth', {
      depth_percentage: currentDepth,
      page_url: window.location.href,
      shop_domain: getShopDomain() // Added shop domain
    });
  }
});

// Track time on page
let pageLoadTime = Date.now();
window.addEventListener('beforeunload', () => {
  const timeOnPage = Date.now() - pageLoadTime;
  trackEvent('page_exit', {
    time_on_page: timeOnPage,
    scroll_depth: maxScrollDepth,
    page_url: window.location.href,
    shop_domain: getShopDomain() // Added shop domain
  });
});
