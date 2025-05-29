document.addEventListener('DOMContentLoaded', () => {
  const submitButton = document.getElementById('submitRequest');
  const cancelButton = document.getElementById('cancelOperation');
  const userInput = document.getElementById('userInput');
  const maxTabsInput = document.getElementById('maxTabs');

  submitButton.addEventListener('click', () => {
    const request = userInput.value;
    const maxTabs = parseInt(maxTabsInput.value, 10);

    if (request.trim() === '') {
      alert('Please enter a request.');
      return;
    }

    if (isNaN(maxTabs) || maxTabs <= 0) {
      alert('Please enter a valid number for max tabs.');
      return;
    }

    chrome.runtime.sendMessage({
      type: 'startAgent',
      data: {
        request: request,
        maxTabs: maxTabs
      }
    });
  });

  cancelButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'cancelOperation' });
  });

  const loginButton = document.getElementById('loginGoogle');
  loginButton.addEventListener('click', () => {
    console.log('Login to Google button clicked.');
    chrome.runtime.sendMessage({ action: 'authenticateGoogle' });
  });
});
