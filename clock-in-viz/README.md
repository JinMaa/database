# Clock-In Visualization

A scalable web application for visualizing block clock-in data from the OylNet blockchain.

## Features

- Interactive visualization of block clock-in data across multiple blocks
- Displays max clock-in counts per block with global context
- Responsive design that works on desktop and mobile devices
- Data table showing detailed transaction information
- Real-time data fetching from Neo4j database
- Uses D3.js for advanced data visualization

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: HTML/CSS/JavaScript with Bootstrap 5
- **Visualization**: D3.js
- **Database**: Neo4j
- **Templating**: EJS with express-ejs-layouts
- **Development**: Nodemon for hot reloading

## Project Structure

```
clock-in-viz/
├── public/             # Static assets
│   ├── css/            # Stylesheets
│   └── js/             # Client-side JavaScript
├── routes/             # Express routes
│   └── api/            # API endpoints
├── views/              # EJS templates
├── server.js           # Main application file
├── package.json        # Dependencies and scripts
└── README.md           # Project documentation
```

## Installation

1. Ensure you have Node.js and npm installed
2. Clone the repository
3. Install dependencies:
   ```
   cd clock-in-viz
   npm install
   ```
4. Configure environment variables (or use .env in parent directory)
5. Start the server:
   ```
   npm start
   ```

## Development

For development with hot reloading:

```
npm run dev
```

## Data Source

The application uses the following Cypher query to fetch data from Neo4j:

```cypher
MATCH (a:alkane {tx:"21568"}) 
MATCH (invoke:event {event_type:"invoke"})-[:myself]->(a)
WHERE invoke.i0="103"
    MATCH (invoke)<-[:trace]-(p:protostone)
    MATCH (p)-[:trace]->(outcome:event)
    MATCH (tx:tx)-[:shadow_out]->(p)
    MATCH (tx)-[:inc]->(b:block)
    MATCH (out:output)<-[:out {vout:0.0}]-(tx)
    OPTIONAL MATCH (out)-[:locked]-(address:address)
WITH tx.txid as txid, 
     b.height as block_height, 
     address.address as address, 
     outcome.clock_in_count as clock_in_count
WHERE clock_in_count IS NOT NULL
WITH txid, block_height, address, clock_in_count,
     max(clock_in_count) OVER() as global_max_clock_in,
     max(clock_in_count) OVER(PARTITION BY block_height) as block_max_clock_in
RETURN txid, block_height, address, clock_in_count, global_max_clock_in, block_max_clock_in
ORDER BY clock_in_count
```

## Visualization Details

The visualization includes:
1. A bar chart showing max clock-in counts for each block
2. Block visualization boxes ordered from left to right by block height
3. Each block displays its height and max clock-in count
4. Interactive tooltips showing additional details on hover
5. A data table with all transaction details

## Deployment

This application can be deployed alongside the existing web-explorer application. It uses a separate port to avoid conflicts and can be run in parallel.
