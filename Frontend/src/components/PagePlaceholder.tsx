export default function PagePlaceholder({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-3xl">{title}</h1>
    </main>
  );
}
