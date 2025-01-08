import { apiRequest, Method } from "../util/apiRequest";

type Message = {
    username: string;
    message: string;
    timestamp: string;
}

type Token = {
    meta: {
        address: string;
        ticker: string;
        name: string;
        logoUrl: string;
    },
    messages: Message[];
}

// Enums for environments and routes
enum ENV {
    DEXSCREENER = 'dexscreener.com',
    BULLX = 'bullx.io',
    PUMPFUN = 'pump.fun',
};

enum ROUTES {
    AUTHENTICATION = '/authentication',
    TOKEN = '/token',
};

// Utility to detect current environment
class EnvironmentDetector {
    static getEnvironment(url: string) {
        if (url.includes(ENV.DEXSCREENER)) {
            return ENV.DEXSCREENER;
        } else if (url.includes(ENV.BULLX)) {
            return ENV.BULLX;
        } else if (url.includes(ENV.PUMPFUN)) {
            return ENV.PUMPFUN;
        }
        return null;
    }

    static getTokenAddress(url: string) {
        const currentEnvironment = this.getEnvironment(url);
        if (currentEnvironment === ENV.PUMPFUN) {
            const urlParts = url.split('/');
            if(urlParts.length < 3) return null;
            if(urlParts[urlParts.length - 2] != 'coin') return null;
            return urlParts[urlParts.length - 1];
        } else if (currentEnvironment === ENV.BULLX) {
            const urlParams = new URLSearchParams(window.location.search);
            if(!urlParams.has('address')) return null;
            return urlParams.get('address');
        } 
        else if (currentEnvironment === ENV.DEXSCREENER) {
            const aTags = document.getElementsByTagName('a');
            for (let i = 0; i < aTags.length; i++) {
                const href = aTags[i].href;
                if (href.includes('solscan.io/token/') && !href.includes('So11111111111111111111111111111111111111112')) {
                    const urlParts = aTags[i].href.split('/');
                    return urlParts[urlParts.length - 1];
                }
            }
        }
        console.error('Platform not supported');
        return null;
    }
}

// Class for rendering dynamic content in the sidebar
class DynamicRenderer {
    container: HTMLElement | null;
    constructor(containerSelector: string) {
        this.container = document.querySelector(containerSelector);
        // this.container: = document.querySelector(containerSelector);
    }

    renderLoading(message:string = "Loading...") {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="loader-container">
                <div class="loader"></div>
                <p>${message}</p>
            </div>`;
    }

    renderError(error:string) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="error-message">
                <p>${error}</p>
            </div>`;
    }

    renderTokenInfo(token: Token) {
        if (!this.container) return;

        this.container.innerHTML = `
            <div>
                <img src="${token.meta.logoUrl}" alt="Token logo" />
                <p><strong>${token.meta.ticker}</strong> ${token.meta.name}</p>
                <p>${token.meta.address}</p>
            </div>`;
    }

    renderCreateTokenForm(tokenAddress: string) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div>
                <p>No token found for address: ${tokenAddress}</p>
                <p>Creating a new token chatroom...</p>
            </div>`;
    }
}

// Sidebar logic
class Sidebar {
    popupWidth: string;
    sidebarVisible: boolean;
    cachedPageStyle: string;
    currentEnvironment: string | null;
    renderer: DynamicRenderer | null;
    currentTokenAddress: string | null;
    pollingInterval: number;
    pollingTimer: number | null;

    constructor(popupWidth = '300px') {
        this.popupWidth = popupWidth;
        this.sidebarVisible = false;
        this.cachedPageStyle = '0px';
        this.currentEnvironment = EnvironmentDetector.getEnvironment(window.location.href);
        this.renderer = null;
        this.currentTokenAddress = null;
        this.pollingInterval = 3000; // Check every 3 seconds
        this.pollingTimer = null;
    }

    startPolling() {
        this.pollingTimer = window.setInterval(async () => {
            const newTokenAddress = EnvironmentDetector.getTokenAddress(window.location.href);
            if (newTokenAddress !== this.currentTokenAddress && newTokenAddress != null) {
                this.currentTokenAddress = newTokenAddress;
                await this.initializeToken();
            }
        }, this.pollingInterval);
    }

    stopPolling() {
        if (this.pollingTimer) {
            window.clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    async injectFonts() {
        const font = new FontFace('Passion One', `url(${chrome.runtime.getURL('assets/PassionOne-Regular.ttf')})`);
        await font.load();
        document.fonts.add(font);
    }

    async injectSidebar() {
        if (this.sidebarVisible) return;

        try {
            const response = await fetch(chrome.runtime.getURL("content.html"));
            let html = await response.text();
            await this.injectFonts();

            html = html.replace(/src="assets\//g, `src="${chrome.runtime.getURL('assets/')}`);

