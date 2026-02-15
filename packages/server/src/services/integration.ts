// ============================================================
// SOA One — Module Integration Service
// ============================================================
//
// Central wiring point that makes the Engine, ESB, CMS, DI,
// DQM, SOA, and IAM modules aware of each other. Creates
// singleton instances, registers cross-module plugins, and
// manages the lifecycle.
//
// Architecture:
//   ┌────────────┐
//   │ RuleEngine │◄── ESB + CMS + DI + DQM + SOA + IAM + Bridge Plugins
//   └────┬───────┘
//        │
//   ┌────┴──────────────────────────────────────────────┐
//   │            │              │          │     │       │
//   ▼            ▼              ▼          ▼     ▼       ▼
// ServiceBus   CMS     DataIntegrator   DQM   SOASuite  IAM
//   │            │              │          │     │       │
//   └──── Bridge (multi-directional) ──────────────────┘
// ============================================================

import { RuleEngine } from '@soa-one/engine';
import type { EnginePlugin } from '@soa-one/engine';
import { ServiceBus, createESBPlugin } from '@soa-one/esb';
import { ContentManagementSystem, createCMSPlugin } from '@soa-one/cms';
import { DataIntegrator, createDIPlugin } from '@soa-one/di';
import { DataQualityMessaging, createDQMPlugin } from '@soa-one/dqm';
import { SOASuite, createSOAPlugin, NotificationService, GovernanceManager, DeploymentManager } from '@soa-one/soa';
import { IdentityAccessManager, createIAMPlugin } from '@soa-one/iam';
import { createBridgePlugin, setupEventBridge } from './bridge';

// New Tier 2 imports
import { EventDeliveryNetwork, CrossReferenceManager, DomainValueMapManager, AdapterFramework, ReliableMessagingManager } from '@soa-one/esb';
import { ManagedFileTransfer } from '@soa-one/mft';
import { BusinessRulesEngine } from '@soa-one/rules';
import { BPMEngine } from '@soa-one/bpm';

// ── Singleton Instances ─────────────────────────────────────

let _bus: ServiceBus | null = null;
let _cms: ContentManagementSystem | null = null;
let _di: DataIntegrator | null = null;
let _dqm: DataQualityMessaging | null = null;
let _soa: SOASuite | null = null;
let _iam: IdentityAccessManager | null = null;
let _engine: RuleEngine | null = null;
let _initialized = false;

// Tier 2 singletons
let _notification: NotificationService | null = null;
let _governance: GovernanceManager | null = null;
let _deployment: DeploymentManager | null = null;
let _edn: EventDeliveryNetwork | null = null;
let _xref: CrossReferenceManager | null = null;
let _dvm: DomainValueMapManager | null = null;
let _adapterFramework: AdapterFramework | null = null;
let _reliableMessaging: ReliableMessagingManager | null = null;
let _mft: ManagedFileTransfer | null = null;
let _businessRules: BusinessRulesEngine | null = null;
let _bpm: BPMEngine | null = null;

// ── Public Accessors ────────────────────────────────────────

/** Get the shared ServiceBus instance. */
export function getBus(): ServiceBus {
  if (!_bus) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _bus;
}

/** Get the shared ContentManagementSystem instance. */
export function getCMS(): ContentManagementSystem {
  if (!_cms) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _cms;
}

/** Get the shared DataIntegrator instance. */
export function getDI(): DataIntegrator {
  if (!_di) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _di;
}

/** Get the shared DataQualityMessaging instance. */
export function getDQM(): DataQualityMessaging {
  if (!_dqm) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _dqm;
}

/** Get the shared SOASuite instance. */
export function getSOA(): SOASuite {
  if (!_soa) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _soa;
}

/** Get the shared IdentityAccessManager instance. */
export function getIAM(): IdentityAccessManager {
  if (!_iam) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _iam;
}

/** Get the shared RuleEngine with ESB + CMS + DI + DQM + SOA + IAM plugins registered. */
export function getEngine(): RuleEngine {
  if (!_engine) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _engine;
}

/** Check if the integration layer is initialized. */
export function isIntegrationReady(): boolean {
  return _initialized;
}

// ── Tier 2 Accessors ────────────────────────────────────────

export function getNotificationService(): NotificationService {
  if (!_notification) { _notification = new NotificationService(); }
  return _notification;
}

export function getGovernanceManager(): GovernanceManager {
  if (!_governance) { _governance = new GovernanceManager(); }
  return _governance;
}

export function getDeploymentManager(): DeploymentManager {
  if (!_deployment) { _deployment = new DeploymentManager(); }
  return _deployment;
}

export function getEDN(): EventDeliveryNetwork {
  if (!_edn) { _edn = new EventDeliveryNetwork(); }
  return _edn;
}

export function getXRef(): CrossReferenceManager {
  if (!_xref) { _xref = new CrossReferenceManager(); }
  return _xref;
}

export function getDVM(): DomainValueMapManager {
  if (!_dvm) { _dvm = new DomainValueMapManager(); }
  return _dvm;
}

