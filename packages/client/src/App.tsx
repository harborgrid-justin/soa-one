import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { RuleSetsList } from './pages/RuleSetsList';
import { RuleSetEditor } from './pages/RuleSetEditor';
import { DecisionTablesList } from './pages/DecisionTablesList';
import { DecisionTableEditor } from './pages/DecisionTableEditor';
import { DataModelsList, DataModelEditor } from './pages/DataModels';
import { TestSandbox } from './pages/TestSandbox';
import { Monitoring } from './pages/Monitoring';
import { ApiDocs } from './pages/ApiDocs';
import { Settings } from './pages/Settings';
import { WorkflowsList } from './pages/WorkflowsList';
import { WorkflowDesigner } from './pages/WorkflowDesigner';
import { AuditLog } from './pages/AuditLog';
import { AdaptersList } from './pages/Adapters';
import { UserManagement } from './pages/UserManagement';
// V3 pages
import { VersionDiff } from './pages/VersionDiff';
import { Analytics } from './pages/Analytics';
import { Simulations } from './pages/Simulations';
import { NotificationCenter } from './pages/NotificationCenter';
import { RuleConflicts } from './pages/RuleConflicts';
import { ImportExport } from './pages/ImportExport';
// V4 pages
import { Approvals } from './pages/Approvals';
import { ApiGateway } from './pages/ApiGateway';
import { ScheduledJobs } from './pages/ScheduledJobs';
import { TemplateMarketplace } from './pages/TemplateMarketplace';
import { ComplianceDashboard } from './pages/ComplianceDashboard';
import { CacheMonitor } from './pages/CacheMonitor';
// V7 pages
import { Environments } from './pages/Environments';
import { FunctionLibrary } from './pages/FunctionLibrary';
import { DecisionExplorer } from './pages/DecisionExplorer';
import { PermissionManager } from './pages/PermissionManager';
import { ReportGenerator } from './pages/ReportGenerator';
import { BatchExecutor } from './pages/BatchExecutor';
// V8 pages
import { RuleCopilot } from './pages/RuleCopilot';
import { ABTestingDashboard } from './pages/ABTestingDashboard';
import { ImpactAnalyzer } from './pages/ImpactAnalyzer';
import { RuleDebugger } from './pages/RuleDebugger';
import { ExecutionReplay } from './pages/ExecutionReplay';
import { CompliancePacks } from './pages/CompliancePacks';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="rule-sets" element={<RuleSetsList />} />
          <Route path="rule-sets/:id" element={<RuleSetEditor />} />
          <Route path="decision-tables" element={<DecisionTablesList />} />
          <Route path="decision-tables/:id" element={<DecisionTableEditor />} />
          <Route path="data-models" element={<DataModelsList />} />
          <Route path="data-models/:id" element={<DataModelEditor />} />
          <Route path="workflows" element={<WorkflowsList />} />
          <Route path="workflows/:id" element={<WorkflowDesigner />} />
          <Route path="adapters" element={<AdaptersList />} />
          <Route path="test" element={<TestSandbox />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="api-docs" element={<ApiDocs />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="settings" element={<Settings />} />
          {/* V3 routes */}
          <Route path="analytics" element={<Analytics />} />
          <Route path="simulations" element={<Simulations />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="rule-sets/:ruleSetId/diff/:v1/:v2" element={<VersionDiff />} />
          <Route path="rule-sets/:ruleSetId/conflicts" element={<RuleConflicts />} />
          <Route path="import-export" element={<ImportExport />} />
          {/* V4 routes */}
          <Route path="approvals" element={<Approvals />} />
          <Route path="api-gateway" element={<ApiGateway />} />
          <Route path="scheduled-jobs" element={<ScheduledJobs />} />
          <Route path="templates" element={<TemplateMarketplace />} />
          <Route path="compliance" element={<ComplianceDashboard />} />
          <Route path="performance" element={<CacheMonitor />} />
          {/* V7 routes */}
          <Route path="environments" element={<Environments />} />
          <Route path="functions" element={<FunctionLibrary />} />
          <Route path="decision-explorer" element={<DecisionExplorer />} />
          <Route path="permissions" element={<PermissionManager />} />
          <Route path="reports" element={<ReportGenerator />} />
          <Route path="batch-execute" element={<BatchExecutor />} />
          {/* V8 routes */}
          <Route path="copilot" element={<RuleCopilot />} />
          <Route path="ab-testing" element={<ABTestingDashboard />} />
          <Route path="impact-analysis" element={<ImpactAnalyzer />} />
          <Route path="debugger" element={<RuleDebugger />} />
          <Route path="replay" element={<ExecutionReplay />} />
          <Route path="compliance-packs" element={<CompliancePacks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
