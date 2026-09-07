/**
 * Static content for the demo workspace.
 *
 * Kept separate from seed.ts so the generator logic stays readable, and so the
 * copy can be reviewed (and later translated for Phase 3) on its own.
 */

export const DEMO_PASSWORD = 'DemoPass2026';

export interface SeedUser {
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  avatarColor: string;
}

/** A small Gulf real-estate agency — the kind of team this product is sold to. */
export const DEMO_ORG = {
  name: 'Meridian Property Group',
  slug: 'meridian-property-group',
  defaultCurrency: 'AED',
};

export const DEMO_USERS: SeedUser[] = [
  { email: 'demo@leadpilot.app', name: 'Layla Haddad', role: 'OWNER', avatarColor: '#2563eb' },
  { email: 'omar@leadpilot.app', name: 'Omar Khalil', role: 'ADMIN', avatarColor: '#7c3aed' },
  { email: 'sara@leadpilot.app', name: 'Sara Mansour', role: 'MEMBER', avatarColor: '#db2777' },
  { email: 'daniel@leadpilot.app', name: 'Daniel Reyes', role: 'MEMBER', avatarColor: '#ea580c' },
  { email: 'yousef@leadpilot.app', name: 'Yousef Al Rashid', role: 'MEMBER', avatarColor: '#059669' },
  { email: 'nina@leadpilot.app', name: 'Nina Petrova', role: 'MEMBER', avatarColor: '#0891b2' },
];

/** A second tenant, so cross-organisation isolation can be demonstrated. */
export const SECONDARY_ORG = {
  name: 'Northwind Consulting',
  slug: 'northwind-consulting',
  defaultCurrency: 'USD',
};

export const SECONDARY_USERS: SeedUser[] = [
  { email: 'owner@northwind.test', name: 'Grace Okafor', role: 'OWNER', avatarColor: '#4f46e5' },
  { email: 'rep@northwind.test', name: 'Tomas Nyberg', role: 'MEMBER', avatarColor: '#c026d3' },
];

export const SERVICES = [
  'Off-plan apartment investment',
  'Villa purchase — Palm Jumeirah',
  'Commercial office leasing',
  'Property valuation report',
  'Short-term rental management',
  'Warehouse lease — Jebel Ali',
  'Townhouse resale listing',
  'Portfolio acquisition advisory',
  'Retail unit fit-out & lease',
  'Golden visa property package',
  'Mortgage pre-approval support',
  'Land plot acquisition',
  'Serviced apartment block',
  'Holiday home management',
  'Tenant sourcing — 2BR unit',
];

export const CONTACT_NAMES = [
  'Ahmed Al Mansoori', 'Fatima Zahra Benali', 'James Whitfield', 'Noura Al Suwaidi',
  'Marcus Lindqvist', 'Hana Al Fardan', 'Priya Raghunathan', 'Karim Boutros',
  'Elena Vasquez', 'Rashid Al Nuaimi', 'Sophie Duval', 'Tariq Hameed',
  'Mei Ling Chen', 'Abdullah Al Ghamdi', 'Isabella Rossi', 'Yara Chalhoub',
  'Viktor Sokolov', 'Amira El Sayed', 'Daniel O’Connor', 'Zainab Karimi',
  'Lucas Ferreira', 'Huda Al Balushi', 'Nikolai Petrenko', 'Salma Toubal',
  'Christopher Nolan-Reid', 'Aisha Rahman', 'Felix Baumann', 'Reem Al Dosari',
  'Anika Sharma', 'Hassan Al Jabri', 'Charlotte Bennett', 'Youssef Hamdan',
  'Ingrid Larsson', 'Mariam Al Hashimi', 'Peter Nakamura', 'Layan Odeh',
  'Gabriel Santos', 'Dana Al Kaabi', 'Olivia Grant', 'Bilal Chaudhry',
  'Katarina Novak', 'Nasser Al Muhairi', 'Emma Sorensen', 'Rania Fakhoury',
  'Andres Molina', 'Shaikha Al Qassimi', 'Thomas Wright', 'Leila Barakat',
  'Jonas Meyer', 'Hind Al Ameri', 'Ryan Kavanagh', 'Nour Sabbagh',
  'Diego Herrera', 'Maha Al Zaabi', 'Sebastian Krause', 'Farah Nassar',
  'Aurora Lindholm', 'Sami Haddadin', 'Grace Adeyemi', 'Khalid Bin Sultan',
];

