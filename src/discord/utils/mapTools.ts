export function mapSubtraction(
  diminuende: Map<string, number>,
  diminisher: Map<string, number>,
): Map<string, number> {
  let result = new Map<string, number>();

  diminuende.forEach((value, key) => {
    if (diminisher.has(key)) {
      result.set(key, value - diminisher.get(key)!);
    } else {
      result.set(key, value);
    }
  });

  return result;
}
