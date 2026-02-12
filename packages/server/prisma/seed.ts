import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a demo project
  const project = await prisma.project.create({
    data: {
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

  // Create a second project for demo breadth
  const govProject = await prisma.project.create({
    data: {
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

  console.log('Seed complete!');
  console.log(`  - 2 projects created`);
  console.log(`  - 2 data models created`);
  console.log(`  - 2 rule sets created`);
  console.log(`  - 5 rules created`);
  console.log(`  - 1 decision table created`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
