import { ENQUIRY_HOURS, SITE_URL } from './site';

/** The two documents a payment processor asks for. They are kept as data
 *  rather than as markup so that both pages render the same way, and so the
 *  facts in them sit next to the constants they have to agree with. */

export interface LegalSection {
  heading: string;
  /** Paragraphs. `*italic*` and `**bold**` are honoured, as elsewhere. */
  body?: string[];
  /** An unordered list, rendered after the paragraphs. */
  list?: string[];
}

export interface LegalDoc {
  path: string;
  title: string;
  /** Shown at the top of the page, and the date to change when it changes. */
  updated: string;
  description: string;
  intro: string[];
  sections: LegalSection[];
}

/** Whoever is on the other side of the sale. */
const SELLER = 'Klaus Hofrichter';
const EMAIL = 'klaus@klaushofrichter.net';
const PLACE = 'Texas, United States';
const UPDATED = '29 August 2026';

export const TERMS: LegalDoc = {
  path: '/terms',
  title: 'Terms of Service',
  updated: UPDATED,
  description: `The terms on which artwork is offered and sold at ${SITE_URL}.`,
  intro: [
    `This site is run by ${SELLER} from ${PLACE}. It shows original paintings and photographs, and offers some of them for sale. By using the site or buying a piece you agree to what follows.`,
    `If anything here is unclear, write to **${EMAIL}** before you buy rather than after.`,
  ],
  sections: [
    {
      heading: 'What is sold here',
      body: [
        'The paintings are originals, *one of one*. There are no editions and no reproductions of them, and when one is sold there is nothing identical to replace it. A sold painting stays on display here so the room reads as it was made, and is marked as sold.',
        'The photographs are printed to order on archival paper. They can be printed again, so they are not marked sold; if you want a size that is not listed, ask.',
        'Pictures are photographed as accurately as the process allows, but colour on a screen is not colour on a wall. Dimensions and materials are given for each piece and are the reliable description.',
      ],
    },
    {
      heading: 'Prices and availability',
      body: [
        'Prices are shown in US dollars and cover the piece itself. Shipping is quoted separately, because it depends on where the piece is going and how it has to be packed. Any sales tax that applies is added at checkout.',
        'A price shown on the site is an invitation to enquire, not a binding offer. A sale is formed only when payment is accepted and confirmed. Nothing is reserved by adding a piece to a page or by looking at it, and there is no basket — one picture is bought at a time.',
        `If you ask about a piece, that is a request to hold it for about ${ENQUIRY_HOURS} hours while we talk. It is a courtesy, kept by hand, and it is not a guarantee: if two people ask at once, the first to complete payment gets the piece and the other is told promptly.`,
      ],
    },
    {
      heading: 'Payment',
      body: [
        'Payment is handled by **Stripe**, an external payment processor. Card details are entered on Stripe\'s own pages and are never seen by, sent to, or stored on this site. Stripe\'s terms apply to the payment itself alongside these terms.',
        'Some pieces may instead be arranged by email and invoiced directly. Either way the piece is not shipped until payment has cleared.',
      ],
    },
    {
      heading: 'Shipping',
      body: [
        'Work is packed by hand and sent insured, with tracking. Paintings are shipped framed unless agreed otherwise. Once a piece has been handed to the carrier, the delivery timetable is theirs and not mine, though I will chase anything that goes astray.',
        'Import duties or customs charges on an international order are the buyer\'s responsibility. Ask before ordering from outside the United States and I will tell you what shipping is likely to cost.',
      ],
    },
    {
      heading: 'Damage, returns and cancellation',
      body: [
        'If a piece arrives damaged, photograph it — including the packaging — and write to me within **14 days** of delivery. Insured shipping exists for exactly this, and you will be refunded or the print re-made, whichever fits.',
        'If a piece is simply not what you hoped for, you may return it within **14 days** of delivery, unused and in its original packaging, and be refunded the price of the work. Return shipping is at your cost unless the piece was damaged or not as described. A refund is issued once the piece is back and has been checked.',
        'An order can be cancelled for a full refund at any point before it ships. A commission or a piece printed at a size made specially for you cannot be cancelled once printing has begun.',
      ],
    },
    {
      heading: 'Copyright',
      body: [
        `Copyright in every image on this site stays with ${SELLER}. Buying a piece buys the physical object and the right to enjoy and display it — it does not transfer copyright and does not carry a right to reproduce the image, sell prints of it, or use it commercially.`,
        'Please do not copy, scrape or republish the images here. If you want to use one for something, ask; the answer is often yes.',
      ],
    },
    {
      heading: 'The site itself',
      body: [
        'The site is offered as it is. It is a small personal gallery, not a service with an uptime promise, and it may be changed or taken down at any time. Details and prices can change without notice, and I am not liable for anything beyond the price of a piece actually bought.',
        'Nothing in these terms limits any right you have under consumer law that cannot be limited by agreement.',
      ],
    },
    {
      heading: 'Governing law',
      body: [
        `These terms are governed by the laws of the State of ${PLACE.split(',')[0]}, United States.`,
      ],
    },
    {
      heading: 'Getting in touch',
      body: [
        `Write to **${EMAIL}**. Replies usually come within a day or two. That is also the address to use for anything about an order, a return, or these terms.`,
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  path: '/privacy',
  title: 'Privacy Policy',
  updated: UPDATED,
  description: `What this site does and does not collect about the people who visit it.`,
  intro: [
    `This is a small gallery site run by ${SELLER} in ${PLACE}. It collects as little as it can: there are **no accounts, no logins, no cookies, and no analytics or tracking of any kind**.`,
    'What follows is the whole of it.',
  ],
  sections: [
    {
      heading: 'What the site stores about you',
      body: [
        'Nothing on a server. The gallery keeps no database of visitors and sets no cookies.',
        'One thing is stored **in your own browser**, not sent anywhere: when you send an enquiry about a piece, the site remembers that you did, so the page can show you that you already asked. It holds only the picture\'s id and the time, it lapses by itself after about ' + ENQUIRY_HOURS + ' hours, and clearing your browser\'s site data removes it. It never reaches me or anyone else.',
      ],
    },
    {
      heading: 'What happens when you get in touch',
      body: [
        `Enquiries are ordinary email, sent from your own mail program to **${EMAIL}**. I keep that correspondence so I can answer it and keep track of a sale, and I do not add you to any list or send marketing.`,
      ],
    },
    {
      heading: 'If you buy something',
      body: [
        'Payment is handled by **Stripe**, and card details go directly to Stripe — they are never entered on, sent to, or stored by this site. Stripe collects what it needs to take a payment and to meet its own legal obligations, under its own privacy policy.',
        'From a completed sale I receive what I need to send the piece and to keep proper records: a name, a delivery address, an email address, and what was bought. Tax and accounting rules mean sales records have to be kept for several years.',
      ],
    },
    {
      heading: 'Third parties',
      body: [
        'Only two, and neither is a tracker:',
      ],
      list: [
        '**Google Fonts** serves the typefaces the site uses. Loading them means your browser requests files from Google, which necessarily discloses your IP address to Google. Nothing else is shared, and no cookie is set by this site to do it.',
        '**Stripe** handles payments, as described above, and only if you buy something.',
      ],
    },
    {
      heading: 'Server logs',
      body: [
        'The site runs on a small server I operate myself. Like any web server it may record ordinary request information — an IP address, a page, a timestamp — in short-lived operational logs used to keep the site running and to diagnose faults. These are not used to profile anyone, are not combined with anything else, and are not shared.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        `You can ask what I hold about you, ask for it to be corrected, or ask for it to be deleted, subject to records I am obliged to keep for tax purposes. Write to **${EMAIL}** and I will answer.`,
        'Because the site sets no cookies and runs no tracking, there is nothing here to opt out of and no consent banner to click through.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'This site is not directed at children, and nothing is knowingly collected from them.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'If this policy changes, the date at the top of the page changes with it. There is no mailing list to notify, by design.',
      ],
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY];
