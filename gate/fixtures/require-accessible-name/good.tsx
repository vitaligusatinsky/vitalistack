export function Good() {
  return (
    <div>
      <button aria-label="Remove" onClick={remove}><TrashIcon /></button>
      <button aria-labelledby="remove-label"><TrashIcon /></button>
      <button title="Remove"><TrashIcon /></button>
      <button><TrashIcon /> Remove</button>
      <button>Remove</button>
      <button>{label}</button>
      <button {...props}><TrashIcon /></button>
      <a href="/settings"><GearIcon aria-label="Settings" /></a>
      <a href="/home">Home</a>
      <img alt="" role="presentation" src="/a.png" />
      <img alt="Team photo" src="/team.png" />
      <img {...imgProps} />
      <button><TrashIcon>Remove</TrashIcon></button>
      <button aria-label="Menu">{open ? <XIcon /> : <MenuIcon />}</button>
      <button>{open ? <XIcon /> : "Menu"}</button>
      <button>{cond && "Text"}</button>
      <button>{label}{cond && <Icon />}</button>
    </div>
  )
}
