let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

function connectToMcpServer() {
    try {
        ws = new WebSocket('ws://localhost:8080');

        ws.onopen = () => {
            console.log('Connected to MCP server');
            reconnectAttempts = 0;
        };

        ws.onclose = () => {
            console.log('Disconnected from MCP server');
            ws = null;
            
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connectToMcpServer, RECONNECT_DELAY);
            }
        };

        ws.onmessage = async (event) => {
            // Always return page source regardless of message content
            try {
                const tabs = await chrome.tabs.query({ active: true });
                const tab = tabs?.[0];

                console.log(tab, tabs);
                
                if (!tab) {
                    ws.send(JSON.stringify({ 
                        error: 'No active tab found' 
                    }));
                    return;
                }

                // Execute script to get page source
                const [{result}] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.documentElement.outerHTML
                });

                ws.send(JSON.stringify({ 
                    source: result 
                }));
            } catch (error) {
                console.error('Error getting page source:', error);
                ws.send(JSON.stringify({ 
                    error: error.message 
                }));
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Connection error:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(connectToMcpServer, RECONNECT_DELAY);
        }
    }
}

// Initial connection
connectToMcpServer();

// Handle communication with the MCP server
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'QUERY_CODE') {
        // Handle regular query
        handleMcpQuery(message.payload)
            .then(result => sendResponse({ result }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Required for async response
    } else if (message.type === 'GET_PAGE_SOURCE' || message.query === 'GET_PAGE_SOURCE') {
        // Handle page source request directly
        getPageSource()
            .then(source => sendResponse({ source }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    } else if (message.type === 'MCP_CHROME_TAB_QUERY') {
        if (message.query === 'GET_PAGE_SOURCE') {
            getPageSource()
                .then(source => sendResponse({ source }))
                .catch(error => sendResponse({ error: error.message }));
            return true; // Required for async response
        }
    }
});

async function getPageSource() {
    try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            throw new Error('No active tab found');
        }

        // Execute script to get page source
        const [{result}] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.documentElement.outerHTML
        });

        return result;
    } catch (error) {
        throw error;
    }
}

async function handleMcpQuery({ query, code, language }) {
    // Check if this is a GET_PAGE_SOURCE request
    if (query === 'GET_PAGE_SOURCE') {
        return await getPageSource();
    }
    
    // Otherwise, do a simple text search
    try {
        const lines = code.split('\n');
        const matches = lines
            .map((line, index) => ({ line, index: index + 1 }))
            .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()));

        if (matches.length === 0) {
            return "No matches found for your query.";
        }

        const results = matches.map(({ line, index }) => 
            `Line ${index}: ${line.trim()}`
        );

        return `Found ${matches.length} matches:\n\n${results.join('\n')}`;
    } catch (error) {
        throw new Error(`Failed to process query: ${error.message}`);
    }
} 