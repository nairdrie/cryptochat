export enum Method {
    GET = 'GET',
    POST = 'POST'
}

// Utility for API requests
export async function apiRequest(method: Method, route: string, body?: any): Promise<{ success: boolean, status?: number, data?: any }> {
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

export async function connectToStream(tokenAddress: string) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                action: 'connectToStream',
                tokenAddress: tokenAddress,
            },
            (response) => {
                if (response.success) {
                    resolve(true);
                } else {
                    reject();
                }
            }
        );
    });
}