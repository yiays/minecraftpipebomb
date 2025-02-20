/*
  Tracks player inactivity on a minecraft server and counts down to a server shutdown
*/

// Imports
import { parse } from "https://deno.land/std/flags/mod.ts"

// Interfaces
interface State {
  days: number,
  losestreak: number,
  timer: number
}
interface Player {
  name: string,
  skin: string,
  last: number,
  update: number
}
interface Players {
  [key: string]: Player
}

// Constants
const ONLINETHRESHOLD = 60 * 5; // 5 minutes
const STARTINGDAYS = 28;
const ONEDAY = 1000 * 60 * 60 * 24;
const SERVER_API = 'https://mc.duncy.nz/stats/data/players.json';

// Handle command-line args
const args = parse(Deno.args);

if (args.help || args.h) {
  console.log(
`minecraftpipebomb [args]

parameters:
--help, -h:     help
--mostrecent:   override last online timestamp (in unix seconds)
--output:       override output file
--state:        override state file name`);
  Deno.exit();
}

const outputFile = args.output || 'output.json';

// Read state
const stateFile = args.state || 'state.json';
let stateRaw: string;
try {
  stateRaw = await Deno.readTextFile(stateFile);
} catch (e) {
  if(e instanceof Deno.errors.NotFound) stateRaw = '{}';
  else throw e;
}
const oldstate: State = JSON.parse(stateRaw);
const state: State = JSON.parse(stateRaw);
if(!('days' in state)) state.days = STARTINGDAYS;
if(!('losestreak' in state)) state.losestreak = 0;

// Get last online status
const htmlResponse = await fetch(SERVER_API);
const players : Players = await htmlResponse.json();

let mostRecent = parseInt(args.mostrecent) || 0;
const playersOnline: string[] = [];

const now = new Date().getTime();

if(mostRecent == 0) {
  for (const uuid in players) {
    const player = players[uuid];
    if (player.last > mostRecent) mostRecent = player.last;
    if (player.last > now / 1000 - ONLINETHRESHOLD) playersOnline.push(player.name);
  }
} else if(mostRecent > now / 1000 - ONLINETHRESHOLD) playersOnline.push('test');
mostRecent += ONLINETHRESHOLD;
mostRecent *= 1000;

// Begin report
console.log('---------------------');
console.log("Time:", new Date());
playersOnline.length?
  console.log("Players online:", JSON.stringify(playersOnline)):
  console.log("Last online:", new Date(mostRecent));
const daysPassed = (now - mostRecent) / ONEDAY;
console.log("It's been", daysPassed, "days since the last player was online.");

while(Math.floor(daysPassed) > state.losestreak) {
  state.days--;
  state.losestreak++;
  console.log("Lose streak has increased to", state.losestreak);
}

const wait: number = ONEDAY * (state.days + state.losestreak);
if((now - mostRecent) < ONEDAY) {
  state.losestreak = 0;
}
if(playersOnline.length) state.timer = now + wait;
else state.timer = mostRecent + wait;

// Skip saving if nothing has changed
if(JSON.stringify(oldstate) == JSON.stringify(state)) {
  console.log("Nothing has changed.");
  Deno.exit();
}

// Save state
await Deno.writeTextFile(stateFile, JSON.stringify(state));

// Report summary of new state
console.log(
  playersOnline.length?'The clock is frozen with':'The clock is ticking with less than',
  state.days,
  'days remaining...'
);

// Generate output for doomsday.json
const outputRaw = {
  days: state.days + state.losestreak,
  losestreak: state.losestreak,
  timer: state.timer,
  online: playersOnline,
  paused: Boolean(playersOnline.length)
};
const output = JSON.stringify(outputRaw);

await Deno.writeTextFile(outputFile, output);
