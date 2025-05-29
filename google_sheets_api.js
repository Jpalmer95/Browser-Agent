// google_sheets_api.js

/**
 * Appends values to a Google Sheet.
 * @param {string} spreadsheetId The ID of the Google Sheet.
 * @param {Array<Array<string>>} values A 2D array of values to append (e.g., [['Value A1', 'Value B1']]).
 * @param {string} accessToken The OAuth2 access token.
 * @returns {Promise<boolean>} A promise that resolves with true on success, false on failure.
 */
async function appendToSheet(spreadsheetId, values, accessToken) {
  if (!spreadsheetId || spreadsheetId === "YOUR_SPREADSHEET_ID_HERE") {
    console.error("Spreadsheet ID is a placeholder or not provided.");
    return Promise.reject("Spreadsheet ID is a placeholder or not provided.");
  }
  if (!accessToken) {
    console.error("Access token not provided for appendToSheet.");
    return Promise.reject("Access token not provided.");
  }

  const API_ENDPOINT = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const requestBody = {
    values: values,
  };

  console.log(`Appending data to Spreadsheet ID: ${spreadsheetId}`);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Error response from Google Sheets API:', responseData);
      throw new Error(`Google Sheets API request failed with status ${response.status}: ${responseData.error?.message || response.statusText}`);
    }

    console.log('Successfully appended data to Google Sheet:', responseData);
    return true;
  } catch (error) {
    console.error('Error appending to Google Sheet:', error);
    return Promise.reject(error.message || "An unknown error occurred during the Google Sheets API call.");
  }
}

// Example of how this might be used from background.js:
// self.googleSheetsAPI = { appendToSheet };
// Or if background.js will use importScripts('google_sheets_api.js') and then call appendToSheet directly.
// For service workers, functions defined at the top level of an imported script are generally available.
