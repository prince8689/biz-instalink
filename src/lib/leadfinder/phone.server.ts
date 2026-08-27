// Server-only phone number verification.
// Checks that a number is a real, dialable line (correct country/length/prefix)
// and whether it is a mobile line. Carrier/live "is the handset switched on"
// status is not exposed by any public API, so we verify dialability + line type.

import parsePhoneNumberFromString, { type CountryCode } from "libphonenumber-js";

export interface PhoneCheck {
  /** Number in E.164 form when parsable, else the original string. */
  formatted: string;
  /** True when the number is a valid, dialable number. */
  valid: boolean;
  /** "mobile" | "landline" | "other" | "unknown" */
  lineType: string;
}

export function verifyPhone(raw: string, defaultCountry?: CountryCode): PhoneCheck {
  try {
    const parsed = parsePhoneNumberFromString(raw, defaultCountry);
    if (!parsed) return { formatted: raw, valid: false, lineType: "unknown" };
    const valid = parsed.isValid();
    const type = parsed.getType();
    let lineType = "unknown";
    if (type === "MOBILE") lineType = "mobile";
    else if (type === "FIXED_LINE") lineType = "landline";
    else if (type === "FIXED_LINE_OR_MOBILE") lineType = "mobile / landline";
    else if (type) lineType = "other";
    return { formatted: valid ? parsed.number : raw, valid, lineType };
  } catch {
    return { formatted: raw, valid: false, lineType: "unknown" };
  }
}