export function getAdapterFramework(): AdapterFramework {
  if (!_adapterFramework) { _adapterFramework = new AdapterFramework(); }
  return _adapterFramework;
}

export function getReliableMessaging(): ReliableMessagingManager {
  if (!_reliableMessaging) { _reliableMessaging = new ReliableMessagingManager(); }
  return _reliableMessaging;
}

export function getMFT(): ManagedFileTransfer {
  if (!_mft) { _mft = new ManagedFileTransfer(); }
  return _mft;
}

export function getBusinessRules(): BusinessRulesEngine {
  if (!_businessRules) { _businessRules = new BusinessRulesEngine(); }
  return _businessRules;
}

export function getBPM(): BPMEngine {
  if (!_bpm) { _bpm = new BPMEngine(); }
  return _bpm;
}

// ── Lifecycle ───────────────────────────────────────────────

/**
 * Initialize all seven modules and wire them together.
 *
 * 1. Creates ServiceBus, CMS, DataIntegrator, DQM, SOASuite, IAM, RuleEngine
 * 2. Registers ESB, CMS, DI, DQM, SOA, and IAM plugins with the engine
 * 3. Registers the bridge plugin for cross-module functions
 * 4. Sets up multi-directional event forwarding between all modules
 */
export async function initIntegration(): Promise<void> {
  if (_initialized) return;

  console.log('[integration] Initializing cross-module integration...');

  // 1. Create module instances
  _bus = new ServiceBus({
    name: 'soa-one-esb',
    metricsEnabled: true,
    metadata: { source: 'soa-one-server' },
  });

  _cms = new ContentManagementSystem({
    name: 'soa-one-cms',
    auditEnabled: true,
    fullTextIndexEnabled: true,
    metadata: { source: 'soa-one-server' },
  });

  _di = new DataIntegrator({
    name: 'soa-one-di',
    auditEnabled: true,
  });

  _dqm = new DataQualityMessaging({
    name: 'soa-one-dqm',
    auditEnabled: true,
    topics: [
      { name: 'dqm.quality.events', type: 'standard' },
      { name: 'dqm.messaging.events', type: 'standard' },
      { name: 'dqm.alerts', type: 'standard' },
    ],
  });

  _soa = new SOASuite({
    name: 'soa-one-soa',
    auditEnabled: true,
  });

  _iam = new IdentityAccessManager({
    name: 'soa-one-iam',
    auditEnabled: true,
  });

  // 2. Initialize modules
  await _bus.init();
  await _cms.init();
  await _di.init();
  await _dqm.init();
  await _soa.init();
  await _iam.init();
  console.log('[integration] ESB, CMS, DI, DQM, SOA, and IAM initialized');

  // 3. Create the ESB integration channels
  _bus.createChannel({ name: 'cms.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'esb.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'cms.documents', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'cms.workflows', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'di.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'di.pipelines', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'di.cdc', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'dqm.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'dqm.quality', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'dqm.messaging', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'soa.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'soa.processes', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'soa.tasks', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'soa.cep', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'soa.b2b', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'soa.api', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'iam.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'iam.auth', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'iam.identity', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'iam.governance', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'iam.risk', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'iam.pam', type: 'publish-subscribe' });

  // 4. Create engine with all plugins + bridge plugin
  const plugins: EnginePlugin[] = [
    createESBPlugin(_bus),
    createCMSPlugin(_cms),
    createDIPlugin(_di),
    createDQMPlugin(_dqm),
    createSOAPlugin(_soa),
    createIAMPlugin(_iam),
    createBridgePlugin(_bus, _cms, _di, _dqm, _soa, _iam),
  ];

  _engine = new RuleEngine({ plugins });
  await _engine.init();
  console.log('[integration] RuleEngine initialized with ESB, CMS, DI, DQM, SOA, IAM, and Bridge plugins');

  // 5. Set up multi-directional event bridge
  setupEventBridge(_bus, _cms, _di, _dqm, _soa, _iam);
  console.log('[integration] ESB ⇄ CMS ⇄ DI ⇄ DQM ⇄ SOA ⇄ IAM event bridge active');

  _initialized = true;
  console.log('[integration] Cross-module integration ready');
}

/**
 * Gracefully shut down all modules in reverse order.
 */
export async function shutdownIntegration(): Promise<void> {
  if (!_initialized) return;

  console.log('[integration] Shutting down cross-module integration...');

  if (_engine) {
    await _engine.shutdown();
    _engine = null;
  }

  if (_iam) {
    await _iam.shutdown();
    _iam = null;
  }

  if (_soa) {
    await _soa.shutdown();
    _soa = null;
  }

  if (_dqm) {
    await _dqm.shutdown();
    _dqm = null;
  }

  if (_di) {
    await _di.shutdown();
    _di = null;
  }

  if (_cms) {
    await _cms.shutdown();
    _cms = null;
  }

  if (_bus) {
    await _bus.shutdown();
    _bus = null;
  }

  _initialized = false;
  console.log('[integration] Integration shutdown complete');
}
