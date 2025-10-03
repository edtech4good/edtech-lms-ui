// Example environment configuration
// Copy this file to environment.ts and update with your actual values

export const environment = {
  production: false,
  API_URL: 'localhost:3000', // Your API server URL
  SCHEMA: 'http', // http or https
  s3Link: 'https://your-s3-bucket.s3.amazonaws.com', // Your S3 bucket URL
  PAYLOAD_KEY: 'your-payload-key-here', // JWT payload encryption key
  ALG_KEY: 'your-alg-key-here', // JWT algorithm key
  HASH_KEY: 'your-hash-key-here', // JWT hash key
  REFRESH_PAYLOAD_KEY: 'your-refresh-payload-key-here', // Refresh token payload key
  REFRESH_ALG_KEY: 'your-refresh-alg-key-here', // Refresh token algorithm key
  REFRESH_HASH_KEY: 'your-refresh-hash-key-here', // Refresh token hash key
  GRAMMARLY_CLIENT_ID: 'your-grammarly-client-id-here', // Grammarly client ID (optional)
};
