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
  'apiError.LAST_OWNER': 'A workspace must always have an owner',
  'apiError.CANNOT_DEACTIVATE_SELF': 'You cannot deactivate your own account',
  'apiError.FOLLOW_UP_NOT_YOURS': 'You can only change follow-ups on your own leads',
  'apiError.NOT_FOUND': 'That record no longer exists',
  'apiError.VALIDATION_ERROR': 'Some fields need your attention',
  'apiError.RATE_LIMITED': 'Too many requests. Please try again shortly.',
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
    'Small teams rarely lose a deal to a better competitor. They lose it to a message nobody answered. LeadPilot is one shared place to capture every enquiry, give it an owner, and make sure somebody actually follows up.',
  'landing.heroNote': 'No card, no signup. The demo opens a private workspace with real data.',
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
  'landing.featuresSubtitle': 'Six things, done properly, instead of forty half-built ones.',

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
  'landing.featureOwnershipTitle': 'Everyone can see it, owners change it',
  'landing.featureOwnershipBody':
    'Reps read the whole pipeline and edit the leads that are theirs; managers edit anything. Nothing is hidden from the team, and nothing gets overwritten by accident.',

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
  'landing.faq4Q': 'Can the whole team use it at once?',
  'landing.faq4A':
    'That is the point. Every lead has one owner, every change is on the record, and a rep sees the shared pipeline while editing only what is theirs.',

  'landing.ctaTitle': 'Have a look around first.',
  'landing.ctaBody':
    'The demo opens a workspace that is yours alone — {count} leads and a year of history to change however you like. Nobody else sees it, and it is removed after a day.',

  'landing.footerTagline': 'Bilingual lead management for small and medium service businesses.',
  'landing.footerBuilt': 'A portfolio project, built to production standards.',

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
  'bulk.restore': 'Restore',
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
  'filters.archived': 'Archived',
  'filters.archivedTitle': 'Show leads that have been archived',
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
    'Invitations are not built yet — a new member joins by creating an account against this workspace.',
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
  'followUp.assigneeAll': 'Everyone',
  'followUp.assigneeMine': 'Assigned to me',

  'bucket.overdue': 'Overdue',
  'bucket.today': 'Today',
  'bucket.week': 'Next 7 days',
  'bucket.later': 'Later',
  'bucket.done': 'Done',

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
  'followUp.emptyDoneBody': 'Completed and cancelled follow-ups are kept here.',
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
  'settings.currencyConfirm': 'I understand — convert them',
  'settings.currencyChanged_one': 'Workspace currency changed. {count} lead converted.',
  'settings.currencyChanged_other': 'Workspace currency changed. {count} leads converted.',
  'settings.couldNotChangeCurrency': 'Could not change the workspace currency',
  'settings.currencyUnchanged': 'That is already the workspace currency',
  'settings.demoNotice':
    'This is a demo workspace. Change anything you like — it is yours alone, and it disappears when the sandbox does.',

  /* -------------------------------------------------------------- *
   * Dates
   * -------------------------------------------------------------- */
  'due.none': 'No follow-up',
  'due.overdue_one': 'Overdue by {count} day',
  'due.overdue_other': 'Overdue by {count} days',
  'due.today': 'Today, {time}',
  'due.tomorrow': 'Tomorrow, {time}',
  'relative.justNow': 'just now',
} as const;
