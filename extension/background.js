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
            const message = JSON.parse(event.data);
            
            if (message.type === 'GET_PAGE_SOURCE') {
                try {
                    // Get the active tab
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    
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
                    ws.send(JSON.stringify({ 
                        error: error.message 
                    }));
                }
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
        // In a real implementation, you would need to set up WebSocket or other
        // communication with the MCP server. For now, we'll simulate the response
        handleMcpQuery(message.payload)
            .then(result => sendResponse({ result }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Required for async response
    }
});

async function handleMcpQuery({ query, code, language }) {
    // Here you would implement the actual communication with your MCP server
    // For now, we'll do a simple text search to demonstrate the concept
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