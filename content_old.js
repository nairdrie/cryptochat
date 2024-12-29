let sidebarVisible = false;
const popupWidth = '300px'

// enum ENV
const ENV = {
    DEXSCREENER: 'dexscreener.com',
    BULLX: 'bullx.io',
    PUMPFUN: 'pump.fun',
}

function getEnvironment(url) {
    if(url.includes(ENV.DEXSCREENER)) {
        return ENV.DEXSCREENER;
    } else if(url.includes(ENV.BULLX)) {
        return ENV.BULLX;
    } else if(url.includes(ENV.PUMPFUN)) {
        return ENV.PUMPFUN;
    }
    return null;
}   

const url = window.location.href;
const currentEnironment = getEnvironment(url);

let cachedPageStyle;

function setDocumentStyles() {
    if(currentEnironment === ENV.DEXSCREENER) {
        // Select the <nav> element
        const navElement = document.querySelector('nav');
        if (!navElement) {
        console.error('<nav> element not found');
        return;
        }

        // Get the computed width of <nav>
        const navWidth = window.getComputedStyle(navElement).width;
        console.log(`Computed nav width: ${navWidth}`);

        // Update the width of the target element
        const mainChild = document.querySelector('main > div');
        if (mainChild) {
        console.log(`Setting width: calc(100vw - ${navWidth} - ${popupWidth})`);
        cachedPageStyle = mainChild.style.width;
        mainChild.style.width = `calc(100vw - ${navWidth} - ${popupWidth})`;
        } else {
        console.error('<main > div> element not found');
        }
    }
    else {
        document.body.style.marginRight = popupWidth;
    }
}

function resetDocumentStyles() {
    if(currentEnironment === ENV.DEXSCREENER) {
        // Update the width of the target element
        const mainChild = document.querySelector('main > div');
        if (mainChild) {
            mainChild.style.width = cachedPageStyle;
        } else {
        console.error('<main > div> element not found');
        }
    }
    else {
        document.body.style.marginRight = 0;
    }
}


async function injectFonts() {
    const font = new FontFace('Passion One', `url(${chrome.runtime.getURL('assets/PassionOne-Regular.ttf')})`);
    await font.load();
    document.fonts.add(font);
  }
  

async function injectSidebar() {
    if (sidebarVisible) return;
  
    fetch(chrome.runtime.getURL("sidebar.html"))
      .then((response) => response.text())
      .then( async (html) => {

        await injectFonts();
        
        // Preprocess the HTML string to replace relative paths with chrome.runtime.getURL
        const processedHtml = html.replace(/src="assets\//g, `src="${chrome.runtime.getURL('assets/')}`);
  
        const sidebarContainer = document.createElement("div");
        sidebarContainer.id = "CryptoChat";
        sidebarContainer.innerHTML = processedHtml;
        sidebarContainer.style.width = popupWidth;
        // // add data-addr 
        // sidebarContainer.setAttribute('data-env', currentEnvironment);

        setDocumentStyles();
  
        document.body.appendChild(sidebarContainer);

        const styles = document.createElement("link");
        styles.rel = 'stylesheet';
        styles.href = chrome.runtime.getURL("sidebar.css");
        (document.head || document.documentElement).appendChild(styles);

        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("sidebar.js");
        (document.head || document.documentElement).appendChild(script);
      })
      .catch((error) => console.error("Failed to load sidebar:", error));
}
  


// Listen for messages from the popup to toggle the sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleSidebarOn") {
    injectSidebar();
    sidebarVisible = true;
    sendResponse({ status: "Sidebar toggled" });
  }
  else if(request.action === "toggleSidebarOff") {
      document.getElementById("CryptoChat")?.remove();
      resetDocumentStyles();
      sidebarVisible = false;
    sendResponse({ status: "Sidebar toggled" });
  }
});


// On load, retrieve the toggle preference from storage
chrome.storage.local.get(['togglePreference'], (result) => {
    const isChecked = result.togglePreference || false; // Default to `false` if not set
    if(isChecked) {
        injectSidebar();
        sidebarVisible = true;
    }
});

