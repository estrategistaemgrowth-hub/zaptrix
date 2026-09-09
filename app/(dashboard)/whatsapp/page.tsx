import { redirect } from 'next/navigation';

export default function WhatsappRedirect() {
  redirect('/configuracoes?section=whatsapp');
}
