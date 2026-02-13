import { useState } from 'react';
import {
  Sparkles,
  MessageSquare,
  Code,
  Wand2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { generateRuleFromNL, explainRule } from '../api/client';
import { useStore } from '../store';

interface GeneratedRule {
  rule: any;
  confidence?: number;
  suggestions?: string[];
}

interface ExplanationResult {
  explanation: string;
  summary?: string;
  conditions?: string[];
  actions?: string[];
}

export function RuleCopilot() {
  const { addNotification } = useStore();

  // Generate rule state
  const [nlDescription, setNlDescription] = useState('');
  const [context, setContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedRule, setGeneratedRule] = useState<GeneratedRule | null>(null);
  const [copied, setCopied] = useState(false);

  // Explain rule state
  const [explainRuleId, setExplainRuleId] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);

  // Conversation history
  const [history, setHistory] = useState<
    { role: 'user' | 'assistant'; content: string; timestamp: string }[]
  >([]);

  const handleGenerate = async () => {
    if (!nlDescription.trim()) {
      addNotification({ type: 'error', message: 'Please enter a rule description' });
      return;
    }

    setGenerating(true);
    setGeneratedRule(null);

    const userMessage = {
      role: 'user' as const,
      content: nlDescription,
      timestamp: new Date().toISOString(),
    };
    setHistory((prev) => [...prev, userMessage]);

    try {
      const res = await generateRuleFromNL({ description: nlDescription, context: context || undefined });
      const result: GeneratedRule = res.rule ? res : { rule: res };
      setGeneratedRule(result);

      const assistantMessage = {
        role: 'assistant' as const,
        content: `Generated rule:\n${JSON.stringify(result.rule, null, 2)}`,
        timestamp: new Date().toISOString(),
      };
      setHistory((prev) => [...prev, assistantMessage]);

      addNotification({ type: 'success', message: 'Rule generated successfully' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to generate rule';
      addNotification({ type: 'error', message: msg });

      const errorMessage = {
        role: 'assistant' as const,
        content: `Error: ${msg}`,
        timestamp: new Date().toISOString(),
      };
      setHistory((prev) => [...prev, errorMessage]);
    } finally {
      setGenerating(false);
    }
  };

  const handleExplain = async () => {
    if (!explainRuleId.trim()) {
      addNotification({ type: 'error', message: 'Please enter a rule ID' });
      return;
    }

    setExplaining(true);
    setExplanation(null);

    try {
      const res = await explainRule(explainRuleId);
      setExplanation(res);
      addNotification({ type: 'success', message: 'Rule explained successfully' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to explain rule';
      addNotification({ type: 'error', message: msg });
    } finally {
      setExplaining(false);
    }
  };

  const handleCopyRule = () => {
    if (generatedRule) {
      navigator.clipboard.writeText(JSON.stringify(generatedRule.rule, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rule Copilot</h1>
          <p className="text-sm text-slate-500">
            AI-powered assistant for generating and understanding rules
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Generate Rule */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-slate-900">Generate Rule from Description</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Describe the rule in plain language</label>
                <textarea
                  className="input min-h-[120px]"
                  value={nlDescription}
                  onChange={(e) => setNlDescription(e.target.value)}
                  placeholder="e.g., If the applicant's age is over 25 and credit score is above 700, approve the application with a standard rate..."
                />
              </div>

              <div>
                <label className="label">Context (optional)</label>
                <input
                  className="input"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., Insurance premium calculation, loan approval..."
                />
              </div>

              <button
                onClick={handleGenerate}
                className="btn-primary w-full justify-center"
                disabled={generating || !nlDescription.trim()}
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Rule
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Explain Rule */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-slate-900">Explain Rule</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Rule ID</label>
                <input
                  className="input"
                  value={explainRuleId}
                  onChange={(e) => setExplainRuleId(e.target.value)}
                  placeholder="Enter rule ID to explain..."
                />
              </div>

              <button
                onClick={handleExplain}
                className="btn-secondary w-full justify-center"
                disabled={explaining || !explainRuleId.trim()}
              >
                {explaining ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Explaining...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Explain Rule
                  </>
                )}
              </button>
            </div>

            {explanation && (
              <div className="mt-4 bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-sm text-slate-900 mb-2">Explanation</h4>
                <p className="text-sm text-slate-700">{explanation.explanation || explanation.summary}</p>
                {explanation.conditions && explanation.conditions.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs font-medium text-slate-500">Conditions:</span>
                    <ul className="mt-1 space-y-1">
                      {explanation.conditions.map((cond, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                          <span className="text-brand-600 mt-0.5">-</span> {cond}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.actions && explanation.actions.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs font-medium text-slate-500">Actions:</span>
                    <ul className="mt-1 space-y-1">
                      {explanation.actions.map((action, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                          <span className="text-brand-600 mt-0.5">-</span> {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Output */}
        <div className="space-y-4">
          {/* Generated Rule Output */}
          {generatedRule && (
            <div className="card">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-brand-600" />
                  <h3 className="font-semibold text-slate-900">Generated Rule</h3>
                </div>
                <button onClick={handleCopyRule} className="btn-secondary btn-sm">
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
              <div className="p-6">
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[400px]">
                  {JSON.stringify(generatedRule.rule, null, 2)}
                </pre>

                {generatedRule.confidence != null && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Confidence:</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full">
                      <div
                        className="h-2 rounded-full bg-brand-600"
                        style={{ width: `${generatedRule.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700">
                      {Math.round(generatedRule.confidence * 100)}%
                    </span>
                  </div>
                )}

                {generatedRule.suggestions && generatedRule.suggestions.length > 0 && (
                  <div className="mt-4">
                    <span className="text-xs font-medium text-slate-500">Suggestions:</span>
                    <ul className="mt-2 space-y-1">
                      {generatedRule.suggestions.map((suggestion, i) => (
                        <li key={i} className="text-xs text-slate-600 bg-amber-50 rounded px-3 py-2">
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conversation History */}
          {history.length > 0 && (
            <div className="card">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Conversation History</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {history.map((msg, idx) => (
                  <div key={idx} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium ${
                          msg.role === 'user' ? 'text-brand-600' : 'text-emerald-600'
                        }`}
                      >
                        {msg.role === 'user' ? 'You' : 'Copilot'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!generatedRule && history.length === 0 && (
            <div className="card p-12 text-center">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">AI Rule Assistant</h3>
              <p className="text-sm text-slate-500">
                Describe a rule in plain language and the AI will generate the rule definition for you.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
