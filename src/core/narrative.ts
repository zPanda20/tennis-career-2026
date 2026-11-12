// Life events (spec 12): 48 authored dilemmas. All supporting characters are fictional; real players never appear here.
// Tokens: {coach} {friend} {partner} {agent}. Effects are shown to the user as directions, not numbers.
import type { Ability, State } from './types';

export interface Fx { mo?: number; fa?: number; st?: number; co?: number; sh?: number; $?: number; tr?: number; rc?: number; ct?: number; fr?: number; pa?: number; ag?: number; startPartner?: boolean; endPartner?: boolean; ab?: [Ability, number] }
export interface LifeChoice { label: string; hint: string; fx: Fx; follow?: { after: number; text: string; fx?: Fx } }
export interface LifeEv { id: string; cat: 'dev' | 'health' | 'rel' | 'media' | 'travel' | 'future'; title: string; text: string; choices: LifeChoice[]; adult?: boolean; personal?: boolean; when?: (S: State) => boolean; repeat?: number }

const me = (S: State) => S.players[S.userId];
const rank = (S: State) => S.rank[S.userId] ?? 999;
const age = (S: State) => S.year - +me(S).born.slice(0, 4);
const recentWin = (S: State) => S.u.tourneys.slice(-4).some(t => t.title || t.final);
const backFromInjury = (S: State) => S.u.injuries.some(i => i.sev !== 'minor' && S.wk - (i.wk + i.weeks) < 20 && S.wk > i.wk + i.weeks);
const c = (label: string, hint: string, fx: Fx, follow?: LifeChoice['follow']): LifeChoice => ({ label, hint, fx, follow });

