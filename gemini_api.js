// gemini_api.js

/**
 * Interacts with the Google Gemini API to get a response for a given prompt.
 *
 * IMPORTANT: Replace "YOUR_API_KEY_HERE" with your actual Google Gemini API key.
 *
 * @param {string} userPrompt The prompt to send to the LLM.
 * @param {string} apiKey The API key for the Gemini API.
 * @returns {Promise<string>} A promise that resolves with the generated text content or an error message.
 */
async function getLLMResponse(userPrompt, apiKey) {
  // IMPORTANT: Users must replace "YOUR_API_KEY_HERE" with their actual key.
  // This is a placeholder and will not work.
  if (apiKey === "YOUR_API_KEY_HERE" || !apiKey) {
    console.error("API Key not provided or is a placeholder. Please provide a valid API key.");
    return Promise.reject("API Key not provided or is a placeholder.");
  }

  const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: userPrompt
      }]
    }]
  };

  console.log("Sending request to Gemini API with prompt:", userPrompt);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text(); // Try to get more details from the response body
      console.error(`API request failed with status: ${response.status}. Body: ${errorBody}`);
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}. Body: ${errorBody}`);
    }

    const responseData = await response.json();
    console.log("Raw API Response:", responseData);

    // Extract the generated text content
    // Based on Gemini API structure, this might be in:
    // responseData.candidates[0].content.parts[0].text
    if (responseData.candidates && responseData.candidates.length > 0 &&
        responseData.candidates[0].content && responseData.candidates[0].content.parts &&
        responseData.candidates[0].content.parts.length > 0) {
      const generatedText = responseData.candidates[0].content.parts[0].text;
      console.log("Extracted text from LLM:", generatedText);
      return generatedText;
    } else {
      console.error("Could not extract generated text from API response:", responseData);
      throw new Error("Invalid response structure from LLM API.");
    }

  } catch (error) {
    console.error('Error during LLM API call:', error);
    return Promise.reject(error.message || "An unknown error occurred during the API call.");
  }
}

// If using importScripts in background.js, we might need to make this function globally accessible
// or attach it to a namespace. For now, assuming direct import or future adjustment.
// self.geminiAPI = { getLLMResponse };
// Or if background.js will use importScripts('gemini_api.js') and then call getLLMResponse directly if it's in global scope.
// For service workers, functions defined at the top level of an imported script are generally available.
