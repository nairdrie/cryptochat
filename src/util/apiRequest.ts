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