export const EVENTS: LifeEv[] = [
  // ---- development and coaching (12) ----
  { id: 'd1', cat: 'dev', title: 'Arriving flat', text: 'Results have been solid lately, but {coach} notices you are arriving flat for practice. {friend} invites you home for a few days before the next stretch of events.', choices: [
    c('Take the break and go home', 'Better support and recovery, less practice', { mo: 6, rc: 3, tr: 0.92, fr: 6 }, { after: 3, text: '{friend} still talks about those few days at home. You remember how light you felt going back on court afterwards.', fx: { mo: 2 } }),
    c('Stay and prepare', 'Keeps training time, small burnout risk if strain stays high', { tr: 1.06, st: 4, mo: -2 }),
    c('Shorten the next trip and do both', 'A little of each, if the schedule permits', { mo: 3, rc: 1, fr: 3 })] },
  { id: 'd2', cat: 'dev', title: 'Rebuilding the second serve', text: '{coach} wants to rebuild your second-serve motion. It will feel worse before it feels better, and there is never a quiet month on tour to do it.', choices: [
    c('Commit to the rebuild now', 'Short-term confidence dip, possible lasting serve gain', { co: -4, sh: -3, ct: 5 }, { after: 3, text: 'The rebuilt second serve has stopped feeling like a project. It simply holds up under pressure now.', fx: { ab: ['serve', 0.7], co: 3 } }),
    c('Keep the motion you trust', 'No disruption, no change', { ct: -3 }),
    c('Make small adjustments only', 'Limited disruption, limited upside', { co: -1, ct: 1 }, { after: 4, text: 'The small serve adjustments settled in without much fuss.', fx: { ab: ['serve', 0.25] } })] },
  { id: 'd3', cat: 'dev', title: 'A week as a hitting partner', text: 'A veteran well inside the top hundred needs a hitting partner for a week and asks for you by name. The sessions would be hard, fast and unpaid.', when: S => rank(S) > 150, choices: [
    c('Say yes', 'Sharper and more confident, but tired', { sh: 6, co: 3, fa: 6 }),
    c('Do three days, then leave', 'Some of the benefit, less of the load', { sh: 3, co: 1, fa: 2 }),
    c('Decline and keep your own plan', 'Your preparation stays as planned', {})] },
  { id: 'd4', cat: 'dev', title: 'Match analysis package', text: 'An analyst offers a season of tagged match video and opponent reports. {coach} thinks it would sharpen practice. It is not cheap at your level.', choices: [
    c('Buy the package', 'Costs money, more useful practice this block', { $: -600, tr: 1.06, ct: 2 }),
    c('Ask {coach} to do a basic version', 'Free, adds to your coach\'s workload', { tr: 1.02, ct: -2 }),
    c('Pass for now', 'No cost, no change', {})] },
  { id: 'd5', cat: 'dev', title: 'Who sets the schedule', text: '{coach} wants the final say on which events you play. You have always enjoyed choosing your own route through the season.', choices: [
    c('Hand over more control', 'Stronger coaching relationship, less freedom', { ct: 8, mo: -3 }),
    c('Keep the decisions yourself', 'Independence, some friction', { ct: -6, mo: 3 }),
    c('Agree to decide together', 'A slower process that both can live with', { ct: 3 })] },
  { id: 'd6', cat: 'dev', title: 'Altitude training camp', text: 'A group of players is booking two weeks at an altitude camp. The work is brutal and the price reflects the view.', choices: [
    c('Join the camp', 'Expensive and tiring, possible endurance benefit later', { $: -1500, fa: 8, st: 3 }, { after: 2, text: 'The altitude block is paying off. Long matches feel a little shorter than they used to.', fx: { ab: ['end', 0.6] } }),
    c('Run a hard block at home instead', 'Free, familiar, slightly less effective', { fa: 5, st: 2, tr: 1.03 }),
    c('Skip it and stay fresh', 'No load, no gain', { rc: 1 })] },
  { id: 'd7', cat: 'dev', title: 'Clinic at the home club', text: 'The club where you learned to play asks you to run a clinic for its juniors. It would mean a day of travel and a day on your feet.', choices: [
    c('Run the clinic', 'Good for morale and reputation, costs a little energy', { mo: 5, ag: 3, fa: 2 }),
    c('Send a video message and signed kit', 'A small gesture', { mo: 1 }),
    c('Decline this time', 'Protects preparation', { mo: -1 })] },
  { id: 'd8', cat: 'dev', title: 'Come forward more', text: '{coach} believes your game has a ceiling unless you finish more points at the net. You are not convinced it suits you.', choices: [
    c('Give it a real trial', 'Awkward at first, may broaden your game', { co: -2, ct: 5 }, { after: 3, text: 'The trial of coming forward has stuck. You are closing points you used to extend.', fx: { ab: ['net', 0.9] } }),
    c('Refuse: play to your strengths', 'Comfortable, costs some trust', { ct: -5, co: 1 }),
    c('Use it only on big points', 'A cautious middle path', { ct: 1 }, { after: 4, text: 'Picking your moments at the net has become a small, reliable habit.', fx: { ab: ['net', 0.3] } })] },
  { id: 'd9', cat: 'dev', title: 'Training with a rival', text: 'A player your age, someone you keep meeting in draws, suggests sharing a training week and splitting the court costs.', choices: [
    c('Agree', 'Higher quality practice, and they learn your game too', { tr: 1.05, $: 150, co: 1 }),
    c('Agree, but hold back your patterns', 'Some benefit, less exposure', { tr: 1.02, $: 150 }),
    c('Say no', 'Nothing changes', {})] },
  { id: 'd10', cat: 'dev', title: 'A mental skills coach', text: 'After another tight set slipped away, {agent} forwards the number of a mental skills coach who works with several tour players.', choices: [
    c('Book a block of sessions', 'Costs money, may steady you under pressure', { $: -400, mo: 3 }, { after: 3, text: 'The routines from the mental skills sessions have become automatic between points.', fx: { ab: ['comp', 0.7] } }),
    c('Read the book they recommend first', 'Free, slower', { mo: 1 }, { after: 5, text: 'A few ideas from that book have quietly stayed with you.', fx: { ab: ['comp', 0.2] } }),
    c('Not for you', 'No change', {})] },
  { id: 'd11', cat: 'dev', title: 'Sharing your coach', text: '{coach} has been offered work with a second player and asks how you feel about sharing time on the road.', choices: [
    c('Accept the arrangement', 'Lower cost this block, less attention', { $: 300, tr: 0.95, ct: -3 }),
    c('Pay more to keep full attention', 'Costs money, strengthens the partnership', { $: -400, ct: 5 }),
    c('Tell {coach} it worries you', 'Honest, and awkward', { ct: -1, mo: -1 })] },
  { id: 'd12', cat: 'dev', title: 'Screening results', text: 'A movement screening shows an imbalance that could become a problem. The fix is dull daily prehab that eats into court time.', choices: [
    c('Commit to the prehab', 'Less strain, a little less practice', { st: -8, tr: 0.96 }, { after: 3, text: 'The dull prehab routine has paid for itself: your body is holding up better under load.', fx: { st: -6 } }),
    c('Do it when you remember', 'Minor benefit', { st: -2 }),
    c('Ignore it', 'Full practice time, the imbalance remains', { st: 3 })] },
  // ---- health and recovery (10) ----
  { id: 'h1', cat: 'health', title: 'A niggle before travelling', text: 'Something has felt tight for a week. It is not an injury yet. The physio at the last event thought two quiet days would settle it.', choices: [
    c('Rest it properly', 'Lower strain, slightly less sharp', { st: -6, sh: -3 }),
    c('See a specialist physio', 'Costs money, treats the cause', { $: -200, st: -8 }),
    c('Play through it', 'No time lost, the load stays', { st: 5 })] },
  { id: 'h2', cat: 'health', title: 'Sleep debt', text: 'Three time zones in a month have wrecked your sleep. {coach} suggests protecting it; you had planned late video sessions on upcoming opponents.', choices: [
    c('Protect your sleep', 'Better recovery and mood', { fa: -6, mo: 2 }),
    c('Keep the late video sessions', 'Better prepared, more tired', { tr: 1.03, fa: 4 }),
    c('Nap when you can', 'A patchwork answer', { fa: -2 })] },
  { id: 'h3', cat: 'health', title: 'Working with a nutritionist', text: 'A nutritionist who travels with a group of players offers to add you to her list. Her plans are strict and her invoices are prompt.', choices: [
    c('Sign up', 'Costs money, better recovery this block', { $: -350, rc: 2 }),
    c('Ask for a one-off consultation', 'Cheaper, modest benefit', { $: -120, rc: 1 }),
    c('Carry on as you are', 'No change', {})] },
  { id: 'h4', cat: 'health', title: 'Running on empty', text: 'You have stopped looking forward to practice. Small things irritate you, and {friend} says you sound tired every time you call.', when: S => me(S).morale < 50 || me(S).strain > 50, repeat: 8, choices: [
    c('Take a full week away from tennis', 'Mood and strain recover, sharpness drops', { mo: 9, st: -6, sh: -5, tr: 0.9 }),
    c('Talk to {coach} and lighten the load', 'A gentler reset', { mo: 4, ct: 4, st: -3, tr: 0.96 }),
    c('Push through', 'No time lost; the warning signs remain', { st: 4, mo: -4 }, { after: 2, text: 'Pushing through the flat spell took something out of you. It has taken weeks to feel like yourself again.', fx: { mo: -3 } })] },
  { id: 'h5', cat: 'health', title: 'After the heat', text: 'A long match in brutal heat left you cramping in the locker room. The doctor cleared you, with advice about the next few days.', choices: [
    c('Follow the recovery protocol to the letter', 'Better recovery, a quieter few days', { fa: -6, sh: -1 }),
    c('Train as normal', 'No time lost', { fa: 3, st: 2 }),
    c('Train early mornings only', 'A compromise with the weather', { fa: -2 })] },
  { id: 'h6', cat: 'health', title: 'Pacing the comeback', text: 'You are cleared to compete again. {coach} would start one level down to rebuild rhythm; your ranking says you cannot afford to wait.', when: backFromInjury, repeat: 6, choices: [
    c('Start at a lower level', 'Rhythm and confidence first', { co: 3, sh: 2 }),
    c('Go straight back to your usual level', 'Faster, harder on the body', { st: 5, sh: 4 }),
    c('Add two more training weeks first', 'Safer, slower', { st: -4, sh: -2, tr: 1.03 })] },
  { id: 'h7', cat: 'health', title: 'Changing surfaces', text: 'The surface switch always finds new muscles. Your legs are sore after two sessions and the events are close.', choices: [
    c('Add extra movement work', 'Adapt faster, more load', { st: 3, tr: 1.03 }),
    c('Book massage and treatment', 'Costs money, eases the strain', { $: -250, st: -5 }),
    c('Build up gradually', 'Steady and unspectacular', {})] },
  { id: 'h8', cat: 'health', title: 'A bug in the locker room', text: 'Half the locker room is coughing, and tonight is the players\' party, the one evening when everyone relaxes.', choices: [
    c('Skip the party', 'Avoids the bug, a quiet night', { mo: -2 }),
    c('Go and enjoy it', 'Good for morale, some risk of feeling rough', { mo: 4, fa: 4 }),
    c('Drop in for half an hour', 'A little of both', { mo: 2, fa: 1 })] },
  { id: 'h9', cat: 'health', title: 'A clean-up procedure', text: 'A specialist says a small off-season procedure would settle a problem you have managed for years. It means weeks without a racket.', when: S => age(S) >= 26 && me(S).strain > 35, choices: [
    c('Have the procedure', 'Costly and slow now, less strain afterwards', { $: -2500, st: -18, sh: -10, tr: 0.9 }),
    c('Keep managing it', 'No time lost, the problem stays', { st: 2 }),
    c('Get a second opinion', 'A small cost for more certainty', { $: -300, st: -3 })] },
  { id: 'h10', cat: 'health', title: 'Recovery equipment', text: 'A rental company offers travelling recovery kit for the block: compression boots, a portable ice bath, the lot.', choices: [
    c('Rent it', 'Costs money, better recovery between matches', { $: -300, rc: 2 }),
    c('Share a set with another player', 'Cheaper, less convenient', { $: -120, rc: 1 }),
    c('Use the hotel bath', 'Free', {})] },
  // ---- relationships and support (8) ----
  { id: 'r1', cat: 'rel', personal: true, title: 'A family celebration', text: 'There is a big family celebration at home in the middle of the block. Everyone understands the job, and everyone has asked whether you are coming.', choices: [
    c('Go home for it', 'Lifts morale, costs practice', { mo: 7, tr: 0.93, fr: 3 }),
    c('Fly in for a single day', 'Tiring, but you are there', { mo: 4, fa: 4 }),
    c('Send a message and stay', 'Protects preparation, and you will feel it', { mo: -3, fr: -3 })] },
  { id: 'r2', cat: 'rel', personal: true, title: 'Someone new', text: 'You keep running into the same person at the same café near your training base. Coffee has turned into long conversations. They ask whether you would like to have dinner.', when: S => S.u.rel.partner === null && age(S) >= 20, choices: [
    c('Say yes and see where it goes', 'Something good off the court, a little less focus', { startPartner: true, mo: 6, tr: 0.97 }),
    c('Keep it as a friendship', 'Good company without complication', { mo: 2 }),
    c('Explain that this is not the moment', 'Nothing changes', {})] },
  { id: 'r3', cat: 'rel', personal: true, title: 'Life on the road together', text: '{partner} would like to travel with you for this block. It would be good to have them there. It would also change every routine you have.', when: S => S.u.rel.partner !== null, repeat: 6, choices: [
    c('Travel together', 'Support and happiness, extra cost', { mo: 5, pa: 8, $: -600 }),
    c('Ask for space during events', 'Full focus, some distance', { pa: -6, tr: 1.03 }),
    c('Meet for the middle week only', 'A workable split', { mo: 3, pa: 3, $: -250 })] },
  { id: 'r4', cat: 'rel', personal: true, title: 'A friend in trouble', text: '{friend} is going through a rough month and has not asked for anything, which is how you know it is serious.', choices: [
    c('Go and help for a few days', 'Strengthens the friendship, costs practice', { fr: 10, tr: 0.95, fa: 2, mo: 2 }),
    c('Call every evening', 'Something real, from a distance', { fr: 5 }),
    c('Send money and a message', 'Practical; not quite what was needed', { $: -300, fr: 1 })] },
  { id: 'r5', cat: 'rel', personal: true, title: 'Words after a loss', text: 'After a bad defeat you snapped at someone who was only trying to help. The silence since has lasted two days.', choices: [
    c('Apologise first', 'Clears the air', { mo: 2, fr: 4, pa: 4 }),
    c('Let it sit until after the next event', 'No distraction now', { mo: -3 }, { after: 2, text: 'The argument you left unresolved came back at a worse moment. It took a long evening to put right.', fx: { mo: -3, fr: -3 } }),
    c('Ask {coach} to help you talk it through', 'Slower, and it involves your coach', { ct: 2, mo: 1, fr: 2 })] },
  { id: 'r6', cat: 'rel', personal: true, adult: true, title: 'The night after a big week', text: 'A deep run deserves a celebration, and the group heading into town has no intention of stopping at one drink. Your next flight is at noon.', when: recentWin, repeat: 6, choices: [
    c('Go all in', 'A night to remember, a morning to regret', { mo: 8, sh: -4, fa: 5 }),
    c('One drink, then bed', 'A quiet toast', { mo: 3 }),
    c('Skip it', 'Fresh for the flight', { mo: -1, fa: -2 })] },
  { id: 'r7', cat: 'rel', personal: true, adult: true, title: 'The after-hours invitation', text: 'Someone from a sponsor\'s entourage invites you to a private party in a suite upstairs. You know almost nobody going, and gossip accounts follow this crowd closely.', when: S => rank(S) < 300, choices: [
    c('Go', 'Fun and well connected, with some exposure', { mo: 5, ag: -2 }, { after: 2, text: 'A blurry photograph from that suite party did the rounds online. {agent} spent an afternoon making sure it stayed a small story.', fx: { mo: -3, ag: -3 } }),
    c('Go with {friend} and leave early', 'Safer company', { mo: 3, fr: 2 }),
    c('Decline', 'A quiet night', {})] },
  { id: 'r8', cat: 'rel', personal: true, title: 'Drifting', text: 'You and {partner} have managed three conversations in a month, each one shorter than the last. Neither of you has said what you are both thinking.', when: S => S.u.rel.partner !== null && S.u.rel.partner < 45, choices: [
    c('End it kindly', 'Hard now, clearer afterwards', { endPartner: true, mo: -6, tr: 1.02 }),
    c('Make real time to repair it', 'Costs practice, may save something good', { pa: 14, tr: 0.94, mo: 2 }),
    c('Leave it for the off-season', 'Postpones the conversation', { pa: -5, mo: -2 })] },
  // ---- sponsorship and media (8) ----
  { id: 'm1', cat: 'media', title: 'A local sponsor\'s photo shoot', text: 'A regional company that has supported you since juniors wants a day of photographs for its spring campaign.', choices: [
    c('Do the shoot', 'A small fee and goodwill, a day on your feet', { $: 400, fa: 2, ag: 3 }),
    c('Offer two hours instead', 'Less money, less disruption', { $: 150, ag: 1 }),
    c('Decline', 'Protects the day', { ag: -2 })] },
  { id: 'm2', cat: 'media', title: 'The podcast', text: 'A tennis podcast with a large audience wants an hour with you. The host is known for getting players to say more than they planned.', choices: [
    c('Be candid', 'Raises your profile; your words may travel', { ag: 4, mo: 2 }, { after: 2, text: 'A line from your podcast interview resurfaced before a big match. Most people liked the honesty; one opponent mentioned it at the net.', fx: { co: -1, ag: 2 } }),
    c('Give safe answers', 'Pleasant and forgettable', { ag: 1 }),
    c('Decline', 'No exposure', {})] },
  { id: 'm3', cat: 'media', title: 'An offer to switch frames', text: 'A racket company offers a bonus if you switch to its frame immediately. Equipment never wins a match, but changing it mid-season can unsettle one.', choices: [
    c('Switch now', 'Money today, an unsettled few weeks', { $: 1500, sh: -6, co: -2 }),
    c('Agree to switch in the off-season', 'A smaller bonus, no disruption', {}, { after: 3, text: 'The off-season racket switch went through without drama, and the delayed bonus arrived.', fx: { $: 700 } }),
    c('Stay with what you know', 'No change', {})] },
  { id: 'm4', cat: 'media', title: 'The pile-on', text: 'A loss you would rather forget has become a clip. Strangers are filling your mentions with advice and worse.', choices: [
    c('Reply to a few of them', 'Satisfying for a minute', { mo: -4 }),
    c('Log off for a week', 'Peace and quiet', { mo: 3 }),
    c('Let {agent} handle it', 'Out of your hands', { ag: 2, mo: 1 })] },
  { id: 'm5', cat: 'media', title: 'A charity exhibition', text: 'A children\'s hospital is organising an exhibition evening and would love a current professional on the bill. There is no fee.', choices: [
    c('Play', 'Good for the soul and your standing, a little tiring', { mo: 5, fa: 3, ag: 4 }),
    c('Donate signed equipment', 'A smaller contribution', { mo: 1, ag: 1 }),
    c('Decline politely', 'Protects the schedule', {})] },
  { id: 'm6', cat: 'media', title: 'The documentary crew', text: 'A production company wants to follow a player through a full block. It pays well. It also means cameras in the gym, the car and the locker-room corridor.', when: S => rank(S) <= 150, choices: [
    c('Give full access', 'Well paid, distracting', { $: 2000, tr: 0.95, ag: 5 }),
    c('Allow limited access', 'Less money, less intrusion', { $: 800, tr: 0.98, ag: 2 }),
    c('Say no', 'Privacy intact', {})] },
  { id: 'm7', cat: 'media', title: 'An appearance fee', text: 'A small invitational offers a fee to appear during what was meant to be a training week. The tennis would be light and the travel real.', choices: [
    c('Take the fee', 'Money now, less preparation', { $: 900, tr: 0.92, fa: 3 }),
    c('Negotiate a single day', 'Less money, less disruption', { $: 400, tr: 0.97 }),
    c('Decline', 'Training week protected', {})] },
  { id: 'm8', cat: 'media', title: 'The column', text: 'A well-read columnist has written that you have reached your level and should be grateful for it. Everyone in the locker room has seen it.', choices: [
    c('Answer in your next press conference', 'Stands your ground, keeps the story alive', { co: 1, ag: -1 }),
    c('Use it as fuel and say nothing', 'Quiet motivation', { co: 2, mo: 1 }),
    c('Ignore it completely', 'No effect', {})] },
  // ---- travel and competition (6) ----
  { id: 't1', cat: 'travel', title: 'The missing bag', text: 'Your racket bag did not make the connection. The airline promises it will arrive "within days". Your first match is sooner than that.', choices: [
    c('Buy replacements', 'Costs money, you play with unfamiliar frames', { $: -350, sh: -1 }),
    c('Borrow frames from another player', 'Free, and they feel wrong', { sh: -3 }),
    c('Wait and hope', 'Free; you may lose practice days', { sh: -4, mo: -1 })] },
  { id: 't2', cat: 'travel', title: 'No practice courts', text: 'The event has too few practice courts. You can have 6:30 in the morning, half a court beside a seeded player, or nothing.', choices: [
    c('Take the dawn slot', 'Proper practice, less sleep', { sh: 2, fa: 2 }),
    c('Share with the seed', 'Useful, slightly intimidating', { sh: 1, co: 1 }),
    c('Skip practice today', 'Rest instead', { fa: -2, sh: -2 })] },
  { id: 't3', cat: 'travel', title: 'The cheap route', text: 'The direct flight costs real money. The cheap option has two changes and lands at four in the morning.', choices: [
    c('Fly direct', 'Costs more, arrive fresher', { $: -250 }),
    c('Take the cheap route', 'Saves money, costs energy', { $: 150, fa: 5 }),
    c('Go a day early on the cheap route', 'Saves a little, costs a training day', { tr: 0.98, fa: 2 })] },
  { id: 't4', cat: 'travel', title: 'A week inside a bigger event', text: 'A larger tournament near home needs practice partners for its main-draw players. No points, no prize money, and a week inside the world you are trying to reach.', when: S => rank(S) > 200, choices: [
    c('Accept', 'Sharper and inspired, a week without competition', { sh: 3, mo: 3, co: 1 }),
    c('Go for two days', 'A taste of it', { mo: 2 }),
    c('Stick to your plan', 'Nothing changes', {})] },
  { id: 't5', cat: 'travel', title: 'The crowd', text: 'You beat a local favourite last week and the crowd let you know what it thought, loudly, for two hours. Reporters ask how it felt.', choices: [
    c('Say you enjoyed it', 'Owns the moment', { co: 2 }),
    c('Complain about the behaviour', 'Honest, and it may follow you', { ag: -3, mo: -1 }),
    c('Laugh it off', 'Lightens the mood', { mo: 2 })] },
  { id: 't6', cat: 'travel', title: 'Paperwork', text: 'A visa application for a later swing needs documents, an appointment and patience, all during a training week.', choices: [
    c('Handle it yourself', 'Free, eats practice time', { tr: 0.96 }),
    c('Pay an agency', 'Costs money, saves the week', { $: -300 }),
    c('Ask {agent} to sort it out', 'A favour that is noticed', { ag: -2 })] },
  // ---- retirement and future planning (4) ----
  { id: 'f1', cat: 'future', title: 'A coaching qualification', text: 'The federation is running a coaching course in the off-season. Several players your age have signed up, half joking about life after tennis.', when: S => age(S) >= 28, choices: [
    c('Enrol', 'A small cost and an eye on the future', { $: -500, mo: 3 }, { after: 4, text: 'You finished the coaching qualification. Explaining the game to others has changed how you see your own.', fx: { ab: ['comp', 0.3], mo: 2 } }),
    c('Not yet', 'Nothing changes', {})] },
  { id: 'f2', cat: 'future', title: 'An investment pitch', text: 'An acquaintance from the tour is raising money for a tennis academy and wants you in early. The brochure is glossy. The numbers are optimistic.', when: S => S.u.cash > 50000, choices: [
    c('Invest', 'A meaningful sum with an uncertain return', { $: -15000 }, { after: 6, text: 'The academy you invested in has opened. It is too early to call it a success, but the first distribution has arrived.', fx: { $: 9000, mo: 1 } }),
    c('Pay an adviser to review it', 'A small cost for a clear answer', { $: -200 }),
    c('Decline', 'Nothing ventured', {})] },
  { id: 'f3', cat: 'future', title: 'Thinking about the end', text: 'For the first time you caught yourself counting the seasons you might have left, rather than the ones you have played.', when: S => age(S) >= 32, choices: [
    c('Talk it over with your family', 'Shares the weight', { mo: 4, fr: 3 }),
    c('Set yourself a private deadline', 'Clarity, and a little pressure', { co: 2, mo: -1 }),
    c('Put it out of your mind', 'Not today', {})] },
  { id: 'f4', cat: 'future', title: 'A farewell season?', text: '{agent} asks whether you want next season announced as your last. Tournaments like to plan send-offs. It would also make the decision feel final.', when: S => age(S) >= 34, choices: [
    c('Let it be known that the end is near', 'Warm receptions, and no way back', { mo: 5, ag: 5 }),
    c('Keep your plans to yourself', 'All options open', {})] },
];
export const evById = (id: string) => EVENTS.find(e => e.id === id)!;
