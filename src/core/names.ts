// Name pools for generated (fictional) players and supporting characters. Generated players are always flagged real:false.
import type { Rng } from './rng';
import type { Tour } from './types';

const G: Record<string, [string, string, string]> = {
  EN: ['James|Ethan|Mason|Tyler|Jordan|Callum|Lachlan|Owen|Blake|Cooper|Marcus|Declan|Reid|Trent|Nolan|Wyatt|Rhys|Spencer|Dylan|Grant', 'Hannah|Chloe|Brooke|Paige|Megan|Kayla|Sienna|Tessa|Maddie|Alexa|Erin|Jade|Lauren|Sophie|Quinn|Harper|Imogen|Piper|Carly|Abby', 'Whitfield|Harlan|Brennan|Castell|Dunmore|Ashby|Thorne|Kessler|Lockwood|Marsh|Pruitt|Radley|Stanton|Vance|Winslow|Yates|Carrow|Ellery|Fenwick|Garrity|Holloway|Langdon|Merritt|Oakes|Prescott|Sutter|Tolliver|Underhill'],
  FR: ['Julien|Mathis|Théo|Bastien|Loïc|Rémi|Yanis|Florian|Baptiste|Clément|Tristan|Maxence', 'Camille|Léa|Manon|Élise|Inès|Margaux|Océane|Clara|Justine|Anaïs|Maëlle|Salomé', 'Delacroix|Marchetti|Rousselot|Vasseur|Lemarchand|Barbier|Chastain|Fontaine|Girard|Hamelin|Joubert|Lacombe|Mercier|Pelletier|Roche|Tessier'],
  IT: ['Matteo|Luca|Davide|Simone|Federico|Alessio|Riccardo|Tommaso|Gianluca|Nicolò|Edoardo|Pietro', 'Giulia|Chiara|Martina|Sara|Elena|Federica|Alice|Beatrice|Ludovica|Camilla|Noemi|Arianna', 'Bellandi|Carraro|De Santis|Ferraresi|Galvani|Lombardini|Marchesi|Negrini|Orlandi|Pagani|Rinaldi|Salvini|Tedesco|Valentini|Zanetti|Brunelli'],
  ES: ['Pablo|Álvaro|Sergio|Javier|Mateo|Tomás|Nicolás|Ignacio|Gonzalo|Facundo|Santiago|Emilio', 'Lucía|Paula|Carla|Marta|Valentina|Camila|Sofía|Irene|Julieta|Daniela|Rocío|Ximena', 'Aguirre|Benítez|Cabrera|Domínguez|Escobar|Figueroa|Gallardo|Herrera|Ibáñez|Lozano|Montero|Navarrete|Ortega|Paredes|Quiroga|Salazar'],
  DE: ['Lukas|Jonas|Felix|Moritz|Niklas|Tobias|Fabian|Leon|Hannes|Marvin|Florian|Kilian', 'Lena|Hannah|Mia|Johanna|Lea|Nele|Clara|Paulina|Ronja|Carlotta|Annika|Frieda', 'Albrecht|Brandt|Dietrich|Eberhardt|Falk|Gerlach|Hartwig|Jansen|Kessel|Lindner|Mertens|Neubauer|Reinhardt|Seidel|Vogt|Winkler'],
  JP: ['Haruto|Sota|Riku|Yuto|Kaito|Daiki|Takumi|Ren|Shun|Kenta|Naoki|Ryo', 'Yui|Hina|Miyu|Sakura|Aoi|Rin|Nanami|Kana|Mio|Honoka|Ayaka|Risa', 'Aizawa|Fujimori|Hayakawa|Ishikura|Kanzaki|Matsuda|Nagase|Okabe|Sakurai|Tachibana|Uehara|Yamane|Kurosawa|Morita|Shinoda|Takeda'],
  CZ: ['Jakub|Tomáš|Vojtěch|Ondřej|Matěj|Filip|Dominik|Adam|Marek|Patrik|Štěpán|Lukáš', 'Tereza|Karolína|Barbora|Kristýna|Adéla|Eliška|Natálie|Veronika|Klára|Markéta|Nikola|Lucie', 'Dvořák/Dvořáková|Kolář/Kolářová|Pokorný/Pokorná|Růžička/Růžičková|Sedláček/Sedláčková|Urban/Urbanová|Veselý/Veselá|Zeman/Zemanová|Beneš/Benešová|Fiala/Fialová|Hruška/Hrušková|Jelínek/Jelínková|Konečný/Konečná|Machala/Machalová|Kratochvíl/Kratochvílová|Holub/Holubová'],
  RU: ['Artem|Ilya|Nikita|Maksim|Kirill|Yegor|Timur|Roman|Pavel|Denis|Mikhail|Bogdan', 'Anastasia|Daria|Polina|Sofia|Alina|Ksenia|Varvara|Elizaveta|Yana|Milana|Vera|Taisia', 'Abramov|Belov|Chernov|Davydov|Fedorov|Golubev|Ilyin|Kozlov|Lebedev|Morozov|Nikitin|Orlov|Petrov|Sokolov|Tarasov|Zaitsev'],
  PT: ['João|Pedro|Thiago|Gustavo|Felipe|Rafael|Bruno|Caio|Vinícius|Henrique|Diogo|Tiago', 'Beatriz|Carolina|Larissa|Gabriela|Mariana|Luiza|Isabela|Rafaela|Inês|Leonor|Marina|Bianca', 'Almeida|Barros|Cardoso|Duarte|Esteves|Freitas|Guimarães|Lacerda|Macedo|Nogueira|Pacheco|Queiroz|Rezende|Siqueira|Teixeira|Vasconcelos'],
  CN: ['Hao|Jun|Wei|Lei|Yang|Bo|Tao|Kai|Chen|Ming|Zhi|Rui', 'Xin|Yu|Jing|Lin|Mei|Ying|Qian|Lan|Hui|Fang|Yan|Shu', 'Bai|Cao|Deng|Fan|Gong|Han|Jiang|Kong|Luo|Meng|Pan|Qiu|Shen|Tang|Xie|Zeng'],
  NL: ['Daan|Sem|Thijs|Ruben|Jesse|Stijn|Bram|Lars|Niels|Joris|Koen|Wouter', 'Sanne|Lotte|Femke|Fleur|Anouk|Eva|Iris|Jasmijn|Noor|Roos|Tess|Lieke', 'Bakker|Dekker|Hendriks|Jacobs|Koster|Maas|Peeters|Smits|Vermeulen|Willems|Brouwer|Claes|Dijkstra|Hoekstra|Kuipers|Postma'],
  SR: ['Luka|Stefan|Marko|Nikola|Filip|Ivan|Petar|Dušan|Vuk|Matej|Ante|Borna', 'Ana|Mila|Jovana|Teodora|Ivana|Petra|Lana|Tena|Sara|Nina|Dunja|Iva', 'Babić|Čolić|Dragić|Erić|Gajić|Ilić|Jokić|Kovač|Lazić|Marić|Nikolić|Pavić|Rakić|Savić|Tomić|Vukić'],
  PL: ['Kacper|Szymon|Michał|Bartosz|Jakub|Mateusz|Wojciech|Kamil|Dawid|Igor|Oskar|Filip', 'Zuzanna|Julia|Maja|Oliwia|Natalia|Weronika|Kinga|Aleksandra|Martyna|Dominika|Gabriela|Emilia', 'Adamski|Borkowski|Czerwinski|Dabrowski|Gorski|Jasinski|Kaminski|Lisowski|Malinowski|Nowicki|Olszewski|Pawlowski|Rutkowski|Sikorski|Wysocki|Zielinski'],
  KR: ['Min-jun|Ji-ho|Seo-jun|Do-yun|Hyun-woo|Tae-yang|Jun-seo|Woo-jin|Sung-min|Jae-won|Dong-hyun|Yu-chan', 'Seo-yeon|Ji-woo|Ha-eun|Min-seo|Su-bin|Ye-jin|Da-eun|Chae-won|Yu-na|So-yeon|Eun-ji|Hye-rin', 'Bae|Cho|Han|Hwang|Jang|Kang|Kwon|Lim|Moon|Nam|Oh|Ryu|Seo|Shin|Song|Yoon'],
  IN: ['Arjun|Rohan|Karan|Aditya|Vikram|Siddharth|Nikhil|Dev|Aryan|Kabir|Ishaan|Rahul', 'Ananya|Riya|Sneha|Kavya|Meera|Tanvi|Ishita|Pooja|Diya|Nandini|Shruti|Aditi', 'Bhatia|Chauhan|Desai|Ghosh|Iyer|Joshi|Kapoor|Menon|Nair|Pillai|Rao|Saxena|Thakur|Varma|Bose|Reddy'],
  SE: ['Erik|Oskar|Viktor|Axel|Emil|Anton|Magnus|Henrik|Nils|Johan|Kasper|Elias', 'Elsa|Maja|Linnea|Astrid|Ebba|Freja|Ingrid|Saga|Ida|Signe|Tuva|Alva', 'Almqvist|Bergström|Dahlberg|Ekholm|Forsberg|Granlund|Hedlund|Isaksen|Kjellberg|Lindqvist|Nyström|Östlund|Rasmussen|Sandvik|Thorsen|Wikström'],
  RO: ['Andrei|Mihai|Vlad|Radu|Cristian|Bogdan|Ionuț|Răzvan|Tudor|Sebastian|Darius|Matei', 'Ioana|Andreea|Elena|Bianca|Daria|Alexia|Miruna|Oana|Teodora|Ilinca|Denisa|Raluca', 'Albu|Barbu|Constantin|Dobre|Enache|Florea|Ghiță|Iliescu|Lungu|Manole|Neagu|Oprea|Preda|Sandu|Tudose|Voicu'],
  TR: ['Emre|Kerem|Burak|Deniz|Arda|Cem|Mert|Ozan|Tolga|Yiğit|Kaan|Berk', 'Elif|Zeynep|Defne|Ece|Selin|İpek|Melis|Naz|Derin|Azra|Beril|Ceren', 'Akın|Bayram|Çetin|Doğan|Erdem|Güneş|Kaya|Korkmaz|Özkan|Polat|Şahin|Tekin|Uçar|Yavuz|Aydın|Bulut'],
  GR: ['Nikos|Giorgos|Dimitris|Kostas|Petros|Thanos|Vasilis|Alexis|Michalis|Stelios|Aris|Manos', 'Eleni|Katerina|Danai|Ioanna|Sofia|Nefeli|Christina|Marina|Zoi|Thalia|Anna|Myrto', 'Alexiou|Dimou|Economou|Galanis|Kalogeras|Lambrou|Manolis|Nikolaou|Pappas|Raptis|Samaras|Theodorou|Vlachos|Xenakis|Zervas|Karras'],
  AR: ['Youssef|Karim|Omar|Amine|Sami|Tarek|Hamza|Nabil|Walid|Ziad|Malek|Rami', 'Yasmine|Salma|Nour|Lina|Farah|Hana|Mariam|Rania|Dina|Amira|Leila|Ines', 'Ben Salah|Chaouch|Darwish|El Masry|Fakhry|Gharbi|Haddad|Jaziri|Khelifi|Mansour|Naguib|Rahmani|Sabry|Trabelsi|Zidan|Bouzid'],
  TH: ['Kittipong|Thanawat|Nattapong|Pakorn|Chanon|Sarawut|Anucha|Wichai|Tanakorn|Peerapat|Krit|Ekkachai', 'Ploy|Nicha|Pim|Kanya|Mook|Fah|Praew|Dao|Bua|Nam|Ying|Mint', 'Boonmee|Chaiyasit|Intarat|Jantarat|Kongkaew|Maneerat|Narong|Pongsak|Rattana|Sangthong|Thongchai|Wattana|Suksai|Promma|Srisuk|Yodrak'],
  HU: ['Bence|Máté|Ádám|Dániel|Gergő|Balázs|Zsolt|Tamás|Péter|Áron|Levente|Márk', 'Réka|Dóra|Zsófia|Lili|Eszter|Petra|Boglárka|Fanni|Luca|Kata|Nóra|Vivien', 'Balogh|Csonka|Fazekas|Gulyás|Hegedűs|Juhász|Kelemen|Lukács|Molnár|Orbán|Pintér|Rácz|Somogyi|Takács|Vörös|Bíró'],
};
const NAT: [string, string, number][] = [
  ['USA', 'EN', 9], ['GBR', 'EN', 5], ['AUS', 'EN', 5], ['CAN', 'EN', 3], ['NZL', 'EN', 1], ['RSA', 'EN', 1], ['FRA', 'FR', 9], ['BEL', 'FR', 2], ['SUI', 'FR', 2], ['ITA', 'IT', 8],
  ['ESP', 'ES', 7], ['ARG', 'ES', 6], ['CHI', 'ES', 2], ['COL', 'ES', 2], ['MEX', 'ES', 2], ['GER', 'DE', 6], ['AUT', 'DE', 2], ['JPN', 'JP', 5], ['CZE', 'CZ', 4], ['SVK', 'CZ', 1],
  ['RUS', 'RU', 5], ['UKR', 'RU', 2], ['KAZ', 'RU', 1], ['BUL', 'RU', 1], ['BRA', 'PT', 4], ['POR', 'PT', 2], ['CHN', 'CN', 4], ['TPE', 'CN', 1], ['NED', 'NL', 3], ['SRB', 'SR', 2],
  ['CRO', 'SR', 2], ['POL', 'PL', 2], ['KOR', 'KR', 2], ['IND', 'IN', 3], ['SWE', 'SE', 2], ['DEN', 'SE', 1], ['NOR', 'SE', 1], ['FIN', 'SE', 1], ['ROU', 'RO', 2], ['TUR', 'TR', 2],
  ['GRE', 'GR', 1], ['TUN', 'AR', 1], ['EGY', 'AR', 1], ['THA', 'TH', 1], ['HUN', 'HU', 1],
];
export const NATIONS = NAT.map(n => n[0]).sort();
function female(group: string, sur: string): string {
  if (sur.includes('/')) return sur.split('/')[1];
  if (group === 'RU') return sur + 'a';
  if (group === 'PL') return sur.replace(/ski$/, 'ska').replace(/cki$/, 'cka');
  return sur;
}
const male = (_g: string, sur: string) => sur.split('/')[0];
export function genName(r: Rng, tour: Tour, country: string | undefined, taken: Set<string>): { name: string; country: string } {
  for (let i = 0; i < 60; i++) {
    const nat = country ? NAT.find(n => n[0] === country) ?? NAT[0] : r.weighted(NAT, n => n[2]);
    const g = G[nat[1]], first = r.pick(g[tour === 'atp' ? 0 : 1].split('|')), sur = r.pick(g[2].split('|'));
    const name = `${first} ${tour === 'wta' ? female(nat[1], sur) : male(nat[1], sur)}`;
    if (!taken.has(name)) { taken.add(name); return { name, country: nat[0] }; }
  }
  const name = `Player ${taken.size}`; taken.add(name); return { name, country: country ?? 'USA' };
}
export function supportName(r: Rng, country: string, fem: boolean): string {
  const nat = NAT.find(n => n[0] === country) ?? NAT[0], g = G[nat[1]];
  return `${r.pick(g[fem ? 1 : 0].split('|'))} ${fem ? female(nat[1], r.pick(g[2].split('|'))) : male(nat[1], r.pick(g[2].split('|')))}`;
}
// Original fictional sponsor brands (spec 11.2). A private image pack may replace how a slot is displayed.
export const BRANDS: Record<'apparel' | 'racket' | 'partner', string[]> = {
  apparel: ['Veltra', 'Kairo Sport', 'Northline', 'Aster & Co', 'Solenne', 'Brightwater', 'Okami', 'Tessaro', 'Halden', 'Mirano', 'Fjell', 'Corvane', 'Lumen Athletic'],
  racket: ['Stratos', 'Halcyon', 'Vanta', 'Corsa', 'Tessel', 'Orbis', 'Kestrel', 'Meridian Pro', 'Arden', 'Volante'],
  partner: ['Banco Litoral', 'Helvar Bank', 'Castellan Private', 'Ardent Motors', 'Novaro', 'Sable Automotive', 'Maison Verre', 'Calder & Finch', 'Lirien', 'Orrin Timepieces', 'Aurel Watches', 'Tidewater Energy', 'Quill Insurance', 'Polaris Air', 'Kintaro', 'Verano Hotels', 'Sorrel Foods', 'Northgate Telecom'],
};
