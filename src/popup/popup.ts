import { apiRequest, Method } from "../util/apiRequest";

// Elements
const bodyContainer = document.querySelector('.body');

// Utility: Update the popup UI
function renderAuthenticatedUI(user: { username: string }) {
    if(!bodyContainer) return;
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
    if(!bodyContainer) return;
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
    const toggleSwitch: HTMLInputElement | null = document.querySelector('.toggle-container input[type="checkbox"]');
    if(!toggleSwitch) return;
    chrome.storage.local.get(['togglePreference'], (result) => {
        const isChecked = result.togglePreference || false;
        toggleSwitch.checked = isChecked;
    });

    toggleSwitch.addEventListener('change', (event:any) => {
        const isChecked = event.target.checked;
        chrome.storage.local.set({ togglePreference: isChecked }, () => {
            console.log('Toggle preference saved:', isChecked);
        });

        const message = isChecked ? { action: 'toggleSidebarOn' } : { action: 'toggleSidebarOff' };
        chrome.tabs.query({}, (tabs:any[]) => {
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
    const loginForm: HTMLElement | null = document.getElementById('loginForm');
    if(!loginForm) return;
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent the default form submission behavior

        const emailElement = document.getElementById('email') as HTMLInputElement;
        if(!emailElement) return;

        const passwordElement = document.getElementById('password') as HTMLInputElement;
        if(!passwordElement) return;

        const email = emailElement.value.trim();
        const password = passwordElement.value;

        // Basic client-side validation
        if (!email || !password) {
            renderLoginForm("Email and password are required.");
            return;
        }

        // Send login request
        const response = await apiRequest(Method.POST, '/authentication', { email, password });
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


// Check authentication status on load
function checkUserStatus() {
    console.log("WEOCLOEM! checking user status");
    chrome.storage.local.get(['authToken'], async (result) => {
        const token = result.authToken;
        console.log("Token:", token);
        if (token) {
            const response = await apiRequest(Method.GET, '/user', null);
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
