export function Good() {
  const rows = [{ icon: "bolt", title: "Fast" }];
  const note = { label: "Say hi 👋 to us", title: "Welcome" };
  const msg = { text: "🎉 anywhere else is user text" };
  toast("Saved 🎉");
  toast.success("Done");
  return (
    <div>
      <p>Thanks for the help 🎉 see you there</p>
      <footer>© 2026 Example Ltd.</footer>
      <footer>Example™ and Example® are marks.</footer>
      <h2>#1 in the category</h2>
      <h3>Step 1 of 3</h3>
      <a href="/next">Read more ↗</a>
      <button type="button">Save</button>
      <img alt="A rocket 🚀 on the pad" src="/a.png" />
      <input placeholder="Say something 😀" />
      <div className="text-4xl">Rocket</div>
      <span>1 &amp; 2</span>
      <button>{"Launch"}</button>
      {rows.length}
    </div>
  )
}
