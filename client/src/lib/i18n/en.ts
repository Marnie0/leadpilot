import { VALIDATION_EN } from '@leadpilot/shared';

/**
 * The English dictionary — and the source of truth for the whole key list.
 *
 * ## Why it is flat
 *
 * Nesting reads nicely and types badly: deriving `'leads.filters.stage'` from a
 * nested object needs a recursive template-literal type that gets slow and gives
 * unreadable errors. A flat map of dotted keys means `keyof typeof en` is
 * already the exact union, so every lookup is checked instantly and a typo
 * points at the line that has it.
 *
 * ## Conventions
 *
 *  - `{placeholder}` is interpolated. Which placeholders a string has is part of
 *    its type, so `t()` will not compile without them.
 *  - A `_one` / `_other` pair is a plural family, addressed by its stem:
 *    `t('leads.count', { count })`. Arabic adds `_zero`, `_two`, `_few` and
 *    `_many` on top — see `ar.ts`.
 *  - The `validation.*` and `field.*` keys are spread in from the shared package
 *    rather than restated, because the same strings have to render on the
 *    server. Owning them in one place is what makes an untranslated rule a
 *    compile error instead of an English message in an Arabic form.
 */
export const en = {
  ...VALIDATION_EN,

  /* -------------------------------------------------------------- *
   * Common
   * -------------------------------------------------------------- */
  'common.cancel': 'Cancel',
  'common.saving': 'Saving…',
  'common.tryAgain': 'Try again',
  'common.loading': 'Loading…',
  'common.turnOff': 'Turn off',
  'common.clearAll': 'Clear all',
  'common.clearFilters': 'Clear filters',
  'common.clearSelection': 'Clear selection',
  'common.noMatches': 'No matches',
  'common.searchIn': 'Search {label}…',
  'common.clearSearch': 'Clear search',
  'common.unassigned': 'Unassigned',
  'common.deactivatedSuffix': ' (deactivated)',
  'common.you': '(you)',
  'common.dash': '—',
  'common.days_one': '{count} day',
  'common.days_other': '{count} days',
  'common.daysShort': '{count}d',
  'common.percent': '{value}%',
  'common.somethingWentWrong': 'Something went wrong. Check your connection and try again.',
  'common.couldNotLoad': 'Could not load this',

  /* -------------------------------------------------------------- *
   * Application chrome
   * -------------------------------------------------------------- */
  'nav.main': 'Main',
  'nav.openNavigation': 'Open navigation',
  'nav.navigation': 'Navigation',
  'nav.leads': 'Leads',
  'nav.pipeline': 'Pipeline',
  'nav.dashboard': 'Dashboard',
  'nav.followUps': 'Follow-ups',
  'nav.team': 'Team',
  'nav.trash': 'Trash',

  'menu.appearance': 'Appearance',
  'menu.themeLight': 'Light',
  'menu.themeDark': 'Dark',
  'menu.themeSystem': 'System',
  'menu.language': 'Language',
  'menu.signOut': 'Sign out',
  'menu.signedOut': 'Signed out',
  'menu.accountMenu': 'Account menu',

  'language.en': 'English',
  'language.ar': 'العربية',
  'language.switch': 'Change language',
  'language.changed': 'Language changed to English',

  'demo.title': 'This is your own private demo workspace.',
  'demo.bodyWithExpiry': 'Edit anything — no one else sees it, and it is removed in {remaining}.',
  'demo.body': 'Edit anything — no one else sees it.',

  /* -------------------------------------------------------------- *
   * Errors
   * -------------------------------------------------------------- */
  'error.title': 'Something broke',
  'error.body': 'An unexpected error stopped the page from rendering. Reloading usually clears it.',
  'error.reload': 'Reload the page',
  'error.notFoundTitle': 'Page not found',
  'error.notFoundEmbedded':
    'That page does not exist. Check the address, or head back to your leads.',
  'error.notFoundStandalone':
    'That link does not lead anywhere. It may have been moved, or the record was deleted.',
  'error.backToLeads': 'Back to your leads',
  'error.goToLeads': 'Go to your leads',

  // Keyed by the API's stable error code, so the message a user reads is
  // translated rather than echoed back from the server in English.
  'apiError.UNAUTHORIZED': 'You need to sign in to continue',
  'apiError.INVALID_CREDENTIALS': 'Incorrect email or password',
  'apiError.SESSION_EXPIRED': 'Your session has expired. Please sign in again.',
  'apiError.ACCOUNT_INACTIVE': 'Your account is no longer active',
  'apiError.CURRENT_PASSWORD_INCORRECT': 'Your current password is incorrect',
  'apiError.EMAIL_TAKEN': 'An account with that email already exists',
  'apiError.FORBIDDEN': 'You do not have permission to do that',
  'apiError.OWNER_ONLY': 'Only the workspace owner can change the owner account',
  'apiError.FOLLOW_UP_ALREADY_COMPLETED': 'Somebody has already completed that follow-up',
  'apiError.FOLLOW_UP_NOT_PENDING': 'That follow-up is no longer open',
  'apiError.ALREADY_TRASHED': 'That follow-up is already in the trash',
  'apiError.NOT_TRASHED': 'Move it to the trash before deleting it permanently',
  'apiError.RESTORED_MEANWHILE':
    'Somebody restored it from the trash just now, so it was not deleted',
  'apiError.CONFIRMATION_MISMATCH': 'What you typed does not match',
  'apiError.LAST_OWNER': 'A workspace must always have an owner',
  'apiError.CANNOT_DEACTIVATE_SELF': 'You cannot deactivate your own account',
  'apiError.FOLLOW_UP_NOT_YOURS': 'You can only change follow-ups on your own leads',
  'apiError.LEAD_NOT_ACTIVE': 'Restore this lead before asking the assistant about it',
  'apiError.MANAGER_ONLY': 'Only an owner or admin can change that',
  'apiError.AI_DISABLED': 'The assistant is switched off for this workspace',
  'apiError.AI_NOT_CONFIGURED': 'The assistant is not set up on this deployment',
  'apiError.AI_QUOTA_EXCEEDED':
    'This workspace has used its analyses for today. Each one frees up 24 hours after it was run.',
  'apiError.AI_RATE_LIMITED': 'The assistant is busy right now. Try again in a moment.',
  'apiError.AI_UNAVAILABLE': 'The assistant is unavailable right now. Your lead is unchanged.',
  'apiError.AI_INVALID_RESPONSE': 'The assistant returned an unusable answer. Try again.',
  'apiError.OWNER_TRANSFER_ONLY': 'Ownership is transferred, not granted',
  'apiError.ALREADY_A_MEMBER': 'That person is already in this workspace',
  'apiError.DEMO_EMAIL_DISABLED':
    'A demo workspace can create invitation links but cannot email them',
  'apiError.INVITE_LIMIT':
    'This workspace has created too many invitations in the last hour. Try again later',
  'apiError.ALREADY_OWNER': 'You already own this workspace',
  'apiError.INVITE_ALREADY_ACCEPTED': 'That invitation has already been accepted',
  'apiError.EMAIL_REQUIRED': 'An email address is required to accept this invitation',
  'apiError.INVALID_OR_EXPIRED_TOKEN': 'This link is no longer valid. Request a new one.',
  'apiError.CANNOT_CHANGE_OWN_ROLE': 'You cannot change your own role',
  'apiError.ROLE_NAME_TAKEN': 'A role with that name already exists',
  'apiError.ROLE_IN_USE': 'Choose a role to move this one’s members to first',
  'apiError.SYSTEM_ROLE': 'The built-in roles cannot be deleted',
  'apiError.OWNER_ROLE_FIXED': 'The owner role always has every permission',
  'apiError.OWNER_MUST_TRANSFER':
    'Hand the workspace over, or delete it, before deleting your account',
  'apiError.NOT_OWNER': 'Ownership of this workspace has already changed hands',
  'apiError.TARGET_UNAVAILABLE':
    'That person is no longer an active member, so ownership was not transferred',
  'apiError.CANNOT_GRANT_ROLE':
    'You cannot grant a role that holds more than you do, or one that can manage the team',
  'apiError.NOT_FOUND': 'That record no longer exists',
  'apiError.VALIDATION_ERROR': 'Some fields need your attention',
  'apiError.RATE_LIMITED': 'Too many requests. Please try again shortly.',
  'apiError.DEMO_UNAVAILABLE': 'The demo is not available right now. Please try again shortly.',
  'apiError.DATABASE_UNAVAILABLE': 'The service is temporarily unavailable. Please try again.',
  'apiError.INTERNAL_ERROR': 'Something failed on our side. Please try again.',

  /* -------------------------------------------------------------- *
   * Authentication
   * -------------------------------------------------------------- */
  'auth.loginTitle': 'Welcome back',
  'auth.loginSubtitle': 'Sign in to pick up where your pipeline left off.',
  'auth.noAccount': 'Don’t have an account?',
  'auth.createOne': 'Create one',
  'auth.haveAccount': 'Already have an account?',
  'auth.signIn': 'Sign in',
  'auth.checkingSession': 'Checking your session…',
  'auth.workEmail': 'Work email',
  'auth.emailPlaceholder': 'you@company.com',
  'auth.password': 'Password',
  'auth.passwordPlaceholder': 'Enter your password',
  'auth.showPassword': 'Show password',
  'auth.hidePassword': 'Hide password',

  'auth.signupTitle': 'Create your workspace',
  'auth.signupSubtitle': 'Set up your team’s pipeline in under a minute. No card required.',
  'auth.yourName': 'Your name',
  'auth.namePlaceholder': 'Layla Haddad',
  'auth.companyName': 'Company name',
  'auth.companyPlaceholder': 'Meridian Property Group',
  'auth.companyHint': 'This becomes your workspace. You can invite your team once you’re in.',
  'auth.createPassword': 'Create a password',
  'auth.passwordHint': 'At least {count} characters, with a letter and a number.',
  'auth.confirmPassword': 'Confirm password',
  'auth.confirmPlaceholder': 'Re-enter your password',
  'auth.createWorkspace': 'Create workspace',

  'auth.demoTitle': 'Just want a look around?',
  'auth.demoBody':
    'Opens your own private workspace with {count} leads and a full activity history. Change anything you like — nobody else sees it, and it is removed after a day.',
  'auth.demoStart': 'Start a demo',
  'auth.demoPreparing': 'Preparing your workspace…',
  'auth.demoFailed': 'Could not open a demo workspace',

  'auth.brandEyebrow': 'Lead management',
  'auth.brandHeadline': 'Stop losing deals in a spreadsheet.',
  'auth.brandBody':
    'LeadPilot gives small service teams one place to track every enquiry from first contact to signed deal.',
  'auth.brandPoint1': 'Every enquiry captured, assigned and followed up',
  'auth.brandPoint2': 'A shared pipeline your whole team can see',
  'auth.brandPoint3': 'Works in English and Arabic, right-to-left included',

  /* -------------------------------------------------------------- *
   * Landing page
   * -------------------------------------------------------------- */
  'landing.skipToContent': 'Skip to content',
  'landing.signIn': 'Sign in',
  'landing.startDemo': 'Start a demo',
  'landing.openWorkspace': 'Open your workspace',
  'landing.openWorkspaceShort': 'Workspace',

  'landing.heroEyebrow': 'Lead management for service businesses',
  'landing.heroTitle': 'Every enquiry, followed up.',
  'landing.heroSubtitle':
    'Small teams rarely lose a deal to a better competitor. They lose it to a message nobody answered. LeadPilot is one shared place to capture every enquiry, give it an owner, and make sure somebody actually follows up — with an AI assistant that reads each enquiry, scores it, and drafts the reply.',
  'landing.heroNote': 'No card, no signup. The demo opens a private workspace with real data.',
  'landing.trustAi': 'An AI assistant that drafts the reply',
  'landing.trustBilingual': 'English and Arabic, properly',
  'landing.trustNoCard': 'No card, no signup',
  'landing.trustPrivate': 'A private workspace, yours alone',

  'landing.previewLabel': 'A pipeline board, one column per stage',

  /* The problem, before the product. */
  'landing.problemTitle': 'Deals rarely die loudly.',
  'landing.problemSubtitle': 'They go quiet. Almost always in one of three places.',
  'landing.problem1Title': 'The enquiry nobody owned',
  'landing.problem1Body':
    'It landed in a shared inbox on a Thursday. Two people each assumed the other had picked it up. By Monday the customer had booked somebody else.',
  'landing.problem2Title': 'The follow-up nobody made',
  'landing.problem2Body':
    '“Call them next week” lives in someone’s head, a notebook, or a chat message that scrolled away. Next week arrives and nothing happens.',
  'landing.problem3Title': 'The month nobody could explain',
  'landing.problem3Body':
    'The total was down and nobody could say which stage stalled, which source dried up, or how much longer deals were taking to close.',

  'landing.featuresTitle': 'What it does about it',
  'landing.featuresSubtitle': 'Nine things, done properly, instead of forty half-built ones.',

  'landing.featureAiTitle': 'It reads the enquiry before you do',
  'landing.featureAiBody':
    'Point the assistant at an inbound enquiry and it comes back with what the customer actually wants, how strong the opportunity looks and why, what to do next, and a reply you can send. Off until a workspace turns it on.',
  'landing.featureBriefingTitle': 'And briefs you on all of it',
  'landing.featureBriefingBody':
    'Ask the same assistant about the whole workspace and it answers in one screen: where the pipeline stands, what needs attention today and how badly, what is trending up or down, and the one thing to do next. It tells you when it has gone out of date.',
  'landing.featurePipelineTitle': 'A pipeline everyone can see',
  'landing.featurePipelineBody':
    'Drag a deal between stages and it moves everywhere at once — the table, the detail view and the activity trail. Stages are per workspace, so you can name them the way your team already talks.',
  'landing.featureDashboardTitle': 'Numbers you can act on',
  'landing.featureDashboardBody':
    'Conversion, expected revenue, lead sources and stage occupancy, aggregated in the database rather than guessed at. Every figure links back to the leads behind it.',
  'landing.featureFollowUpsTitle': 'Nothing goes quiet',
  'landing.featureFollowUpsBody':
    'Book the next touchpoint on a lead and it shows up as overdue, due today or due this week — so the deals that need a call are the ones you see first.',
  'landing.featureBilingualTitle': 'Genuinely bilingual',
  'landing.featureBilingualBody':
    'Not translated strings in a left-to-right frame. Arabic mirrors the whole interface — navigation, tables, charts and drag-and-drop — with the dates, numbers and plural rules to match.',
  'landing.featureCurrencyTitle': 'Money in the currency you think in',
  'landing.featureCurrencyBody':
    'The workspace records deals in one currency; each person reads every figure in theirs, converted at today’s rate and labelled as converted. Nobody does arithmetic in their head during a meeting.',
  'landing.featureRolesTitle': 'Roles you define, not roles you inherit',
  'landing.featureRolesBody':
    'A role is a name and a set of ticks — edit every lead, manage the team, change the currency, run the assistant. Build a “regional manager” or a read-only auditor if that is how your team actually works. Everyone still reads the whole pipeline; what they can change is up to you.',
  'landing.featureOwnershipTitle': 'The account is yours to close',
  'landing.featureOwnershipBody':
    'Delete your account whenever you like, and the workspace keeps the work: leads become unassigned, notes keep their text and lose their author. An owner hands the workspace over first — or deletes the whole thing, which is one typed confirmation and genuinely gone.',

  /* What it replaces — the honest comparison, against the tools people
     genuinely use rather than against a strawman competitor. */
  'landing.replaceTitle': 'What it replaces',
  'landing.replaceSubtitle':
    'Nothing here is exotic. It is the work your team already does, somewhere that remembers it.',
  'landing.replaceBefore': 'Today',
  'landing.replaceAfter': 'With LeadPilot',
  'landing.replace1Before': 'A spreadsheet only one person edits confidently',
  'landing.replace1After': 'A shared pipeline the whole team reads the same way',
  'landing.replace2Before': 'Follow-ups split across a notebook and three chat threads',
  'landing.replace2After': 'One overdue list, with whoever has waited longest at the top',
  'landing.replace3Before': 'A monthly total nobody can break down',
  'landing.replace3After': 'Conversion, sources and stage ageing, computed rather than guessed',
  'landing.replace4Before': 'An English-only tool your Arabic-speaking team puts up with',
  'landing.replace4After': 'A fully mirrored Arabic interface, not a translated one',

  'landing.howTitle': 'How it works',
  'landing.howStep1Title': 'Capture the enquiry',
  'landing.howStep1Body':
    'Name, service, value and source in one short form. It lands at the top of the New column.',
  'landing.howStep2Title': 'Assign and chase',
  'landing.howStep2Body':
    'Give it to a rep, log the call, book the follow-up. Every change is on the record.',
  'landing.howStep3Title': 'Close and learn',
  'landing.howStep3Body':
    'Move it to Won, or to Lost with a reason. The dashboard turns both into something you can use.',

  /* Adding people — the mechanics, not the permission model. The roles card
     says what a role is; this says how somebody gets into the workspace. */
  'landing.teamTitle': 'Getting your team in',
  'landing.teamSubtitle':
    'Three steps, and at no point do you invent a password for somebody else.',
  'landing.teamStep1Title': 'Send them a link',
  'landing.teamStep1Body':
    'From the Team screen, create an invite and pick the role it grants. Give it an email address and only that address can redeem it — and we send the link there as well. Leave the address out and it is simply a link, redeemable once by whoever opens it first.',
  'landing.teamStep2Title': 'They set their own password',
  'landing.teamStep2Body':
    'The link opens a short form: their name, a password they choose, and that is the account. Nothing temporary to pass along and nothing for you to type on their behalf — and if the invitation was addressed to them, their email is confirmed the moment they accept it.',
  'landing.teamStep3Title': 'You stay in charge of what they can do',
  'landing.teamStep3Body':
    'Change somebody’s role from the same screen whenever it stops fitting. Deactivate an account and every session it holds ends on the next request. Remove it and the pipeline keeps the work — their leads simply become unassigned.',

  'landing.teamFactsTitle': 'What an invite link actually is',
  'landing.teamFact1': 'Single-use, and it expires after seven days',
  'landing.teamFact2':
    'Shown once, when you create it. Only a hash is stored, so nobody — including you — can look it up again',
  'landing.teamFact3':
    'Revocable at any moment, and every invitation is listed with what became of it',
  'landing.teamFact4': 'Only the owner can hand out a role that manages the team',
  'landing.teamFactsNote':
    'Ownership itself is transferred rather than granted, and there is exactly one owner — the database enforces it, not a promise in the code.',

  'landing.faqTitle': 'Questions people actually ask',
  'landing.faq1Q': 'Do I have to install anything?',
  'landing.faq1A':
    'No. It runs in a browser, on a phone as readily as on a laptop, and the demo opens in a few seconds.',
  'landing.faq2Q': 'Is the demo data really mine?',
  'landing.faq2A':
    'Yes. Starting a demo clones a fresh workspace for you alone. Nothing you change reaches anybody else, and the whole sandbox is deleted afterwards.',
  'landing.faq3Q': 'Does Arabic genuinely work, or is it just translated?',
  'landing.faq3A':
    'The entire interface mirrors — navigation, tables, charts, drag-and-drop — with Arabic dates and its six plural forms. Switch it in the top corner and judge for yourself before signing up for anything.',
  'landing.faq5Q': 'What does the AI see, and can I turn it off?',
  'landing.faq5A':
    'It is off until an owner turns it on, and off again the moment they turn it back. When it runs it is sent the lead’s own fields — the enquiry, service, value, stage and dates — or, for the briefing, the workspace’s figures rather than its customers. No passwords, no other workspace, and nothing is used to train anything.',
  'landing.faq4Q': 'Can the whole team use it at once?',
  'landing.faq4A':
    'That is the point. A lead can be assigned to one person, every change is on the record, and a rep sees the shared pipeline while editing only what is theirs.',

  'landing.ctaTitle': 'Have a look around first.',
  'landing.ctaBody':
    'The demo opens a workspace that is yours alone — {count} leads and a year of history to change however you like. Nobody else sees it, and it is removed after a day.',

  /* The assistant, in its own section: what it is asked, and what it is not
     allowed to do. The feature grid says what it produces. */
  'landing.aiEyebrow': 'The AI assistant',
  'landing.aiTitle': 'Two questions, one assistant.',
  'landing.aiSubtitle':
    'One about the enquiry in front of you, one about everything at once. Both answer in the language you asked in, and both stay off until somebody turns them on.',

  'landing.aiLeadTitle': 'Ask it about one lead',
  'landing.aiLeadBody':
    'It reads what the customer wrote and comes back with the enquiry in two or three sentences, a quality score out of 100 with the reasoning that produced it, how urgent it looks, and a follow-up written for you to send.',
  'landing.aiLeadPoint1': 'A score you can argue with, because it shows its reasons',
  'landing.aiLeadPoint2': 'One next action, on a named channel — call, email, WhatsApp',
  'landing.aiLeadPoint3': 'A reply addressed to the customer, ready to send as it stands',

  'landing.aiWorkspaceTitle': 'Ask it about the whole workspace',
  'landing.aiWorkspaceBody':
    'The briefing that reads your pipeline the way a manager would on a Monday morning: the state of things in a short paragraph, then the specifics — ranked, with reasons, and never more than fits on one screen.',
  'landing.aiWorkspacePoint1': 'Up to five things needing attention, most pressing first',
  'landing.aiWorkspacePoint2': 'Up to three trends, each marked as improving or slipping',
  'landing.aiWorkspacePoint3':
    'One concrete step for today, and a warning when the briefing is stale',

  /* The lead-in is a `{label}` rather than markup in the string, so Arabic can
     put it where Arabic puts it. See `useRichT`. */
  'landing.aiGuardOptInLabel': 'Off by default.',
  'landing.aiGuardOptIn':
    '{label} The assistant does nothing until an owner switches it on for the workspace, and switching it off again stops every part of it.',
  'landing.aiGuardBudgetLabel': 'A daily budget, shared.',
  'landing.aiGuardBudget':
    '{label} Both kinds of analysis draw on one workspace allowance that resets every 24 hours, and what is left is on screen before you spend it.',
  'landing.aiGuardStoredLabel': 'Written once, read free.',
  'landing.aiGuardStored':
    '{label} An answer is saved to the lead or the workspace, so re-reading costs nothing and everyone sees the same one. Delete any of them whenever you like.',

  'landing.footerTagline': 'Bilingual lead management for small and medium service businesses.',
  'landing.footerBuilt': 'Built to production standards.',
  'landing.footerExplore': 'On this page',
  'landing.footerLinkFeatures': 'What it does',
  'landing.footerLinkAssistant': 'The AI assistant',
  'landing.footerLinkTeam': 'Adding your team',
  'landing.footerLinkFaq': 'Questions',
  'landing.footerStart': 'Get started',
  'landing.footerLinkDemo': 'Start a demo',
  'landing.footerLinkSignup': 'Create a workspace',
  'landing.footerLinkSignin': 'Sign in',
  'landing.footerContactTitle': 'Who built this',
  'landing.footerContactBody':
    'LeadPilot is the work of one developer. The portfolio has the rest of it, and the way to get in touch.',
  'landing.footerContact': 'Visit the portfolio',
  'landing.footerRights': '© {year} LeadPilot',

  /* -------------------------------------------------------------- *
   * Bulk selection
   * -------------------------------------------------------------- */
  'bulk.selectAll': 'Select every lead on this page',
  'bulk.selectRow': 'Select {name}',
  'bulk.locked': 'Assigned to someone else — only an owner or admin can change it',
  'bulk.actions': 'Bulk actions',
  'bulk.selected_one': '{count} selected',
  'bulk.selected_other': '{count} selected',
  'bulk.clear': 'Clear',
  'bulk.moveToStage': 'Move to stage',
  'bulk.assignTo': 'Assign to',
  'bulk.archive': 'Archive',
  'bulk.unarchive': 'Unarchive',
  'bulk.restore': 'Restore',
  'bulk.delete': 'Delete',
  'bulk.deleteTitle_one': 'Delete {count} lead?',
  'bulk.deleteTitle_other': 'Delete {count} leads?',
  'bulk.deleteBody_one':
    'They move to the trash, out of every list and report. You can restore them until they are permanently deleted after {count} day.',
  'bulk.deleteBody_other':
    'They move to the trash, out of every list and report. You can restore them until they are permanently deleted after {count} days.',
  'bulk.updated_one': '{count} lead updated',
  'bulk.updated_other': '{count} leads updated',
  'bulk.notPermitted': '{count} left selected — only leads assigned to you can be changed',
  'bulk.alreadyDone': '{count} were already up to date',
  'bulk.noneAllowed': 'None of those leads are yours to change',
  'bulk.nothingToDo': 'Nothing in that selection needed changing',
  'bulk.failed': 'Could not apply that to every lead',
  'bulk.archiveTitle_one': 'Archive {count} lead?',
  'bulk.archiveTitle_other': 'Archive {count} leads?',
  'bulk.archiveBody':
    'They leave the pipeline and every total. Their activity history and follow-ups are kept, and an owner or admin can restore them from the Archived filter.',
  'bulk.markLostTitle_one': 'Mark {count} lead as lost?',
  'bulk.markLostTitle_other': 'Mark {count} leads as lost?',

  /* -------------------------------------------------------------- *
   * Leads list
   * -------------------------------------------------------------- */
  'leads.title': 'Leads',
  'leads.description': 'Every enquiry across {organization}, in one place.',
  'leads.archivedTitle': 'Archived',
  'leads.archivedDescription': 'Filed away from {organization}’s working list, and kept.',
  'leads.trashDescription_one':
    'Deleted leads, restorable until they are permanently removed after {count} day.',
  'leads.trashDescription_other':
    'Deleted leads, restorable until they are permanently removed after {count} days.',
  'leads.backToActive': 'Back to active leads',
  'leads.trashEmptyTitle': 'The trash is empty',
  'leads.trashEmptyBody_one':
    'Deleted leads wait here for {count} day before they are removed for good.',
  'leads.trashEmptyBody_other':
    'Deleted leads wait here for {count} days before they are removed for good.',
  'leads.archivedEmptyTitle': 'Nothing archived',
  'leads.archivedEmptyBody': 'Archiving a lead files it away without losing its history.',
  'leads.newLead': 'New lead',
  'leads.couldNotLoad': 'Could not load leads',
  'leads.noMatchTitle': 'No leads match these filters',
  'leads.noMatchBody': 'Try widening your search, or clear the filters to see the whole pipeline.',
  'leads.emptyTitle': 'No leads yet',
  'leads.emptyBody':
    'Add your first enquiry and it will show up here with its full activity history.',
  'leads.itemLabel': 'leads',

  'leads.column.customer': 'Customer',
  'leads.column.service': 'Service',
  'leads.column.stage': 'Stage',
  'leads.column.value': 'Value',
  'leads.column.priority': 'Priority',
  'leads.column.assignee': 'Rep',
  'leads.column.followUp': 'Next follow-up',
  'leads.column.updated': 'Updated',
  'leads.sortBy': 'Sort by {label}',

  'leads.stat.open': 'Open leads',
  'leads.stat.openHint': '{total} total in view',
  'leads.stat.pipelineValue': 'Pipeline value',
  'leads.stat.pipelineValueHint': 'Estimated value of open leads',
  'leads.stat.won': 'Won',
  'leads.stat.wonHintNoRate': '{count} deals closed',
  'leads.stat.wonHint': '{count} deals · {rate}% win rate',
  'leads.stat.overdue': 'Overdue follow-ups',
  'leads.stat.overdueHint': 'Needs attention today',
  'leads.stat.nothingOverdue': 'Nothing overdue',

  /* -------------------------------------------------------------- *
   * Filters, shared by the table and the board
   * -------------------------------------------------------------- */
  'filters.searchPlaceholder': 'Search name, company, email, phone…',
  'filters.searchLeads': 'Search leads',
  'filters.searchPipeline': 'Search the pipeline…',
  'filters.stage': 'Stage',
  'filters.assignee': 'Assignee',
  'filters.source': 'Source',
  'filters.priority': 'Priority',
  'filters.followUp': 'Filter by follow-up',
  'filters.openOnly': 'Open only',
  'filters.view': 'Which leads',
  'leadView.active': 'Active',
  'leadView.archived': 'Archived',
  'leadView.trash': 'Trash',
  'filters.sort': 'Sort by',
  'filters.sortAscending': 'Sorted ascending — switch to descending',
  'filters.sortDescending': 'Sorted descending — switch to ascending',
  'filters.ascending': 'Ascending',
  'filters.descending': 'Descending',

  'pagination.rows': 'Rows',
  'pagination.rowsPerPage': 'Rows per page',
  'pagination.previous': 'Previous page',
  'pagination.next': 'Next page',
  'pagination.page': 'Page {page} of {total}',
  'pagination.empty': 'No {items}',
  'pagination.range': 'Showing {from}–{to} of {total} {items}',

  /* -------------------------------------------------------------- *
   * Lead detail
   * -------------------------------------------------------------- */
  'lead.allLeads': 'All leads',
  'lead.missing': 'This lead no longer exists',
  'lead.couldNotLoad': 'Could not load this lead',
  'lead.backToLeads': 'Back to leads',
  'lead.edit': 'Edit',
  'lead.editDetails': 'Edit details',
  'lead.moreActions': 'More actions',
  'lead.archive': 'Archive lead',
  'lead.delete': 'Delete lead',
  'lead.deleteTitle': 'Delete {name}?',
  'lead.deleteBody_one':
    'The lead moves to the trash, out of every list and report. Its history is kept, and you can restore it until it is permanently deleted after {count} day.',
  'lead.deleteBody_other':
    'The lead moves to the trash, out of every list and report. Its history is kept, and you can restore it until it is permanently deleted after {count} days.',
  'lead.deleted': 'Moved to the trash',
  'lead.deletedDescription': '{name} is in the trash and can be restored.',
  'lead.couldNotDelete': 'Could not delete that lead',
  'lead.trashedTitle': 'This lead is in the trash',
  'lead.trashedBody_one':
    'Deleted {date}. It will be permanently deleted {count} day after that unless you restore it.',
  'lead.trashedBody_other':
    'Deleted {date}. It will be permanently deleted {count} days after that unless you restore it.',
  'lead.restoreFromTrash': 'Restore',
  'lead.restoredFromTrash': 'Lead restored',
  'lead.couldNotRestoreFromTrash': 'Could not restore that lead',
  'lead.deleteForever': 'Delete permanently',
  'lead.deleteForeverTitle': 'Permanently delete {name}?',
  'lead.deleteForeverBody':
    'This destroys the lead, its whole activity history and every follow-up on it. Nothing here can be recovered.',
  'lead.deleteForeverConfirmLabel': 'Type {name} to confirm',
  'lead.deleteForeverWarning':
    'There is no undo and no backup. The trash is the recovery step, and this is the end of it.',
  'lead.deleteForeverMismatch': 'That does not match the customer’s name',
  'lead.deletedForever': 'Lead permanently deleted',
  'lead.couldNotDeleteForever': 'Could not delete that lead',
  'lead.archivedTitle': 'This lead is archived',
  'lead.archivedBody': 'Archived {date}. It is hidden from the pipeline and from every total.',
  'lead.restore': 'Restore to pipeline',
  'lead.restored': 'Lead restored to the pipeline',
  'lead.couldNotRestore': 'Could not restore this lead',
  'lead.archived': 'Lead archived',
  'lead.archivedDescription': '{name} — its history is kept and an admin can restore it.',
  'lead.couldNotArchive': 'Could not archive this lead',
  'lead.archiveConfirmTitle': 'Archive this lead?',
  'lead.archiveConfirmBody_one':
    '{name} will be removed from the pipeline and from every total. Their {count} activity entry and any follow-ups are kept, and an owner or admin can restore the lead from the Archived filter.',
  'lead.archiveConfirmBody_other':
    '{name} will be removed from the pipeline and from every total. Their {count} activity entries and any follow-ups are kept, and an owner or admin can restore the lead from the Archived filter.',
  'lead.reasonLost': 'Reason lost',

  'lead.logUpdate': 'Log an update',
  'lead.activity': 'Activity',
  'lead.activityAll': 'All',
  'lead.activityNotes': 'Notes & calls',
  'lead.activityShowing': 'Showing {shown} of {total}',
  'lead.activityShowOlder': 'Show older activity',

  'lead.contact': 'Contact',
  'lead.noEmail': 'No email on file',
  'lead.noPhone': 'No phone on file',
  'lead.details': 'Details',
  'lead.assignedRep': 'Assigned rep',
  'lead.estimatedValue': 'Estimated value',
  'lead.requestedService': 'Requested service',
  'lead.source': 'Lead source',
  'lead.priority': 'Priority',
  'lead.nextFollowUp': 'Next follow-up',
  'lead.lastContacted': 'Last contacted',
  'lead.lastContactedHint':
    'Set by the newest logged call, email, meeting or WhatsApp. To change it, log the conversation with the time it happened.',
  'lead.notYet': 'Not yet',
  'lead.created': 'Created',
  'lead.createdBy': 'by {name}',
  'lead.wonOn': 'Won on',
  'lead.pipelineStage': 'Pipeline stage',
  'lead.moving': 'Moving…',
  'lead.movedTo': 'Moved to {stage}',
  'lead.couldNotMove': 'Could not move the lead',
  'lead.markLostTitle': 'Mark this lead as lost?',
  'lead.markLostBody': 'A short reason helps the team spot patterns later. You can leave it blank.',
  'lead.lostReasonLabel': 'Reason',
  'lead.lostReasonPlaceholder': 'Chose a competitor with a shorter payment plan…',
  'lead.markAsLost': 'Mark as lost',
  'lead.assignedTo': 'Assigned to {name}',
  'lead.nowUnassigned': 'Lead is now unassigned',
  'lead.couldNotReassign': 'Could not reassign',

  /* -------------------------------------------------------------- *
   * Lead form
   * -------------------------------------------------------------- */
  'leadForm.editTitle': 'Edit lead',
  'leadForm.createTitle': 'New lead',
  'leadForm.editDescription': 'Update the details for this lead.',
  'leadForm.createDescription': 'Capture an enquiry so it never falls through the cracks.',
  'leadForm.customerName': 'Customer name *',
  'leadForm.customerNamePlaceholder': 'Ahmed Al Mansoori',
  'leadForm.company': 'Company',
  'leadForm.companyPlaceholder': 'Gulf Horizon Holdings',
  'leadForm.email': 'Email',
  'leadForm.emailPlaceholder': 'ahmed@example.com',
  'leadForm.phone': 'Phone',
  'leadForm.phonePlaceholder': '+971 50 123 4567',
  'leadForm.requestedService': 'Requested service *',
  'leadForm.requestedServicePlaceholder': 'Off-plan apartment investment',
  'leadForm.currency': 'Currency',
  'leadForm.estimatedValue': 'Estimated value',
  'leadForm.notes': 'Notes',
  'leadForm.notesPlaceholder': 'Anything the team should know before the first call…',
  'leadForm.save': 'Save changes',
  'leadForm.create': 'Create lead',
  'leadForm.created': 'Lead created',
  'leadForm.updated': 'Lead updated',

  /* -------------------------------------------------------------- *
   * Activity timeline
   * -------------------------------------------------------------- */
  'activity.couldNotLoad': 'Could not load the activity',
  'activity.emptyTitle': 'Nothing logged yet',
  'activity.emptyBody':
    'Add the first note or log a call — everything the team does with this lead shows up here.',
  'activity.someone': 'Someone',
  'activity.teammate': 'A teammate',
  'activity.created': '{actor} created this lead',
  'activity.stageChanged': '{actor} moved the lead from {from} to {to}',
  'activity.assigned': '{actor} assigned this lead to {assignee}',
  'activity.unassigned': '{actor} removed the assigned rep',
  'activity.fieldUpdated': '{actor} updated the {field}',
  'activity.fieldUpdatedTo': '{actor} updated the {field} to {value}',
  'activity.aField': 'a field',
  'activity.followUpScheduled': '{actor} scheduled {title}',
  'activity.followUpScheduledFor': '{actor} scheduled {title} for {date}',
  'activity.followUpCompleted': '{actor} completed {title}',
  'activity.followUpCancelled': '{actor} cancelled {title}',
  'activity.loggedCall': '{actor} logged a call',
  'activity.loggedEmail': '{actor} logged an email',
  'activity.loggedMeeting': '{actor} logged a meeting',
  'activity.loggedWhatsapp': '{actor} logged a WhatsApp message',
  'activity.addedNote': '{actor} added a note',
  'activity.addedEntry': '{actor} added an entry',
  'activity.unknownStage': 'unknown',

  'composer.label': 'Add a note',
  'composer.placeholder': 'What happened? Log a call, an email, or leave a note for the team…',
  'composer.tooLong': 'That is {count} characters too long.',
  'composer.entryType': 'Entry type',
  'composer.submit': 'Add entry',
  'composer.when': 'When',
  'composer.whenHint':
    'For a call or meeting you are logging after the fact. Sets “Last contacted”.',
  'composer.added': 'Added to the timeline',
  'composer.couldNotSave': 'Could not save that',

  /* -------------------------------------------------------------- *
   * Follow-ups
   * -------------------------------------------------------------- */
  'followUp.title': 'Follow-ups',
  'followUp.openCount': '{count} open',
  'followUp.schedule': 'Schedule follow-up',
  'followUp.whatNeedsDoing': 'What needs doing?',
  'followUp.titlePlaceholder': 'Call to confirm viewing time',
  'followUp.due': 'Due',
  'followUp.channel': 'Channel',
  'followUp.notes': 'Notes (optional)',
  'followUp.notesPlaceholder': 'Prefers a call after 6pm…',
  'followUp.submit': 'Schedule',
  'followUp.scheduled': 'Follow-up scheduled',
  'followUp.couldNotSchedule': 'Could not schedule that',
  'followUp.couldNotLoad': 'Could not load follow-ups',
  'followUp.emptyTitle': 'No follow-ups scheduled',
  'followUp.emptyBody': 'Book the next touchpoint so this lead does not go quiet.',
  'followUp.past': 'Past',
  'followUp.cancelled': 'Cancelled',
  'followUp.completedAt': 'Completed {date}',
  'followUp.markComplete': 'Mark “{title}” complete',
  'followUp.cancelOne': 'Cancel “{title}”',
  'followUp.completed': 'Follow-up completed',
  'followUp.couldNotComplete': 'Could not complete that follow-up',
  'followUp.wasCancelled': 'Follow-up cancelled',
  'followUp.couldNotCancel': 'Could not cancel that follow-up',

  /* -------------------------------------------------------------- *
   * Pipeline board
   * -------------------------------------------------------------- */
  'board.title': 'Pipeline',
  'board.description': '{leads} leads · {value} in open pipeline',
  'board.fallbackDescription': 'Every deal in {organization}, by stage.',
  'board.couldNotLoad': 'Could not load the pipeline',
  'board.noMatchTitle': 'No leads match these filters',
  'board.noMatchBody': 'The stages below are still yours — none of them holds a matching lead.',
  'board.emptyTitle': 'Your pipeline is empty',
  'board.emptyBody': 'Add your first enquiry and it will appear in the New column.',
  'board.columnLabel': '{stage} — {count} leads',
  'board.dropHere': 'Drop to move here',
  'board.stageEmpty': 'Nothing in this stage',
  'board.showMore': 'Show {count} more',
  'board.loadedOf': '({shown} of {total})',
  'board.viewAllInTable': 'View all {count} in the table',
  'board.moveToStage': 'Move to stage',
  'board.moveCard': 'Move {name} to another stage',
  'board.reorderCard': 'Reorder {name}',
  'board.locked': 'You cannot move this lead',
  'board.lockedHint': 'Assigned to someone else — only an owner or admin can move it',
  'board.markLostTitle': 'Mark {name} as lost?',
  'board.thisLead': 'this lead',

  /* -------------------------------------------------------------- *
   * Dashboard
   * -------------------------------------------------------------- */
  'dashboard.title': 'Dashboard',
  'dashboard.couldNotLoad': 'Could not load the dashboard',
  'dashboard.reportingFrom': '{organization} · reporting from {date}',
  'dashboard.period': 'Reporting period',
  'dashboard.range.30d': 'Last 30 days',
  'dashboard.range.90d': 'Last 90 days',
  'dashboard.range.12m': 'Last 12 months',
  // Same three ranges phrased to sit inside a sentence.
  'dashboard.rangeInline.30d': 'last 30 days',
  'dashboard.rangeInline.90d': 'last 90 days',
  'dashboard.rangeInline.12m': 'last 12 months',
  'dashboard.previous.30d': '30 days',
  'dashboard.previous.90d': '90 days',
  'dashboard.previous.12m': 'year',

  'dashboard.newLeads': 'New leads',
  'dashboard.newLeadsHint': 'vs. {count} the previous {period}',
  'dashboard.newLeadsExplainer':
    'Leads created in the {range}, compared with the {period} before it.',
  'dashboard.conversionRate': 'Conversion rate',
  'dashboard.conversionNone': 'No deals closed in this period',
  'dashboard.conversionNoPrior': '{count} deals closed · no prior data',
  'dashboard.conversionHint': '{count} deals closed · {rate}% the previous {period}',
  'dashboard.conversionExplainer':
    'Deals won as a share of deals closed — won plus lost — inside the selected period. Open leads are excluded, because a deal that has not been decided is not a loss.',
  'dashboard.expectedRevenue': 'Expected revenue',
  'dashboard.expectedRevenueHint': 'of {value} open pipeline',
  'dashboard.expectedRevenueExplainer':
    'Every open lead’s value multiplied by its stage’s win probability, then summed. A proposal counts for more than an untouched enquiry, so this lands well below the headline pipeline figure — deliberately.',
  'dashboard.wonRevenue': 'Won revenue',
  'dashboard.wonRevenueHint': '{count} deals',
  'dashboard.wonRevenueHintAvg': '{count} deals · {average} average',
  'dashboard.wonRevenueExplainer': 'Value of deals marked Won in the {range}.',
  'dashboard.noPriorData': 'No prior data',
  'dashboard.flat': 'Flat',

  'dashboard.trendTitle': 'Lead flow and closed deals',
  'dashboard.trendDescription': 'New leads per {bucket} against deals won, over the {range}.',
  'dashboard.bucket.week': 'week',
  'dashboard.bucket.month': 'month',
  'dashboard.trendEmptyTitle': 'Nothing in this window',
  'dashboard.trendEmptyBody': 'No leads were created and no deals closed in the period selected.',
  'dashboard.weekOf': 'Week of {label}',
  'dashboard.dealsWon': 'Deals won',
  'dashboard.wonValue': 'Won value',

  'dashboard.followUpsTitle': 'Follow-ups',
  'dashboard.followUpsDescription': 'Open tasks right now — not affected by the reporting period.',
  'dashboard.followUpOverdue': 'Overdue',
  'dashboard.followUpToday': 'Today',
  'dashboard.followUpThisWeek': 'This week',
  'dashboard.followUpLater': 'Later',
  'dashboard.followUpsEmptyTitle': 'Nothing scheduled',
  'dashboard.followUpsEmptyBody': 'Follow-ups you book on a lead show up here.',
  'dashboard.nextUp': 'Next up',
  'dashboard.lead': 'Lead',

  'dashboard.stagesTitle': 'Pipeline by stage',
  'dashboard.stagesDescription': '{count} open leads right now · average time to close {days}',
  'dashboard.stagesFallback': 'Where the open pipeline is sitting right now.',
  'dashboard.pipelineValue': 'Pipeline value',
  'dashboard.weightedLegend': 'Weighted by the stage’s win probability',
  'dashboard.weightedAt': 'Weighted at {percent}%',
  'dashboard.averageAge': 'Average age',
  'dashboard.tableStage': 'Stage',
  'dashboard.tableLeads': 'Leads',
  'dashboard.tableValue': 'Value',
  'dashboard.tableAvgAge': 'Avg age',

  'dashboard.sourcesTitle': 'Lead sources',
  'dashboard.sourcesDescription':
    'Where the {range}’ leads came from, and how well each source converts.',
  'dashboard.sourcesEmptyTitle': 'No leads in this window',
  'dashboard.sourcesEmptyBody':
    'Source attribution appears once leads have been created in the selected period.',
  'dashboard.otherSources': '{count} other sources',
  'dashboard.conversion': 'Conversion',
  'dashboard.conversionOfClosed': '{rate}% of {closed} closed',
  'dashboard.leadsWithShare': '{count} ({share}%)',

  'dashboard.figuresIn': 'Figures are in {currency}, the workspace currency.',
  'dashboard.figuresConverted': 'Figures are in {currency}, converted from {base}.',
  'dashboard.footnote':
    'Pipeline and follow-up panels show the current state; everything else covers the selected period.',
  'dashboard.stagesEmpty': 'No open leads',
  'dashboard.stagesEmptyBody': 'Stage occupancy appears once there are deals still in play.',

  /* -------------------------------------------------------------- *
   * Team
   * -------------------------------------------------------------- */
  'team.title': 'Team',
  'team.description': 'Everyone with access to {organization}.',
  'team.empty': 'No team members yet',
  'team.deactivated': 'Deactivated',
  'team.activeAgo': 'Active {when}',
  'team.neverSignedIn': 'Never signed in',
  'team.footnote':
    'Everyone here can see the whole pipeline. What each person may change comes from their role.',
  'team.footnoteMember': 'Ask an owner or an admin if someone else needs access.',
  'team.manage': 'Manage {name}',
  'team.changeRole': 'Role',
  'team.deactivate': 'Deactivate',
  'team.reactivate': 'Reactivate',
  'team.roleChanged': '{name} is now {role}',
  'team.deactivated_action': '{name} was deactivated and signed out',
  'team.reactivated': '{name} can sign in again',
  'team.couldNotUpdate': 'Could not update that member',

  /* -------------------------------------------------------------- *
   * Enumerations returned by the API
   * -------------------------------------------------------------- */
  'source.WEBSITE': 'Website',
  'source.REFERRAL': 'Referral',
  'source.SOCIAL_MEDIA': 'Social media',
  'source.PAID_ADS': 'Paid ads',
  'source.COLD_CALL': 'Cold call',
  'source.EMAIL_CAMPAIGN': 'Email campaign',
  'source.EVENT': 'Event',
  'source.WALK_IN': 'Walk-in',
  'source.PARTNER': 'Partner',
  'source.MARKETPLACE': 'Marketplace',
  'source.OTHER': 'Other',

  'priority.LOW': 'Low',
  'priority.MEDIUM': 'Medium',
  'priority.HIGH': 'High',
  'priority.URGENT': 'Urgent',

  'stage.NEW': 'New',
  'stage.CONTACTED': 'Contacted',
  'stage.QUALIFIED': 'Qualified',
  'stage.PROPOSAL': 'Proposal',
  'stage.WON': 'Won',
  'stage.LOST': 'Lost',

  'role.OWNER': 'Owner',
  'role.ADMIN': 'Admin',
  'role.MEMBER': 'Sales rep',

  'channel.CALL': 'Call',
  'channel.EMAIL': 'Email',
  'channel.MEETING': 'Meeting',
  'channel.WHATSAPP': 'WhatsApp',
  'channel.SMS': 'SMS',
  'channel.OTHER': 'Other',

  'activityType.NOTE': 'Note',
  'activityType.CALL': 'Call',
  'activityType.EMAIL': 'Email',
  'activityType.MEETING': 'Meeting',
  'activityType.WHATSAPP': 'WhatsApp',
  'activityType.LEAD_CREATED': 'Lead created',
  'activityType.STAGE_CHANGED': 'Stage changed',
  'activityType.ASSIGNED': 'Assignment',
  'activityType.FIELD_UPDATED': 'Details updated',
  'activityType.FOLLOW_UP_SCHEDULED': 'Follow-up scheduled',
  'activityType.FOLLOW_UP_COMPLETED': 'Follow-up completed',
  'activityType.FOLLOW_UP_CANCELLED': 'Follow-up cancelled',

  'leadField.customerName': 'customer name',
  'leadField.company': 'company',
  'leadField.email': 'email',
  'leadField.phone': 'phone',
  'leadField.requestedService': 'requested service',
  'leadField.estimatedValue': 'estimated value',
  'leadField.currency': 'currency',
  'leadField.priority': 'priority',
  'leadField.source': 'lead source',

  'sort.updatedAt': 'Last updated',
  'sort.createdAt': 'Date created',
  'sort.customerName': 'Customer name',
  'sort.company': 'Company',
  'sort.estimatedValue': 'Estimated value',
  'sort.nextFollowUpAt': 'Next follow-up',
  'sort.lastActivityAt': 'Last activity',
  'sort.stage': 'Pipeline stage',
  'sort.priority': 'Priority',

  'followUpFilter.any': 'Any follow-up',
  'followUpFilter.overdue': 'Overdue',
  'followUpFilter.today': 'Due today',
  'followUpFilter.week': 'Due this week',
  'followUpFilter.none': 'No follow-up set',

  /* -------------------------------------------------------------- *
   * Currency
   * -------------------------------------------------------------- */
  'currency.USD': 'US dollar',
  'currency.EUR': 'Euro',
  'currency.GBP': 'British pound',
  'currency.SAR': 'Saudi riyal',
  'currency.AED': 'UAE dirham',
  'currency.EGP': 'Egyptian pound',
  'currency.QAR': 'Qatari riyal',
  'currency.KWD': 'Kuwaiti dinar',

  'currency.mixedTotals': 'Totals in more than one currency',
  'currency.viewConverted': 'Convert to one currency',
  'currency.viewBreakdown': 'Keep each currency separate',
  'currency.display': 'Display currency',
  'currency.displayHint':
    'Figures are stored in the workspace currency and converted for you. Nothing you see here changes what anyone else sees.',
  'currency.followWorkspace': 'Workspace currency',
  'currency.followWorkspaceWith': 'Workspace currency ({code})',
  'currency.convertedFrom': 'Converted from {from}',
  'currency.ratesAsOf': 'Rates as of {date}',
  'currency.ratesIndicative': 'Live rates are unavailable — these are indicative.',
  'currency.attribution': 'Exchange rates from exchangerate-api.com',
  'currency.original': 'Originally {amount}',
  'currency.converting': 'Loading rates…',

  /* -------------------------------------------------------------- *
   * Follow-up inbox
   * -------------------------------------------------------------- */
  'followUp.inboxTitle': 'Follow-ups',
  'followUp.inboxDescription': 'Everything owed to a lead, soonest first.',
  'followUp.itemLabel': 'follow-ups',
  'followUp.searchPlaceholder': 'Search follow-ups or customers…',

  'bucket.overdue': 'Overdue',
  'bucket.today': 'Today',
  'bucket.week': 'Next 7 days',
  'bucket.later': 'Later',
  'bucket.done': 'Completed',
  'bucket.cancelled': 'Cancelled',
  'bucket.trash': 'Trash',

  'followUpSort.dueAt': 'Due date',
  'followUpSort.createdAt': 'Date added',
  'followUpSort.title': 'Title',
  'followUpSort.customerName': 'Customer',
  'followUpSort.assignee': 'Assignee',

  'followUp.emptyWorkspace': 'No follow-ups yet',
  'followUp.emptyWorkspaceBody':
    'Open a lead and book the next call, email or viewing. Whatever you promise shows up here.',
  'followUp.goToLeads': 'Go to your leads',
  'followUp.emptyOverdue': 'Nothing overdue',
  'followUp.emptyOverdueBody': 'Every promise you have made is still in the future.',
  'followUp.emptyToday': 'Nothing due today',
  'followUp.emptyTodayBody': 'Check the next seven days to see what is coming.',
  'followUp.emptyWeek': 'Nothing due this week',
  'followUp.emptyWeekBody': 'Open a lead and book the next touchpoint.',
  'followUp.emptyLater': 'Nothing booked further out',
  'followUp.emptyLaterBody': 'Long-horizon follow-ups will appear here.',
  'followUp.emptyDone': 'Nothing completed yet',
  'followUp.emptyDoneBody': 'Follow-ups you finish are kept here.',
  'followUp.emptyCancelled': 'Nothing cancelled',
  'followUp.emptyCancelledBody':
    'A cancelled follow-up stays on its lead’s record rather than disappearing.',
  'followUp.emptyTrash': 'The trash is empty',
  'followUp.emptyTrashBody': 'Deleted follow-ups wait here before they are gone for good.',
  'followUp.emptyFiltered': 'No follow-ups match those filters',
  'followUp.emptyFilteredBody': 'Try a different bucket, or clear the search.',

  'followUp.reschedule': 'Reschedule',
  'followUp.rescheduleTitle': 'Reschedule “{title}”',
  'followUp.rescheduleBody': 'Pick a new date and time. The lead keeps its history.',
  'followUp.rescheduled': 'Follow-up rescheduled',
  'followUp.couldNotReschedule': 'Could not reschedule that follow-up',
  'followUp.snoozeTomorrow': 'Tomorrow',
  'followUp.snoozeWeek': 'Next week',

  'followUp.completeTitle': 'Complete “{title}”',
  'followUp.completeBody':
    'Add what happened, if it is worth recording. It goes on the lead’s timeline.',
  'followUp.outcome': 'Outcome (optional)',
  'followUp.outcomePlaceholder': 'Spoke to Layla — sending the revised quote on Monday.',
  'followUp.completeAction': 'Mark complete',
  'followUp.cancelAction': 'Cancel follow-up',

  'followUp.locked': 'Only the lead’s owner or a manager can change this',
  'followUp.more': 'More actions',
  'followUp.delete': 'Delete',
  'followUp.deleted': 'Moved to the trash',
  'followUp.couldNotDelete': 'Could not delete that follow-up',
  'followUp.restore': 'Restore',
  'followUp.restored': 'Follow-up restored',
  'followUp.couldNotRestore': 'Could not restore that follow-up',
  'followUp.deleteForever': 'Delete permanently',
  'followUp.deleteForeverTitle': 'Delete “{title}” for good?',
  'followUp.deleteForeverBody':
    'This removes the follow-up and its record of what was promised. It cannot be undone.',
  'followUp.deletedForever': 'Follow-up deleted permanently',
  'followUp.couldNotDeleteForever': 'Could not delete that follow-up',
  'followUp.deletedWhen': 'Deleted {when}',
  'followUp.trashNotice_one': 'Anything left here is deleted permanently after {count} day.',
  'followUp.trashNotice_other': 'Anything left here is deleted permanently after {count} days.',
  'followUp.assignedToLabel': 'Assigned to {name}',
  'followUp.wasCompletedBy': 'Completed {when}',
  'followUp.wasCancelledOn': 'Cancelled',

  /* -------------------------------------------------------------- *
   * Settings
   * -------------------------------------------------------------- */
  'nav.settings': 'Settings',
  'settings.title': 'Settings',
  'settings.description': 'Your account, and how this workspace behaves.',
  'settings.tabProfile': 'Profile',
  'settings.tabWorkspace': 'Workspace',

  'settings.profileTitle': 'Your profile',
  'settings.profileBody': 'How you appear to the rest of the team.',
  'settings.fieldName': 'Name',
  'settings.fieldEmail': 'Email',
  'settings.emailHint': 'Sign-in email. Changing it is not supported yet.',
  'settings.fieldRole': 'Role',
  'settings.roleHint': 'Only a workspace owner can change roles, on the Team screen.',
  'settings.save': 'Save changes',
  'settings.saved': 'Saved',
  'settings.noChanges': 'Nothing to save',
  'settings.couldNotSave': 'Could not save your changes',

  'settings.passwordTitle': 'Password',
  'settings.passwordBody':
    'Changing your password ends every session, including this one. You will be asked to sign in again.',
  'settings.currentPassword': 'Current password',
  'settings.newPassword': 'New password',
  'settings.changePassword': 'Change password',
  'settings.passwordChanged': 'Password changed. Sign in again with your new one.',

  'settings.workspaceTitle': 'Workspace',
  'settings.workspaceBody': 'Settings everyone in {organization} shares.',
  'settings.fieldWorkspaceName': 'Workspace name',
  'settings.fieldSlug': 'Workspace address',
  'settings.slugHint': 'Set when the workspace was created, and fixed after that.',
  'settings.createdOn': 'Created {date}',
  'settings.statMembers_one': '{count} member',
  'settings.statMembers_other': '{count} members',
  'settings.statLeads_one': '{count} lead',
  'settings.statLeads_other': '{count} leads',
  'settings.statArchived_one': '{count} archived',
  'settings.statArchived_other': '{count} archived',
  'settings.readOnly': 'Only an owner or admin can change these.',
  'settings.couldNotLoad': 'Could not load your settings',

  'settings.historyTitle': 'Workspace history',
  'settings.historyBody': 'Changes that affect everyone’s data, and who made them.',
  'settings.historyEmpty': 'Nothing has changed yet',
  'settings.historyEmptyBody':
    'Workspace-wide changes — like converting the base currency — are recorded here.',
  'settings.eventCurrencyChanged': 'Changed the base currency from {from} to {to}',
  'settings.eventCurrencyDetail_one': '{count} lead restated at 1 {from} = {rate} {to}',
  'settings.eventCurrencyDetail_other': '{count} leads restated at 1 {from} = {rate} {to}',
  'settings.eventOwnershipTransferred': 'Ownership transferred to {name}',
  'settings.eventMemberInvited': '{name} was invited as {role}',
  'settings.eventInviteAccepted': '{name} joined as {role}',
  'settings.eventInviteRevoked': 'The invitation for {name} was revoked',
  'settings.eventRoleChanged': '{name} is now {role}',
  'settings.eventMemberRemoved': '{name} was removed from the workspace',
  'settings.eventRoleCreated': 'The role {name} was created',
  'settings.eventRoleUpdated': 'The role {name} was changed',
  'settings.eventRoleDeleted': 'The role {name} was deleted',
  'settings.eventRoleDeletedMoved': 'The role {name} was deleted, and its members became {role}',
  'settings.eventAccountDeleted': '{name} deleted their account',
  'settings.eventUnknown': 'Workspace change',
  'settings.eventByRemovedMember': 'A former member',
  'settings.couldNotLoadHistory': 'Could not load the workspace history',

  'settings.baseCurrencyTitle': 'Base currency',
  'settings.baseCurrencyBody':
    'Every lead in this workspace is recorded in this currency. Changing it converts the amounts already stored.',
  'settings.baseCurrencyOwnerOnly': 'Only the workspace owner can change the base currency.',
  'settings.changeCurrency': 'Change base currency',
  'settings.currencyDialogTitle': 'Convert this workspace to {code}?',
  'settings.currencyDialogLead':
    'This restates the stored value of every lead, including archived ones. It cannot be undone automatically — converting back would round a second time.',
  'settings.currencyRate': 'Rate applied',
  'settings.currencyAffected': 'Leads affected',
  'settings.currencyTotalBefore': 'Pipeline now',
  'settings.currencyTotalAfter': 'Pipeline after',
  'settings.currencyIndicative':
    'The live rate feed is unavailable, so this uses the indicative rates built into the app. The conversion cannot be undone — consider waiting until live rates are back.',
  'settings.currencyConfirm': 'I understand — convert them',
  'settings.currencyChanged_one': 'Workspace currency changed. {count} lead converted.',
  'settings.currencyChanged_other': 'Workspace currency changed. {count} leads converted.',
  'settings.couldNotChangeCurrency': 'Could not change the workspace currency',
  'settings.currencyUnchanged': 'That is already the workspace currency',
  'settings.demoNotice':
    'This is a demo workspace. Change anything you like — it is yours alone, and it disappears when the sandbox does.',

  /* -------------------------------------------------------------- *
   * AI lead assistant
   * -------------------------------------------------------------- */
  'ai.title': 'AI assistant',
  'ai.emptyTitle': 'Read this inquiry for me',
  'ai.emptyBody':
    'Summarise what the customer is asking for, score the opportunity, and draft a reply you can send.',
  'ai.analyze': 'Analyse this lead',
  'ai.analyzing': 'Reading the inquiry…',
  'ai.reanalyze': 'Analyse again',
  'ai.quality': 'Lead quality',
  'ai.scoreOutOf': '{score} out of 100',
  'ai.urgencyLabel': 'Urgency',
  // Separate from `priority.*` on purpose: the rep's priority flag and the
  // assistant's urgency are two different opinions about the same lead, and the
  // page shows both. Sharing one label set would imply they always agree.
  'aiUrgency.LOW': 'Can wait',
  'aiUrgency.MEDIUM': 'This week',
  'aiUrgency.HIGH': 'Soon',
  'aiUrgency.CRITICAL': 'Today',
  'ai.signals': 'What this rests on',
  'ai.nextStep': 'Recommended next step',
  'ai.draftVia': 'Draft reply · {channel}',
  'ai.copy': 'Copy',
  'ai.copied': 'Draft copied',
  'ai.copyFailed': 'Could not copy — select the text and copy it manually',
  'ai.discard': 'Discard analysis',
  'ai.discarded': 'Analysis discarded',
  'ai.couldNotDiscard': 'Could not discard the analysis',
  'ai.by': 'Analysed {time} by {name}',
  'ai.byUnknown': 'Analysed {time}',
  'ai.disclaimer': 'Written by AI from what is on this lead. Check it before you act on it.',
  'ai.staleTitle': 'This lead has changed since it was analysed',
  'ai.staleBody': 'Run it again to take the newer details into account.',
  'ai.otherLanguageTitle': 'This analysis was written in another language',
  'ai.otherLanguageBody': 'Run it again to get it in the language you are reading.',
  'ai.failedTitle': 'Could not analyse this lead',
  'ai.remaining_one': '{count} analysis left today',
  'ai.remaining_other': '{count} analyses left today',
  'ai.quotaSpentTitle': 'No analyses left today',
  'ai.quotaSpentBody':
    'This workspace can run {count} a day. Each one frees up 24 hours after it was run.',
  'ai.offTitle': 'The assistant is switched off',
  'ai.offBody': 'It sends lead details to an outside service, so a workspace has to opt in first.',
  'ai.offOwnerHint': 'Turn it on in workspace settings.',
  'ai.unconfiguredTitle': 'The assistant is not set up',
  'ai.unconfiguredBody':
    'This deployment has no AI provider configured, so analysis is unavailable.',
  'ai.notYours': 'Only the rep this lead is assigned to, or a manager, can analyse it.',
  'ai.notForArchived': 'Restore this lead to analyse it.',

  /* -------------------------------------------------------------- *
   * AI settings
   * -------------------------------------------------------------- */
  'settings.aiTitle': 'AI assistant',
  'settings.aiDescription':
    'Summarises an inquiry, scores it, and drafts a reply — on the lead page, when someone asks for it.',
  'settings.aiEnable': 'Enable the AI assistant',
  'settings.aiEnabled': 'The assistant is on for this workspace',
  'settings.aiDisabled': 'The assistant is off. Nothing is sent anywhere.',
  'settings.aiPrivacyTitle': 'What leaves this workspace',
  'settings.aiPrivacyBody':
    'Turning this on sends the lead’s details — the customer’s name, what they asked for, and recent notes — to {provider} when someone runs an analysis. Nothing is sent until they do.',
  'settings.aiTrainingWarning':
    '{provider}’s free tier uses what it receives to improve their products. Do not enable this for a workspace holding customer data you cannot share.',
  'settings.aiUsage': '{used} of {limit} analyses used in the last 24 hours',
  'settings.aiUnconfigured':
    'No AI provider is configured on this deployment, so the assistant cannot run even when enabled.',
  'settings.aiTurnedOn': 'The AI assistant is on',
  'settings.aiTurnedOff': 'The AI assistant is off',
  'settings.couldNotChangeAi': 'Could not change the assistant setting',
  'settings.aiManagerOnly': 'Only an owner or admin can change this.',

  /* -------------------------------------------------------------- *
   * AI workspace summary
   * -------------------------------------------------------------- */
  'aiSummary.title': 'What needs your attention',
  'aiSummary.emptyTitle': 'Read the whole pipeline for me',
  'aiSummary.emptyBody':
    'What needs acting on today, what is moving, and the one thing worth doing first — across every lead, not one.',
  'aiSummary.generate': 'Summarise my workspace',
  'aiSummary.regenerate': 'Refresh',
  'aiSummary.working': 'Reading your pipeline…',
  'aiSummary.attention': 'Needs attention',
  'aiSummary.trends': 'What is moving',
  'aiSummary.nextStep': 'Start here',
  'aiSummary.failedTitle': 'Could not summarise your workspace',
  'aiSummary.staleTitle': 'Your pipeline has changed since this was written',
  'aiSummary.staleBody': 'Refresh it to take the newer figures into account.',
  'aiSummary.discarded': 'Summary discarded',
  'aiSummary.disclaimer':
    'Written by AI from your own figures. Check anything before you act on it.',
  'aiSeverity.URGENT': 'Today',
  'aiSeverity.WATCH': 'This week',
  'aiSeverity.INFO': 'Worth knowing',

  /* -------------------------------------------------------------- *
   * Email verification, password reset and invitations
   * -------------------------------------------------------------- */
  'auth.signedUpCheckEmail':
    'Your workspace is ready. We’ve sent a link to confirm your email — sign in below to get started.',
  'auth.signedUpNoEmail':
    'Your workspace is ready. Sign in below with the password you just chose.',
  'auth.formBlocked': 'Something on this form is not valid. Refresh the page and try again.',
  'auth.forgotPassword': 'Forgot password?',
  'auth.forgotTitle': 'Reset your password',
  'auth.forgotSubtitle': 'We’ll email you a link to choose a new one.',
  'auth.sendResetLink': 'Send the link',
  'auth.backToSignIn': 'Back to sign in',
  'auth.checkYourInbox': 'Check your inbox',
  'auth.resetSentBody': 'If we found an account, a link is on its way.',
  // Deliberately says nothing about whether the address exists — the API is
  // equally quiet, and a more helpful sentence here would undo that.
  'auth.resetSentNeutral':
    'If an account exists for that address, we’ve sent a link to reset the password. It works once and expires in 24 hours.',
  'auth.linkNotValid': 'This link is no longer valid',
  'auth.linkNotValidBody': 'It may have already been used, or it may have expired.',
  'auth.requestNewLink': 'Request a new link',
  'auth.resetTitle': 'Choose a new password',
  'auth.resetSubtitle': 'This will sign you out everywhere else.',
  'auth.newPassword': 'New password',
  'auth.setNewPassword': 'Save the new password',
  'auth.passwordReset': 'Password updated. Sign in with your new one.',
  'auth.verifying': 'Confirming your email…',
  'auth.verifyingBody': 'This will only take a moment.',
  'auth.verifiedTitle': 'Email confirmed',
  'auth.verifiedBody': 'Thanks — your address is confirmed and your account is fully recoverable.',
  'auth.continueToWorkspace': 'Continue to the workspace',
  'auth.unverifiedTitle': 'Confirm your email address',
  'auth.unverifiedBody':
    'Your account works normally. Confirming just means you can recover it if you ever lose your password.',
  'auth.resendVerification': 'Resend the link',
  'auth.verificationResent': 'Sent — check your inbox.',
  'auth.couldNotResend': 'Could not send the link',
  'auth.dismiss': 'Dismiss',

  'invite.loadingTitle': 'Opening your invitation…',
  'invite.invalidTitle': 'This invitation is no longer valid',
  'invite.invalidBody':
    'It may have been used already, revoked, or expired. Ask whoever invited you for a new link.',
  'invite.title': 'Join {workspace}',
  'invite.subtitle': 'You’ve been invited as {role}. Choose a password to get started.',
  'invite.subtitleFrom': '{name} invited you as {role}. Choose a password to get started.',
  'invite.accept': 'Join the workspace',

  'inviteState.PENDING': 'Waiting',
  'inviteState.ACCEPTED': 'Joined',
  'inviteState.REVOKED': 'Revoked',
  'inviteState.EXPIRED': 'Expired',

  'team.role': 'Role',
  'team.invitePeople': 'Invite people',
  'team.inviteTitle': 'Invite someone',
  'team.inviteBody': 'Create a link they can use once to join this workspace.',
  'team.inviteEmailLabel': 'Email address (optional)',
  'team.inviteBoundHint': 'Only this address can use the link, and we’ll email it to them.',
  'team.inviteOpenHint': 'Anyone with the link can use it — once. You share it yourself.',
  'team.inviteDemoLinkOnly':
    'This demo workspace creates links only. Emailing an invitation is switched off here; share the link yourself.',
  'team.createInvite': 'Create the link',
  'team.inviteReadyTitle': 'Invitation ready',
  'team.inviteSentTo': 'We’ve emailed the link to {email}.',
  'team.inviteNotEmailed': 'Bound to {email}, but we could not email it — copy it below.',
  'team.inviteLinkBody': 'Share this link with the person you want to add.',
  'team.inviteLink': 'Invitation link',
  'team.inviteLinkOnce':
    'Copy it now — it is stored hashed, so it cannot be shown again. You can always revoke it and make another.',
  'team.linkCopied': 'Link copied',
  'team.couldNotInvite': 'Could not create the invitation',
  'team.invitations': 'Invitations',
  'team.invitationsBody': 'Who has been asked to join, and what became of it.',
  'team.noInvitations': 'No invitations yet',
  'team.noInvitationsBody': 'Invite someone and it will show up here.',
  'team.inviteAnyoneWithLink': 'Anyone with the link',
  'team.inviteMeta': '{role} · invited by {by} · {date}',
  'team.someone': 'someone',
  'team.revokeInvite': 'Revoke this invitation',
  'team.inviteRevoked': 'Invitation revoked',
  'team.couldNotRevoke': 'Could not revoke the invitation',
  'team.makeOwner': 'Make workspace owner',
  'team.remove': 'Remove from workspace',
  'team.removeTitle': 'Remove {name}?',
  'team.removeBody':
    'They will be signed out immediately and lose access. Their name stays on the leads and notes they worked on.',
  'team.removed': '{name} was removed',
  'team.couldNotRemove': 'Could not remove that person',
  'team.transferTitle': 'Make {name} the owner?',
  'team.transferBody':
    'There is one owner per workspace, so you will become an admin. Only {name} will be able to hand it back.',
  'team.transferConfirmLabel': 'Type {name} to confirm',
  'team.transferred': '{name} is now the workspace owner',
  'team.couldNotTransfer': 'Could not transfer ownership',

  'common.done': 'Done',

  /* -------------------------------------------------------------- *
   * Dates
   * -------------------------------------------------------------- */
  'due.none': 'No follow-up',
  'due.overdue_one': 'Overdue by {count} day',
  'due.overdue_other': 'Overdue by {count} days',
  'due.today': 'Today, {time}',
  'due.tomorrow': 'Tomorrow, {time}',
  'relative.justNow': 'just now',

  /* -------------------------------------------------------------- *
   * Roles and permissions
   * -------------------------------------------------------------- */
  'common.listSeparator': ', ',

  'roles.title': 'Roles',
  'roles.body': 'What each role in this workspace is allowed to do. Only you can change these.',
  'roles.new': 'New role',
  'roles.empty': 'No roles yet',
  'roles.builtIn': 'Built-in',
  'roles.everything': 'Everything, including the things that cannot be delegated.',
  'roles.nonePermissions': 'Can work on their own leads, and nothing else.',
  'roles.memberCount_one': '{count} person',
  'roles.memberCount_other': '{count} people',
  'roles.manage': 'Manage {name}',
  'roles.edit': 'Edit',
  'roles.rename': 'Rename',
  'roles.delete': 'Delete role',
  'roles.newTitle': 'New role',
  'roles.editTitle': 'Edit role',
  'roles.dialogBody':
    'Name it in both languages, and tick what it may do. Everyone holding this role is affected as soon as you save.',
  'roles.ownerFixed':
    'The owner role always has every permission, so there is nothing to tick. You can still rename it.',
  'roles.fieldName': 'Name',
  'roles.fieldNameAr': 'Name in Arabic',
  'roles.permissionsLegend': 'This role can',
  'roles.create': 'Create role',
  'roles.save': 'Save role',
  'roles.couldNotSave': 'Could not save that role',
  'roles.deleteTitle': 'Delete {name}?',
  'roles.deleteBody': 'Nobody holds this role, so nothing else changes.',
  'roles.deleteBodyInUse_one':
    '{count} person holds this role. Choose what they become before it goes.',
  'roles.deleteBodyInUse_other':
    '{count} people hold this role. Choose what they become before it goes.',
  'roles.deleteBodyReferenced':
    'Nobody holds this role, but past invitations still refer to it. Choose which role they should point to instead.',
  'roles.moveTo': 'Move them to',
  'roles.moveToPlaceholder': 'Pick a role',
  'roles.couldNotDelete': 'Could not delete that role',

  'permission.MANAGE_TEAM': 'Manage the team',
  'permission.MANAGE_WORKSPACE': 'Change workspace settings',
  'permission.CHANGE_CURRENCY': 'Change the base currency',
  'permission.EDIT_ALL_LEADS': 'Edit every lead',
  'permission.DELETE_LEADS': 'Archive and delete leads',
  'permission.MANAGE_AI': 'Manage the AI assistant',
  'permissionHint.MANAGE_TEAM': 'Invite people, change their role, and remove them.',
  'permissionHint.MANAGE_WORKSPACE': 'Rename the workspace and edit its details.',
  'permissionHint.CHANGE_CURRENCY': 'Restate every stored amount in another currency.',
  'permissionHint.EDIT_ALL_LEADS': 'Not just the ones they own or created.',
  'permissionHint.DELETE_LEADS': 'Move leads to the trash, and empty it.',
  'permissionHint.MANAGE_AI': 'Switch the assistant on or off for everyone.',

  /* -------------------------------------------------------------- *
   * Closing an account, and closing the workspace
   * -------------------------------------------------------------- */
  'danger.title': 'Delete your account',
  'danger.body': 'Permanent, and it cannot be undone from here.',
  'danger.whatSurvives':
    'Your sign-in goes. The leads you were working on stay with the workspace and become unassigned, and the notes you wrote keep their text but no longer carry your name.',
  'danger.ownerBlocked_one':
    'You own this workspace and {count} other person is in it. Hand it over on the Team screen, or delete the whole workspace below, before you can delete your account.',
  'danger.ownerBlocked_other':
    'You own this workspace and {count} other people are in it. Hand it over on the Team screen, or delete the whole workspace below, before you can delete your account.',
  'danger.lastMemberNotice':
    'You are the only person here, so deleting your account deletes this workspace and everything in it.',
  'danger.deleteAccount': 'Delete my account',
  'danger.deleteWorkspace': 'Delete the workspace',
  'danger.accountDialogTitle': 'Delete your account?',
  'danger.accountDialogBody':
    'This cannot be undone. Your leads stay with the workspace and become unassigned; your notes keep their text and lose their author.',
  'danger.accountDialogBodyLast':
    'This cannot be undone, and you are the only person here — the workspace, its leads and its history go with your account.',
  'danger.workspaceDialogTitle': 'Delete {name}?',
  'danger.workspaceDialogBody':
    'Everyone loses access immediately, and nothing here can be restored — not even from the trash, which lives inside the workspace it would be restored to.',
  'danger.workspaceCounts': 'This deletes {members} and {leads}.',
  'danger.typeEmail': 'Type {email} to confirm',
  'danger.typeName': 'Type {name} to confirm',
  'danger.yourPassword': 'Your password',
  'danger.confirmAccount': 'Delete my account',
  'danger.confirmWorkspace': 'Delete this workspace',
  'danger.couldNotDeleteAccount': 'Could not delete your account',
  'danger.couldNotDeleteWorkspace': 'Could not delete the workspace',
} as const;
