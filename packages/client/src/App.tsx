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
// V9: ESB pages
import { ESBDashboard } from './pages/ESBDashboard';
import { ESBChannels } from './pages/ESBChannels';
import { ESBRoutes } from './pages/ESBRoutes';
import { ESBTransformers } from './pages/ESBTransformers';
import { ESBSagas } from './pages/ESBSagas';
import { ESBMonitoring } from './pages/ESBMonitoring';
// V10: CMS pages
import { CMSDashboard } from './pages/CMSDashboard';
import { CMSDocuments } from './pages/CMSDocuments';
import { CMSSearch } from './pages/CMSSearch';
import { CMSWorkflows } from './pages/CMSWorkflows';
import { CMSTaxonomies } from './pages/CMSTaxonomies';
import { CMSRetention } from './pages/CMSRetention';
import { CMSSecurity } from './pages/CMSSecurity';
import { CMSMonitoring } from './pages/CMSMonitoring';
// V12: DI pages
import { DIDashboard } from './pages/DIDashboard';
import { DIConnectors } from './pages/DIConnectors';
import { DIPipelines } from './pages/DIPipelines';
import { DICDC } from './pages/DICDC';
import { DIReplication } from './pages/DIReplication';
import { DIQuality } from './pages/DIQuality';
import { DILineage } from './pages/DILineage';
import { DICatalog } from './pages/DICatalog';
import { DIMonitoring } from './pages/DIMonitoring';
// V13: DQM pages
import { DQMDashboard } from './pages/DQMDashboard';
import { DQMTopics } from './pages/DQMTopics';
import { DQMQueues } from './pages/DQMQueues';
import { DQMQualityRules } from './pages/DQMQualityRules';
import { DQMProfiling } from './pages/DQMProfiling';
import { DQMCleansing } from './pages/DQMCleansing';
import { DQMMatching } from './pages/DQMMatching';
import { DQMScoring } from './pages/DQMScoring';
import { DQMMonitoring } from './pages/DQMMonitoring';
// V14: SOA pages
import { SOADashboard } from './pages/SOADashboard';
import { SOAServices } from './pages/SOAServices';
import { SOAProcesses } from './pages/SOAProcesses';
import { SOATasks } from './pages/SOATasks';
import { SOACEP } from './pages/SOACEP';
import { SOAB2B } from './pages/SOAB2B';
import { SOAAPIs } from './pages/SOAAPIs';
import { SOAPolicies } from './pages/SOAPolicies';
import { SOAMesh } from './pages/SOAMesh';
import { SOABAM } from './pages/SOABAM';
import { SOAMonitoring } from './pages/SOAMonitoring';
// V15: IAM pages
import { IAMDashboard } from './pages/IAMDashboard';
import { IAMIdentities } from './pages/IAMIdentities';
import { IAMRoles } from './pages/IAMRoles';
import { IAMAuthorization } from './pages/IAMAuthorization';
import { IAMSessions } from './pages/IAMSessions';
import { IAMTokens } from './pages/IAMTokens';
import { IAMFederation } from './pages/IAMFederation';
import { IAMGovernance } from './pages/IAMGovernance';
import { IAMPAM } from './pages/IAMPAM';
import { IAMRisk } from './pages/IAMRisk';
import { IAMMonitoring } from './pages/IAMMonitoring';
import { NotFound } from './pages/NotFound';

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
          {/* V9: ESB routes */}
          <Route path="esb" element={<ESBDashboard />} />
          <Route path="esb/channels" element={<ESBChannels />} />
          <Route path="esb/routes" element={<ESBRoutes />} />
          <Route path="esb/transformers" element={<ESBTransformers />} />
          <Route path="esb/sagas" element={<ESBSagas />} />
          <Route path="esb/monitoring" element={<ESBMonitoring />} />
          {/* V10: CMS routes */}
          <Route path="cms" element={<CMSDashboard />} />
          <Route path="cms/documents" element={<CMSDocuments />} />
          <Route path="cms/search" element={<CMSSearch />} />
          <Route path="cms/workflows" element={<CMSWorkflows />} />
          <Route path="cms/taxonomies" element={<CMSTaxonomies />} />
          <Route path="cms/retention" element={<CMSRetention />} />
          <Route path="cms/security" element={<CMSSecurity />} />
          <Route path="cms/monitoring" element={<CMSMonitoring />} />
          {/* V12: DI routes */}
          <Route path="di" element={<DIDashboard />} />
          <Route path="di/connectors" element={<DIConnectors />} />
          <Route path="di/pipelines" element={<DIPipelines />} />
          <Route path="di/cdc" element={<DICDC />} />
          <Route path="di/replication" element={<DIReplication />} />
          <Route path="di/quality" element={<DIQuality />} />
          <Route path="di/lineage" element={<DILineage />} />
          <Route path="di/catalog" element={<DICatalog />} />
          <Route path="di/monitoring" element={<DIMonitoring />} />
          {/* V13: DQM routes */}
          <Route path="dqm" element={<DQMDashboard />} />
          <Route path="dqm/topics" element={<DQMTopics />} />
          <Route path="dqm/queues" element={<DQMQueues />} />
          <Route path="dqm/quality-rules" element={<DQMQualityRules />} />
          <Route path="dqm/profiling" element={<DQMProfiling />} />
          <Route path="dqm/cleansing" element={<DQMCleansing />} />
          <Route path="dqm/matching" element={<DQMMatching />} />
          <Route path="dqm/scoring" element={<DQMScoring />} />
          <Route path="dqm/monitoring" element={<DQMMonitoring />} />
          {/* V14: SOA routes */}
          <Route path="soa" element={<SOADashboard />} />
          <Route path="soa/services" element={<SOAServices />} />
          <Route path="soa/processes" element={<SOAProcesses />} />
          <Route path="soa/tasks" element={<SOATasks />} />
          <Route path="soa/cep" element={<SOACEP />} />
          <Route path="soa/b2b" element={<SOAB2B />} />
          <Route path="soa/apis" element={<SOAAPIs />} />
          <Route path="soa/policies" element={<SOAPolicies />} />
          <Route path="soa/mesh" element={<SOAMesh />} />
          <Route path="soa/bam" element={<SOABAM />} />
          <Route path="soa/monitoring" element={<SOAMonitoring />} />
          {/* V15: IAM routes */}
          <Route path="iam" element={<IAMDashboard />} />
          <Route path="iam/identities" element={<IAMIdentities />} />
          <Route path="iam/roles" element={<IAMRoles />} />
          <Route path="iam/authorization" element={<IAMAuthorization />} />
          <Route path="iam/sessions" element={<IAMSessions />} />
          <Route path="iam/tokens" element={<IAMTokens />} />
          <Route path="iam/federation" element={<IAMFederation />} />
          <Route path="iam/governance" element={<IAMGovernance />} />
          <Route path="iam/pam" element={<IAMPAM />} />
          <Route path="iam/risk" element={<IAMRisk />} />
          <Route path="iam/monitoring" element={<IAMMonitoring />} />
          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
