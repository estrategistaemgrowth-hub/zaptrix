/**
 * Supabase Auth (client e admin API) sempre retorna mensagem de erro em
 * inglês, sem opção de i18n nativa. Como o Zaptrix é 100% em português,
 * traduzimos aqui as mensagens conhecidas antes de mostrar ao usuário —
 * usado tanto client-side (login, cadastro) quanto server-side (rotas que
 * repassam createError.message da Auth Admin API).
 */
const EXACT_MATCHES: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'E-mail ainda não confirmado.',
  'User not found': 'Usuário não encontrado.',
  'User already registered': 'Já existe uma conta com este e-mail.',
  'A user with this email address has already been registered': 'Já existe uma conta com este e-mail.',
  'signup requires a valid password': 'Informe uma senha válida.',
  'Token has expired or is invalid': 'Link expirado ou inválido.',
  'New password should be different from the old password.': 'A nova senha deve ser diferente da atual.',
};

export function translateAuthError(message: string | null | undefined): string {
  if (!message) return 'Erro inesperado. Tente novamente.';

  if (EXACT_MATCHES[message]) return EXACT_MATCHES[message];

  const lower = message.toLowerCase();

  if (lower.includes('password') && (lower.includes('character') || lower.includes('at least'))) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'Já existe uma conta com este e-mail.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (lower.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde um pouco antes de tentar de novo.';
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'E-mail inválido.';
  }
  if (lower.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado.';
  }

  // Sem tradução conhecida: melhor mostrar a mensagem original do que nada.
  return message;
}
