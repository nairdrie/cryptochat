const ENV = {
    DEXSCREENER: 'dexscreener.com',
    BULLX: 'bullx.io',
    PUMPFUN: 'pump.fun',
}

const dynamicContent = {
    loader: () =>`
        <div class="loader-container">
            <div class="loader"></div>
            <p>Getting token info</p>
        </div>
    `,
    tokenHeader: (token) => `
        <div class="token-header">
            <img src="${token.logo}" alt="${token.ticker} logo">
            <h2>${token.ticker}</h2>
            <put a copy/
            
    `
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

function getTokenAddress() {
    const url = window.location.href;
    const currentEnvironment = getEnvironment(url);
    
    if(currentEnvironment === ENV.PUMPFUN) {
        // last string of the url
        const urlParts = url.split('/');
        return urlParts[urlParts.length - 1];
    }
    else if(currentEnvironment == ENV.BULLX) {
        // address query parameter
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('address');
    }
    else if(currentEnvironment == ENV.DEXSCREENER) {
        // return document.querySelector('.token-address').innerText;
        return window.__SERVER_DATA.route.data.pair.pair.baseToken.address;
    }
    else {
        console.error('Platform not supported');
    }
}

function initializeSidebar() {
    const tokenAddress = getTokenAddress();
    console.log('Token address:', tokenAddress);
}

initializeSidebar();