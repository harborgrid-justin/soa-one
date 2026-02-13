import { Zap, Server, Database, Shield } from 'lucide-react';

export function Settings() {
  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-slate-500">Platform configuration and system information.</p>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-slate-400" />
          System Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Platform</div>
            <div className="font-medium text-slate-900">SOA One Business Rules Platform</div>
          </div>
          <div>
            <div className="text-slate-500">Version</div>
            <div className="font-medium text-slate-900">1.0.0</div>
          </div>
          <div>
            <div className="text-slate-500">API</div>
            <div className="font-medium text-slate-900">REST + GraphQL + Message Queue</div>
          </div>
          <div>
            <div className="text-slate-500">Database</div>
            <div className="font-medium text-slate-900">SQLite (Dev) / PostgreSQL (Prod)</div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-slate-400" />
          Database
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          Currently using SQLite for development. Switch to PostgreSQL in production by updating DATABASE_URL in your .env file.
        </p>
        <code className="block bg-slate-100 rounded-lg p-3 text-xs font-mono text-slate-700">
          DATABASE_URL="postgresql://user:password@localhost:5432/soaone"
        </code>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-slate-400" />
          Message Queue
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          Using database-backed queue by default. For high-throughput production, configure Redis.
        </p>
        <code className="block bg-slate-100 rounded-lg p-3 text-xs font-mono text-slate-700">
          REDIS_URL="redis://localhost:6379"
        </code>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-400" />
          Deployment
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          Deploy with Docker for production use:
        </p>
        <code className="block bg-slate-100 rounded-lg p-3 text-xs font-mono text-slate-700">
          docker-compose up -d
        </code>
      </div>
    </div>
  );
}
