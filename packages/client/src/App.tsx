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
          <Route path="test" element={<TestSandbox />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="api-docs" element={<ApiDocs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
