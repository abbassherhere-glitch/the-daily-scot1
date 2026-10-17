/**
 * House adverts shown in the site's ad slots (AdBanner).
 * Edit this file to change the advertiser, wording or link. Every slot stays labelled "Advertisement".
 */
export interface HouseAd {
  advertiser: string;
  /** Short line for the slim mobile banner */
  shortLine: string;
  /** Main line for the wide leaderboard */
  headline: string;
  /** Supporting sentence for the larger box */
  body: string;
  /** Short proof points shown in the larger box */
  points: string[];
  cta: string;
  /** Destination link. utm_* tags let the advertiser see visits that came from The Daily Scot. */
  url: string;
}

export const HOUSE_AD: HouseAd = {
  advertiser: 'Mondus Pro',
  shortLine: 'On-site IT engineers across the UK & Europe',
  headline: 'On-site IT field engineers across the UK, Europe and the US',
  body: 'Vetted, insured field engineers for MSPs, VARs and IT integrators across the UK, Europe and the US.',
  points: ['No minimum commitment', 'Photo-verified jobs'],
  cta: 'Request an engineer',
  url: 'https://www.monduspro.com/?utm_source=thedailyscot&utm_medium=display&utm_campaign=house_ad',
};
