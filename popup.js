// Elements
const bodyContainer = document.querySelector('.body');

// Utility: Update the popup UI
function renderAuthenticatedUI(user) {
    bodyContainer.innerHTML = `
        <p>Welcome back, ${user.username || "User"}!</p>
        <div class="toggle-container">
            <label class="switch">
                <input type="checkbox">
                <span class="slider round"></span>
            </label>
        </div>
    `;
    attachToggleEvent();
}

function renderLoginForm(errorMessage = "") {
    console.log("Rendering login form", errorMessage);
    bodyContainer.innerHTML = `
        <form id="loginForm" novalidate>
            <div class="error-message" style="color: red; margin-bottom: 10px; ${errorMessage ? "" : "display: none;"}">
                ${errorMessage}
            </div>
            <input type="email" id="email" placeholder="Email" required />
            <input type="password" id="password" placeholder="Password" required />
            <button type="submit">Login</button>
        </form>
    `;
    attachLoginEvent();
}

// Attach toggle switch events
function attachToggleEvent() {
    const toggleSwitch = document.querySelector('.toggle-container input[type="checkbox"]');
    chrome.storage.local.get(['togglePreference'], (result) => {
        const isChecked = result.togglePreference || false;
        toggleSwitch.checked = isChecked;
    });

    toggleSwitch.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        chrome.storage.local.set({ togglePreference: isChecked }, () => {
            console.log('Toggle preference saved:', isChecked);
        });

        const message = isChecked ? { action: 'toggleSidebarOn' } : { action: 'toggleSidebarOff' };
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                chrome.tabs.sendMessage(tab.id, message, (response) => {
                    console.log(response?.status || 'No response from content script');
                });
            }
        });
    });
}

// Attach login form events
function attachLoginEvent() {
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent the default form submission behavior

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Basic client-side validation
        if (!email || !password) {
            renderLoginForm("Email and password are required.");
            return;
        }

        // Send login request
        const response = await apiRequest('POST', '/authentication', { email, password });
        if (response.success) {
            chrome.storage.local.set({ authToken: response.data.token }, () => {
                console.log('Auth token saved');
                checkUserStatus(); // Re-check authentication status after login
            });
        }
        else {
            console.log('Login error from background.js:', response);
            renderLoginForm(response.data.error); // Show error message dynamically
        }
    });
}

async function apiRequest(method, route, body) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                action: 'fetchAPI',
                url: route,
                method: method,
                body: body,
            },
            (response) => {
                resolve({ success: response.success, status: response.status, data: response.data });
            }
        );
    });
}

// Check authentication status on load
function checkUserStatus() {
    console.log("WEOCLOEM! checking user status");
    chrome.storage.local.get(['authToken'], async (result) => {
        const token = result.authToken;
        console.log("Token:", token);
        if (token) {
            const response = await apiRequest('GET', '/user', null);
            if(response.success) {
                renderAuthenticatedUI(response.data);
            } else {
                chrome.storage.local.remove('authToken', () => {
                    renderLoginForm();
                });
            }
        } else {
            renderLoginForm();
        }
    });
}

// On load, check authentication status
document.addEventListener('DOMContentLoaded', checkUserStatus);
