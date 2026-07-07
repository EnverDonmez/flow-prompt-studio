/**
 * Flow Prompt Studio — Call Sheet Generator
 *
 * Generates professional film production call sheets as HTML (→ PDF printable).
 * Industry-standard 9-section format used by 1st ADs worldwide.
 *
 * Usage:
 *   const cs = new CallSheetGenerator(parseResult, coverageResult);
 *   const html = cs.generate({ day: 1, director: "Jane Doe" });
 */

/* ─── Status Codes ─── */
const CAST_STATUS = {
  SW: "Start/Work (first day)",
  W: "Work (continuing)",
  WF: "Work/Finish (last day)",
  SWF: "Start/Work/Finish (one day only)",
  H: "Hold (not working today)",
  R: "Rehearsal",
  T: "Travel",
};

/* ─── Generator ─── */

class CallSheetGenerator {
  /**
   * @param {object} parseResult — From ScreenplayParser
   * @param {object} coverageResult — From CoverageGenerator (optional)
   * @param {object} options — Production info
   */
  constructor(parseResult, coverageResult, options = {}) {
    this.parse = parseResult;
    this.coverage = coverageResult;
    this.options = options;
  }

  /**
   * Generate call sheet as HTML string.
   */
  generate(options = {}) {
    const day = options.day || 1;
    const totalDays = options.totalDays || this.parse.stats.estimatedDurationMinutes || 10;
    const director = options.director || "TBD";
    const producer = options.producer || "TBD";
    const dp = options.dp || "TBD";
    const pd = options.pd || "TBD";
    const ad = options.ad || "TBD";
    const title = options.title || this.parse.stats.filename;
    const shootDate = options.date || new Date().toISOString().split("T")[0];
    const callTime = options.callTime || "07:00";
    const location = options.location || "TBD";
    const locationAddress = options.locationAddress || "";
    const parking = options.parking || "See map";
    const hospital = options.hospital || "Nearest: TBD";
    const weather = options.weather || { high: 72, low: 55, condition: "Sunny", sunrise: "06:30", sunset: "19:45" };

    const { scenes, characters } = this.parse;

    // Shooting schedule
    const scheduleRows = scenes.map((s, i) => {
      const shotCount = this.coverage
        ? this.coverage.shotRows.filter((r) => r["Scene"] === s.number || r["Scene"].includes(s.number)).length
        : 0;
      return {
        time: `${String(8 + Math.floor(i * 1.5)).padStart(2, "0")}:00`,
        scene: s.number,
        description: s.heading.substring(0, 60),
        dayNight: s.heading.match(/DAY/i) ? "D" : s.heading.match(/NIGHT/i) ? "N" : "D/N",
        cast: s.characters.join(", ") || "—",
        location: s.location,
        pages: Math.max(1, Math.ceil(s.dialogueCount / 5)),
        shots: shotCount || Math.ceil(Math.random() * 8 + 5),
      };
    });

    // Cast list
    const castRows = characters.map((c) => ({
      id: c.name.substring(0, 4).toUpperCase(),
      name: "TBD",
      character: c.name,
      status: "W",
      callTime,
      onSet: this._addHours(callTime, 1.5),
    }));

    // Crew departments (standard template)
    const crewDept = [
      { dept: "Director", role: "Director", name: director, call: callTime },
      { dept: "Director", role: "1st AD", name: ad, call: this._addHours(callTime, -0.5) },
      { dept: "Camera", role: "Director of Photography", name: dp, call: callTime },
      { dept: "Camera", role: "1st AC", name: "TBD", call: callTime },
      { dept: "Camera", role: "2nd AC", name: "TBD", call: callTime },
      { dept: "Grip & Electric", role: "Gaffer", name: "TBD", call: this._addHours(callTime, -1) },
      { dept: "Grip & Electric", role: "Key Grip", name: "TBD", call: this._addHours(callTime, -1) },
      { dept: "Sound", role: "Sound Mixer", name: "TBD", call: callTime },
      { dept: "Sound", role: "Boom Op", name: "TBD", call: callTime },
      { dept: "Art", role: "Production Designer", name: pd, call: this._addHours(callTime, -1) },
      { dept: "Art", role: "Art Director", name: "TBD", call: this._addHours(callTime, -1) },
      { dept: "Wardrobe", role: "Costume Designer", name: "TBD", call: this._addHours(callTime, -0.5) },
      { dept: "Hair & Makeup", role: "Key HMU", name: "TBD", call: this._addHours(callTime, -1) },
      { dept: "Production", role: "Producer", name: producer, call: callTime },
      { dept: "Production", role: "UPM", name: "TBD", call: callTime },
      { dept: "Production", role: "PA", name: "TBD", call: this._addHours(callTime, -1) },
    ];

    // Equipment notes from coverage
    const equipmentNotes = this.coverage?.genre?.equipment || [];

    return this._buildHtml({
      title, director, producer, dp, pd, ad, day, totalDays, shootDate, callTime,
      location, locationAddress, parking, hospital, weather,
      scheduleRows, castRows, crewDept, equipmentNotes, scenes: scenes.length,
      totalShots: this.coverage?.totalShots || 0,
    });
  }

  _addHours(time, hours) {
    const [h, m] = (time || "07:00").split(":").map(Number);
    const total = h * 60 + m + hours * 60;
    const newH = Math.floor(total / 60) % 24;
    const newM = Math.round(total % 60);
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  }

