importScripts('gemini_api.js', 'google_sheets_api.js'); // For service workers

// Global state for the agent
// IMPORTANT: Replace "YOUR_API_KEY_HERE" with your actual Google Gemini API key.
const GEMINI_API_KEY = "YOUR_API_KEY_HERE"; // User must replace this
// IMPORTANT: Replace "YOUR_SPREADSHEET_ID_HERE" with your actual Google Sheet ID.
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"; // User must replace this

let userRequest = '';
let maxTabs = 5;
let openedTabs = []; // Stores IDs of tabs opened by the agent
let isCancelled = false;
let currentTask = null; // Could store details about the current operation

console.log('Background service worker started.');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'startAgent') {
    console.log('Received startAgent message');
    userRequest = message.data.request;
    maxTabs = message.data.maxTabs;
    isCancelled = false; // Reset cancellation flag for new task
    currentTask = "Processing: " + userRequest; // Example task tracking

    console.log(`New task started: ${userRequest}. Max tabs: ${maxTabs}`);
    // Store settings (optional, could also keep in memory for simplicity for now)
    chrome.storage.local.set({ userRequest, maxTabs });

    processRequestWithLLM(userRequest);
    sendResponse({ status: "Agent started" });

  } else if (message.type === 'cancelOperation') {
    console.log('Cancel operation requested.');
    isCancelled = true;
    currentTask = null;
    console.log('Operation cancellation flag set.');
    sendResponse({ status: "Cancellation requested" });
  } else if (message.action === 'authenticateGoogle') {
    console.log('Received authenticateGoogle message.');
    authenticateUser()
      .then(() => sendResponse({ status: "Authentication flow started/completed." }))
      .catch(error => sendResponse({ status: "Authentication error", error: error.message }));
    return true; // Indicates that the response will be sent asynchronously
  }
  return true; // Indicates that the response will be sent asynchronously for most messages
});

/**
 * Authenticates the user with Google using chrome.identity.
 * Stores the access token in local storage.
 */
async function authenticateUser() {
  try {
    // First, check if the OAuth Client ID has been configured in manifest.json
    const manifest = chrome.runtime.getManifest();
    if (!manifest.oauth2 || !manifest.oauth2.client_id || manifest.oauth2.client_id === "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com") {
      console.error("OAuth 2.0 Client ID is a placeholder or not set in manifest.json. Please configure it.");
      currentTask = "Error: OAuth Client ID not set.";
      // Optionally, notify the popup.
      alert("OAuth 2.0 Client ID is not configured in the extension. Please check manifest.json.");
      return Promise.reject("OAuth 2.0 Client ID not configured.");
    }

    console.log("Starting Google authentication flow...");
    const token = await chrome.identity.getAuthToken({ interactive: true });

    if (chrome.runtime.lastError) {
      console.error("Error during authentication:", chrome.runtime.lastError.message);
      throw new Error(chrome.runtime.lastError.message);
    }

    if (token) {
      console.log("Successfully retrieved Google access token:", token);
      await chrome.storage.local.set({ google_access_token: token });
      console.log("Access token stored in chrome.storage.local.");
      currentTask = "Google Authentication Successful.";
      // Example call after successful authentication
      // await exampleWriteToSheet("Test data from auth success");
    } else {
      console.warn("Authentication finished, but no token was retrieved.");
      currentTask = "Authentication attempted, but no token received.";
    }
  } catch (error) {
    console.error('Error during Google authentication:', error);
    currentTask = `Google Authentication Failed: ${error.message}`;
    return Promise.reject(error.message || "Unknown authentication error.");
  }
}

/**
 * Example function to write data to a Google Sheet.
 * This serves as a template for how the LLM might direct data to be saved.
 * @param {string} dataToSave The string data to save in a cell.
 */
