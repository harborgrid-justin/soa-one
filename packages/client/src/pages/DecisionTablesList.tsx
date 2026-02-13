import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table2 } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';

export function DecisionTablesList() {
  const navigate = useNavigate();

  // Decision tables are accessed through rule sets
  // This page provides a helpful redirect
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Decision tables are organized within rule sets. Open a rule set to manage its decision tables.</p>
      <EmptyState
        icon={<Table2 className="w-8 h-8" />}
        title="Decision Tables"
        description="Decision tables belong to rule sets. Navigate to a rule set to create and edit decision tables."
        action={
          <button onClick={() => navigate('/rule-sets')} className="btn-primary">
            Go to Rule Sets
          </button>
        }
      />
    </div>
  );
}
