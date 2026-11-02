// "01" and "02" in a comment are ignored.
export function Good() {
  const a = ["1", "2", "10", "100", "001", "0", "00", "Step 1", "2024-01", "1/2"];
  const b = (n: number) => String(n).padStart(3, "0");
  const c = (n: number) => String(n).padStart(2, " ");
  const d = "It's 01 o'clock";
  return (
    <div>
      <ol>
        <li>Install</li>
        <li>Configure</li>
        <li>Ship</li>
      </ol>
      <p>Step 1 of 3</p>
      <p>Don't pad: 2 items and 10 more</p>
      {a}{b(1)}{c(2)}{d}
    </div>
  )
}
