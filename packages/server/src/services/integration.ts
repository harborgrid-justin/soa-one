// ============================================================
// SOA One — Module Integration Service
// ============================================================
//
// Central wiring point that makes the Engine, ESB, CMS, DI,
// DQM, and SOA modules aware of each other. Creates singleton
// instances, registers cross-module plugins, and manages the
// lifecycle.
//
// Architecture:
//   ┌────────────┐
//   │ RuleEngine │◄── ESB + CMS + DI + DQM + SOA + Bridge Plugins
//   └────┬───────┘
//        │
//   ┌────┴──────────────────────────────────────┐
//   │            │              │          │     │
//   ▼            ▼              ▼          ▼     ▼
// ServiceBus   CMS     DataIntegrator   DQM   SOASuite
//   │            │              │          │     │
//   └──── Bridge (multi-directional) ───────────┘
// ============================================================

import { RuleEngine } from '@soa-one/engine';
import type { EnginePlugin } from '@soa-one/engine';
import { ServiceBus, createESBPlugin } from '@soa-one/esb';
import { ContentManagementSystem, createCMSPlugin } from '@soa-one/cms';
import { DataIntegrator, createDIPlugin } from '@soa-one/di';
import { DataQualityMessaging, createDQMPlugin } from '@soa-one/dqm';
import { SOASuite, createSOAPlugin } from '@soa-one/soa';
import { createBridgePlugin, setupEventBridge } from './bridge';

// ── Singleton Instances ─────────────────────────────────────

let _bus: ServiceBus | null = null;
let _cms: ContentManagementSystem | null = null;
let _di: DataIntegrator | null = null;
let _dqm: DataQualityMessaging | null = null;
let _soa: SOASuite | null = null;
let _engine: RuleEngine | null = null;
let _initialized = false;

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

/** Get the shared RuleEngine with ESB + CMS + DI + DQM + SOA plugins registered. */
export function getEngine(): RuleEngine {
  if (!_engine) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _engine;
}

/** Check if the integration layer is initialized. */
export function isIntegrationReady(): boolean {
  return _initialized;
}

// ── Lifecycle ───────────────────────────────────────────────

/**
 * Initialize all six modules and wire them together.
 *
 * 1. Creates ServiceBus, CMS, DataIntegrator, DQM, SOASuite, RuleEngine
 * 2. Registers ESB, CMS, DI, DQM, and SOA plugins with the engine
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

  // 2. Initialize modules
  await _bus.init();
  await _cms.init();
  await _di.init();
  await _dqm.init();
  await _soa.init();
  console.log('[integration] ESB, CMS, DI, DQM, and SOA initialized');

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

  // 4. Create engine with all plugins + bridge plugin
  const plugins: EnginePlugin[] = [
    createESBPlugin(_bus),
    createCMSPlugin(_cms),
    createDIPlugin(_di),
    createDQMPlugin(_dqm),
    createSOAPlugin(_soa),
    createBridgePlugin(_bus, _cms, _di, _dqm, _soa),
  ];

  _engine = new RuleEngine({ plugins });
  await _engine.init();
  console.log('[integration] RuleEngine initialized with ESB, CMS, DI, DQM, SOA, and Bridge plugins');

  // 5. Set up multi-directional event bridge
  setupEventBridge(_bus, _cms, _di, _dqm, _soa);
  console.log('[integration] ESB ⇄ CMS ⇄ DI ⇄ DQM ⇄ SOA event bridge active');

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
