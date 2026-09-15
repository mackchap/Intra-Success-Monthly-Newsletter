import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@platform/db";
import { parseBlocks, type FunnelBlock, type LeadFormField } from "@/lib/funnels/blocks";
import { formatMoney } from "@/lib/format";
import { logFunnelVisit } from "@/lib/funnels/analytics";
import { leadCaptureAction, funnelBuyAction } from "./actions";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<LeadFormField, string> = {
  email: "Email",
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
};

// Stored block content predates Phase 9's tenant-scoped public URLs, so a
// button's `href` may still be the old bare `/f/<funnel>/<step>` shape.
// Rewritten here at render time (not migrated in the DB) so existing
// funnels keep working with zero data migration.
function resolveHref(href: string, tenantSlug: string): string {
  if (href.startsWith("/f/")) return `/t/${tenantSlug}${href}`;
  return href;
}

function withLead(href: string, lead: string | undefined) {
  if (!lead || !href.startsWith("/t/")) return href;
  return `${href}${href.includes("?") ? "&" : "?"}lead=${lead}`;
}

function Block({
  block,
  ctx,
}: {
  block: FunnelBlock;
  ctx: {
    tenantId: string;
    tenantSlug: string;
    funnelId: string;
    funnelStepId: string;
    funnelSlug: string;
    stepSlug: string;
    lead?: string;
    productPrice?: string;
  };
}) {
  switch (block.type) {
    case "heading":
      return <h1 className="text-3xl font-bold">{block.text}</h1>;
    case "text":
      return <p className="whitespace-pre-wrap text-slate-700">{block.body}</p>;
    case "image":
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-entered URLs, not a static asset
      return <img src={block.url} alt={block.alt ?? ""} className="w-full rounded-lg" />;
    case "button":
      return (
        <a
          href={withLead(resolveHref(block.href, ctx.tenantSlug), ctx.lead)}
          className="inline-block rounded-md bg-brand-600 px-6 py-3 font-medium text-white"
        >
          {block.label}
        </a>
      );
    case "form":
      return (
        <form action={leadCaptureAction} className="flex flex-col gap-3">
          <input type="hidden" name="funnelId" value={ctx.funnelId} />
          <input type="hidden" name="funnelStepId" value={ctx.funnelStepId} />
          <input type="hidden" name="tenantSlug" value={ctx.tenantSlug} />
          <input type="hidden" name="funnelSlug" value={ctx.funnelSlug} />
          <input type="hidden" name="stepSlug" value={ctx.stepSlug} />
          {block.fields.map((field) => (
            <label key={field} className="flex flex-col gap-1 text-sm font-medium">
              {FIELD_LABELS[field]}
              <input
                name={field}
                type={field === "email" ? "email" : "text"}
                required={field === "email"}
                className="rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            </label>
          ))}
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-3 font-medium text-white">
            {block.submitLabel}
          </button>
        </form>
      );
    case "buy":
      return (
        <form action={funnelBuyAction}>
          <input type="hidden" name="productId" value={block.productId} />
          <input type="hidden" name="funnelId" value={ctx.funnelId} />
          {ctx.lead && <input type="hidden" name="lead" value={ctx.lead} />}
          <button type="submit" className="w-full rounded-md bg-brand-600 px-4 py-3 font-medium text-white">
            {block.label}
            {ctx.productPrice ? ` — ${ctx.productPrice}` : ""}
          </button>
        </form>
      );
    default:
      return null;
  }
}

export default async function FunnelStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; funnelSlug: string; stepSlug: string }>;
  searchParams: Promise<{ lead?: string; submitted?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string }>;
}) {
  const { tenantSlug, funnelSlug, stepSlug } = await params;
  const { lead, submitted, utm_source, utm_medium, utm_campaign } = await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const funnel = await prisma.funnel.findUnique({ where: { tenantId_slug: { tenantId: tenant.id, slug: funnelSlug } } });
  if (!funnel || funnel.status !== "PUBLISHED") notFound();

  const step = await prisma.funnelStep.findUnique({ where: { funnelId_slug: { funnelId: funnel.id, slug: stepSlug } } });
  if (!step) notFound();

  const requestHeaders = await headers();
  const sessionId = requestHeaders.get("x-fs-id");
  if (sessionId) {
    await logFunnelVisit({
      sessionId,
      funnelId: funnel.id,
      funnelStepId: step.id,
      contactId: lead,
      referrer: requestHeaders.get("referer"),
      utmSource: utm_source,
      utmMedium: utm_medium,
      utmCampaign: utm_campaign,
    });
  }

  const blocks = parseBlocks(step.content);

  const buyBlock = blocks.find((b): b is Extract<FunnelBlock, { type: "buy" }> => b.type === "buy");
  const product = buyBlock
    ? await prisma.product.findFirst({ where: { id: buyBlock.productId, tenantId: tenant.id } })
    : null;
  const productPrice = product ? formatMoney(product.priceCents, product.currency) : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      {submitted && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">Thanks! We&apos;ve got your info.</p>
      )}
      {blocks.map((block, index) => (
        <Block
          key={index}
          block={block}
          ctx={{
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            funnelId: funnel.id,
            funnelStepId: step.id,
            funnelSlug: funnel.slug,
            stepSlug: step.slug,
            lead,
            productPrice,
          }}
        />
      ))}
      {blocks.length === 0 && <p className="text-sm text-slate-400">This page has no content yet.</p>}
    </main>
  );
}
