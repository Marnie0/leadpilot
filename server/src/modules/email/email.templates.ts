import type { Locale } from '@leadpilot/shared';
import { env } from '../../env.js';

/**
 * Email copy, in both languages.
 *
 * ## Why the strings are here and not in the client dictionary
 *
 * The client's dictionary is compiled into the browser bundle and typed against
 * the English one; the server cannot reach it, and shipping these strings to
 * every visitor to send none of them would be daft. So email copy lives beside
 * the sender, and the two languages sit next to each other in one file for the
 * same reason the client keeps them in parallel dictionaries: a missing
 * translation should be visible while you are editing, not discovered by an
 * Arabic-speaking recipient.
 *
 * ## Direction
 *
 * Arabic mail is rendered right-to-left with `dir="rtl"` on the wrapper and
 * `text-align` set per block — email clients ignore most CSS, and the ones that
 * matter respect these two.
 */

interface Copy {
  subject: string;
  heading: string;
  /** Paragraphs before the button. */
  body: string[];
  action: string;
  /** Small print after the button. */
  footer: string[];
}

const LINK_LIFETIME_HOURS = 24;
const INVITE_LIFETIME_DAYS = 7;

export type EmailKind =
  'verify' | 'verifyExisting' | 'reset' | 'resetUnknown' | 'invite' | 'roleChanged' | 'removed';

/* ------------------------------------------------------------------ *
 * Copy
 * ------------------------------------------------------------------ */

const EN = {
  verify: (name: string, workspace: string): Copy => ({
    subject: 'Confirm your email address',
    heading: `Welcome, ${name}`,
    body: [
      `Your workspace <strong>${workspace}</strong> is ready. Confirm this address so we know we can reach you.`,
      'You can sign in and start working straight away — confirming just keeps your account recoverable.',
    ],
    action: 'Confirm my email',
    footer: [
      `This link works once and expires in ${LINK_LIFETIME_HOURS} hours.`,
      'If you did not create this account, you can ignore this message.',
    ],
  }),
  /*
   * Sent when somebody tries to sign up with an address that already has an
   * account. It is what makes the sign-up endpoint stop being an enumeration
   * oracle: the API answers identically either way, and the difference between
   * "new account" and "already exists" lives only in the recipient's inbox,
   * where only the owner of the address can see it.
   */
  verifyExisting: (_name: string, _workspace: string): Copy => ({
    subject: 'Someone tried to sign up with your email',
    heading: 'You already have an account',
    body: [
      'Somebody just tried to create a LeadPilot account with this email address. You already have one, so nothing was created and nothing has changed.',
      'If that was you, sign in instead — or reset your password if you have forgotten it.',
    ],
    action: 'Go to sign in',
    footer: ['If this was not you, no action is needed. Your account is untouched.'],
  }),
  reset: (name: string): Copy => ({
    subject: 'Reset your password',
    heading: `Hello ${name}`,
    body: ['Use the link below to choose a new password.'],
    action: 'Choose a new password',
    footer: [
      `This link works once and expires in ${LINK_LIFETIME_HOURS} hours.`,
      'If you did not ask for this, you can ignore it — your password has not changed.',
      'Using the link will sign you out everywhere else.',
    ],
  }),
  resetUnknown: (): Copy => ({
    subject: 'Password reset requested',
    heading: 'No account for this address',
    body: [
      'Somebody asked to reset the password for a LeadPilot account using this email address, but there is no account here.',
      'If you were expecting this, you may have signed up with a different address.',
    ],
    action: 'Create an account',
    footer: ['If this was not you, no action is needed.'],
  }),
  invite: (inviter: string, workspace: string, role: string): Copy => ({
    subject: `${inviter} invited you to ${workspace}`,
    heading: `Join ${workspace}`,
    body: [
      `<strong>${inviter}</strong> has invited you to join <strong>${workspace}</strong> on LeadPilot as ${role}.`,
      'Follow the link to choose a password and get started.',
    ],
    action: 'Accept the invitation',
    footer: [
      `This invitation works once and expires in ${INVITE_LIFETIME_DAYS} days.`,
      'If you were not expecting it, you can ignore this message.',
    ],
  }),
  roleChanged: (workspace: string, role: string): Copy => ({
    subject: `Your role in ${workspace} changed`,
    heading: 'Your access changed',
    body: [`You are now ${role} in <strong>${workspace}</strong>.`],
    action: 'Open the workspace',
    footer: ['If this looks wrong, speak to whoever administers the workspace.'],
  }),
  removed: (workspace: string): Copy => ({
    subject: `You were removed from ${workspace}`,
    heading: 'Access removed',
    body: [
      `Your access to <strong>${workspace}</strong> has been removed and you have been signed out.`,
    ],
    action: '',
    footer: ['If this looks wrong, speak to whoever administers the workspace.'],
  }),
};

