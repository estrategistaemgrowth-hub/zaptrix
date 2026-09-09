import { redirect } from 'next/navigation';

/**
 * Rota antiga de cadastro (antes de existir o painel master + planos).
 * Não tem mais link nenhum apontando pra cá (o botão "Criar conta" do login
 * foi migrado pra /assinar), mas mantemos o path vivo — só redirecionando —
 * caso alguém tenha um link salvo. Era um problema real: signUp direto por
 * aqui criava, via /onboarding, um workspace sem plano e sem vencimento de
 * teste (subscription_expires_at nulo nunca bloqueia no middleware), ou
 * seja, acesso grátis e ilimitado pra sempre, contornando toda a cobrança.
 */
export default function LegacySignupRedirect() {
  redirect('/assinar');
}
