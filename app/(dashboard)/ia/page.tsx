'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, Zap, Settings2 } from 'lucide-react';

interface AIProfile {
  id: string;
  name: string;
  description: string;
  personality: string;
  greeting: string;
  language_model: string;
  temperature: number;
  max_tokens: number;
}

export default function IaPage() {
  const [profile, setProfile] = useState<AIProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Assistente Zaptrix',
    description: 'Agente de atendimento e vendas automático',
    personality: 'Profissional, educado e prestativo',
    greeting: 'Olá! Como posso ajudar você hoje?',
    language_model: 'gpt-4-turbo',
    temperature: 0.7,
    max_tokens: 2048,
  });
  const supabase = createClient();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: workspace } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .single();

      if (!workspace) return;

      const { data } = await supabase
        .from('ai_profiles')
        .select('*')
        .eq('workspace_id', workspace.workspace_id)
        .single();

      if (data) {
        setProfile(data);
        setFormData({
          name: data.name,
          description: data.description,
          personality: data.personality,
          greeting: data.greeting,
          language_model: data.language_model,
          temperature: data.temperature,
          max_tokens: data.max_tokens,
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
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: workspace } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .single();

      if (!workspace) return;

      if (profile) {
        await supabase
          .from('ai_profiles')
          .update(formData)
          .eq('id', profile.id);
      } else {
        await supabase
          .from('ai_profiles')
          .insert([
            {
              workspace_id: workspace.workspace_id,
              ...formData,
            },
          ]);
      }

      alert('Perfil de IA salvo com sucesso!');
      loadProfile();
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao salvar perfil de IA');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Zap className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configuração da IA</h1>
            <p className="text-muted-foreground">Personalize seu agente de atendimento</p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-lg p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome da IA
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                  placeholder="ex: Assistente Zaptrix"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Modelo de Linguagem
                </label>
                <select
                  value={formData.language_model}
                  onChange={(e) => setFormData({ ...formData, language_model: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                >
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                placeholder="Descrição do agente de IA"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Personalidade
              </label>
              <textarea
                value={formData.personality}
                onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                placeholder="ex: Profissional, educado e prestativo"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Mensagem de Boas-vindas
              </label>
              <input
                type="text"
                value={formData.greeting}
                onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                placeholder="Mensagem inicial da IA"
              />
            </div>

            <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Temperatura (0-1)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Mais alta = mais criativa</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tokens Máximos
                </label>
                <input
                  type="number"
                  min="256"
                  max="4096"
                  step="256"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Tamanho máximo da resposta</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
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

        <div className="bg-white border border-border rounded-lg p-6 mt-8">
          <div className="flex items-center gap-3 mb-4">
            <Settings2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Próximas Etapas</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>→ Adicione documentação na seção Base de Conhecimento</li>
            <li>→ Configure as credenciais LLM nas Configurações</li>
            <li>→ Conecte sua conta WhatsApp via Evolution API</li>
            <li>→ Teste o agente em uma conversa de teste</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
