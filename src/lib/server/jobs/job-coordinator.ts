export class JobAlreadyRunningError extends Error {
  constructor(readonly jobName: string) {
    super(`${jobName} is already running.`);
    this.name = 'JobAlreadyRunningError';
  }
}

let activeJob: string | undefined;

export function currentJob(): string | undefined {
  return activeJob;
}

export async function runExclusive<T>(
  jobName: string,
  task: () => Promise<T>
): Promise<T> {
  if (activeJob) throw new JobAlreadyRunningError(activeJob);
  activeJob = jobName;
  try {
    return await task();
  } finally {
    activeJob = undefined;
  }
}
