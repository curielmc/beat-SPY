// Set your Google Cloud Client ID here
// Create one at: https://console.cloud.google.com/apis/credentials
export const GOOGLE_CLIENT_ID = ''

if (!GOOGLE_CLIENT_ID) {
  console.warn('[Beat the S&P] Google Client ID not configured. Set GOOGLE_CLIENT_ID in src/config.js to enable Google Sign-In.')
}