            const sidebarContainer = document.createElement("div");
            sidebarContainer.id = "CryptoChat";
            sidebarContainer.innerHTML = html;
            sidebarContainer.style.width = this.popupWidth;

            this.setDocumentStyles();
            document.body.appendChild(sidebarContainer);

            const styles = document.createElement("link");
            styles.rel = 'stylesheet';
            styles.href = chrome.runtime.getURL("content.css");
            (document.head || document.documentElement).appendChild(styles);

            this.sidebarVisible = true;
            this.renderer = new DynamicRenderer('#CryptoChat .body');
            this.renderer.renderLoading("");

            // Start polling for token changes
            this.startPolling();

            this.initializeToken();
        } catch (error) {
            console.error("Failed to inject sidebar:", error);
        }
    }

    removeSidebar() {
        document.getElementById("CryptoChat")?.remove();
        this.resetDocumentStyles();
        this.sidebarVisible = false;

        // Stop polling when sidebar is removed
        this.stopPolling();
    }

    setDocumentStyles() {
        if (this.currentEnvironment === ENV.DEXSCREENER) {
            const navElement = document.querySelector('nav');
            if (!navElement) return;

            const navWidth = window.getComputedStyle(navElement).width;
            const mainChild: HTMLElement | null = document.querySelector('main > div');
            if (mainChild) {
                this.cachedPageStyle = mainChild.style.width;
                mainChild.style.width = `calc(100vw - ${navWidth} - ${this.popupWidth})`;
            }
        } else {
            document.body.style.marginRight = this.popupWidth;
        }
    }

    resetDocumentStyles() {
        if (this.currentEnvironment === ENV.DEXSCREENER) {
            const mainChild: HTMLElement | null = document.querySelector('main > div');
            if (mainChild) {
                mainChild.style.width = this.cachedPageStyle;
            }
        } else {
            document.body.style.marginRight = '0px';
        }
    }

    async initializeToken() {
        if (!this.renderer) return;
        console.log('Initializing token...');
        const tokenAddress = EnvironmentDetector.getTokenAddress(window.location.href);
        if (!tokenAddress) {
            this.renderer.renderError("Error loading token info.");
            return;
        }

        this.currentTokenAddress = tokenAddress; // Update current token address
        this.renderer.renderLoading("Getting token info...");
        const response = await apiRequest(Method.GET, `${ROUTES.TOKEN}/${tokenAddress}`);

        if (response.success) {
            this.renderer.renderTokenInfo(response.data);
        } else if (response.status === 404) {
            const createResponse = await apiRequest(Method.POST, `${ROUTES.TOKEN}`, {
                address: tokenAddress
            });

            if (createResponse.success) {
                this.renderer.renderTokenInfo(createResponse.data);
            } else {
                this.renderer.renderError("Failed to fetch token info.");
            }
        } else {
            this.renderer.renderError("Failed to fetch token info.");
        }
    }
}

// Initialize the sidebar instance
const sidebar = new Sidebar();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleSidebarOn") {
        sidebar.injectSidebar();
        sendResponse({ status: "Sidebar toggled on" });
    } else if (request.action === "toggleSidebarOff") {
        sidebar.removeSidebar();
        sendResponse({ status: "Sidebar toggled off" });
    }
});

// On load, retrieve the toggle preference from storage
chrome.storage.local.get(['togglePreference'], (result) => {
    const isChecked = result.togglePreference || false;
    if (isChecked) {
        sidebar.injectSidebar();
    }
});
