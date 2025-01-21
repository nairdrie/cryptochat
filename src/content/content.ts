import { apiRequest, connectToStream, Method } from "../util/apiRequest";

type Message = {
    id: string;
    username: string;
    content: string;
    timestamp: string;
    self: boolean;
};

type Token = {
    address: string;
    ticker: string;
    name: string;
    logoUrl: string;
};

// Enums for environments and routes
enum ENV {
    DEXSCREENER = 'dexscreener.com',
    BULLX = 'bullx.io',
    PUMPFUN = 'pump.fun',
};

enum ROUTES {
    AUTHENTICATION = '/authentication',
    TOKEN = '/token',
    CHAT = '/chat'
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
        } 
        else if (currentEnvironment === ENV.BULLX) {
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
    private elapsedTimeInterval: number | null = null;
    public renderedMessageIds: Set<string>; // To track rendered message IDs

    constructor(containerSelector: string) {
        this.container = document.querySelector(containerSelector);
        this.renderedMessageIds = new Set();
    }

    startElapsedTimeUpdates() {
        if (this.elapsedTimeInterval) return; // Prevent multiple intervals
        this.elapsedTimeInterval = window.setInterval(() => {
            this.updateElapsedTimes();
        }, 10000); // Update every minute
    }

    stopElapsedTimeUpdates() {
        if (this.elapsedTimeInterval) {
            clearInterval(this.elapsedTimeInterval);
            this.elapsedTimeInterval = null;
        }
    }

    renderLoading(message = "Loading...") {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="loader-container">
                <div class="loader"></div>
                <p>${message}</p>
            </div>`;
    }

    renderError(mainText: string, subText = "") {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="error-message">
                ${ mainText ? `<p class="maintext">${mainText}</p>` : '' }
                ${ subText ? `<p class="subtext">${subText}</p>` : '' }
            </div>`;
    }

    renderTokenInfo(token: Token | null) {
        if (!this.container) return;
        if(!token) {
            this.renderError('Token info not available.');
            return;
        }

        // Render the token header and chat container
        this.container.innerHTML = `
            <div class="token-container">
                <div class="token-header">
                    <img class="token-img" src="${token.logoUrl}" alt="Token logo" />
                    <h2>
                        <div class="ticker">
                            ${token.ticker} 
                            <i class="fa-solid fa-copy copy-icon" title="Copy address"></i>
                            <span id="copy-popup" class="copy-popup hidden">Address copied!</span>
                        </div>
                        <div class="name">${token.name}</div>
                    </h2>
                </div>
                <div class="token-chat-container">
                </div>
            </div>
        `;

        // Add click event listener for the copy icon
        const copyIcon = this.container.querySelector('.copy-icon');
        if (copyIcon) {
            copyIcon.addEventListener('click', () => this.copyToClipboard(token.address));
        }
    }

    getElapsedTime(timestamp: string) {
        const messageTime = new Date(+timestamp).getTime();
        const currentTime = new Date().getTime();
        const elapsed = currentTime - messageTime;

        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return `now`;
    }

    renderMessage(message: Message) {
        return `
            <div class="chat-message ${message.self ? 'self' : ''}" data-timestamp="${message.timestamp}">
                <div class="message-header">
                    <span class="username">${message.username}</span>&nbsp;
                    <span class="timestamp">${this.getElapsedTime(message.timestamp)}</span>
                </div>
                <div class="message-body">${message.content}</div>
            </div>
        `;
    }
    

    // Method to render chat messages
    renderChat() {
        const chatContainer = this.container?.querySelector('.token-chat-container');
        if (!chatContainer) return;

        // Clear the rendered message set
        this.renderedMessageIds.clear();


        chatContainer.innerHTML = `
            <div class="chat-messages">
                <div class="empty-chat">
                    <p class="maintext">Nothing to see here...</p>
                    <p class="subtext">Type a message to get the conversation going.</p>
                </div>
            </div>
            <div class="chat-toolbar">
                <input class="message-input" type="text" placeholder="Type a message..." />
                <button class="send-message"><i class="fa-solid fa-arrow-right"></i></button>
            </div>
        `;
        
        

        const sendButton = chatContainer.querySelector('.send-message');
        const inputField = chatContainer.querySelector('.message-input') as HTMLInputElement;

        if (sendButton && inputField) {
            sendButton.addEventListener('click', () => this.sendMessage(inputField.value));
            inputField.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.sendMessage(inputField.value);
                }
            });
        }

        // Start elapsed time updates
        this.startElapsedTimeUpdates();
    }
    
    // Method to copy to clipboard and show a popup
    copyToClipboard(text: string) {
        navigator.clipboard.writeText(text).then(() => {
            this.showPopup("Address copied!");
        }).catch((err) => {
            console.error("Failed to copy text:", err);
        });
    }

    // Method to show a temporary popup
    showPopup(message: string) {
        const popup = document.getElementById('copy-popup');
        if (!popup) return;
    
        popup.textContent = message;
        popup.classList.remove('hidden');
    
        // Hide the popup after 2 seconds
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 20000);
    }

    // Update appendChatMessage to avoid duplicate messages
    appendChatMessage(message: Message) {
        // Check if the message is already rendered
        if (this.renderedMessageIds.has(message.id)) return;

        const chatMessages = this.container?.querySelector('.chat-messages');
        if (!chatMessages) return;

        const emptyChat = this.container?.querySelector('.empty-chat');
        if (emptyChat) emptyChat.remove();

        chatMessages.innerHTML = this.renderMessage(message) + chatMessages.innerHTML;
        this.renderedMessageIds.add(message.id);
    }

    async sendMessage(content: string) {
        console.log("SENDING MESSAGE");
        if (!content.trim()) return;
        const tokenAddress = sidebar.currentTokenAddress;
        if (!tokenAddress) {
            this.renderError('No token address available for sending messages.');
            return;
        }

        try {
            const response = await apiRequest(Method.POST, '/chat', {
                tokenAddress,
                content,
            });

            if (response.success) {
                const inputField = this.container?.querySelector('.message-input') as HTMLInputElement;
                if (inputField) inputField.value = '';
            } else {
                console.error('Failed to send message:', response);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    updateElapsedTimes() {
        const timestamps = this.container?.querySelectorAll('.timestamp');
        if (!timestamps) return;
    
        timestamps.forEach((timestampElement) => {
            const messageElement = timestampElement.closest('.chat-message');
            if (!messageElement) return;
    
            const timestampAttr = messageElement.getAttribute('data-timestamp');
            if (!timestampAttr) return;
    
            const elapsedTime = this.getElapsedTime(timestampAttr);
            timestampElement.textContent = elapsedTime;
        });
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
    token: Token | null;

    constructor(popupWidth = '300px') {
        this.popupWidth = popupWidth;
        this.sidebarVisible = false;
        this.cachedPageStyle = '0px';
        this.currentEnvironment = EnvironmentDetector.getEnvironment(window.location.href);
        this.renderer = null;
        this.currentTokenAddress = null;
        this.pollingInterval = 3000;
        this.pollingTimer = null;
        this.token = null;
    }

    startPolling() {
        this.pollingTimer = window.setInterval(async () => {
            console.log("POLLING");
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
        // Inject local Font Awesome stylesheet
        const faLocal = document.createElement('link');
        faLocal.rel = 'stylesheet';
        faLocal.href = chrome.runtime.getURL('assets/fa/css/font-awesome-all.min.css');
        (document.head || document.documentElement).appendChild(faLocal);
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
    
        const tokenAddress = EnvironmentDetector.getTokenAddress(window.location.href);
        if (!tokenAddress) {
            this.renderer.renderError("Navigate to a token page to chat.");
            return;
        }
    
        this.currentTokenAddress = tokenAddress;
        this.renderer.renderLoading("Getting token info...");
        this.renderer.renderedMessageIds.clear(); // Reset the rendered IDs
    
        try {
            const response = await apiRequest(Method.GET, `${ROUTES.TOKEN}/${tokenAddress}`);
            
            if (response.success) {
                this.token = response.data;
                this.renderer.renderTokenInfo(this.token);
    
                await this.renderer.renderChat();

                // Connect to the stream
                await connectToStream(tokenAddress);
            } 
            else if (response.status === 404) {
                const createResponse = await apiRequest(Method.POST, `${ROUTES.TOKEN}`, {
                    address: tokenAddress
                });
    
                if (createResponse.success) {
                    this.token = createResponse.data;
                    this.renderer.renderTokenInfo(this.token);
    
                    await this.renderer.renderChat();

                    // Connect to the stream
                    await connectToStream(tokenAddress);
                } else {
                    this.renderer.renderError("Failed to fetch token info.");
                }
            }
            else if (response.status === 401 || response.status === 403) {
                this.renderer.renderError("Looks like you're not signed in.", "Click the CryptoChat extension icon to sign in.");
            }
            else {
                this.renderer.renderError("Failed to fetch token info.");
            }
        } catch (error) {
            console.error('Error initializing token:', error);
            this.renderer.renderError("Failed to fetch token info.");
        }
    }
    
    // /**
    //  * Fetches chat messages for the given token and renders them.
    //  * @param {string} tokenAddress 
    //  */
    // async fetchAndRenderChatMessages(tokenAddress: string) {
    //     console.log("Fetching chat messages...");
    //     if (!this.renderer) return;
    //     try {
    //         const chatResponse = await apiRequest(Method.GET, `${ROUTES.CHAT}/${tokenAddress}`);
    //         console.log(chatResponse);
    //         if (chatResponse.success) {
    //             const tokenMessages = chatResponse.data;
                
    //             // Render the chat messages
    //             this.renderer.renderChat(tokenMessages);
    //         } else {
    //             this.renderer.renderError("Failed to fetch chat messages.");
    //         }
    //     } catch (error) {
    //         console.error('Error fetching chat messages:', error);
    //         this.renderer.renderError("Failed to fetch chat messages.");
    //     }
    // }
    
}

// Initialize the sidebar instance
const sidebar = new Sidebar();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleSidebarOn") {
        sidebar.injectSidebar();
        sendResponse({ status: "Sidebar toggled on" });
    } else if (request.action === "toggleSidebarOff") {
        sidebar.removeSidebar();
        sendResponse({ status: "Sidebar toggled off" });
    } else if (request.action === 'newChatMessages') {
        const newMessages: Message[] = request.data;

        // Append only new messages
        newMessages.forEach((msg) => {
            if (!sidebar.renderer?.renderedMessageIds.has(msg.id)) {
                sidebar.renderer?.appendChatMessage(msg);
            }
        });
        sendResponse({ status: "Messages processed" });

    } else if (request.action === "authenticated") {
        sidebar.initializeToken();
    }
});

chrome.storage.local.get(['togglePreference'], (result) => {
    const isChecked = result.togglePreference || false;
    if (isChecked) {
        sidebar.injectSidebar();
    }
});
