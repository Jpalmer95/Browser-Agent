console.log('Web Agent content script loaded and active.');

/**
 * Listens for messages from the background script.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  if (message.action === 'scrollToBottom') {
    scrollToPageBottom()
      .then(() => {
        sendResponse({ status: 'scrolledToBottom' });
      })
      .catch(error => {
        console.error('Error scrolling to bottom:', error);
        sendResponse({ status: 'error', message: error.toString() });
      });
    return true; // Indicates that the response will be sent asynchronously.
  } else if (message.action === 'extractData') {
    try {
      const data = extractPageData();
      sendResponse({ status: 'dataExtracted', data: data });
    } catch (error) {
      console.error('Error extracting data:', error);
      sendResponse({ status: 'error', message: error.toString() });
    }
    return false; // Response is sent synchronously here.
  } else {
    console.warn('Unknown action received:', message.action);
    sendResponse({ status: 'error', message: `Unknown action: ${message.action}`})
  }
});

/**
 * Smoothly scrolls the window to the bottom of the page.
 * Handles dynamic content loading by scrolling multiple times if necessary.
 * Includes a maximum number of scroll attempts to prevent infinite loops.
 * @returns {Promise<{success: boolean, reason?: string}>} A promise that resolves with the outcome.
 */
function scrollToPageBottom() {
  return new Promise((resolve, reject) => {
    const MAX_SCROLL_ATTEMPTS = 10; // Maximum number of scroll attempts
    const SCROLL_DELAY_MS = 1000;   // Delay between scroll attempts for content loading
    const SMOOTH_SCROLL_DELAY_MS = 500; // Additional delay for smooth scroll animation to settle
    let attempts = 0;

    const scrollStep = async () => {
      attempts++;
      if (attempts > MAX_SCROLL_ATTEMPTS) {
        console.warn('scrollToPageBottom: Max scroll attempts reached.');
        resolve({ success: false, reason: 'max_attempts_reached' });
        return;
      }

      try {
        const lastScrollHeight = document.body.scrollHeight;
        window.scrollTo({ top: lastScrollHeight, behavior: 'smooth' });

        // Wait for smooth scroll animation to approximately complete
        await new Promise(r => setTimeout(r, SMOOTH_SCROLL_DELAY_MS));
        // Wait for new content to potentially load
        await new Promise(r => setTimeout(r, SCROLL_DELAY_MS));

        const currentScrollHeight = document.body.scrollHeight;
        const isAtBottom = (window.innerHeight + Math.ceil(window.scrollY)) >= currentScrollHeight;

        if (lastScrollHeight === currentScrollHeight && isAtBottom) {
          console.log('scrollToPageBottom: Successfully scrolled to bottom.');
          resolve({ success: true });
        } else {
          console.log(`scrollToPageBottom: Attempt ${attempts} - Not at bottom or content loaded. LastH: ${lastScrollHeight}, CurrentH: ${currentScrollHeight}, AtBottom: ${isAtBottom}. Scrolling again...`);
          scrollStep(); // Recursive call
        }
      } catch (error) {
        console.error('scrollToPageBottom: Error during scroll step:', error);
        reject(error); // Reject the main promise on error
      }
    };

    scrollStep();
  });
}

/**
 * Extracts basic data from the page.
 * Currently extracts title and all body text.
 * @returns {Object} An object containing the extracted page title and content.
 */
function extractPageData() {
  console.log('Extracting page data...');
  const pageTitle = document.title;
  const pageContent = document.body.innerText; // Gets all visible text

  // Could also consider: document.body.textContent for more raw text
  // or specific element selection: document.querySelector('article')?.innerText

  console.log(`Data extracted: Title - "${pageTitle}"`);
  return {
    title: pageTitle,
    content: pageContent,
  };
}

// Example: How background.js might send a message to this script
// (Not to be run here, just for illustration)
/*
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "extractData" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
      } else if (response && response.status === 'dataExtracted') {
        console.log('Data received from content script:', response.data);
      } else if (response && response.status === 'error') {
        console.error('Error from content script:', response.message);
      }
    });
  }
});
*/
