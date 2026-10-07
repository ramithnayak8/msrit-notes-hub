import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Modules that read config need these; tests never touch a real database.
    env: {
      MONGODB_URI: 'mongodb://localhost:27017/conceptquery-test',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef012345678',
      LOG_LEVEL: 'silent',
      NODE_ENV: 'test',
    },
  },
});
