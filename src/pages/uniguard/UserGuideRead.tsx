import { ArrowLeft, Check, ChevronRight, Download, Lightbulb, Search, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { Link, useLocation } from "react-router-dom";
import { GUIDE_SECTIONS, QUICK_START, USER_GUIDE_PDF, type GuideBlock, type GuideRole, type GuideSection } from "@/content/userGuide";
import { cn } from "@/lib/utils";

const ROLE_STYLE: Record<GuideRole, string> = {
  Admin: "border-primary/30 bg-primary/10 text-primary",
  Scheduler: "border-success/30 bg-success/10 text-success",
  Viewer: "border-border bg-muted text-muted-foreground",
};

/** Renders **bold** inside guide text. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>);
}

const plain = (section: GuideSection) => [
  section.title, section.summary,
  ...section.blocks.flatMap((block) => {
    switch (block.kind) {
      case "list": case "steps": return block.items;
      case "table": return [...block.head, ...block.rows.flat()];
      case "img": return [block.caption];
      default: return [block.text];
    }
  }),
].join(" ").replace(/\*\*/g, "").toLowerCase();

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="text-sm leading-relaxed text-muted-foreground">{rich(block.text)}</p>;
    case "h":
      return <h3 className="pt-2 text-sm font-semibold text-foreground">{block.text}</h3>;
    case "list":
      return (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
              <span>{rich(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2.5">
          {block.items.map((item, index) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{index + 1}</span>
              <span className="pt-0.5">{rich(item)}</span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="stack-table w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{block.head.map((cell) => <th key={cell} className="px-3 py-2 font-medium">{cell}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={index} data-label={block.head[index]} data-stack={index === 0 ? "title" : undefined}
                      className={cn("px-3 py-2 align-top", index === 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {cell === "Yes" ? <Check className="h-4 w-4 text-success" aria-label="Yes" />
                        : cell === "No" ? <X className="h-4 w-4 text-muted-foreground/50" aria-label="No" />
                        : rich(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "img":
      return (
        <figure className="guide-figure">
          <a href={block.src} target="_blank" rel="noopener noreferrer" title="Open full size"
            className="block overflow-hidden rounded-lg border border-border bg-muted/30 shadow-card transition-smooth hover:shadow-elevated">
            <img src={block.src} alt={block.caption} loading="lazy" className="block w-full" />
          </a>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">{block.caption}</figcaption>
        </figure>
      );
    case "tip":
      return (
        <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{rich(block.text)}</span>
        </div>
      );
  }
}

function SectionCard({ section, index }: { section: GuideSection; index: number }) {
  const Icon = section.icon;
  return (
    <section id={section.id} className="guide-section scroll-mt-24 rounded-xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-4 sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-display text-lg font-bold">
            <span className="mr-2 text-muted-foreground/60 tabular-nums">{String(index + 1).padStart(2, "0")}</span>{section.title}
          </h2>
          <p className="text-sm text-muted-foreground">{section.summary}</p>
        </div>
        <div className="flex w-full flex-wrap gap-1 pl-[52px] sm:w-auto sm:pl-0">
          {section.roles.map((role) => (
            <span key={role} className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", ROLE_STYLE[role])}>{role}</span>
          ))}
        </div>
      </header>
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {section.blocks.map((block, blockIndex) => <Block key={blockIndex} block={block} />)}
      </div>
    </section>
  );
}

/** Reading view of the user guide: every page and button, with screenshots. All roles can read it. */
export default function UserGuideRead() {
  const { hash } = useLocation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(GUIDE_SECTIONS[0].id);
  const index = useMemo(() => GUIDE_SECTIONS.map((section) => ({ section, text: plain(section) })), []);
  const needle = query.trim().toLowerCase();
  const visible = needle ? index.filter((entry) => entry.text.includes(needle)).map((entry) => entry.section) : GUIDE_SECTIONS;

  // Highlight the section being read in the contents list.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const top = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: "-80px 0px -65% 0px" });
    visible.forEach((section) => { const el = document.getElementById(section.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [visible]);

  // Opened from a contents link (/user-guide/read#scheduler): go to that section.
  useEffect(() => {
    const id = hash.slice(1);
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
  }, [hash]);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const search = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the guide" aria-label="Search the guide" className="pl-9" />
    </div>
  );

  return (
    <AppLayout
      title="Uni-Guard User Guide"
      subtitle="Every page and button, step by step."
      actions={
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="gap-2" asChild>
          <Link to="/user-guide"><ArrowLeft className="h-4 w-4" /> User Guides</Link>
        </Button>
        <Button className="gap-2" asChild>
          <a href={USER_GUIDE_PDF} download="Uni-Guard-User-Guide.pdf"><Download className="h-4 w-4" /> Download PDF</a>
        </Button>
        </div>
      }
    >
      <div className="guide-quickstart mb-6 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick start</div>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {QUICK_START.map((step, stepIndex) => (
            <li key={step} className="flex items-center gap-1.5">
              <span className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-hero text-[10px] font-semibold text-primary-foreground">{stepIndex + 1}</span>
                {step}
              </span>
              {stepIndex < QUICK_START.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="guide-toc hidden lg:block">
          <div className="sticky top-20 space-y-3">
            {search}
            <nav aria-label="Guide contents" className="space-y-0.5">
              {visible.map((section) => {
                const Icon = section.icon;
                return (
                  <button key={section.id} type="button" onClick={() => jump(section.id)}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-smooth",
                      active === section.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="guide-toc lg:hidden">{search}</div>
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              Nothing matches "{query}". Try another word.
            </div>
          ) : visible.map((section) => (
            <SectionCard key={section.id} section={section} index={GUIDE_SECTIONS.indexOf(section)} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
