const express = require('express');
const path = require('path');

const app = express();

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Define your API routes or other backend logic here
// For example:
app.get('/api/data', (req, res) => {
    // Your API logic
    res.json({ message: 'API response' });
});

// For all other requests, serve the React frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname + '/client/build/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
