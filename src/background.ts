type Message = {
    username: string;
    message: string;
    timestamp: string;
};

// A map to track subscriptions: { tabId: { tokenAddress: EventSource } }
const streams: Record<number, { tokenAddress: string; eventSource: EventSource }> = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fetchAPI') {
        chrome.storage.local.get(['authToken'], (result) => {
            const token = result.authToken; // May be undefined if no token is stored
            const url = message.url.startsWith('http') ? message.url : `http://localhost:3000${message.url}`;
            const headers = {
                'Content-Type': 'application/json',
                ...(message.headers || {}),
            };

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
    } else if (message.action === 'connectToStream') {
        chrome.storage.local.get(['authToken'], (result) => {
            const jwt = result.authToken;
            const { tokenAddress } = message;
            const tabId = sender.tab?.id;

            if (!tabId || !tokenAddress) {
                sendResponse({ success: false, error: 'Invalid tab or token address.' });
                return;
            }

            // If a stream for this tab/token already exists, close it first
            if (streams[tabId]) {
                streams[tabId].eventSource.close();
                delete streams[tabId];
            }

            // Open a new stream
            const eventSource = new EventSource(`http://localhost:3000/chatStream?tokenAddress=${tokenAddress} &jwt=${jwt}`);
            streams[tabId] = { tokenAddress, eventSource };

            eventSource.onmessage = (event) => {
                const newMessages: Message[] = JSON.parse(event.data);

                // Send the new messages to the corresponding tab
                chrome.tabs.sendMessage(tabId, {
                    action: 'newChatMessages',
                    data: newMessages,
                });
            };

            eventSource.onerror = () => {
                console.error(`Stream error for token ${tokenAddress} in tab ${tabId}.`);
                eventSource.close();
                delete streams[tabId]; // Remove the stream from the map
            };

            sendResponse({ success: true });
        });
        return true;
    } else if (message.action === 'disconnectFromStream') {
        const tabId = sender.tab?.id;

        if (tabId && streams[tabId]) {
            streams[tabId].eventSource.close();
            delete streams[tabId];
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'No stream found for this tab.' });
        }

        return true;
    }
});

// Clean up streams when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (streams[tabId]) {
        streams[tabId].eventSource.close();
        delete streams[tabId];
    }
});
