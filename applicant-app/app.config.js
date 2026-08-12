const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
const appJson = require('./app.json');

module.exports = ({ config }) => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    // Reads EXPO_PUBLIC_API_URL from .env at build/start time.
    // Set this in your local .env file (see .env.example).
    // Falls back to undefined so api.config.js handles per-platform defaults.
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
});
