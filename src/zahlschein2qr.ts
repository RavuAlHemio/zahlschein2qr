import QRCode from "qrcode/lib/browser";

const BIC_RE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

function min(a: number, b: number): number {
    return (a < b) ? a : b;
}

function trimIban(iban: string): string|null {
    let trimmed = "";
    for (let i = 0; i < iban.length; i++) {
        const c = iban.charAt(i);
        if (c >= "0" && c <= "9") {
            trimmed += c;
        } else if (c >= "A" && c <= "Z") {
            trimmed += c;
        } else if (c !== " ") {
            return null;
        }
    }
    return trimmed;
}

function isIbanOk(iban: string): boolean {
    // trim spaces and ensure we only have valid characters
    const trimmed = trimIban(iban);
    if (trimmed === null) {
        return false;
    }
    if (trimmed.length < 4) {
        return false;
    }

    // reorder: remove check digits, place country code at the end, append 00 as check digit placeholder
    // AT12 3456 7890 -> 3456 7890 AT00
    const reordered = trimmed.substring(4) + trimmed.substring(0, 2) + "00";

    let numbered = "";
    for (let i = 0; i < reordered.length; i++) {
        const c = reordered.charAt(i);
        const cCode = reordered.charCodeAt(i);

        if (c >= "0" && c <= "9") {
            // regular digit
            numbered += c;
        } else if (c >= "A" && c <= "Z") {
            // two-digit code (A = 10, B = 11, ..., Z = 35)
            const digitCode = (cCode - 0x41) + 10;
            numbered += `${digitCode}`;
        } else if (c !== " ") {
            return false;
        }
    }

    // mod-97 calculation hack: take 9 digits at a time
    let mod97Position = 0;
    let mod97String = "";
    while (mod97Position < numbered.length) {
        // take as many digits as we can to append to the string
        const digitsRemain = numbered.length - mod97Position;
        const fitsInString = 9 - mod97String.length;
        const wantDigits = min(digitsRemain, fitsInString);

        mod97String += numbered.substring(mod97Position, mod97Position + wantDigits);
        mod97Position += wantDigits;

        let mod97Number = +mod97String;
        mod97Number = mod97Number % 97;
        mod97String = `${mod97Number}`;
    }

    const checkNumber = 98 - (+mod97String);
    let checkDigits = `${checkNumber}`;
    while (checkDigits.length < 2) {
        checkDigits = "0" + checkDigits;
    }

    const originalCheckDigits = trimmed.substring(2, 4);
    return (originalCheckDigits == checkDigits);
}

function formSubmitted(e: Event) {
    const form = <HTMLFormElement|null>document.getElementById("zahlschein2qr-form");
    if (form === null) {
        return;
    }

    e.preventDefault();

    // check recipient name
    const recipientNameInput = <HTMLInputElement|null>form.elements.namedItem("recipient-name");
    if (recipientNameInput === null) {
        return;
    }
    if (recipientNameInput.value.length === 0) {
        alert("invalid recipient name");
        return;
    }

    // check IBAN
    const ibanInput = <HTMLInputElement|null>form.elements.namedItem("recipient-iban");
    if (ibanInput === null) {
        return;
    }
    if (!isIbanOk(ibanInput.value)) {
        alert("invalid IBAN");
        return;
    }

    // check BIC, if any
    const bicInput = <HTMLInputElement|null>form.elements.namedItem("recipient-bic");
    if (bicInput === null) {
        return;
    }
    if (bicInput.value.length > 0) {
        if (!BIC_RE.test(bicInput.value)) {
            alert("invalid BIC");
            return;
        }
    }

    // check amount
    const amountInput = <HTMLInputElement|null>form.elements.namedItem("amount");
    if (amountInput === null) {
        return;
    }

    const referenceInput = <HTMLInputElement|null>form.elements.namedItem("payment-reference");
    if (referenceInput === null) {
        return;
    }

    const reasonInput = <HTMLInputElement|null>form.elements.namedItem("payment-reason");
    if (reasonInput === null) {
        return;
    }
    const reasonValue = (referenceInput.value.length === 0) ? reasonInput.value : "";

    // assemble QR data
    const version = "002"; // allows optional BIC
    const encoding = "1"; // UTF-8
    const paymentType = "SCT"; // SEPA credit transfer
    const purposeCode = ""; // always empty
    const userNote = ""; // always empty (client can override)
    const qrData = `BCD\n${version}\n${encoding}\n${paymentType}\n${bicInput.value}\n${recipientNameInput.value}\n${trimIban(ibanInput.value)}\n${amountInput.value}\n${purposeCode}\n${referenceInput.value}\n${reasonValue}\n${userNote}`;

    // generate QR code
    const canvas = <HTMLCanvasElement|null>document.getElementById("qrcode-canvas");
    if (canvas === null) {
        return;
    }
    QRCode.toCanvas(canvas, qrData, { errorCorrectionLevel: "M" });
}

function setUp() {
    const form = <HTMLFormElement|null>document.getElementById("zahlschein2qr-form");
    if (form === null) {
        return;
    }

    form.addEventListener("submit", formSubmitted);
}

document.addEventListener("DOMContentLoaded", setUp);
