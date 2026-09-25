/**
 * Open Funding Protocol: types, constants and helpers shared by implementations.
 * The JSON Schemas in ./schemas are the normative artefact; these types mirror them.
 */

export const OPENFP_VERSION = "0.3";

/** Discovery surfaces, in the order an agent should try them. */
export const WELL_KNOWN_PATH = "/.well-known/openfp.json";
export const LINK_REL = "openfp";
export const META_NAME = "openfp";
export const VERIFICATION_META = "openfp-verification";
export const DNS_PREFIX = "_openfp";

export type Basis = "voluntary" | "usage" | "agreement";
export type RateUnit = "per_request" | "per_1000_requests" | "per_page";

export type SettledMethod = {
  type: "openfp_settlement";
  currency: string;
  amount_unit: "minor";
  suggested_amounts: number[];
  min_amount: number;
  max_amount: number;
  endpoint: string;
  supports: ("balance" | "checkout" | "batch")[];
  request?: Record<string, unknown>;
};

export type LinkMethod = { type: string; label?: string; url: string };
export type PaymentMethod = SettledMethod | LinkMethod;

export const isSettledMethod = (m: PaymentMethod): m is SettledMethod => m.type === "openfp_settlement";

export type Manifest = {
  openfp: string;
  registry?: { name: string; url: string; terms_url?: string };
  site: { id: string; domain: string; name: string; description?: string };
  status: "accepting" | "not_accepting";
  verified_domain: boolean;
  basis: Basis;
  rate?: { amount: number; unit: RateUnit; currency: string };
  note?: string;
  payment: { methods: PaymentMethod[] };
  links?: { manifest?: string; human_page?: string; spec?: string };
};

export type WellKnown = { openfp: string; site_id?: string; manifest?: string; verification?: string };

export type SettlementRequest = {
  currency?: string;
  total?: number;
  settle?: "auto" | "balance" | "checkout";
  allocations: {
    site_id?: string;
    domain?: string;
    amount?: number;
    weight?: number;
    note?: string;
  }[];
  agent?: { name?: string; operator?: string; url?: string };
  usage_note?: string;
};

export type Settlement = {
  settlement_id: string;
  status: "paid" | "requires_payment" | "pending" | "expired";
  method?: "balance" | "checkout";
  currency: string;
  total: number;
  operator?: { id: string; name: string; domain: string; verified: boolean; balance_after?: number };
  contributions: {
    contribution_id: string;
    site_id: string;
    domain?: string;
    amount: number;
    weight?: number | null;
    basis?: Basis;
    status: "pending" | "paid" | "expired";
  }[];
  unsettled?: { ref?: string; site_id?: string; domain?: string; reason: UnsettledReason; funding_links?: LinkMethod[] }[];
  payment?: { method: string; checkout_url?: string; instructions?: string };
  status_url?: string;
  receipt_url?: string;
};

export type UnsettledReason =
  | "site_not_found"
  | "no_settled_method"
  | "below_minimum"
  | "no_weight"
  | "amount_out_of_range";

export type OfpError = { error: { code: ErrorCode; message: string } };

export type ErrorCode =
  | "invalid_request" | "invalid_body" | "site_not_found" | "not_accepting" | "no_settled_sites"
  | "currency_mismatch" | "amount_out_of_range" | "too_many_domains" | "insufficient_balance"
  | "signature_invalid" | "key_unknown" | "operator_unverified" | "limit_exceeded" | "payment_provider_error";

/** Version check: agents accept a manifest whose major version matches and whose minor is any. */
export function isSupportedVersion(version: string, supported = OPENFP_VERSION): boolean {
  const [maj] = version.split(".");
  const [supMaj] = supported.split(".");
  return maj === supMaj;
}

/**
 * Funding-channel type inference, following npm's `funding` convention: the type is advisory
 * because it can always be worked out from the URL.
 */
const FUNDING_HOSTS: [RegExp, string][] = [
  [/(^|\.)github\.com$/, "github"],
  [/(^|\.)opencollective\.com$/, "opencollective"],
  [/(^|\.)patreon\.com$/, "patreon"],
  [/(^|\.)ko-fi\.com$/, "kofi"],
  [/(^|\.)buymeacoffee\.com$/, "buymeacoffee"],
  [/(^|\.)liberapay\.com$/, "liberapay"],
  [/(^|\.)tidelift\.com$/, "tidelift"],
  [/(^|\.)thanks\.dev$/, "thanksdev"],
  [/(^|\.)polar\.sh$/, "polar"],
];

export function inferFundingType(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return FUNDING_HOSTS.find(([re]) => re.test(host))?.[1] ?? "custom";
  } catch {
    return "custom";
  }
}

export const FUNDING_LABELS: Record<string, string> = {
  github: "GitHub Sponsors",
  opencollective: "Open Collective",
  patreon: "Patreon",
  kofi: "Ko-fi",
  buymeacoffee: "Buy Me a Coffee",
  liberapay: "Liberapay",
  tidelift: "Tidelift",
  thanksdev: "thanks.dev",
  polar: "Polar",
  custom: "Other",
};

export * from "./signing.js";
export * from "./discovery.js";
