import Image from 'next/image';
import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <Image src="/zaptrix-logo-light.png" alt="Zaptrix" width={150} height={48} priority />
        </div>

        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <SearchX className="w-8 h-8 text-muted-foreground" />
        </div>

        <h1 className="text-xl font-bold text-foreground mb-2">Página não encontrada</h1>
        <p className="text-muted-foreground text-sm mb-8">
          O link que você acessou não existe ou foi movido.
        </p>

        <Link href="/dashboard" className="inline-block btn-gradient font-medium px-6 py-2.5">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