export const COMPANIES = [
  'Gulf Horizon Holdings', 'Nexa Interiors', null, 'Bright Path Academy',
  'Sandstone Capital', null, 'Delta Logistics FZE', 'Vireo Health Clinics',
  'Atlas Retail Group', null, 'Marina Bay Hospitality', 'Cedarwood Ventures',
  'Falcon Freight LLC', null, 'Oasis Media House', 'Silverline Trading',
  'Quantum Advisory', null, 'Palm Grove Developments', 'Emerald Facilities',
  'Blue Ridge Partners', null, 'Sunrise Education Group', 'Vertex Engineering',
  'Harbour & Co.', null, 'Zenith Wellness', 'Terra Nova Properties',
  'Lumen Digital', null,
];

export const TAG_POOL = [
  'hot', 'investor', 'first-time-buyer', 'cash-buyer', 'mortgage',
  'relocation', 'referral-vip', 'off-plan', 'commercial', 'urgent',
  'expat', 'repeat-client', 'high-value', 'needs-nurture',
];

/** Realistic note bodies, keyed loosely by the stage they tend to appear in. */
export const NOTE_TEMPLATES: Record<string, string[]> = {
  NEW: [
    'Enquiry came in through the website contact form. Left a voicemail, no answer yet.',
    'Downloaded the investment brochure. Sent the welcome email with our current listings.',
    'Referred by an existing client. Worth prioritising — their referrals usually close.',
    'Walked into the Marina office on Saturday. Took their details, promised a call back Monday.',
    'Instagram DM enquiry. Asked for a callback after 6pm on weekdays.',
  ],
  CONTACTED: [
    'Spoke for about 12 minutes. Budget is flexible, timeline is the constraint — wants to move before the school year.',
    'Reached them on WhatsApp. Prefers written updates over calls; noted on the file.',
    'Discussed three shortlisted units. They are comparing against a competitor listing in the same tower.',
    'Left a second voicemail and followed up by email. Will try once more this week before pausing.',
    'Confirmed they are the decision maker, but their spouse needs to see the unit before any offer.',
  ],
  QUALIFIED: [
    'Budget confirmed and mortgage pre-approval is in hand. Ready to view three units next week.',
    'Viewed two properties on Tuesday. Strong preference for the higher floor despite the price gap.',
    'Finance is sorted through their own bank. No chain, so we can move quickly on the right unit.',
    'Requirements are firm: 3BR minimum, sea view, handover before Q3. Narrowed the list to four.',
    'Second viewing went well. They asked about service charges and the building’s maintenance history.',
  ],
  PROPOSAL: [
    'Sent the full proposal with payment plan options. They are reviewing with their accountant.',
    'Negotiating on the payment schedule — they want 40/60 rather than the standard 60/40.',
    'Offer submitted to the seller. Waiting on a response, expected within 48 hours.',
    'Proposal revised after their feedback on the fee structure. Resent this morning.',
    'They asked for a comparison against two other units before committing. Sent the breakdown.',
  ],
  WON: [
    'Offer accepted. SPA signed and the deposit has cleared. Handover walkthrough booked.',
    'Closed at slightly under asking. Client was delighted with the turnaround.',
    'Deal done — they have already asked about a second unit for their brother.',
    'Contract signed. Introduced them to our property management team for the rental side.',
  ],
  LOST: [
    'Went with a competitor who could offer a shorter payment plan. Worth re-approaching in six months.',
    'Budget fell through after their financing was declined. Asked us to keep them on the list.',
    'Decided to postpone the purchase entirely until next year. Left the door open.',
    'Stopped responding after the third follow-up. Marking as lost rather than leaving it stale.',
  ],
};

export const LOST_REASONS = [
  'Chose a competitor',
  'Budget no longer available',
  'Timing — postponed to next year',
  'Went unresponsive',
  'Requirements changed',
];

export const FOLLOW_UP_TITLES = [
  'Call to confirm viewing time',
  'Send updated listing shortlist',
  'Check in on mortgage pre-approval',
  'Follow up on proposal feedback',
  'Share service charge breakdown',
  'Book second viewing',
  'Confirm documents for the SPA',
  'Quarterly check-in',
  'Send comparable units report',
  'Chase the seller’s response',
];
