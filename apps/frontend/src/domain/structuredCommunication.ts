export function toStructuredCommunication(transactionId: string): string {
  const base = hashToTenDigits(transactionId);
  const checksumRaw = Number(base % 97n);
  const checksum = checksumRaw === 0 ? 97 : checksumRaw;
  const full = `${base.toString().padStart(10, "0")}${checksum
    .toString()
    .padStart(2, "0")}`;

  return `+++${full.slice(0, 3)}/${full.slice(3, 7)}/${full.slice(7)}+++`;
}

function hashToTenDigits(input: string): bigint {
  let h1 = 5381n;
  let h2 = 52711n;

  for (const char of input) {
    const code = BigInt(char.charCodeAt(0));
    h1 = ((h1 << 5n) + h1 + code) & 0xffffffffn;
    h2 = ((h2 << 5n) + h2 + code) & 0xffffffffn;
  }

  const combined = (h1 << 32n) | h2;
  return combined % 10000000000n;
}
