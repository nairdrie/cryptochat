// Enums for environments and routes
const ENV = {
    DEXSCREENER: 'dexscreener.com',
    BULLX: 'bullx.io',
    PUMPFUN: 'pump.fun',
};

const ROUTES = {
    AUTHENTICATION: '/authentication',
    TOKEN: '/token',
};

// Utility for API requests
async function apiRequest(method, route, body) {
    return new Promise((resolve, _reject) => {
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

// Utility to detect current environment
class EnvironmentDetector {
    static getEnvironment(url) {
        if (url.includes(ENV.DEXSCREENER)) {
            return ENV.DEXSCREENER;
        } else if (url.includes(ENV.BULLX)) {
            return ENV.BULLX;
        } else if (url.includes(ENV.PUMPFUN)) {
            return ENV.PUMPFUN;
        }
        return null;
    }

    static getTokenAddress(url) {
        const currentEnvironment = this.getEnvironment(url);
        if (currentEnvironment === ENV.PUMPFUN) {
            const urlParts = url.split('/');
            return urlParts[urlParts.length - 1];
        } else if (currentEnvironment === ENV.BULLX) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('address');
        } else if (currentEnvironment === ENV.DEXSCREENER) {
            return window.__SERVER_DATA.route.data.pair.pair.baseToken.address;
        }
        console.error('Platform not supported');
        return null;
    }
}

// Class for rendering dynamic content in the sidebar
class DynamicRenderer {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
    }

    renderLoading(message = "Loading...") {
        this.container.innerHTML = `
            <div class="loader-container">
                <div class="loader"></div>
                <p>${message}</p>
            </div>`;
    }

    renderError(error) {
        this.container.innerHTML = `
            <div class="error-message">
                <p>Error: ${error}</p>
            </div>`;
    }

    renderTokenInfo(data) {
        const token = data.token;
        this.container.innerHTML = `
            <div>
                <img src="${token.logoUrl}" alt="Token logo" />
                <p><strong>${token.ticker}</strong> ${token.name}</p>
                <p>${token.address}</p>
            </div>`;
    }

    renderCreateTokenForm(tokenAddress) {
        this.container.innerHTML = `
            <div>
                <p>No token found for address: ${tokenAddress}</p>
                <p>Creating a new token chatroom...</p>
            </div>`;
    }
}

// Sidebar logic
class Sidebar {
    constructor(popupWidth = '300px') {
        this.popupWidth = popupWidth;
        this.sidebarVisible = false;
        this.cachedPageStyle = null;
        this.currentEnvironment = EnvironmentDetector.getEnvironment(window.location.href);
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

            // Replace relative paths with runtime URLs
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
            this.initializeToken();
        } catch (error) {
            console.error("Failed to inject sidebar:", error);
        }
    }

    removeSidebar() {
        document.getElementById("CryptoChat")?.remove();
        this.resetDocumentStyles();
        this.sidebarVisible = false;
    }

    setDocumentStyles() {
        if (this.currentEnvironment === ENV.DEXSCREENER) {
            const navElement = document.querySelector('nav');
            if (!navElement) return;

            const navWidth = window.getComputedStyle(navElement).width;
            const mainChild = document.querySelector('main > div');
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
            const mainChild = document.querySelector('main > div');
            if (mainChild) {
                mainChild.style.width = this.cachedPageStyle;
            }
        } else {
            document.body.style.marginRight = 0;
        }
    }

    async initializeToken() {
        console.log('Initializing token...');
        const tokenAddress = EnvironmentDetector.getTokenAddress(window.location.href);
        if (!tokenAddress) {
            this.renderer.renderError("Token address not found.");
            return;
        }

        this.renderer.renderLoading("Getting token info...");
        const response = await apiRequest('GET', `${ROUTES.TOKEN}/${tokenAddress}`);

        if (response.success) {
            this.renderer.renderTokenInfo(response.data);
        } else if (response.status === 404) {
            // this.renderer.renderCreateTokenForm(tokenAddress);

            const createResponse = await apiRequest('POST', `${ROUTES.TOKEN}`, {
                address: tokenAddress,
                ticker: 'TOK',
                name: 'Token',
                logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
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
