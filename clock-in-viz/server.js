const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
const { testConnection, verifyConnection } = require('./config/db');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize Express
const app = express();
const PORT = process.env.CLOCK_VIZ_PORT || 3001;

// Test Neo4j connection
testConnection();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Routes
app.use('/api', require('./routes/api/clockInData'));
app.use('/api', require('./routes/api/txCountData'));
app.use('/api/market-share-data', require('./routes/api/marketShareData'));

// Home route
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Clock-In Visualization',
    description: 'Visualization of block clock-in data'
  });
});

// About route
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Clock-In Visualization'
  });
});

// Transaction Count Visualization route
app.get('/tx-count', (req, res) => {
  res.render('tx-count', {
    title: 'Transaction Count Visualization'
  });
});

// Market Share Visualization route
app.get('/market-share', (req, res) => {
  res.render('market-share', {
    title: 'Clock-In Market Share Visualization'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Clock-In Visualization server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
