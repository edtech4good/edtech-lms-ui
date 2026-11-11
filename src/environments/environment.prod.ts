export const environment = {
  production: true,
  API_URL: 'your-api-domain.com',
  SCHEMA: 'https',
  s3Link: 'https://your-s3-bucket.s3.amazonaws.com',
  PAYLOAD_KEY: 'your-production-payload-key-here',
  ALG_KEY: 'your-production-alg-key-here',
  HASH_KEY: 'your-production-hash-key-here',
  REFRESH_PAYLOAD_KEY: 'your-production-refresh-payload-key-here',
  REFRESH_ALG_KEY: 'your-production-refresh-alg-key-here',
  REFRESH_HASH_KEY: 'your-production-refresh-hash-key-here',
  // Which server holds this deployment's learners: 'online' or 'offline'. Picks the route of the learner page's Awards section
  // (report/online/student-awards or report/student-awards) and the permission that shows it. Optional: a file without it means 'online'.
  learningServer: 'online',
  GRAMMARLY_CLIENT_ID: 'your-production-grammarly-client-id-here',
};
