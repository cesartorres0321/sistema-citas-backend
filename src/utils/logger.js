const format = (level, message, meta) => {
  const entry = { timestamp: new Date().toISOString(), level, message };
  if (meta && Object.keys(meta).length > 0) entry.meta = meta;
  return JSON.stringify(entry);
};

export const logger = {
  info:  (message, meta = {}) => console.log(format("INFO",  message, meta)),
  warn:  (message, meta = {}) => console.warn(format("WARN",  message, meta)),
  error: (message, meta = {}) => console.error(format("ERROR", message, meta)),
};
