chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   console.log("Message received in background.js", message);

  if (message.action === 'fetchAPI') {
      // Retrieve the token from storage
      chrome.storage.local.get(['authToken'], (result) => {
          const token = result.authToken; // May be undefined if no token is stored

          // Construct the request URL and options
          const url = message.url.startsWith('http') ? message.url : `http://localhost:3000${message.url}`;
          const headers = {
              'Content-Type': 'application/json',
              ...(message.headers || {}),
          };

          // Conditionally add the Authorization header if a token exists
          if (token) {
              headers['Authorization'] = `Bearer ${token}`;
          }

          const options: any = {
              method: message.method || 'GET',
              headers: headers,
          };

          if (message.body) {
              options.body = JSON.stringify(message.body);
          }

          // Make the API request
          fetch(url, options)
              .then(async (response) => {
                  const contentType = response.headers.get('content-type');
                  let data;

                  if (contentType && contentType.includes('application/json')) {
                      data = await response.json();
                  } else {
                      data = await response.text(); // Handle non-JSON responses
                  }

                  sendResponse({
                      success: response.ok,
                      status: response.status,
                      data: data,
                  });
              })
              .catch((error) => {
                  console.error("Error fetching API:", error);
                  sendResponse({
                      success: false,
                      error: error.message,
                  });
              });
      });

      return true; // Keeps the message channel open for async response
  }
});
