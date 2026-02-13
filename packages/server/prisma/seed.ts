import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Default Organization',
      slug: 'default',
      plan: 'enterprise',
    },
  });

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@soa-one.dev',
      name: 'Admin User',
      password: hashedPassword,
      role: 'admin',
      tenantId: tenant.id,
    },
  });

  // Create a demo project
  const project = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      name: 'Insurance Underwriting',
      description: 'Auto insurance policy underwriting rules for risk assessment and premium calculation',
    },
  });

  // Create a data model
  const dataModel = await prisma.dataModel.create({
    data: {
      projectId: project.id,
      name: 'PolicyApplication',
      schema: JSON.stringify({
        fields: [
          { name: 'applicant', type: 'object', children: [
            { name: 'age', type: 'number', required: true },
            { name: 'state', type: 'string', required: true },
            { name: 'drivingYears', type: 'number', required: true },
            { name: 'accidents', type: 'number', required: true },
            { name: 'creditScore', type: 'number' },
          ]},
          { name: 'vehicle', type: 'object', children: [
            { name: 'year', type: 'number', required: true },
            { name: 'make', type: 'string', required: true },
            { name: 'value', type: 'number', required: true },
            { name: 'type', type: 'string', enumValues: ['sedan', 'suv', 'truck', 'sports', 'luxury'] },
          ]},
          { name: 'coverage', type: 'object', children: [
            { name: 'type', type: 'string', enumValues: ['basic', 'standard', 'premium'] },
            { name: 'deductible', type: 'number' },
          ]},
        ],
      }),
    },
  });

  // Create a rule set
  const ruleSet = await prisma.ruleSet.create({
    data: {
      projectId: project.id,
      name: 'Premium Calculation Rules',
      description: 'Core rules for calculating auto insurance premiums',
      inputModelId: dataModel.id,
      status: 'published',
      version: 1,
    },
  });

  // Create rules
  await prisma.rule.createMany({
    data: [
      {
        ruleSetId: ruleSet.id,
        name: 'Base Premium by Age',
        description: 'Set base premium based on driver age',
        priority: 100,
        conditions: JSON.stringify({
          logic: 'AND',
          conditions: [
            { field: 'applicant.age', operator: 'greaterThanOrEqual', value: 25 },
            { field: 'applicant.age', operator: 'lessThan', value: 65 },
          ],
        }),
        actions: JSON.stringify([
          { type: 'SET', field: 'premium.base', value: 800 },
          { type: 'SET', field: 'premium.riskCategory', value: 'standard' },
        ]),
        enabled: true,
      },
      {
        ruleSetId: ruleSet.id,
        name: 'Young Driver Surcharge',
        description: 'Higher premium for drivers under 25',
        priority: 99,
        conditions: JSON.stringify({
          logic: 'AND',
          conditions: [
            { field: 'applicant.age', operator: 'lessThan', value: 25 },
          ],
        }),
        actions: JSON.stringify([
          { type: 'SET', field: 'premium.base', value: 1400 },
          { type: 'SET', field: 'premium.riskCategory', value: 'high' },
        ]),
        enabled: true,
      },
      {
        ruleSetId: ruleSet.id,
        name: 'Senior Driver Adjustment',
        description: 'Adjusted premium for drivers 65+',
        priority: 98,
        conditions: JSON.stringify({
          logic: 'AND',
          conditions: [
            { field: 'applicant.age', operator: 'greaterThanOrEqual', value: 65 },
          ],
        }),
        actions: JSON.stringify([
          { type: 'SET', field: 'premium.base', value: 1100 },
          { type: 'SET', field: 'premium.riskCategory', value: 'elevated' },
        ]),
        enabled: true,
      },
      {
        ruleSetId: ruleSet.id,
        name: 'Accident History Penalty',
        description: 'Increase premium by $300 per accident',
        priority: 50,
        conditions: JSON.stringify({
          logic: 'AND',
          conditions: [
            { field: 'applicant.accidents', operator: 'greaterThan', value: 0 },
          ],
        }),
        actions: JSON.stringify([
          { type: 'SET', field: 'premium.accidentSurcharge', value: 300 },
          { type: 'APPEND', field: 'premium.flags', value: 'accident-history' },
        ]),
        enabled: true,
      },
      {
        ruleSetId: ruleSet.id,
        name: 'Good Credit Discount',
        description: '10% discount for credit score above 750',
        priority: 30,
        conditions: JSON.stringify({
          logic: 'AND',
          conditions: [
            { field: 'applicant.creditScore', operator: 'greaterThanOrEqual', value: 750 },
          ],
        }),
        actions: JSON.stringify([
          { type: 'SET', field: 'premium.creditDiscount', value: -0.10 },
          { type: 'APPEND', field: 'premium.flags', value: 'good-credit' },
        ]),
        enabled: true,
      },
    ],
  });

  // Create a decision table
  await prisma.decisionTable.create({
    data: {
      ruleSetId: ruleSet.id,
      name: 'Vehicle Type Factor',
      description: 'Premium multiplier based on vehicle type',
      columns: JSON.stringify([
        { id: 'col-1', name: 'Vehicle Type', field: 'vehicle.type', type: 'condition', operator: 'equals' },
        { id: 'col-2', name: 'Vehicle Value', field: 'vehicle.value', type: 'condition', operator: 'greaterThan' },
        { id: 'col-3', name: 'Factor', field: 'premium.vehicleFactor', type: 'action', actionType: 'SET' },
        { id: 'col-4', name: 'Category', field: 'premium.vehicleCategory', type: 'action', actionType: 'SET' },
      ]),
      rows: JSON.stringify([
        { id: 'row-1', values: { 'col-1': 'sedan', 'col-2': '', 'col-3': 1.0, 'col-4': 'standard' }, enabled: true },
        { id: 'row-2', values: { 'col-1': 'suv', 'col-2': '', 'col-3': 1.15, 'col-4': 'standard' }, enabled: true },
        { id: 'row-3', values: { 'col-1': 'truck', 'col-2': '', 'col-3': 1.1, 'col-4': 'standard' }, enabled: true },
        { id: 'row-4', values: { 'col-1': 'sports', 'col-2': '', 'col-3': 1.5, 'col-4': 'high-risk' }, enabled: true },
        { id: 'row-5', values: { 'col-1': 'luxury', 'col-2': 50000, 'col-3': 1.8, 'col-4': 'high-value' }, enabled: true },
        { id: 'row-6', values: { 'col-1': 'luxury', 'col-2': '', 'col-3': 1.4, 'col-4': 'elevated' }, enabled: true },
      ]),
    },
  });

  // Create initial version snapshot
  const fullRuleSet = await prisma.ruleSet.findUnique({
    where: { id: ruleSet.id },
    include: { rules: true, decisionTables: true },
  });

  await prisma.ruleSetVersion.create({
    data: {
      ruleSetId: ruleSet.id,
      version: 1,
      snapshot: JSON.stringify({
        rules: fullRuleSet!.rules,
        decisionTables: fullRuleSet!.decisionTables,
      }),
      changelog: 'Initial release — core premium calculation rules',
      publishedBy: 'admin',
    },
  });

  // Create a demo workflow
  await prisma.workflow.create({
    data: {
      projectId: project.id,
      name: 'Underwriting Review',
      description: 'End-to-end underwriting review process with automated risk assessment',
      status: 'active',
      nodes: JSON.stringify([
        { id: 'start-1', type: 'start', position: { x: 250, y: 25 }, data: { label: 'Start' } },
        { id: 'ruleTask-1', type: 'ruleTask', position: { x: 200, y: 150 }, data: { label: 'Calculate Premium', ruleSetName: 'Premium Calculation Rules' } },
        { id: 'decision-1', type: 'decision', position: { x: 200, y: 300 }, data: { label: 'Risk Assessment', condition: 'output.premium.riskCategory' } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 450 }, data: { label: 'End' } },
      ]),
      edges: JSON.stringify([
        { id: 'e1', source: 'start-1', target: 'ruleTask-1', animated: true },
        { id: 'e2', source: 'ruleTask-1', target: 'decision-1', animated: true },
        { id: 'e3', source: 'decision-1', target: 'end-1', sourceHandle: 'yes', animated: true },
      ]),
    },
  });

  // Create a demo adapter
  await prisma.adapter.create({
    data: {
      projectId: project.id,
      name: 'Credit Score API',
      type: 'rest',
      config: JSON.stringify({ baseUrl: 'https://api.example.com/credit', method: 'GET' }),
      status: 'inactive',
    },
  });

  // Create a second project for demo breadth
  const govProject = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      name: 'Benefits Eligibility',
      description: 'Government program eligibility determination rules',
    },
  });

  const govModel = await prisma.dataModel.create({
    data: {
      projectId: govProject.id,
      name: 'Applicant',
      schema: JSON.stringify({
        fields: [
          { name: 'age', type: 'number', required: true },
          { name: 'income', type: 'number', required: true },
          { name: 'householdSize', type: 'number', required: true },
          { name: 'state', type: 'string', required: true },
          { name: 'veteran', type: 'boolean' },
          { name: 'disabled', type: 'boolean' },
        ],
      }),
    },
  });

  await prisma.ruleSet.create({
    data: {
      projectId: govProject.id,
      name: 'SNAP Eligibility',
      description: 'Supplemental Nutrition Assistance Program eligibility rules',
      inputModelId: govModel.id,
      status: 'draft',
    },
  });

  // Create seed audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userName: 'Admin User',
        action: 'create',
        entity: 'project',
        entityName: 'Insurance Underwriting',
      },
      {
        tenantId: tenant.id,
        userName: 'Admin User',
        action: 'publish',
        entity: 'ruleSet',
        entityName: 'Premium Calculation Rules',
      },
      {
        tenantId: tenant.id,
        userName: 'Admin User',
        action: 'create',
        entity: 'workflow',
        entityName: 'Underwriting Review',
      },
    ],
  });

  // V3+V4: Create demo templates
  await prisma.template.createMany({
    data: [
      {
        name: 'Auto Insurance Underwriting',
        description: 'Complete auto insurance underwriting rules with premium calculation, risk assessment, and vehicle factors',
        category: 'insurance',
        tags: JSON.stringify(['insurance', 'underwriting', 'auto', 'premium']),
        content: JSON.stringify({ type: 'ruleSet', name: 'Premium Calculation' }),
        type: 'ruleSet',
        author: 'SOA One Team',
        downloads: 142,
        rating: 4.5,
        ratingCount: 28,
        isOfficial: true,
      },
      {
        name: 'HIPAA Privacy Compliance',
        description: 'Healthcare privacy rules aligned with HIPAA regulations for patient data handling',
        category: 'healthcare',
        tags: JSON.stringify(['healthcare', 'hipaa', 'compliance', 'privacy']),
        content: JSON.stringify({ type: 'ruleSet', name: 'HIPAA Rules' }),
        type: 'ruleSet',
        author: 'SOA One Team',
        downloads: 89,
        rating: 4.7,
        ratingCount: 15,
        isOfficial: true,
      },
      {
        name: 'KYC/AML Screening',
        description: 'Know Your Customer and Anti-Money Laundering screening rules for financial services',
        category: 'finance',
        tags: JSON.stringify(['finance', 'kyc', 'aml', 'screening']),
        content: JSON.stringify({ type: 'ruleSet', name: 'KYC Screening' }),
        type: 'ruleSet',
        author: 'SOA One Team',
        downloads: 67,
        rating: 4.3,
        ratingCount: 12,
        isOfficial: true,
      },
      {
        name: 'Order Processing Workflow',
        description: 'End-to-end order processing workflow with validation, payment, and fulfillment steps',
        category: 'general',
        tags: JSON.stringify(['workflow', 'orders', 'ecommerce']),
        content: JSON.stringify({ type: 'workflow', name: 'Order Processing' }),
        type: 'workflow',
        author: 'SOA One Team',
        downloads: 53,
        rating: 4.1,
        ratingCount: 9,
        isOfficial: true,
      },
    ],
  });

  // V4: Create default approval pipeline
  await prisma.approvalPipeline.create({
    data: {
      tenantId: tenant.id,
      name: 'Standard Review',
      stages: JSON.stringify([
        { name: 'Technical Review', requiredRole: 'editor' },
        { name: 'Final Approval', requiredRole: 'admin' },
      ]),
      entityType: 'ruleSet',
      isDefault: true,
    },
  });

  // V4: Create compliance framework
  await prisma.complianceFramework.create({
    data: {
      tenantId: tenant.id,
      name: 'SOX Compliance',
      framework: 'sox',
      description: 'Sarbanes-Oxley compliance framework for financial reporting rules',
      requirements: JSON.stringify([
        { id: 'sox-1', name: 'Change Management', description: 'All rule changes must go through approval workflow', category: 'controls', status: 'compliant' },
        { id: 'sox-2', name: 'Audit Trail', description: 'Full audit trail for all rule modifications', category: 'audit', status: 'compliant' },
        { id: 'sox-3', name: 'Access Control', description: 'Role-based access to rule management', category: 'access', status: 'compliant' },
      ]),
      retentionDays: 2555,
    },
  });

  console.log('Seed complete!');
  console.log(`  - 1 tenant created (${tenant.name})`);
  console.log(`  - 1 admin user created (admin@soa-one.dev / admin123)`);
  console.log(`  - 2 projects created`);
  console.log(`  - 2 data models created`);
  console.log(`  - 2 rule sets created`);
  console.log(`  - 5 rules created`);
  console.log(`  - 1 decision table created`);
  console.log(`  - 1 workflow created`);
  console.log(`  - 1 adapter created`);
  console.log(`  - 3 audit log entries created`);
  console.log(`  - 4 templates created`);
  console.log(`  - 1 approval pipeline created`);
  console.log(`  - 1 compliance framework created`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