const AR = {
  verify: (name: string, workspace: string): Copy => ({
    subject: 'أكّد بريدك الإلكتروني',
    heading: `أهلًا بك، ${name}`,
    body: [
      `مساحة العمل <strong>${workspace}</strong> جاهزة. أكّد هذا العنوان لنطمئن إلى أننا نستطيع الوصول إليك.`,
      'يمكنك تسجيل الدخول والبدء فورًا — التأكيد يضمن فقط إمكانية استعادة حسابك لاحقًا.',
    ],
    action: 'تأكيد بريدي الإلكتروني',
    footer: [
      `يعمل هذا الرابط مرة واحدة وتنتهي صلاحيته خلال ${LINK_LIFETIME_HOURS} ساعة.`,
      'إن لم تكن أنت من أنشأ هذا الحساب، فتجاهل هذه الرسالة.',
    ],
  }),
  verifyExisting: (_name: string, _workspace: string): Copy => ({
    subject: 'حاول أحدهم التسجيل ببريدك الإلكتروني',
    heading: 'لديك حساب بالفعل',
    body: [
      'حاول أحدهم للتو إنشاء حساب في «ليدبايلوت» بهذا البريد الإلكتروني. لديك حساب بالفعل، لذا لم يُنشأ شيء ولم يتغيّر شيء.',
      'إن كنت أنت، فسجّل الدخول بدلًا من ذلك — أو أعد تعيين كلمة المرور إن كنت قد نسيتها.',
    ],
    action: 'الانتقال إلى تسجيل الدخول',
    footer: ['إن لم تكن أنت، فلا حاجة إلى أي إجراء. حسابك كما هو.'],
  }),
  reset: (name: string): Copy => ({
    subject: 'إعادة تعيين كلمة المرور',
    heading: `مرحبًا ${name}`,
    body: ['استخدم الرابط أدناه لاختيار كلمة مرور جديدة.'],
    action: 'اختيار كلمة مرور جديدة',
    footer: [
      `يعمل هذا الرابط مرة واحدة وتنتهي صلاحيته خلال ${LINK_LIFETIME_HOURS} ساعة.`,
      'إن لم تطلب ذلك، فتجاهله — لم تتغيّر كلمة مرورك.',
      'سيؤدي استخدام الرابط إلى تسجيل خروجك من كل الأجهزة الأخرى.',
    ],
  }),
  resetUnknown: (): Copy => ({
    subject: 'طلب إعادة تعيين كلمة المرور',
    heading: 'لا يوجد حساب بهذا العنوان',
    body: [
      'طلب أحدهم إعادة تعيين كلمة مرور حساب في «ليدبايلوت» بهذا البريد الإلكتروني، لكن لا يوجد حساب هنا.',
      'إن كنت تتوقّع هذه الرسالة، فربما سجّلت ببريد إلكتروني آخر.',
    ],
    action: 'إنشاء حساب',
    footer: ['إن لم تكن أنت، فلا حاجة إلى أي إجراء.'],
  }),
  invite: (inviter: string, workspace: string, role: string): Copy => ({
    subject: `دعاك ${inviter} للانضمام إلى ${workspace}`,
    heading: `انضم إلى ${workspace}`,
    body: [
      `دعاك <strong>${inviter}</strong> للانضمام إلى <strong>${workspace}</strong> على «ليدبايلوت» بصفة ${role}.`,
      'اتبع الرابط لاختيار كلمة مرور والبدء.',
    ],
    action: 'قبول الدعوة',
    footer: [
      `تعمل هذه الدعوة مرة واحدة وتنتهي صلاحيتها خلال ${INVITE_LIFETIME_DAYS} أيام.`,
      'إن لم تكن تتوقّعها، فتجاهل هذه الرسالة.',
    ],
  }),
  roleChanged: (workspace: string, role: string): Copy => ({
    subject: `تغيّرت صلاحيتك في ${workspace}`,
    heading: 'تغيّرت صلاحيتك',
    body: [`أصبحت الآن ${role} في <strong>${workspace}</strong>.`],
    action: 'فتح مساحة العمل',
    footer: ['إن بدا هذا غير صحيح، فتحدّث إلى من يدير مساحة العمل.'],
  }),
  removed: (workspace: string): Copy => ({
    subject: `تمت إزالتك من ${workspace}`,
    heading: 'تمت إزالة الوصول',
    body: [`أُزيل وصولك إلى <strong>${workspace}</strong> وتم تسجيل خروجك.`],
    action: '',
    footer: ['إن بدا هذا غير صحيح، فتحدّث إلى من يدير مساحة العمل.'],
  }),
};