async function exampleWriteToSheet(dataToSave) {
  if (SPREADSHEET_ID === "YOUR_SPREADSHEET_ID_HERE" || !SPREADSHEET_ID) {
    console.error("Spreadsheet ID is a placeholder or not set in background.js. Cannot write to sheet.");
    return;
  }

  chrome.storage.local.get(['google_access_token'], async (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error retrieving access token from storage:", chrome.runtime.lastError);
      return;
    }

    const token = result.google_access_token;
    if (token) {
      console.log(`Attempting to write "${dataToSave}" to sheet ID: ${SPREADSHEET_ID}`);
      try {
        const success = await appendToSheet(SPREADSHEET_ID, [[dataToSave]], token);
        if (success) {
          console.log(`Successfully wrote "${dataToSave}" to the sheet.`);
        } else {
          console.warn(`Failed to write "${dataToSave}" to the sheet (appendToSheet returned false).`);
        }
      } catch (error) {
        console.error(`Error in exampleWriteToSheet calling appendToSheet for "${dataToSave}":`, error);
        if (error.message && error.message.includes("401") || error.message && error.message.includes("403")) {
          console.warn("Token might be expired or invalid. Consider re-authenticating.");
          // Optional: Attempt to remove the invalid token
          // chrome.identity.removeCachedAuthToken({ token: token }, () => {
          //   console.log("Removed potentially invalid cached token.");
          // });
          // chrome.storage.local.remove('google_access_token');
        }
      }
    } else {
      console.warn("No Google access token found. Please authenticate first.");
      // Optionally, trigger authentication flow here.
      // await authenticateUser();
    }
  });
}

/**
 * Placeholder function to simulate LLM processing and generate a plan.
 * @param {string} requestText The user's request.
 */