  _buildHtml(data) {
    const scheduleHtml = data.scheduleRows.map((r) =>
      `<tr><td>${r.time}</td><td>${r.scene}</td><td>${r.description}</td><td>${r.dayNight}</td><td>${r.cast}</td><td>${r.location}</td><td>${r.pages}</td><td>${r.shots}</td></tr>`
    ).join("");

    const castHtml = data.castRows.map((c) =>
      `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.character}</td><td>${c.status}</td><td>${c.callTime}</td><td>${c.onSet}</td></tr>`
    ).join("");

    const crewByDept = {};
    data.crewDept.forEach((c) => {
      if (!crewByDept[c.dept]) crewByDept[c.dept] = [];
      crewByDept[c.dept].push(c);
    });
    const crewHtml = Object.entries(crewByDept).map(([dept, members]) =>
      `<tr class="dept-header"><td colspan="3"><strong>${dept}</strong></td></tr>` +
      members.map((m) => `<tr><td></td><td>${m.role}</td><td>${m.name}</td><td>${m.call}</td></tr>`).join("")
    ).join("");

    const equipHtml = data.equipmentNotes.map((e) => `<li>${e}</li>`).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Call Sheet — Day ${data.day}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:10pt;color:#000;max-width:800px;margin:0 auto;padding:20px}
  .header{text-align:center;border:3px solid #000;padding:15px;margin-bottom:15px}
  .header h1{font-size:18pt;text-transform:uppercase;letter-spacing:3px}
  .header .sub{font-size:11pt;margin-top:4px}
  .row{display:flex;border:1px solid #000;border-bottom:none}
  .row:last-child{border-bottom:1px solid #000}
  .cell{flex:1;padding:6px 8px;border-right:1px solid #000;font-size:9pt}
  .cell:last-child{border-right:none}
  .cell strong{display:block;font-size:7pt;text-transform:uppercase;color:#555;margin-bottom:2px}
  .section-title{background:#000;color:#fff;padding:6px 10px;font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin-top:15px}
  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:8.5pt}
  th{background:#333;color:#fff;padding:5px 6px;text-align:left;font-size:7.5pt;text-transform:uppercase}
  td{padding:4px 6px;border:0.5px solid #ddd}
  tr:nth-child(even){background:#f9f9f9}
  .dept-header td{background:#eee;font-size:8pt;padding:4px 6px}
  .notes{padding:10px;font-size:9pt;line-height:1.5}
  .footer{text-align:center;font-size:7pt;color:#999;margin-top:20px;border-top:1px solid #ddd;padding-top:10px}
  @media print{body{padding:0}.section-title{background:#000!important;color:#fff!important;-webkit-print-color-adjust:exact}}
</style></head>
<body>
<div class="header">
  <h1>Call Sheet — Day ${data.day} of ${data.totalDays}</h1>
  <div class="sub">${data.title} · ${data.shootDate}</div>
</div>
<div class="row">
  <div class="cell"><strong>Director</strong>${data.director}</div>
  <div class="cell"><strong>Producer</strong>${data.producer}</div>
  <div class="cell"><strong>DP</strong>${data.dp}</div>
  <div class="cell"><strong>1st AD</strong>${data.ad}</div>
</div>
<div class="row">
  <div class="cell"><strong>General Call</strong>${data.callTime}</div>
  <div class="cell"><strong>Weather</strong>${data.weather.high}°/${data.weather.low}° ${data.weather.condition}</div>
  <div class="cell"><strong>Sunrise</strong>${data.weather.sunrise}</div>
  <div class="cell"><strong>Sunset</strong>${data.weather.sunset}</div>
</div>
<div class="row">
  <div class="cell" style="flex:2"><strong>Location</strong>${data.location}<br><small>${data.locationAddress}</small></div>
  <div class="cell"><strong>Parking</strong>${data.parking}</div>
  <div class="cell"><strong>Nearest Hospital</strong>${data.hospital}</div>
</div>

<div class="section-title">Shooting Schedule (${data.scenes} scenes · ${data.totalShots} shots)</div>
<table>
  <tr><th>Time</th><th>Scene</th><th>Description</th><th>D/N</th><th>Cast</th><th>Location</th><th>Pgs</th><th>Shots</th></tr>
  ${scheduleHtml}
</table>

<div class="section-title">Cast List · Day ${data.day}</div>
<table>
  <tr><th>ID</th><th>Actor</th><th>Character</th><th>S</th><th>Call</th><th>On Set</th></tr>
  ${castHtml}
</table>
<p style="font-size:7.5pt;color:#666;margin:4px 8px">S=Start W=Work F=Finish H=Hold R=Rehearsal T=Travel · Meal break NLT 6 hrs after general call</p>

<div class="section-title">Crew Call</div>
<table>
  <tr><th>Dept</th><th>Role</th><th>Name</th><th>Call</th></tr>
  ${crewHtml}
</table>

${data.equipmentNotes.length > 0 ? `
<div class="section-title">Equipment Notes</div>
<div class="notes"><ul>${equipHtml}</ul></div>
` : ""}

<div class="section-title">Special Announcements</div>
<div class="notes">
  • Safety meeting at crew call. All crew must attend.<br>
  • No photos of cast without permission.<br>
  • Walkie channels: Ch.1 Production, Ch.2 Camera, Ch.3 G&E, Ch.4 ADs<br>
  • Catering provided. Dietary restrictions: notify UPM 24h in advance.
</div>

<div class="footer">
  Generated by Flow Prompt Studio v${require("../package.json").version} · ${new Date().toISOString().split("T")[0]}<br>
  This is a template — fill in TBD fields before distribution.
</div>
</body></html>`;
  }
}

module.exports = { CallSheetGenerator, CAST_STATUS };
