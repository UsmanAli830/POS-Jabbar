/**
 * Jest runs the TypeScript test suites directly via ts-jest. Previously the
 * `test` npm script compiled the whole project with `tsc` (emitting .js files
 * all over the tree) just so Jest could pick up the emitted test files. Running
 * ts-jest here removes that side effect; `tsc --noEmit` still type-checks.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts']
};
