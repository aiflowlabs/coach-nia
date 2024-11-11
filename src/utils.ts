export function retry<T>(fn: Function, retriesLeft = 3, interval = 1000): Promise<T> {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error: any) => {
        if (retriesLeft > 0) {
          setTimeout(() => {
            retry<T>(fn, retriesLeft - 1, interval)
              .then(resolve)
              .catch(reject);
          }, interval);
        } else {
          reject(error);
        }
      });
  });
}