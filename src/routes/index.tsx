import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-title font-semibold">Vitali Stack</h1>
      <p className="mt-4 text-ink-muted">
        This page is the starting point. Replace it with your app; the gate
        keeps agent-written code on the tokens.
      </p>
      <a
        className="mt-6 inline-block rounded-control bg-accent px-4 py-2 text-surface"
        href="https://github.com/vitaligusatinsky/vitalistack"
      >
        Read the project
      </a>
    </main>
  )
}
