export function Bad() {
  return (
    <div>
      <div className="bg-white p-4">A</div> {/* @expect no-raw-palette */}
      <div className="text-black">B</div> {/* @expect no-raw-palette */}
      <p className="text-gray-600">C</p> {/* @expect no-raw-palette */}
      <div className="dark:bg-slate-900">D</div> {/* @expect no-raw-palette */}
      <div className="border-red-500/50 border">E</div> {/* @expect no-raw-palette */}
      <a className="hover:text-blue-600" href="/">F</a> {/* @expect no-raw-palette */}
      <div className="ring-offset-white ring-2">G</div> {/* @expect no-raw-palette */}
      <div className="border-t-zinc-200">H</div> {/* @expect no-raw-palette */}
      <div className="bg-white/10">I</div> {/* @expect no-raw-palette */}
      <div className="shadow-black/20 shadow-md">J</div> {/* @expect no-raw-palette */}
      <svg className="fill-emerald-400" />{/* @expect no-raw-palette */}
      <div className="divide-gray-200 divide-y">K</div> {/* @expect no-raw-palette */}
      <div className={`p-4 ${open ? "bg-amber-100" : ""}`}>L</div> {/* @expect no-raw-palette */}
      <div className="bg-white!">important suffix</div> {/* @expect no-raw-palette */}
      <div className="!bg-white">important prefix</div> {/* @expect no-raw-palette */}
      <div className="inset-ring-gray-300 inset-ring">M</div> {/* @expect no-raw-palette */}
      <div className="inset-shadow-black/20">N</div> {/* @expect no-raw-palette */}
      <div className="bg-mauve-500">new v4 palette</div> {/* @expect no-raw-palette */}
      <div className="text-taupe-700">new v4 palette</div> {/* @expect no-raw-palette */}
      <div style={{ color: "var(--color-red-500)" }}>var</div> {/* @expect no-raw-palette */}
      {/* vs-allow no-raw-palette: third-party brand colour that must match the vendor logo */}
      <div className="bg-sky-500">M</div>
      {/* vs-allow no-raw-palette */}
      <div className="bg-sky-500">N</div> {/* @expect no-raw-palette */}
    </div>
  )
}
