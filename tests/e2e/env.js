// Must be imported before any module that reads these variables (e.g. the
// database connection), so the E2E tests never touch the development database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/blog_test";
process.env.API_KEY = "e2e-api-key";
