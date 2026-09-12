import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  CircleDollarSign,
  // ExternalLink,
  Gauge,
  Link2,
  Inbox,
  KanbanSquare,
  Languages,
  Loader2,
  MessageSquareOff,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { STAGE_KEYS, type StageKey } from '@leadpilot/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/common/logo';
import { AppearanceControls } from '@/components/layout/appearance-controls';
import { useAuth } from '@/features/auth/auth-context';
import { useRichT, useT, type StaticKey } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { DEMO_LEAD_COUNT } from '@/lib/constants';

/** Where to reach the person who built this. */
// const PORTFOLIO_URL = 'https://portfolio-ih18.vercel.app/';

/** Where deals actually go quiet. Named before the product is mentioned. */
const PROBLEMS: { icon: LucideIcon; title: StaticKey; body: StaticKey }[] = [
  { icon: Inbox, title: 'landing.problem1Title', body: 'landing.problem1Body' },
  { icon: MessageSquareOff, title: 'landing.problem2Title', body: 'landing.problem2Body' },
  { icon: TrendingDown, title: 'landing.problem3Title', body: 'landing.problem3Body' },
];

/** The honest comparison: against a spreadsheet and a chat thread, which is
 *  what these teams genuinely use, rather than against a strawman competitor. */
const REPLACES: { before: StaticKey; after: StaticKey }[] = [
  { before: 'landing.replace1Before', after: 'landing.replace1After' },
  { before: 'landing.replace2Before', after: 'landing.replace2After' },
  { before: 'landing.replace3Before', after: 'landing.replace3After' },
  { before: 'landing.replace4Before', after: 'landing.replace4After' },
];

const FAQS: { q: StaticKey; a: StaticKey }[] = [
  { q: 'landing.faq1Q', a: 'landing.faq1A' },
  { q: 'landing.faq2Q', a: 'landing.faq2A' },
  // The data question, asked by everyone the moment an AI feature appears.
  { q: 'landing.faq5Q', a: 'landing.faq5A' },
  { q: 'landing.faq3Q', a: 'landing.faq3A' },
  { q: 'landing.faq4Q', a: 'landing.faq4A' },
];

const FEATURES: { icon: LucideIcon; title: StaticKey; body: StaticKey }[] = [
  // First, because it is the one thing here a spreadsheet cannot do at all.
  {
    icon: Sparkles,
    title: 'landing.featureAiTitle',
    body: 'landing.featureAiBody',
  },
  // Second, because it is the same assistant asked a different question, and
  // the two read as one idea when they sit together.
  {
    icon: Gauge,
    title: 'landing.featureBriefingTitle',
    body: 'landing.featureBriefingBody',
  },
  {
    icon: KanbanSquare,
    title: 'landing.featurePipelineTitle',
    body: 'landing.featurePipelineBody',
  },
  {
    icon: BarChart3,
    title: 'landing.featureDashboardTitle',
    body: 'landing.featureDashboardBody',
  },
  {
    icon: CalendarClock,
    title: 'landing.featureFollowUpsTitle',
    body: 'landing.featureFollowUpsBody',
  },
  {
    icon: Languages,
    title: 'landing.featureBilingualTitle',
    body: 'landing.featureBilingualBody',
  },
  {
    icon: CircleDollarSign,
    title: 'landing.featureCurrencyTitle',
    body: 'landing.featureCurrencyBody',
  },
  {
    icon: SlidersHorizontal,
    title: 'landing.featureRolesTitle',
    body: 'landing.featureRolesBody',
  },
  {
    icon: ShieldCheck,
    title: 'landing.featureOwnershipTitle',
    body: 'landing.featureOwnershipBody',
  },
];

/**
 * What the assistant is asked, and what it is not allowed to do.
 *
 * The feature grid says what it produces; this says how it behaves — which is
 * the part somebody weighing an AI feature actually wants, and the part most
 * pages leave out.
 */
const AI_ANSWERS: { title: StaticKey; body: StaticKey; points: readonly StaticKey[] }[] = [
  {
    title: 'landing.aiLeadTitle',
    body: 'landing.aiLeadBody',
    points: ['landing.aiLeadPoint1', 'landing.aiLeadPoint2', 'landing.aiLeadPoint3'],
  },
  {
    title: 'landing.aiWorkspaceTitle',
    body: 'landing.aiWorkspaceBody',
    points: ['landing.aiWorkspacePoint1', 'landing.aiWorkspacePoint2', 'landing.aiWorkspacePoint3'],
  },
];

