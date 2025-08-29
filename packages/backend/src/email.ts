function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

function utcDate(timestring: string): number {
  const [date, time] = timestring.split("T");
  const [year, month1, day] = date.split("-").map((s) => parseInt(s));
  const month = month1 - 1; // adjust month number to be zero-based
  if (time) {
    return Date.UTC(year, month, day, ...time.split(":").map((s) => parseInt(s)));
  } else {
    return Date.UTC(year, month, day);
  }
}

// function range(start: string, stop: string): string {
//   let fmt = start.indexOf("T") > 0 ? dateTimeFmt : dateFmt;
//   if ("formatRange" in fmt) {
//     return (fmt as any).formatRange(utcDate(start), utcDate(stop));
//   } else {
//     return `${fmt.format(utcDate(start))} – ${fmt.format(utcDate(stop))}`;
//   }
// }

function formatStart(start: string): string {
  const fmt = start.indexOf("T") > 0 ? dateTimeFmt : dateFmt;
  const milliseconds = utcDate(start);
  return fmt.format(milliseconds);
}

function eventRowHtml(event: BandEvent): string {
  const etype = escape(event.type);
  const start = formatStart(event.start);
  if (event.cancelled) {
    return `<tr valign="top">
  <td width=32>&nbsp;</td>
  <td>
  <span style="font-weight: 600">${etype}</span>
  <span>${start}</span>
  <span style="border-radius: 0.5em; padding: 0 0.5em;
        background: #ffaaaa; color: black; font-weight: 600">INSTÄLLT</span>
  </td>
</tr>`;
  }

  const loc = event.location ? escape(event.location) : "";
  const desc = event.description ? escape(event.description) : "";
  return `<tr valign="top">
  <td width=32>&nbsp;</td>
  <td>
    <span style="font-weight: 600">${etype}</span> <span>${start}</span><br>
    <span style="font-style: italic; font-size: 0.875em">${loc}</span><br>
    <span style="font-size: 0.875em">${desc}</span><br>
  </td>
</tr>`;
}

function eventRowText(event: BandEvent): string {
  const etype = escape(event.type);
  const start = formatStart(event.start);
  if (event.cancelled) {
    return `    ${start} -- INSTÄLLT: ${etype}`;
  }

  const loc = event.location ? `\nPlats: ${escape(event.location)}` : "";
  const desc = event.description ? `\n${escape(event.description)}` : "";
  return `    ${start} -- ${etype}${loc}${desc}`;
}

export function newEventHtml(band: Band, event: BandEvent): string {
  return `<html>
<body>
<p>
En ny händelse har lagts till i kalendern för ${escape(band.display_name)}.</p>
<table border=0 style="margin-top: 1em">
${eventRowHtml(event)}
</table>
</body>
</html>`;
}

export function changedEventText(band: Band, event: BandEvent): string {
  return `En händelse har ändrats i kalendern för ${escape(band.display_name)}.

${eventRowText(event)}
`;
}

export function changedEventHtml(band: Band, event: BandEvent): string {
  return `<html>
<body>
<p>
En händelse har ändrats i kalendern för ${escape(band.display_name)}.</p>
<table border=0 style="margin-top: 1em">
${eventRowHtml(event)}
</table>
</body>
</html>`;
}

export function newEventText(band: Band, event: BandEvent): string {
  return `En ny händelse har lagts till i kalendern för ${escape(
    band.display_name
  )}.

${eventRowText(event)}
`;
}
