const { eventUpdated } = require("./lib/index.js");
const snapshot = {
  data: {
    after: { data: () => ({ type: "Rehearsal", start: "2026-03-30" }) }
  },
  params: { bandid: "myband", eventid: "myevent" }
};
eventUpdated(snapshot).then(() => console.log("Success")).catch(e => console.error("Caught:", e));

