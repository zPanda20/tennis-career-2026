// Nations: IOC-style three-letter codes (as the tours use), display names, ISO codes for flag images, and travel regions.
// Russia and Belarus are shown without a national flag, as the tours currently list those players as neutral.
export const NEUTRAL = new Set(['RUS', 'BLR']);
const RAW: [string, string, string, string][] = [
  // code, name, iso2, region
  ['ALB', 'Albania', 'al', 'EU'], ['ALG', 'Algeria', 'dz', 'AF'], ['AND', 'Andorra', 'ad', 'EU'], ['ANG', 'Angola', 'ao', 'AF'], ['ARG', 'Argentina', 'ar', 'SA'], ['ARM', 'Armenia', 'am', 'EU'],
  ['AUS', 'Australia', 'au', 'OC'], ['AUT', 'Austria', 'at', 'EU'], ['AZE', 'Azerbaijan', 'az', 'EU'], ['BAH', 'Bahamas', 'bs', 'NA'], ['BAN', 'Bangladesh', 'bd', 'AS'], ['BAR', 'Barbados', 'bb', 'NA'],
  ['BEL', 'Belgium', 'be', 'EU'], ['BEN', 'Benin', 'bj', 'AF'], ['BIH', 'Bosnia and Herzegovina', 'ba', 'EU'], ['BLR', 'Belarus', 'by', 'EU'], ['BOL', 'Bolivia', 'bo', 'SA'], ['BOT', 'Botswana', 'bw', 'AF'],
  ['BRA', 'Brazil', 'br', 'SA'], ['BRN', 'Bahrain', 'bh', 'ME'], ['BUL', 'Bulgaria', 'bg', 'EU'], ['BDI', 'Burundi', 'bi', 'AF'], ['CAM', 'Cambodia', 'kh', 'AS'], ['CAN', 'Canada', 'ca', 'NA'],
  ['CGO', 'Congo', 'cg', 'AF'], ['CHI', 'Chile', 'cl', 'SA'], ['CHN', 'China', 'cn', 'AS'], ['CIV', "Côte d'Ivoire", 'ci', 'AF'], ['CMR', 'Cameroon', 'cm', 'AF'], ['COL', 'Colombia', 'co', 'SA'],
  ['CRC', 'Costa Rica', 'cr', 'NA'], ['CRO', 'Croatia', 'hr', 'EU'], ['CUB', 'Cuba', 'cu', 'NA'], ['CYP', 'Cyprus', 'cy', 'EU'], ['CZE', 'Czechia', 'cz', 'EU'], ['DEN', 'Denmark', 'dk', 'EU'],
  ['DOM', 'Dominican Republic', 'do', 'NA'], ['ECU', 'Ecuador', 'ec', 'SA'], ['EGY', 'Egypt', 'eg', 'AF'], ['ESA', 'El Salvador', 'sv', 'NA'], ['ESP', 'Spain', 'es', 'EU'], ['EST', 'Estonia', 'ee', 'EU'],
  ['ETH', 'Ethiopia', 'et', 'AF'], ['FIJ', 'Fiji', 'fj', 'OC'], ['FIN', 'Finland', 'fi', 'EU'], ['FRA', 'France', 'fr', 'EU'], ['GBR', 'Great Britain', 'gb', 'EU'], ['GEO', 'Georgia', 'ge', 'EU'],
  ['GER', 'Germany', 'de', 'EU'], ['GHA', 'Ghana', 'gh', 'AF'], ['GRE', 'Greece', 'gr', 'EU'], ['GUA', 'Guatemala', 'gt', 'NA'], ['GUM', 'Guam', 'gu', 'OC'], ['HAI', 'Haiti', 'ht', 'NA'],
  ['HKG', 'Hong Kong, China', 'hk', 'AS'], ['HON', 'Honduras', 'hn', 'NA'], ['HUN', 'Hungary', 'hu', 'EU'], ['INA', 'Indonesia', 'id', 'AS'], ['IND', 'India', 'in', 'AS'], ['IRI', 'Iran', 'ir', 'ME'],
  ['IRL', 'Ireland', 'ie', 'EU'], ['IRQ', 'Iraq', 'iq', 'ME'], ['ISL', 'Iceland', 'is', 'EU'], ['ISR', 'Israel', 'il', 'ME'], ['ITA', 'Italy', 'it', 'EU'], ['JAM', 'Jamaica', 'jm', 'NA'],
  ['JOR', 'Jordan', 'jo', 'ME'], ['JPN', 'Japan', 'jp', 'AS'], ['KAZ', 'Kazakhstan', 'kz', 'AS'], ['KEN', 'Kenya', 'ke', 'AF'], ['KGZ', 'Kyrgyzstan', 'kg', 'AS'], ['KOR', 'South Korea', 'kr', 'AS'],
  ['KOS', 'Kosovo', 'xk', 'EU'], ['KSA', 'Saudi Arabia', 'sa', 'ME'], ['KUW', 'Kuwait', 'kw', 'ME'], ['LAT', 'Latvia', 'lv', 'EU'], ['LBN', 'Lebanon', 'lb', 'ME'], ['LIE', 'Liechtenstein', 'li', 'EU'],
  ['LTU', 'Lithuania', 'lt', 'EU'], ['LUX', 'Luxembourg', 'lu', 'EU'], ['MAD', 'Madagascar', 'mg', 'AF'], ['MAR', 'Morocco', 'ma', 'AF'], ['MAS', 'Malaysia', 'my', 'AS'], ['MDA', 'Moldova', 'md', 'EU'],
  ['MEX', 'Mexico', 'mx', 'NA'], ['MGL', 'Mongolia', 'mn', 'AS'], ['MKD', 'North Macedonia', 'mk', 'EU'], ['MLT', 'Malta', 'mt', 'EU'], ['MNE', 'Montenegro', 'me', 'EU'], ['MON', 'Monaco', 'mc', 'EU'],
  ['MOZ', 'Mozambique', 'mz', 'AF'], ['MRI', 'Mauritius', 'mu', 'AF'], ['NAM', 'Namibia', 'na', 'AF'], ['NCL', 'New Caledonia', 'nc', 'OC'], ['NED', 'Netherlands', 'nl', 'EU'], ['NEP', 'Nepal', 'np', 'AS'],
  ['NGR', 'Nigeria', 'ng', 'AF'], ['NOR', 'Norway', 'no', 'EU'], ['NZL', 'New Zealand', 'nz', 'OC'], ['OMA', 'Oman', 'om', 'ME'], ['PAK', 'Pakistan', 'pk', 'AS'], ['PAN', 'Panama', 'pa', 'NA'],
  ['PAR', 'Paraguay', 'py', 'SA'], ['PER', 'Peru', 'pe', 'SA'], ['PHI', 'Philippines', 'ph', 'AS'], ['POL', 'Poland', 'pl', 'EU'], ['POR', 'Portugal', 'pt', 'EU'], ['PUR', 'Puerto Rico', 'pr', 'NA'],
  ['QAT', 'Qatar', 'qa', 'ME'], ['ROU', 'Romania', 'ro', 'EU'], ['RSA', 'South Africa', 'za', 'AF'], ['RUS', 'Russia', 'ru', 'EU'], ['RWA', 'Rwanda', 'rw', 'AF'], ['SEN', 'Senegal', 'sn', 'AF'],
  ['SGP', 'Singapore', 'sg', 'AS'], ['SLO', 'Slovenia', 'si', 'EU'], ['SMR', 'San Marino', 'sm', 'EU'], ['SRB', 'Serbia', 'rs', 'EU'], ['SRI', 'Sri Lanka', 'lk', 'AS'], ['SUI', 'Switzerland', 'ch', 'EU'],
  ['SVK', 'Slovakia', 'sk', 'EU'], ['SWE', 'Sweden', 'se', 'EU'], ['SYR', 'Syria', 'sy', 'ME'], ['TAN', 'Tanzania', 'tz', 'AF'], ['THA', 'Thailand', 'th', 'AS'], ['TJK', 'Tajikistan', 'tj', 'AS'],
  ['TKM', 'Turkmenistan', 'tm', 'AS'], ['TOG', 'Togo', 'tg', 'AF'], ['TPE', 'Chinese Taipei', 'tw', 'AS'], ['TTO', 'Trinidad and Tobago', 'tt', 'NA'], ['TUN', 'Tunisia', 'tn', 'AF'], ['TUR', 'Türkiye', 'tr', 'EU'],
  ['UAE', 'United Arab Emirates', 'ae', 'ME'], ['UGA', 'Uganda', 'ug', 'AF'], ['UKR', 'Ukraine', 'ua', 'EU'], ['URU', 'Uruguay', 'uy', 'SA'], ['USA', 'United States', 'us', 'NA'], ['UZB', 'Uzbekistan', 'uz', 'AS'],
  ['VEN', 'Venezuela', 've', 'SA'], ['VIE', 'Vietnam', 'vn', 'AS'], ['ZAM', 'Zambia', 'zm', 'AF'], ['ZIM', 'Zimbabwe', 'zw', 'AF'],
];
export const COUNTRIES: Record<string, { name: string; iso: string; region: string }> = {};
for (const [c, name, iso, region] of RAW) COUNTRIES[c] = { name, iso, region };
export const COUNTRY_LIST = RAW.map(r => r[0]).sort((a, b) => COUNTRIES[a].name.localeCompare(COUNTRIES[b].name));
