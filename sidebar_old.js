const apiAddress = 'http://localhost:3000';

const ROUTES = {
    AUTHENTICATION: '/authentication',
    TOKEN: '/token',
}

class ApiService {
    constructor(baseURL) {
      this.baseURL = baseURL;
    }
  
    async request(endpoint, method = 'GET', data = null, headers = {}) {
      const url = `${this.baseURL}${endpoint}`;
  
      // Default headers
      const defaultHeaders = {
        'Content-Type': 'application/json',
      };
  
      const options = {
        method,
        headers: { ...defaultHeaders, ...headers },
      };
  
      // Add body if the method is POST, PUT, PATCH, or DELETE
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && data) {
        options.body = JSON.stringify(data);
      }
  
      try {
        const response = await fetch(url, options);
  
        // Handle non-2xx responses
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        // Return JSON if the response has JSON content
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
  
        // Return text for non-JSON responses
        return await response.text();
      } catch (error) {
        console.error('API request error:', error);
        throw error;
      }
    }
  
    async get(endpoint, headers = {}) {
      return this.request(endpoint, 'GET', null, headers);
    }
  
    async post(endpoint, data, headers = {}) {
      return this.request(endpoint, 'POST', data, headers);
    }
  
    async put(endpoint, data, headers = {}) {
      return this.request(endpoint, 'PUT', data, headers);
    }
  
    async patch(endpoint, data, headers = {}) {
      return this.request(endpoint, 'PATCH', data, headers);
    }
  
    async delete(endpoint, data = null, headers = {}) {
      return this.request(endpoint, 'DELETE', data, headers);
    }
  }

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
            
    `,
    debug: (token) => `
        <div>
            <p>Token Address: </p>
            <p>${token.address}
        </div>
    `
}

const api = new ApiService(apiAddress);

let token;

function render(content) {
    const container = document.querySelector('#CryptoChat .body');
    container.innerHTML = content;
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

async function initializeSidebar() {
    render(dynamicContent.loader());
    const tokenAddress = getTokenAddress();
    // token = await api.get(`${ROUTES.TOKEN}/${tokenAddress}`);

    chrome.runtime.sendMessage(
        {
          action: 'fetchAPI',
          url: 'http://localhost:3000/token/2vnVvGGKacVyrkqxiWTaoNadMWzYa6HYrvdtHNA7pump',
          method: 'GET',
        },
        response => {
          if (response.success) {
            console.log('Data:', response.data);
          } else {
            console.error('Error:', response.error);
          }
        }
    );
    
    console.log('Token info:', token);
    render(dynamicContent.debug(token));
}

initializeSidebar();