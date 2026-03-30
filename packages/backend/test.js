const { changedEventText } = require("./lib/email.js");
const band = { display_name: "The Beatles" };
const event = { type: "Rehearsal", start: "2026-03-30", location: "Liverpool" };
console.log(changedEventText(band, event));