export const ROLE_NAMES: Record<Locale, Record<string, string>> = {
  en: { OWNER: 'the owner', ADMIN: 'an admin', MEMBER: 'a member' },
  ar: { OWNER: 'المالك', ADMIN: 'مشرفًا', MEMBER: 'عضوًا' },
};

const COPY = { en: EN, ar: AR } as const;

/** Escapes text that came from a user before it goes into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps copy in the message shell.
 *
 * Table-free, inline-styled and deliberately plain: every extra construct is
 * another thing an email client renders differently, and none of them make a
 * six-line transactional message read better.
 */
function render(copy: Copy, link: string, locale: Locale): { html: string; text: string } {
  const rtl = locale === 'ar';
  const align = rtl ? 'right' : 'left';

  const paragraphs = copy.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2430;text-align:${align}">${line}</p>`,
    )
    .join('');

  const button = copy.action
    ? `<p style="margin:24px 0;text-align:${align}">
         <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600">${escapeHtml(copy.action)}</a>
       </p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#5b6478;text-align:${align};word-break:break-all">${link}</p>`
    : '';

  const footer = copy.footer
    .map(
      (line) =>
        `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#5b6478;text-align:${align}">${line}</p>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}">
<body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px" dir="${rtl ? 'rtl' : 'ltr'}">
    <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#2563eb;text-align:${align}">LeadPilot</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#111827;text-align:${align}">${escapeHtml(copy.heading)}</h1>
    ${paragraphs}
    ${button}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    ${footer}
  </div>
</body>
</html>`;

  // Every client that refuses HTML still gets a usable message, and the link is
  // on its own line so it survives being wrapped by a mail transfer agent.
  const text = [
    copy.heading,
    '',
    ...copy.body.map((line) => line.replace(/<[^>]+>/g, '')),
    ...(link && copy.action ? ['', copy.action + ':', link] : []),
    '',
    ...copy.footer,
  ].join('\n');

  return { html, text };
}

export function buildEmail(
  kind: EmailKind,
  locale: Locale,
  link: string,
  params: { name?: string; workspace?: string; inviter?: string; role?: string },
): { subject: string; html: string; text: string } {
  const dictionary = COPY[locale] ?? COPY.en;
  const name = escapeHtml(params.name ?? '');
  const workspace = escapeHtml(params.workspace ?? '');
  const inviter = escapeHtml(params.inviter ?? '');
  const role = params.role ?? '';

  const copy =
    kind === 'verify'
      ? dictionary.verify(name, workspace)
      : kind === 'verifyExisting'
        ? dictionary.verifyExisting(name, workspace)
        : kind === 'reset'
          ? dictionary.reset(name)
          : kind === 'resetUnknown'
            ? dictionary.resetUnknown()
            : kind === 'invite'
              ? dictionary.invite(inviter, workspace, role)
              : kind === 'roleChanged'
                ? dictionary.roleChanged(workspace, role)
                : dictionary.removed(workspace);

  const rendered = render(copy, link, locale);
  return { subject: copy.subject, ...rendered };
}

/** Absolute link into the app, built from the configured origin. */
export const appLink = (path: string): string => new URL(path, env.APP_URL).toString();
