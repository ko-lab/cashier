import QRCode from "qrcode-svg";

const QR_SIZE = 224;

export function createPaymentQR(
  paymentIbanName: string,
  paymentIbanNumber: string,
  amount: string,
  structuredCommunication: string
) {
  const payload = [
    "BCD",
    "002",                        // Changed to version 001
    "1",
    "SCT",
    "",
    `${ paymentIbanName }`,
    `${ paymentIbanNumber }`,
    `EUR${ amount }`,
    "",                           // Purpose code (usually empty)
    structuredCommunication.substring(0, 100),
    "",                           // Remittance info (structured or empty)
    ""                            // Extra empty line at the end (recommended)
  ].join("\n");

  const qr = new QRCode({
    content: payload,
    padding: 4,
    width: QR_SIZE,
    height: QR_SIZE,
    color: "#000000",
    background: "#ffffff",
    ecl: "H"
  });

  return qr;
}

export function createQRImageSrc(qr: QRCode) {
  const qrSvg = qr.svg();
  let imageSrc = `data:image/svg+xml;charset=utf-8,${ encodeURIComponent(qrSvg) }`;
  return imageSrc;
}