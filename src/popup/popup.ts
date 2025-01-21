import { apiRequest, Method } from "../util/apiRequest";

interface User {
    username: string;
}

class AuthApp {
    private bodyContainer: HTMLElement | null;

    constructor() {
        this.bodyContainer = document.querySelector('.body');
        document.addEventListener('DOMContentLoaded', this.checkUserStatus.bind(this));
    }

    private renderAuthenticatedUI(user: User): void {
        if (!this.bodyContainer) return;

        this.bodyContainer.innerHTML = `
            <div id="cc-popup">
                <p>Welcome back, ${user.username || "User"}!</p>
                <div class="cc-toggle-container">
                    <p class="toggle-state">Sidebar Disabled</p>
                    <div class="toggle-container">
                        <label class="switch">
                            <input type="checkbox">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        this.attachToggleEvent();
    }

    private renderLoginForm(errorMessage = "", loading = false): void {
        if (!this.bodyContainer) return;

        this.bodyContainer.innerHTML = `
            <form id="loginForm" novalidate>
                <div class="form-group">
                    <label for="email">Email address</label>
                    <input type="email" id="email" placeholder="name@example.com" required />
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="password" required />
                </div>
                <div class="error-message" style="color: red; margin-bottom: 10px; ${errorMessage ? "" : "display: none;"}">
                    ${errorMessage}
                </div>
                ${loading ? `<button disabled type="submit">...</button>` : `<button type="submit">Login</button>`}
            </form>
        `;

        this.attachLoginEvent();
    }

    private attachToggleEvent(): void {
        const toggleSwitch = document.querySelector<HTMLInputElement>('.toggle-container input[type="checkbox"]');
        const toggleState = document.querySelector<HTMLElement>('.cc-toggle-container .toggle-state');

        if (!toggleSwitch || !toggleState) return;

        chrome.storage.local.get(['togglePreference'], (result) => {
            const isChecked: boolean = result.togglePreference !== undefined ? result.togglePreference : false;
            toggleSwitch.checked = isChecked;
            toggleState.textContent = isChecked ? "Sidebar Enabled" : "Sidebar Disabled";
        });

        toggleSwitch.addEventListener('change', (event: Event) => {
            const isChecked = (event.target as HTMLInputElement).checked;
            chrome.storage.local.set({ togglePreference: isChecked }, () => {
                console.log('Toggle preference saved:', isChecked);
                toggleState.textContent = isChecked ? "Sidebar Enabled" : "Sidebar Disabled";
            });

            const message = isChecked ? { action: 'toggleSidebarOn' } : { action: 'toggleSidebarOff' };
            chrome.tabs.query({}, (tabs) => {
                for (const tab of tabs) {
                    chrome.tabs.sendMessage(tab.id!, message, (response) => {
                        console.log(response?.status || 'No response from content script');
                    });
                }
            });
        });
    }

    private async attachLoginEvent() {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) return;

        loginForm.addEventListener('submit', async (e: Event) => {
            e.preventDefault();

            const emailElement = document.getElementById('email') as HTMLInputElement;
            const passwordElement = document.getElementById('password') as HTMLInputElement;

            if (!emailElement || !passwordElement) return;

            const email = emailElement.value.trim();
            const password = passwordElement.value;

            if (!email || !password) {
                this.renderLoginForm("Email and password are required.");
                return;
            }

            this.renderLoginForm("", true);

            const response = await apiRequest(Method.POST, '/authentication', { email, password });

            if (response.success) {
                chrome.storage.local.set({ authToken: response.data.token }, async () => {
                    await this.checkUserStatus();
                    // send message to background script to notify that user is authenticated
                    chrome.runtime.sendMessage({ action: 'authenticated' });
                });
            } else {
                const error = response.data ? response.data.error : "An error occurred. Please try again.";
                this.renderLoginForm(error);
            }
        });
    }

    private async checkUserStatus(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get(['authToken'], async (result) => {
                const token: string = result.authToken;
                console.log("Token:", token);
    
                if (token) {
                    const response = await apiRequest(Method.GET, '/user', null);
    
                    if (response.success) {
                        this.renderAuthenticatedUI(response.data);
                    } else {
                        chrome.storage.local.remove('authToken', () => {
                            this.renderLoginForm();
                        });
                    }
                } else {
                    this.renderLoginForm();
                }
                resolve();
            });
        });
    }
}

new AuthApp();
