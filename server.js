import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";

// Create WebSocket server to communicate with Chrome extension
const wss = new WebSocketServer({ port: 8080 });
let activeConnections = new Set();

wss.on('connection', (ws) => {
    // console.log('Chrome extension connected');
    activeConnections.add(ws);

    // Add error handler
    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        cleanupConnection(ws);
    });

    ws.on('close', () => {
        console.error("Chrome extension disconnected");
        cleanupConnection(ws);
    });

    // Send welcome message to confirm connection
    try {
        ws.send(JSON.stringify({ type: 'CONNECTION_ESTABLISHED' }));
    } catch (error) {
        console.error('Error sending welcome message:', error.message);
    }
});

// Handle server errors
wss.on('error', (error) => {
    console.error('WebSocket server error:', error.message);
});

// Cleanup function to ensure connections are properly removed
function cleanupConnection(ws) {
    activeConnections.delete(ws);
}

// Function to safely send messages to a client
function safelySendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Error sending message:', error.message);
            return false;
        }
    }
    return false;
}

// Create an MCP server
const server = new McpServer({
    name: "WebPageQuery",
    version: "1.0.0"
});

// Add webpage query tool
server.tool("query_current_page",
    {},
    async () => {
        if (activeConnections.size === 0) {
            return {
                content: [{
                    type: "text",
                    text: "Error: Chrome extension not connected. Please ensure the extension is running."
                }]
            };
        }

        try {
            // Get first available connection
            const activeConnection = [...activeConnections][0];

            // Request page source from Chrome extension
            const pageSource = await new Promise((resolve, reject) => {
                // Check if connection is still valid
                if (!safelySendMessage(activeConnection, { type: 'GET_PAGE_SOURCE' })) {
                    return reject(new Error('Failed to send message to extension'));
                }

                const timeout = setTimeout(() => {
                    // Remove the message handler to avoid memory leaks
                    activeConnection.removeListener('message', messageHandler);
                    reject(new Error('Timeout waiting for page source'));
                }, 5000);

                const messageHandler = (data) => {
                    clearTimeout(timeout);
                    try {
                        const response = JSON.parse(data.toString());
                        if (response.error) {
                            reject(new Error(response.error));
                        } else {
                            resolve(response.source);
                        }
                    } catch (error) {
                        reject(new Error(`Invalid response format: ${error.message}`));
                    }
                };

                activeConnection.once('message', messageHandler);
            });

            return {
                content: [{
                    type: "text",
                    text: pageSource
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error retrieving page source: ${error.message}`
                }]
            };
        }
    }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport); 