/** How somebody actually gets into the workspace, in the order it happens. */
const TEAM_STEPS: { title: StaticKey; body: StaticKey }[] = [
  { title: 'landing.teamStep1Title', body: 'landing.teamStep1Body' },
  { title: 'landing.teamStep2Title', body: 'landing.teamStep2Body' },
  { title: 'landing.teamStep3Title', body: 'landing.teamStep3Body' },
];

/** What the link is, for the person deciding whether to send one. */
const TEAM_FACTS: StaticKey[] = [
  'landing.teamFact1',
  'landing.teamFact2',
  'landing.teamFact3',
  'landing.teamFact4',
];

/**
 * The limits, stated on the marketing page rather than discovered in settings.
 *
 * Each is one sentence whose opening phrase is emphasised, and that phrase is a
 * `{label}` rather than markup inside the string — Arabic does not necessarily
 * open the sentence where English does.
 */
const AI_GUARDRAILS: {
  body: 'landing.aiGuardOptIn' | 'landing.aiGuardBudget' | 'landing.aiGuardStored';
  label: StaticKey;
}[] = [
  { body: 'landing.aiGuardOptIn', label: 'landing.aiGuardOptInLabel' },
  { body: 'landing.aiGuardBudget', label: 'landing.aiGuardBudgetLabel' },
  { body: 'landing.aiGuardStored', label: 'landing.aiGuardStoredLabel' },
];

const STEPS: { title: StaticKey; body: StaticKey }[] = [
  { title: 'landing.howStep1Title', body: 'landing.howStep1Body' },
  { title: 'landing.howStep2Title', body: 'landing.howStep2Body' },
  { title: 'landing.howStep3Title', body: 'landing.howStep3Body' },
];

/** The default stage palette, matching what a new workspace is seeded with. */
const STAGE_COLORS: Record<StageKey, string> = {
  NEW: '#64748b',
  CONTACTED: '#0ea5e9',
  QUALIFIED: '#8b5cf6',
  PROPOSAL: '#f59e0b',
  WON: '#10b981',
  LOST: '#ef4444',
};

/** How many placeholder cards each preview column shows. */
const PREVIEW_DEPTH: Record<StageKey, number> = {
  NEW: 3,
  CONTACTED: 2,
  QUALIFIED: 3,
  PROPOSAL: 1,
  WON: 2,
  LOST: 1,
};

/**
 * A diagram of the board, not a screenshot of one.
 *
 * The stage names are real and translated; the cards are deliberately blank
 * bars. Filling them with invented customers would be inventing evidence, and
 * the shape is the part that communicates anything anyway. It mirrors with the
 * rest of the page because it is ordinary flex layout.
 */
