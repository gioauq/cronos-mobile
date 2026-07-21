import { useCallback, useState } from 'react';

/**
 * Encapsula o par isLoading + try/catch/finally reimplementado de forma quase
 * idêntica em várias telas (Login, Justification, EditProfile, Timesheet) —
 * cada chamador mantém controle total da mensagem/UI de erro via onError.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  onError?: (error: unknown) => void
) {
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setIsLoading(true);
      try {
        return await action(...args);
      } catch (error) {
        onError?.(error);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [action, onError]
  );

  return { run, isLoading };
}
