export function sessionPool(connection, signal) {
  async function query(...args) {
    if (args[0] !== 'ROLLBACK') signal.throwIfAborted();
    return connection.query(...args);
  }
  const borrowed = { query, release() {} };
  return {
    query,
    async connect() {
      signal.throwIfAborted();
      return borrowed;
    },
  };
}
