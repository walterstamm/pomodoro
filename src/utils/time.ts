export const computeRemainingSeconds = (endTime: Date, now = Date.now()) => {
  const remainingMs = endTime.getTime() - now;
  return Math.max(0, Math.round(remainingMs / 1000));
};

export const completedSessionMinutes = (
  totalSeconds: number,
  remainingSeconds: number,
) => {
  const normalizedTotal = Math.max(0, totalSeconds);
  const normalizedRemaining = Math.min(
    normalizedTotal,
    Math.max(0, remainingSeconds),
  );
  const completedSeconds = normalizedTotal - normalizedRemaining;

  return Math.max(1, Math.round(completedSeconds / 60));
};
