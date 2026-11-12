// Example environment configuration
// Copy this file to environment.ts and update with your actual values

export const environment = {
  production: false,
  API_URL: 'localhost:3000', // Your API server URL
  SCHEMA: 'http', // http or https
  s3Link: 'https://example.com', // Public asset base in dev; use real CDN/S3 in prod
  // sessionStorage key names for JWT segments (not the API signing secret — see LOCAL_DEVELOPMENT.md §1d)
  PAYLOAD_KEY: 'lms_access_payload',
  ALG_KEY: 'lms_access_alg',
  HASH_KEY: 'lms_access_hash',
  REFRESH_PAYLOAD_KEY: 'lms_refresh_payload',
  REFRESH_ALG_KEY: 'lms_refresh_alg',
  REFRESH_HASH_KEY: 'lms_refresh_hash',
  // Which server holds this deployment's learners: 'online' or 'offline'. Picks the route of the learner page's Awards section
  // (report/online/student-awards or report/student-awards) and the permission that shows it. Optional: a file without it means 'online'.
  learningServer: 'online',
  GRAMMARLY_CLIENT_ID: 'your-grammarly-client-id-here', // Grammarly client ID (optional)
};
