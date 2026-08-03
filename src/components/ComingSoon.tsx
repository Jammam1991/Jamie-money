import Link from "next/link";
import { Clock, ChevronLeft } from "lucide-react";
import { PageTitle, Card } from "@/components/ui";

// Stands in for a whole page while Chris has it parked on the Settings screen.
// The tab and menu row stay exactly where they were — this is all Jamie sees
// when he opens it, so none of the page's real numbers load at all.
export default function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <PageTitle>{title}</PageTitle>
      <Card className="py-10 text-center">
        <Clock size={40} className="mx-auto mb-4 text-muted" strokeWidth={1.5} />
        <p className="text-lg font-medium">Coming Soon</p>
        <p className="mx-auto mt-2 max-w-[16rem] text-[14px] text-muted">
          This one isn&apos;t ready yet. Check back a little later.
        </p>
      </Card>
      <Link
        href="/"
        className="mt-4 flex items-center justify-center gap-1 text-[14px] text-muted"
      >
        <ChevronLeft size={16} />
        Back to My Cash
      </Link>
    </div>
  );
}
