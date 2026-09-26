import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="app-shell flex min-h-[100dvh] items-center justify-center p-6">
      <div className="panel max-w-md p-9 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-7 w-7" />
        </div>
        <div className="eyebrow text-primary">Record not found</div>
        <h1 className="display-serif mt-3 text-4xl">This trail ends here.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page you requested is not part of this evidence room, or it has moved.
        </p>
        <Link href="/dashboard" className="button-primary mt-7" data-testid="link-return-dashboard">
          <ArrowLeft className="h-4 w-4" /> Return to overview
        </Link>
      </div>
    </div>
  );
}