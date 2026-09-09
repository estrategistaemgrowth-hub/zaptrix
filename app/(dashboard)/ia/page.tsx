'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Save, Zap, ToggleLeft, ToggleRight } from 'lucide-react';

interface AIProfile {
  id: string;
  agent_name: string | null;
  company_name: string | null;
  objective: string | null;
  persona: string | null;
  tone: string | null;
  custom_tone: string | null;
  response_style: string | null;
  allowed_topics: string | null;
  forbidden_topics: string | null;
  business_rules: string | null;
  enabled: boolean;
}

const emptyForm = {
  agent_name: '',
  company_name: '',
  objective: '',
  persona: '',
  tone: 'amigavel',
  custom_tone: '',
  response_style: 'conciso',
  allowed_topics: '',
  forbidden_topics: '',
  business_rules: '',
  enabled: true,
};

export default function IaPage() {
  const [profile, setProfile] = useState<AIProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const supabase = createClient();

  useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const workspace = await ensureWorkspace(supabase, session.user.id, session.user.email);
      if (!workspace) {
        setError('Não foi possível carregar seu workspace.');
        setLoading(false);
        return;
      }

      setWorkspaceId(workspace.workspaceId);

      const { data, error: loadError } = await supabase
        .from('ai_profiles')
        .select('*')
        .eq('workspace_id', workspace.workspaceId)
        .maybeSingle();

      if (loadError) {
        setError('Erro ao carregar perfil de IA: ' + loadError.message);
      } else if (data) {
        setProfile(data);
        setFormData({
          agent_name: data.agent_name || '',
          company_name: data.company_name || '',
          objective: data.objective || '',
          persona: data.persona || '',
          tone: data.tone || 'amigavel',
          custom_tone: data.custom_tone || '',
          response_style: data.response_style || 'conciso',
          allowed_topics: data.allowed_topics || '',
          forbidden_topics: data.forbidden_topics || '',
          business_rules: data.business_rules || '',
          enabled: data.enabled,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setSaving(true);
    setError('');
    setSaved(false);

    const payload = { workspace_id: workspaceId, ...formData };

    const { error: saveError } = profile
      ? await supabase.from('ai_profiles').update(payload).eq('id', profile.id)
      : await supabase.from('ai_profiles').insert([payload]);

    if (saveError) {
      console.error('Erro ao salvar perfil de IA:', saveError);
      setError('Erro ao salvar: ' + saveError.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    await init();
  }

  if (loading) {
    return (
      <div className="p-2">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Configuração da IA</h1>
              <p className="text-muted-foreground">Personalize seu agente de atendimento</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
            className="flex items-center gap-2 text-sm font-medium text-foreground"
          >
            {formData.enabled ? (
              <ToggleRight className="w-8 h-8 text-primary" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-muted-foreground" />
            )}
            {formData.enabled ? 'IA ativa' : 'IA desativada'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Perfil de IA salvo com sucesso!
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome do agente
                </label>
                <input
                  type="text"
                  value={formData.agent_name}
                  onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: Ana"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome da empresa
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: Loja da Ana"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Objetivo do agente
              </label>
              <textarea
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="ex: Tirar dúvidas sobre produtos e ajudar o cliente a fechar a compra"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Persona</label>
              <textarea
                value={formData.persona}
                onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="ex: Vendedora experiente, atenciosa, que conhece bem o catálogo"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tom de voz</label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                >
                  <option value="amigavel">Amigável</option>
                  <option value="formal">Formal</option>
                  <option value="descontraido">Descontraído</option>
                  <option value="profissional">Profissional</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Estilo de resposta
                </label>
                <select
                  value={formData.response_style}
                  onChange={(e) => setFormData({ ...formData, response_style: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                >
                  <option value="conciso">Conciso (respostas curtas)</option>
                  <option value="detalhado">Detalhado</option>
                  <option value="conversacional">Conversacional</option>
                </select>
              </div>
            </div>

            {formData.tone === 'personalizado' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Descreva o tom personalizado
                </label>
                <input
                  type="text"
                  value={formData.custom_tone}
                  onChange={(e) => setFormData({ ...formData, custom_tone: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: Bem-humorado, usa gírias regionais"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tópicos permitidos
                </label>
                <textarea
                  value={formData.allowed_topics}
                  onChange={(e) => setFormData({ ...formData, allowed_topics: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: produtos, preços, entrega, trocas"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tópicos proibidos
                </label>
                <textarea
                  value={formData.forbidden_topics}
                  onChange={(e) => setFormData({ ...formData, forbidden_topics: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: política, concorrentes, assuntos pessoais"
                  rows={2}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Regras de negócio
              </label>
              <textarea
                value={formData.business_rules}
                onChange={(e) => setFormData({ ...formData, business_rules: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="ex: Nunca dar desconto acima de 10% sem aprovação humana. Prazo de entrega é sempre 5 dias úteis."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Próximas Etapas</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>→ Adicione documentação na seção Base de Conhecimento</li>
            <li>→ Configure as credenciais LLM nas Configurações</li>
            <li>→ Conecte sua conta WhatsApp via Evolution API</li>
            <li>→ Em cada conversa no Atendimento, você pode ligar/desligar a IA individualmente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
