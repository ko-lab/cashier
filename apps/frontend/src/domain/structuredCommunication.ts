export function toStructuredCommunication(transactionId: string): string {
  const base = hashToTenDigits(transactionId);
  const checksumRaw = base % 97;
  const checksum = checksumRaw === 0 ? 97 : checksumRaw;
  const full = `${base.toString().padStart(10, "0")}${checksum
    .toString()
    .padStart(2, "0")}`;

  return `+++${full.slice(0, 3)}/${full.slice(3, 7)}/${full.slice(7)}+++`;
}

function hashToTenDigits(input: string): number {
  let h1 = 5381;
  let h2 = 52711;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = (((h1 << 5) + h1 + code) >>> 0);
    h2 = (((h2 << 5) + h2 + code) >>> 0);
  }

  const combined = (h1 * 4294967296 + h2) % 10000000000;
  return Math.floor(combined);
}
