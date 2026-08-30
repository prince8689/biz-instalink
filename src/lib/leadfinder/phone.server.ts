// Server-only phone validation. No public API can tell whether a handset is
// switched on, so we verify that the number is a valid, dialable line and
// detect whether it is a mobile or a landline.

export interface PhoneCheck {
  /** E.164-ish normalized number. */
  normalized: string;
  valid: boolean;
  lineType: "mobile" | "landline" | "unknown";
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function verifyPhone(raw: string | null | undefined, defaultCountry = "91"): PhoneCheck {
  const input = digitsOnly(raw ?? "");
  if (!input) return { normalized: "", valid: false, lineType: "unknown" };

  let national = input.replace(/^\+/, "");
  let country = "";

  if (input.startsWith("+")) {
    if (national.startsWith(defaultCountry)) {
      country = defaultCountry;
      national = national.slice(defaultCountry.length);
    } else {
      // Unknown country: accept 8-15 digits as dialable, type unknown.
      const ok = national.length >= 8 && national.length <= 15;
      return { normalized: `+${national}`, valid: ok, lineType: "unknown" };
    }
  } else {
    if (national.startsWith("0")) national = national.replace(/^0+/, "");
    if (national.startsWith(defaultCountry) && national.length > 10) {
      national = national.slice(defaultCountry.length);
    }
    country = defaultCountry;
  }

  const normalized = `+${country}${national}`;

  if (country === "91") {
    // Indian mobile numbers: 10 digits starting 6-9. Landlines: STD code + subscriber.
    if (/^[6-9]\d{9}$/.test(national)) {
      return { normalized, valid: true, lineType: "mobile" };
    }
    if (/^[1-5]\d{7,9}$/.test(national)) {
      return { normalized, valid: true, lineType: "landline" };
    }
    return { normalized, valid: false, lineType: "unknown" };
  }

  const ok = national.length >= 8 && national.length <= 15;
  return { normalized, valid: ok, lineType: "unknown" };
}
