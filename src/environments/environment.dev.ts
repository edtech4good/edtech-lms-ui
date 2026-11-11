export const environment = {
  production: false,
  API_URL: 'dev.your-api-domain.com',
  SCHEMA: 'https',
  s3Link: 'https://your-s3-bucket.s3.amazonaws.com',
  PAYLOAD_KEY: 'your-dev-payload-key-here',
  ALG_KEY: 'your-dev-alg-key-here',
  HASH_KEY: 'your-dev-hash-key-here',
  REFRESH_PAYLOAD_KEY: 'your-dev-refresh-payload-key-here',
  REFRESH_ALG_KEY: 'your-dev-refresh-alg-key-here',
  REFRESH_HASH_KEY: 'your-dev-refresh-hash-key-here',
  // Which server holds this deployment's learners: 'online' or 'offline'. Picks the route of the learner page's Awards section
  // (report/online/student-awards or report/student-awards) and the permission that shows it. Optional: a file without it means 'online'.
  learningServer: 'online',
  GRAMMARLY_CLIENT_ID: 'your-dev-grammarly-client-id-here',
};
