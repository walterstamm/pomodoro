const configuredOrigins = () =>
  [process.env.APP_ORIGIN, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const matchesAllowedOrigin = (origin: string, allowedOrigin: string) => {
  if (origin === allowedOrigin) return true;
  if (!allowedOrigin.endsWith(":*")) return false;

  try {
    const parsedOrigin = new URL(origin);
    const allowedUrl = new URL(allowedOrigin.slice(0, -2));

    return (
      parsedOrigin.protocol === allowedUrl.protocol &&
      parsedOrigin.hostname === allowedUrl.hostname &&
      parsedOrigin.port !== ""
    );
  } catch {
    return false;
  }
};

export const isAllowedOrigin = (origin: string) =>
  configuredOrigins().some((allowedOrigin) =>
    matchesAllowedOrigin(origin, allowedOrigin),
  );
