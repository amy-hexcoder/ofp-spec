/**
 * Discovery helpers. An agent finds a site's manifest through whichever surface it already
 * touches: the well-known file, a Link header, the HTML head, or a registry lookup.
 */
import { LINK_REL, META_NAME } from "./index.js";

export function manifestUrlFromLinkHeader(header: string | null): string | null {
  const m = header?.match(new RegExp(`<([^>]+)>\\s*;\\s*rel="?${LINK_REL}"?`, "i"));
  return m ? m[1] : null;
}

export function manifestUrlFromHtml(html: string): string | null {
  const link = html.match(new RegExp(`<link[^>]+rel=["']${LINK_REL}["'][^>]*href=["']([^"']+)["']`, "i"));
  if (link) return link[1];
  const meta = html.match(new RegExp(`<meta[^>]+name=["']${META_NAME}["'][^>]*content=["']([^"']+)["']`, "i"));
  return meta ? meta[1] : null;
}

/** The HTML an implementation should emit in <head>. Kept here so every implementation agrees. */
export function headTags(input: { manifestUrl: string; verificationToken?: string; jsonLd?: unknown }): string {
  const lines = [
    `<link rel="${LINK_REL}" type="application/json" href="${input.manifestUrl}">`,
    `<meta name="${META_NAME}" content="${input.manifestUrl}">`,
  ];
  if (input.verificationToken) lines.push(`<meta name="ofp-verification" content="${input.verificationToken}">`);
  if (input.jsonLd) lines.push(`<script type="application/ld+json">\n${JSON.stringify(input.jsonLd)}\n</script>`);
  return lines.join("\n");
}