async function processRequestWithLLM(requestText) {
  if (isCancelled) {
    console.log("LLM processing skipped due to cancellation.");
    return;
  }
  console.log(`Processing request: "${requestText}" using Gemini API.`);
  currentTask = `LLM processing: ${requestText}`;

  if (GEMINI_API_KEY === "YOUR_API_KEY_HERE" || !GEMINI_API_KEY) {
    console.error("Gemini API key is a placeholder or not set. Please update background.js with your API key.");
    currentTask = "Error: API Key not set.";
    // Potentially, inform the popup about this error.
    // Example: Trigger an alert or update popup UI
    // chrome.action.setPopup({ popup: "error_popup.html" }); // (Requires creating error_popup.html)
    return;
  }
  
  // Also check for OAuth Client ID in manifest, if not already checked by authenticateUser (e.g. if LLM tries to use Sheets before auth)
  const manifest = chrome.runtime.getManifest();
  if (!manifest.oauth2 || !manifest.oauth2.client_id || manifest.oauth2.client_id === "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com") {
      console.error("OAuth 2.0 Client ID is a placeholder or not set in manifest.json. Google Sheets integration will fail if SAVE_TO_SHEET is used.");
      // This warning is important if the LLM might try to use Sheets functionality
      // without the user having gone through the login flow first.
  }

  // --- Prompt Augmentation for LLM ---
  // The quality of the LLM's plan heavily depends on this prompt and the LLM's capabilities.
  // Users may need to iterate on this prompt for their specific use cases and LLM model.
  // Ensure your GEMINI_API_KEY, SPREADSHEET_ID (if using SAVE_TO_SHEET), and OAUTH_CLIENT_ID are configured.
  const systemInstruction = `You are an AI assistant controlling a web browser. Your goal is to achieve the user's request by generating a precise JSON plan of actions.
The available actions are strictly limited to the following types:
- {"type": "OPEN_TAB", "url": "https://..."} - Opens a new tab with the specified URL. For searches, use "https://www.google.com/search?q=YOUR+SEARCH+QUERY".
- {"type": "WAIT", "milliseconds": 3000} - Pauses execution for a specified number of milliseconds (e.g., for page loads).
- {"type": "SCROLL_TO_BOTTOM", "tabId": "CURRENT_TAB"} - Scrolls the tab specified by tabId (or the most recently opened tab if "CURRENT_TAB") to the bottom.
- {"type": "EXTRACT_DATA", "tabId": "CURRENT_TAB", "data_needed": "all body text OR document title"} - Extracts data from the specified tab. 'data_needed' must be either "all body text" or "document title". The current implementation extracts both but this field guides your intent.
- {"type": "SAVE_TO_SHEET", "spreadsheetId": "your_sheet_id", "data": [["row1col1", "row1col2"], ["row2col1", "row2col2"]]} - Saves 2D array data to the specified Google Sheet. Use the global SPREADSHEET_ID if a specific one isn't needed.

Important Considerations for Plan Generation:
1.  Always start with an OPEN_TAB action, usually a Google search if the user's request implies needing to find information.
2.  Follow OPEN_TAB with a WAIT action to allow the page to load before attempting further actions like SCROLL_TO_BOTTOM or EXTRACT_DATA.
3.  SCROLL_TO_BOTTOM is often necessary before EXTRACT_DATA on long pages to ensure all content is loaded.
4.  EXTRACT_DATA currently gets the page title and all visible body text. The 'data_needed' field is for your semantic guidance. The agent does not yet re-feed this data to you for multi-step analysis. The user will see this logged data to make decisions.
5.  Ensure all URLs are complete and valid (e.g., "https://www.google.com/search?q=example").

User Request: "${requestText}"

Based *only* on the user request and the rules above, generate a JSON object containing a single key "actions", which is an array of action objects.
Example of a valid JSON plan:
{
  "actions": [
    { "type": "OPEN_TAB", "url": "https://www.google.com/search?q=best+running+shoes+reviews" },
    { "type": "WAIT", "milliseconds": 4000 },
    { "type": "SCROLL_TO_BOTTOM", "tabId": "CURRENT_TAB" },
    { "type": "EXTRACT_DATA", "tabId": "CURRENT_TAB", "data_needed": "all body text" }
  ]
}

Generate the JSON plan now:`;
  // --- End of Prompt Augmentation ---

  try {
    // Call the actual getLLMResponse function with the augmented prompt
    console.log("Sending augmented prompt to LLM:", systemInstruction);
    const llmResponse = await getLLMResponse(systemInstruction, GEMINI_API_KEY);

    if (isCancelled) {
      console.log("LLM processing was cancelled after API call.");
      currentTask = null;
      return;
    }

    console.log("Raw LLM Response:", llmResponse);
    currentTask = `LLM response received for: ${requestText}`;

    // For now, we're just logging. Plan execution will be based on this response later.
    // Example: Parse llmResponse if it's a JSON string defining a plan,
    // or if it's natural language that needs further parsing.

    // Based on the subtask, we are not yet implementing the parsing of llmResponse into a plan.
    // IMPORTANT: The prompt sent to Gemini API must be structured to request output in the JSON
    // format defined below. E.g., "Based on my request '...', provide a JSON plan of actions..."

    // LLM Response Structure Expectation:
    // {
    //   "actions": [
    //     { "type": "OPEN_TAB", "url": "https://..." },
    //     { "type": "WAIT", "milliseconds": 5000 },
    //     { "type": "SCROLL_TO_BOTTOM", "tabId": "CURRENT_TAB" | tabId },
    //     { "type": "EXTRACT_DATA", "tabId": "CURRENT_TAB" | tabId, "data_needed": "all text" | "title" /* etc. */ },
    //     { "type": "SAVE_TO_SHEET", "spreadsheetId": "your_sheet_id", "data": [["row1col1", "row1col2"]] }
    //   ]
    // }

    try {
      const parsedResponse = JSON.parse(llmResponse);
      if (parsedResponse && parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
        console.log("Successfully parsed LLM response into actions:", parsedResponse.actions);
        currentTask = "Executing LLM-generated plan.";
        await executeActionPlan(parsedResponse.actions); // Changed from executePlan
      } else {
        console.error("LLM response is not in the expected JSON structure or 'actions' array is missing/invalid:", parsedResponse);
        currentTask = "Error: Invalid plan structure from LLM.";
      }
    } catch (parseError) {
      console.error("Failed to parse LLM response as JSON:", parseError, "\nRaw LLM response:", llmResponse);
      currentTask = "Error: Failed to parse LLM response.";
      // Optionally, send a message to the popup or retry with a different prompt.
    }

  } catch (error) {
    console.error("Error in processRequestWithLLM (calling getLLMResponse or processing its result):", error);
    currentTask = `Error during LLM processing: ${error}`;
    // Optionally, display this error to the user via the popup.
  }
}

/**
 * Executes a plan (array of actions) received from the LLM.
 * @param {Array<Object>} actions The array of action objects to execute.
 */
