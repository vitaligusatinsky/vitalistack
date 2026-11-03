export function Bad() {
  return (
    <div>
      <button onClick={remove}><TrashIcon /></button> {/* @expect require-accessible-name */}
      <img src="/hero.png" /> {/* @expect require-accessible-name */}
      <a href="/settings"><GearIcon /><ChevronIcon /></a> {/* @expect require-accessible-name */}
      <IconButton onClick={close}><CloseIcon /></IconButton> {/* @expect require-accessible-name */}
      <button // @expect require-accessible-name
        type="button"
        onClick={remove}
      >
        <TrashIcon />
      </button>
      <img src="/a.png" className="rounded-control"></img> {/* @expect require-accessible-name */}
      {/* vs-allow require-accessible-name: the label is supplied by a wrapping tooltip, reviewed */}
      <button><MenuIcon /></button>
      {/* vs-allow require-accessible-name */}
      <button><MenuIcon /></button> {/* @expect require-accessible-name */}
    </div>
  )
}
