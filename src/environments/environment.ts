// Local Lane C — points at edtech-lms-api on port 3000 (see ../LOCAL_DEVELOPMENT.md).
// PAYLOAD_KEY / ALG_KEY / HASH_KEY are sessionStorage key names for JWT segments, not API secrets.

export const environment = {
  production: false,
  API_URL: 'localhost:3000',
  SCHEMA: 'http',
  s3Link: 'https://example.com',
  PAYLOAD_KEY: 'lms_access_payload',
  ALG_KEY: 'lms_access_alg',
  HASH_KEY: 'lms_access_hash',
  REFRESH_PAYLOAD_KEY: 'lms_refresh_payload',
  REFRESH_ALG_KEY: 'lms_refresh_alg',
  REFRESH_HASH_KEY: 'lms_refresh_hash',
  // Which server holds this deployment's learners: 'online' or 'offline'. Picks the route of the learner page's Awards section
  // (report/online/student-awards or report/student-awards) and the permission that shows it. Optional: a file without it means 'online'.
  // learningServer: 'offline',   // (left out here: absent means 'online', the default)
  GRAMMARLY_CLIENT_ID: '',
};
