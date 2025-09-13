// AWS Configuration - Use your exact Identity Pool ID
const AWS_CONFIG = {
  region: 'us-east-1',
  IdentityPoolId: 'us-east-1:f73b9c93-1212-4ee6-b6ed-ad3ad4fae856'
};

// Generate unique ID
const generateUniqueId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Initialize AWS
let kinesis = null;
let isInitialized = false;

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
    
    // Track initial page view after initialization
    trackEvent('page_view');
  };
  document.head.appendChild(script);
}

// Function to send events to Kinesis
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
    ...eventData
  };

  const params = {
    Data: JSON.stringify(event),
    PartitionKey: event.event_id,
    StreamName: 'CdkIacProjectStack-WebsiteClickStream66FE1323-blFyTYg1yVJv'
  };

  kinesis.putRecord(params, (err, data) => {
    if (err) {
      console.error('Error sending event:', err);
    } else {
      console.log('Event sent successfully:', eventType);
    }
  });
}

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
        link_text: link.textContent.trim(),
        link_url: link.href,
        link_location: 'navigation'
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
      page_url: window.location.href
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
    page_url: window.location.href
  });
});
