import { BookOpen, Clock3, Download, FileText, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { GUIDE_SECTIONS, USER_GUIDE_PDF } from "@/content/userGuide";

const AUDIENCE = ["Admin", "Scheduler", "Viewer"];

/** User Guides: the guide as a card with its contents, to read online or download as PDF. */
export default function UserGuide() {
  return (
    <AppLayout title="User Guides" subtitle="Step-by-step guides with screenshots of every page. Read online or download the PDF.">
      <article className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
          {/* Cover preview */}
          <Link to="/user-guide/read" className="group relative hidden bg-gradient-hero p-6 md:block" aria-label="Read the guide online">
            <img src="/guide/cover.png" alt="" className="w-full rounded-lg shadow-elevated ring-1 ring-white/20 transition-smooth group-hover:-translate-y-1" />
          </Link>

          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elevated">
                <BookOpen className="h-6 w-6" />
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCE.map((role) => (
                  <span key={role} className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">{role}</span>
                ))}
              </div>
            </div>

            <h2 className="text-display mt-4 text-xl font-bold">Uni-Guard User Guide</h2>
            <p className="text-sm text-muted-foreground">For everyone at your university who uses Uni-Guard</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Signing in, people, rooms and time slots, building the schedule, checking and exporting it, reports, users and settings.
              Every button explained, with screenshots.
            </p>

            <div className="mt-5 rounded-xl bg-muted/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <ListChecks className="h-4 w-4" /> Contents
              </div>
              <ol className="gap-x-6 sm:columns-2">
                {GUIDE_SECTIONS.map((section, index) => (
                  <li key={section.id} className="break-inside-avoid">
                    <Link to={`/user-guide/read#${section.id}`} className="group flex items-center gap-2.5 rounded-md py-1.5 text-sm text-foreground/90 transition-smooth hover:text-primary">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-background text-[10px] font-semibold text-muted-foreground ring-1 ring-border group-hover:text-primary">{index + 1}</span>
                      <span>{section.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> 20 min read</span>
                <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> PDF, {GUIDE_SECTIONS.length} sections</span>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Button variant="outline" className="flex-1 gap-2 sm:flex-none" asChild>
                  <Link to="/user-guide/read"><BookOpen className="h-4 w-4" /> Read online</Link>
                </Button>
                <Button className="flex-1 gap-2 sm:flex-none" asChild>
                  <a href={USER_GUIDE_PDF} download="Uni-Guard-User-Guide.pdf"><Download className="h-4 w-4" /> Download PDF</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </AppLayout>
  );
}