async function executeActionPlan(actions) {
  let currentTabId = null; // To keep track of the context tab for actions

  for (const action of actions) {
    if (isCancelled) {
      console.log(`Action plan execution cancelled at action type: ${action.type}`);
      currentTask = "Plan execution cancelled.";
      return;
    }

    currentTask = `Executing action: ${action.type}`;
    console.log(`Executing action:`, action);

    try {
      switch (action.type) {
        case 'OPEN_TAB':
          if (!action.url) {
            console.error("OPEN_TAB action missing 'url'. Skipping.", action);
            continue;
          }
          const newTab = await openTab(action.url);
          if (newTab && newTab.id) {
            currentTabId = newTab.id;
            console.log(`OPEN_TAB successful. currentTabId set to: ${currentTabId}`);
          } else {
            console.warn("OPEN_TAB did not return a valid tab object or tab ID.", newTab);
          }
          break;

        case 'WAIT':
          if (typeof action.milliseconds !== 'number') {
            console.error("WAIT action missing or invalid 'milliseconds'. Skipping.", action);
            continue;
          }
          console.log(`Waiting for ${action.milliseconds}ms...`);
          await new Promise(resolve => setTimeout(resolve, action.milliseconds));
          console.log("Wait finished.");
          break;

        case 'SCROLL_TO_BOTTOM':
          const scrollTabId = (action.tabId === "CURRENT_TAB" || !action.tabId) ? currentTabId : action.tabId;
          if (!scrollTabId) {
            console.error("SCROLL_TO_BOTTOM: No valid tabId available (currentTabId is null and no specific tabId provided). Skipping.", action);
            continue;
          }
          console.log(`Requesting SCROLL_TO_BOTTOM for tabId: ${scrollTabId}`);
          try {
            const response = await chrome.tabs.sendMessage(scrollTabId, { action: 'scrollToBottom' });
            console.log("SCROLL_TO_BOTTOM response from content script:", response);
          } catch (e) {
            console.error(`Error sending SCROLL_TO_BOTTOM to tab ${scrollTabId}:`, e.message, "Did the content script load and respond?");
          }
          break;

        case 'EXTRACT_DATA':
          const extractTabId = (action.tabId === "CURRENT_TAB" || !action.tabId) ? currentTabId : action.tabId;
          if (!extractTabId) {
            console.error("EXTRACT_DATA: No valid tabId available. Skipping.", action);
            continue;
          }
          if (!action.data_needed) {
            console.error("EXTRACT_DATA action missing 'data_needed' field. Skipping.", action);
            continue;
          }
          console.log(`Requesting EXTRACT_DATA for tabId: ${extractTabId}, data needed: ${action.data_needed}`);
          try {
            const response = await chrome.tabs.sendMessage(extractTabId, { action: 'extractData', details: action.data_needed });
            console.log("EXTRACT_DATA response from content script:", response);
            if (response && response.status === 'dataExtracted' && response.data) {
              // In a more advanced agent, this data would be stored or sent back to LLM for further processing.
              // For this use case, ensure this data is clearly logged.
              console.log("--- EXTRACTED DATA ---");
              console.log("Title:", response.data.title);
              console.log("Content (first 500 chars):", response.data.content ? response.data.content.substring(0, 500) + "..." : "[NO CONTENT]");
              console.log("--- END OF EXTRACTED DATA ---");

              // The temporary direct link to populate SAVE_TO_SHEET data is kept for now,
              // but the LLM should ideally be prompted to create the full SAVE_TO_SHEET action itself.
              const nextActionIndex = actions.indexOf(action) + 1;
              if (nextActionIndex < actions.length && actions[nextActionIndex].type === "SAVE_TO_SHEET") {
                // Ensure data is an array of arrays for appendToSheet
                actions[nextActionIndex].data = [[response.data.title, response.data.content ? response.data.content.substring(0, 49990) : ""]]; // Respecting potential cell limits
                console.log("Populated 'data' field for subsequent SAVE_TO_SHEET action using extracted title and content.");
              }
            } else {
              console.warn("EXTRACT_DATA: Response received, but status is not 'dataExtracted' or data is missing.", response);
            }
          } catch (e) {
            console.error(`Error sending EXTRACT_DATA message to tab ${extractTabId} or processing response:`, e.message, "Ensure content script is injected and responding correctly.");
          }
          break;

        case 'SAVE_TO_SHEET':
          if (!action.data || !Array.isArray(action.data)) {
            console.error("SAVE_TO_SHEET action missing 'data' array or data is not an array. Skipping.", action);
            continue;
          }
          const sheetId = action.spreadsheetId || SPREADSHEET_ID; // Use action's ID or global fallback
          if (sheetId === "YOUR_SPREADSHEET_ID_HERE" || !sheetId) {
            console.error("SAVE_TO_SHEET: Spreadsheet ID is a placeholder or not provided. Skipping.", action);
            continue;
          }
          // Retrieve token
          const result = await new Promise(resolve => chrome.storage.local.get(['google_access_token'], resolve));
          if (chrome.runtime.lastError) {
            console.error("Error retrieving access token for SAVE_TO_SHEET:", chrome.runtime.lastError.message);
            continue;
          }
          const token = result.google_access_token;
          if (!token) {
            console.warn("SAVE_TO_SHEET: No Google access token found. Please authenticate first. Skipping.", action);
            // Optionally, trigger authentication here: await authenticateUser();
            continue;
          }
          console.log(`Attempting to save data to Spreadsheet ID: ${sheetId}`);
          try {
            await appendToSheet(sheetId, action.data, token);
            console.log("SAVE_TO_SHEET: Successfully appended data.");
          } catch (e) {
            console.error(`SAVE_TO_SHEET: Error appending data to sheet ${sheetId}:`, e.message);
          }
          break;

        default:
          console.warn(`Unknown action type: ${action.type}. Skipping.`, action);
      }
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error, "Action details:", action);
      // Decide if one error should stop the whole plan. For now, log and continue.
      currentTask = `Error on action: ${action.type}. Continuing plan.`;
    }
    // Small delay between actions if needed, or make it a WAIT action from LLM
    // await new Promise(resolve => setTimeout(resolve, 250));
  }

  if (!isCancelled) {
    console.log("Action plan execution completed.");
    currentTask = "Completed LLM plan: " + userRequest;
  } else {
    console.log("Action plan was cancelled during execution.");
  }
}