function BoardPreview() {
  const t = useT();

  return (
    <div
      className="scrollbar-slim flex gap-3 overflow-x-auto pb-2"
      role="img"
      aria-label={t('landing.previewLabel')}
    >
      {STAGE_KEYS.map((key) => (
        <div key={key} className="w-[130px] shrink-0 space-y-2">
          <div className="flex items-center gap-1.5 px-0.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: STAGE_COLORS[key] }}
              aria-hidden
            />
            <span className="truncate text-xs font-medium text-muted-foreground">
              {t(`stage.${key}`)}
            </span>
          </div>
          <div className="space-y-2 rounded-lg bg-muted/50 p-2">
            {Array.from({ length: PREVIEW_DEPTH[key] }, (_, index) => (
              <div key={index} className="space-y-1.5 rounded-md border bg-card p-2" aria-hidden>
                <div className="h-1.5 w-4/5 rounded-full bg-foreground/15" />
                <div className="h-1.5 w-3/5 rounded-full bg-foreground/10" />
                <div className="flex items-center gap-1 pt-0.5">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: `${STAGE_COLORS[key]}40` }}
                  />
                  <div className="h-1.5 w-1/3 rounded-full bg-foreground/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Footer link styling, shared by the anchors and the routed links. */
const FOOTER_LINK =
  'text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <h3 className="text-xs font-medium tracking-[0.12em] text-foreground uppercase">{title}</h3>
      <ul className="mt-3 space-y-2">{children}</ul>
    </nav>
  );
}

/** An in-page jump. `scroll-mt` on each section keeps the heading clear of the
 *  sticky header when one is followed. */
function FooterAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a href={href} className={FOOTER_LINK}>
        {children}
      </a>
    </li>
  );
}

/**
 * The public front page.
 *
 * It stays visible to signed-in visitors rather than redirecting them, because
 * a marketing page that bounces you the moment you have an account is a page
 * you can never link anyone to. The call to action swaps to "open your
 * workspace" instead.
 */
export function LandingPage() {
  const t = useT();
  const richT = useRichT();
  const navigate = useNavigate();
  const { isAuthenticated, startDemo } = useAuth();
  const describeError = useApiErrorMessage();
  const [isStarting, setStarting] = useState(false);

  /**
   * The demo starts from here rather than sending the visitor to the sign-in
   * screen to find the button again. Somebody who has decided to look around
   * should not have to pass a login form to do it.
   */
  const handleStartDemo = async () => {
    setStarting(true);
    try {
      await startDemo();
      navigate('/leads', { replace: true });
    } catch (error) {
      toast.error(t('auth.demoFailed'), { description: describeError(error) });
      setStarting(false);
    }
  };

  const cta = (size: 'lg' | 'default', variant?: 'secondary') =>
    isAuthenticated ? (
      <Button asChild size={size} {...(variant && { variant })}>
        <Link to="/leads">
          {t('landing.openWorkspace')}
          <ArrowRight className="icon-directional size-4" aria-hidden />
        </Link>
      </Button>
    ) : (
      <Button
        size={size}
        {...(variant && { variant })}
        disabled={isStarting}
        onClick={handleStartDemo}
      >
        {isStarting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('auth.demoPreparing')}
          </>
        ) : (
          <>
            {t('landing.startDemo')}
            <ArrowRight className="icon-directional size-4" aria-hidden />
          </>
        )}
      </Button>
    );

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t('landing.skipToContent')}
      </a>

      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring">
            <Logo />
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <AppearanceControls className="flex items-center gap-1" />
            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link to="/leads">
                  {/* "Open your workspace" and the language toggle together run
                      off the side of a 390px phone. The short label is the same
                      destination, not a different one. */}
                  <span className="sm:hidden">{t('landing.openWorkspaceShort')}</span>
                  <span className="hidden sm:inline">{t('landing.openWorkspace')}</span>
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/login">{t('landing.signIn')}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/login">{t('landing.startDemo')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="content" className="flex-1">
        {/* --- Hero ---------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-14 sm:px-6 sm:pt-20 lg:pt-24">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
              {t('landing.heroEyebrow')}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              {t('landing.heroSubtitle')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {cta('lg')}
              {!isAuthenticated && (
                <Button asChild variant="outline" size="lg">
                  <Link to="/signup">{t('auth.createWorkspace')}</Link>
                </Button>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t('landing.heroNote')}</p>

            {/* Claims that are checkable in under a minute, rather than logos
                and testimonials this product has not earned. */}
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {(
                [
                  'landing.trustAi',
                  'landing.trustBilingual',
                  'landing.trustNoCard',
                  'landing.trustPrivate',
                ] as const
              ).map((key) => (
                <li key={key} className="flex items-center gap-1.5">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>

          <Card className="mt-12 overflow-hidden p-4 sm:p-5">
            <BoardPreview />
          </Card>
        </section>

        {/* --- The problem --------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            {t('landing.problemTitle')}
          </h2>
          <p className="mt-2 text-muted-foreground">{t('landing.problemSubtitle')}</p>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="space-y-2">
                <span
                  className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                  aria-hidden
                >
                  <Icon className="size-4.5" />
                </span>
                <h3 className="font-medium text-foreground">{t(title)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- Features ------------------------------------------------ */}
        <section id="features" className="scroll-mt-20 border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t('landing.featuresTitle')}
            </h2>
            <p className="mt-2 text-muted-foreground">{t('landing.featuresSubtitle')}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="gap-3 p-5">
                  <span
                    className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <Icon className="size-4.5" />
                  </span>
                  <h3 className="font-medium text-foreground">{t(title)}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* --- The assistant, in more detail --------------------------- */}
        <section
          id="assistant"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20"
        >
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
            {t('landing.aiEyebrow')}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            {t('landing.aiTitle')}
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t('landing.aiSubtitle')}</p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {AI_ANSWERS.map(({ title, body, points }) => (
              <Card key={title} className="gap-4 p-6">
                <h3 className="text-lg font-medium text-foreground">{t(title)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
                <ul className="space-y-2 border-t pt-4">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="leading-relaxed">{t(point)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          {/* The limits, given the same weight as the capabilities. */}
          <div className="mt-4 grid gap-4 rounded-xl border border-dashed p-5 sm:grid-cols-3 sm:p-6">
            {AI_GUARDRAILS.map(({ body, label }) => (
              <p key={body} className="text-sm leading-relaxed text-muted-foreground">
                {richT(body, {
                  label: <strong className="font-medium text-foreground">{t(label)}</strong>,
                })}
              </p>
            ))}
          </div>
        </section>

        {/* --- What it replaces ---------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('landing.replaceTitle')}
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t('landing.replaceSubtitle')}</p>

          <div className="mt-8 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-2 border-b bg-muted/40 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <div className="px-4 py-2.5 sm:px-5">{t('landing.replaceBefore')}</div>
              <div className="border-s px-4 py-2.5 sm:px-5">{t('landing.replaceAfter')}</div>
            </div>
            {REPLACES.map(({ before, after }) => (
              <div key={before} className="grid grid-cols-2 border-b text-sm last:border-b-0">
                <p className="px-4 py-3.5 text-muted-foreground sm:px-5">{t(before)}</p>
                <p className="flex items-start gap-2 border-s px-4 py-3.5 text-foreground sm:px-5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{t(after)}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* --- How it works -------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('landing.howTitle')}
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map(({ title, body }, index) => (
              <li key={title} className="space-y-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                  {index + 1}
                </span>
                <h3 className="font-medium text-foreground">{t(title)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* --- Adding the team ----------------------------------------- */}
        <section id="team" className="scroll-mt-20 border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
              {t('landing.teamTitle')}
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{t('landing.teamSubtitle')}</p>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
              <ol className="space-y-6">
                {TEAM_STEPS.map(({ title, body }, index) => (
                  <li key={title} className="flex gap-4">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div className="space-y-1.5">
                      <h3 className="font-medium text-foreground">{t(title)}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* The properties of the link itself, which is the part somebody
                  sending one to a colleague actually wants to know. */}
              <Card className="h-fit gap-4 bg-muted/40 p-6">
                <h3 className="flex items-center gap-2 font-medium text-foreground">
                  <Link2 className="size-4 text-muted-foreground" aria-hidden />
                  {t('landing.teamFactsTitle')}
                </h3>
                <ul className="space-y-2.5">
                  {TEAM_FACTS.map((key) => (
                    <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="leading-relaxed">{t(key)}</span>
                    </li>
                  ))}
                </ul>
                <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                  {t('landing.teamFactsNote')}
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* --- Objections ---------------------------------------------- */}
        <section id="faq" className="scroll-mt-20 border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t('landing.faqTitle')}
            </h2>
            <dl className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
              {FAQS.map(({ q, a }) => (
                <div key={q} className="space-y-1.5">
                  <dt className="font-medium text-foreground">{t(q)}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">{t(a)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* --- Closing call to action ---------------------------------- */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
              <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.2),transparent_45%)] rtl:-scale-x-100"
                aria-hidden
              />
              <div className="relative max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t('landing.ctaTitle')}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-primary-foreground/85">
                  {t('landing.ctaBody', { count: DEMO_LEAD_COUNT })}
                </p>
                <div className="mt-7">{cta('lg', 'secondary')}</div>
              </div>
            </div>
          </div>
        </section>
      </main>

       <footer className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t('landing.footerTagline')}
              </p>
            </div>

            {/* In-page anchors rather than routes: everything they point at is
                on this page, and a router link would reload it. */}
            <FooterColumn title={t('landing.footerExplore')}>
              <FooterAnchor href="#features">{t('landing.footerLinkFeatures')}</FooterAnchor>
              <FooterAnchor href="#assistant">{t('landing.footerLinkAssistant')}</FooterAnchor>
              <FooterAnchor href="#team">{t('landing.footerLinkTeam')}</FooterAnchor>
              <FooterAnchor href="#faq">{t('landing.footerLinkFaq')}</FooterAnchor>
            </FooterColumn>

            <FooterColumn title={t('landing.footerStart')}>
              {isAuthenticated ? (
                <li>
                  <Link to="/leads" className={FOOTER_LINK}>
                    {t('landing.openWorkspace')}
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link to="/login" className={FOOTER_LINK}>
                      {t('landing.footerLinkDemo')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/signup" className={FOOTER_LINK}>
                      {t('landing.footerLinkSignup')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" className={FOOTER_LINK}>
                      {t('landing.footerLinkSignin')}
                    </Link>
                  </li>
                </>
              )}
            </FooterColumn>

            {/*
              The portfolio gets a card rather than a line of small print: it is
              the one link on this page that leaves the site, and hiding that
              behind "here" would tell nobody where they are going.

              Temporarily disabled — kept in source, just not rendered.

            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-medium text-foreground">
                {t('landing.footerContactTitle')}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t('landing.footerContactBody')}
              </p>
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t('landing.footerContact')}
                <ExternalLink className="icon-directional size-3.5" aria-hidden />
              </a>
            </div>

            */}
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>{t('landing.footerBuilt')}</p>
            <p>{t('landing.footerRights', { year: new Date().getFullYear() })}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
