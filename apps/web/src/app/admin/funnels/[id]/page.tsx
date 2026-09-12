import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@platform/db";
import { parseBlocks } from "@/lib/funnels/blocks";
import {
  addBlockAction,
  createStepAction,
  moveBlockAction,
  publishFunnelAction,
  removeBlockAction,
} from "../actions";

function describeBlock(block: ReturnType<typeof parseBlocks>[number]): string {
  switch (block.type) {
    case "heading":
      return `Heading: "${block.text}"`;
    case "text":
      return `Text: "${block.body.slice(0, 60)}${block.body.length > 60 ? "…" : ""}"`;
    case "image":
      return `Image: ${block.url}`;
    case "button":
      return `Button: "${block.label}" → ${block.href}`;
    case "form":
      return `Lead form (${block.fields.join(", ")}) — "${block.submitLabel}"`;
    case "buy":
      return `Buy button: "${block.label}" (product ${block.productId})`;
    default:
      return "Unknown block";
  }
}

export default async function AdminFunnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [funnel, products] = await Promise.all([
    prisma.funnel.findUnique({ where: { id }, include: { steps: { orderBy: { order: "asc" } } } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!funnel) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{funnel.name}</h1>
          <p className="text-sm text-slate-500">/f/{funnel.slug}</p>
        </div>
        <form action={publishFunnelAction}>
          <input type="hidden" name="funnelId" value={funnel.id} />
          <input type="hidden" name="status" value={funnel.status} />
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
            {funnel.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </button>
        </form>
      </div>

      <section>
        <h2 className="font-medium">Steps</h2>
        <form action={createStepAction} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input type="hidden" name="funnelId" value={funnel.id} />
          <select name="type" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            <option value="LANDING">Landing</option>
            <option value="OPT_IN">Opt-in</option>
            <option value="OFFER">Offer</option>
            <option value="CHECKOUT">Checkout</option>
            <option value="UPSELL">Upsell</option>
            <option value="THANK_YOU">Thank you</option>
            <option value="AD">Ad</option>
            <option value="CUSTOM">Custom</option>
          </select>
          <input name="name" required placeholder="Step name" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          <input name="slug" required placeholder="url-slug" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
            Add step
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-6">
          {funnel.steps.map((step) => {
            const blocks = parseBlocks(step.content);
            return (
              <div key={step.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {step.name} <span className="text-xs text-slate-400">({step.type})</span>
                  </h3>
                  <Link href={`/f/${funnel.slug}/${step.slug}`} target="_blank" className="text-xs text-brand-600">
                    View live ↗
                  </Link>
                </div>

                <ul className="mt-3 flex flex-col gap-1">
                  {blocks.map((block, index) => (
                    <li key={index} className="flex items-center justify-between rounded-md bg-slate-50 p-2 text-sm">
                      <span>{describeBlock(block)}</span>
                      <span className="flex gap-1">
                        <form action={moveBlockAction}>
                          <input type="hidden" name="funnelId" value={funnel.id} />
                          <input type="hidden" name="stepId" value={step.id} />
                          <input type="hidden" name="index" value={index} />
                          <input type="hidden" name="direction" value="up" />
                          <button type="submit" className="text-xs text-slate-500" disabled={index === 0}>
                            ↑
                          </button>
                        </form>
                        <form action={moveBlockAction}>
                          <input type="hidden" name="funnelId" value={funnel.id} />
                          <input type="hidden" name="stepId" value={step.id} />
                          <input type="hidden" name="index" value={index} />
                          <input type="hidden" name="direction" value="down" />
                          <button type="submit" className="text-xs text-slate-500" disabled={index === blocks.length - 1}>
                            ↓
                          </button>
                        </form>
                        <form action={removeBlockAction}>
                          <input type="hidden" name="funnelId" value={funnel.id} />
                          <input type="hidden" name="stepId" value={step.id} />
                          <input type="hidden" name="index" value={index} />
                          <button type="submit" className="text-xs text-red-600">
                            Remove
                          </button>
                        </form>
                      </span>
                    </li>
                  ))}
                  {blocks.length === 0 && <p className="text-sm text-slate-400">No blocks yet.</p>}
                </ul>

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-brand-600">Add block</summary>
                  <form action={addBlockAction} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input type="hidden" name="funnelId" value={funnel.id} />
                    <input type="hidden" name="stepId" value={step.id} />
                    <select name="type" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2">
                      <option value="heading">Heading</option>
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="button">Button</option>
                      <option value="form">Lead capture form</option>
                      <option value="buy">Buy button</option>
                    </select>

                    <input name="text" placeholder="Heading text" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2" />
                    <textarea name="body" placeholder="Text block body" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2" />
                    <input name="url" placeholder="Image URL" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                    <input name="alt" placeholder="Image alt text" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                    <input name="label" placeholder="Button/Buy label" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                    <input name="href" placeholder="Button link (e.g. /f/slug/next-step)" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />

                    <fieldset className="sm:col-span-2">
                      <legend className="text-xs text-slate-500">Lead form fields</legend>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" name="fields" value="email" defaultChecked /> Email
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" name="fields" value="firstName" /> First name
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" name="fields" value="lastName" /> Last name
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" name="fields" value="phone" /> Phone
                        </label>
                      </div>
                    </fieldset>
                    <input
                      name="submitLabel"
                      placeholder="Form submit button label"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
                    />

                    <select name="productId" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2">
                      <option value="">Product for buy button...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white sm:col-span-2 sm:w-fit">
                      Add block
                    </button>
                  </form>
                </details>
              </div>
            );
          })}
          {funnel.steps.length === 0 && <p className="text-sm text-slate-500">No steps yet.</p>}
        </div>
      </section>
    </div>
  );
}