/**
 * Opens a new tab with the given URL.
 * Manages the list of opened tabs and checks against maxTabs.
 * @param {string} url The URL to open.
 * @param {boolean} active Whether the tab should be active.
 * @returns {Promise<chrome.tabs.Tab | null>} The created tab object or null if not opened.
 */
async function openTab(url, active = true) { // Made async for consistency, though chrome.tabs.create is callback-based
  if (isCancelled) {
    console.log(`Open tab (${url}) cancelled.`);
    return null;
  }
  if (openedTabs.length >= maxTabs) {
    console.warn(`Max tabs limit (${maxTabs}) reached. Cannot open new tab for ${url}.`);
    return null;
  }
  return new Promise((resolve, reject) => { // Promise was already here, which is good
    chrome.tabs.create({ url: url, active: active }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error(`Error opening tab ${url}:`, chrome.runtime.lastError.message);
        return reject(chrome.runtime.lastError);
      }
      if (tab) {
        console.log(`Opened tab: ${tab.id} with URL: ${url}`);
        if (!openedTabs.includes(tab.id)) { // Ensure not to add duplicates if event fires multiple times
          openedTabs.push(tab.id);
        }
        // Listen for when the tab is closed by the user or programmatically
        // Ensure listener is only added once per tab
        const onRemovedListenerKey = `onRemoved_${tab.id}`;
        if (!self[onRemovedListenerKey]) { // Use self to store listener status on global worker scope
            self[onRemovedListenerKey] = function tabSpecificOnRemoved(removedTabId, removeInfo) {
                if (removedTabId === tab.id) {
                    console.log(`Tab ${tab.id} was closed.`);
                    openedTabs = openedTabs.filter(id => id !== tab.id);
                    chrome.tabs.onRemoved.removeListener(self[onRemovedListenerKey]); // Clean up specific listener
                    delete self[onRemovedListenerKey]; // Remove stored status
                }
            };
            chrome.tabs.onRemoved.addListener(self[onRemovedListenerKey]);
        }
        resolve(tab); // Resolve with the tab object
      } else {
        // This case should ideally not happen if lastError is not set, but good for safety
        console.error(`Failed to open tab for ${url}, but no error was reported.`);
        resolve(null); // Resolve with null if tab creation failed silently
      }
    });
  });
}

// Note: openTabAndSearch is removed as its functionality is covered by OPEN_TAB + LLM specifying search URL.
// The old executePlan is replaced by executeActionPlan.

/**
 * Closes a specific tab and removes it from the agent's list. (Kept for potential manual use or future actions)
 * @param {number} tabId The ID of the tab to close.
 */
function closeTab(tabId) {
  if (openedTabs.includes(tabId)) {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        console.error(`Error closing tab ${tabId}:`, chrome.runtime.lastError.message);
      } else {
        console.log(`Closed tab: ${tabId}`);
      }
      // Removal from openedTabs is handled by the onRemoved listener set in openTab
    });
  } else {
    console.warn(`Tab ${tabId} not found in agent's list or already closed.`);
  }
}

// Example of how to clear storage on startup (for development)
// chrome.storage.local.clear(() => console.log('Storage cleared on startup.'));
