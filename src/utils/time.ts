export const computeRemainingSeconds = (endTime: Date, now = Date.now()) => {
  const remainingMs = endTime.getTime() - now;
  return Math.max(0, Math.round(remainingMs / 1000));
};

export const minutesBetween = (start: Date, end: Date) =>
  Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
