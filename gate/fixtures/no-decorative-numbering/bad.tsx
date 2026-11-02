export function Bad() {
  const steps = ["01", "02"]; // @expect no-decorative-numbering
  const label = "03."; // @expect no-decorative-numbering
  const slash = "/ 04"; // @expect no-decorative-numbering
  const pad = (i: number) => String(i + 1).padStart(2, "0"); // @expect no-decorative-numbering
  const pad2 = (i: number) => `${i}`.padStart(2, '0'); // @expect no-decorative-numbering
  // vs-allow no-decorative-numbering: clock display needs two digits, not decoration
  const minutes = (m: number) => String(m).padStart(2, "0");
  // vs-allow no-decorative-numbering
  const seconds = (s: number) => String(s).padStart(2, "0"); // @expect no-decorative-numbering
  return (
    <div>
      <span>05</span> {/* @expect no-decorative-numbering */}
      <span className="text-ink-muted">06.</span> {/* @expect no-decorative-numbering */}
      {"07"} {/* @expect no-decorative-numbering */}
      <span>
        08 {/* @expect no-decorative-numbering */}
      </span>
      {steps}{label}{slash}{pad(1)}{pad2(1)}{minutes(1)}{seconds(1)}
    </div>
  )
}
