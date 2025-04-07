# MCP Web Query Bridge

This project provides a bridge between an MCP server and Chrome browser, allowing LLMs to query the source code of the currently active webpage.

## Components

1. **MCP Server**: Exposes a tool that allows LLMs to query webpage source code
2. **Chrome Extension**: Runs in the background and bridges communication between the MCP server and the browser

## Setup

### MCP Server Setup
1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

### Chrome Extension Setup
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` directory from this project
4. The extension will automatically connect to the MCP server

## Usage

The MCP server exposes a tool called `query_current_page` that accepts a query string. When called, it will:

1. Request the source code of the currently active Chrome tab
2. Search through the source code for matches to the query
3. Return the results with line numbers

Example tool usage:
```javascript
{
    "query": "your search term"
}
```

## Architecture

- The MCP server runs a WebSocket server on port 8080
- The Chrome extension maintains a persistent WebSocket connection to the server
- When the LLM calls the `query_current_page` tool:
  1. The MCP server requests the page source through the WebSocket connection
  2. The Chrome extension retrieves the source from the active tab
  3. The source is sent back to the MCP server
  4. The MCP server processes the query and returns results to the LLM

## Development

To modify the MCP server:
1. Edit `code-query-server.js`
2. Restart the server to apply changes

To modify the Chrome extension:
1. Edit files in the `extension` directory
2. Click the refresh icon in `chrome://extensions/` to reload the extension 