import Link from "next/link";

export default function NotFound() {
  return <main><h1>404 · Rota bulunamadı</h1><Link href="/learn">Ders haritasına dön</Link></main>;
}
